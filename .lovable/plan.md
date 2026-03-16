

## Plano: Corrigir e Complementar Sistema de Pontuação de Consultores

### Contexto

A infraestrutura base existe: `comissoes_parametros` (com `troca_titularidade_peso_ranking = 0.5`), `fn_parametro_comissao()` helper SQL, `fn_fechamento_mensal_comissoes()`, `comissoes_ranking_mensal`. A tabela `consultores` foi dropada — o sistema usa `profiles` via `vendedor_id`. Há dois hardcodes de `0.5` e a substituição de placa não entra no ranking.

---

### 1. Migration: Criar tabela `pontuacao_eventos` + inserir parâmetros

```sql
-- Tabela de histórico granular de pontuação
CREATE TABLE IF NOT EXISTS pontuacao_eventos (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id     UUID          NOT NULL REFERENCES profiles(id),
  tipo_operacao   VARCHAR(60)   NOT NULL,
  pontos          DECIMAL(4,1)  NOT NULL,
  conta_ranking   BOOLEAN       NOT NULL DEFAULT TRUE,
  contrato_id     UUID          REFERENCES contratos(id),
  referencia_tipo VARCHAR(40),
  referencia_id   UUID,
  mes_referencia  DATE          NOT NULL DEFAULT date_trunc('month', NOW()),
  estornado       BOOLEAN       NOT NULL DEFAULT FALSE,
  estorno_id      UUID          REFERENCES pontuacao_eventos(id),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- RLS + policies
ALTER TABLE pontuacao_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pontuacao" ON pontuacao_eventos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Escrita pontuacao" ON pontuacao_eventos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Update pontuacao" ON pontuacao_eventos FOR UPDATE TO authenticated USING (true);

-- Índices
CREATE INDEX idx_pontuacao_vendedor ON pontuacao_eventos(vendedor_id);
CREATE INDEX idx_pontuacao_mes ON pontuacao_eventos(mes_referencia);
CREATE INDEX idx_pontuacao_contrato ON pontuacao_eventos(contrato_id);

-- Inserir parâmetros de pontuação (ON CONFLICT para não duplicar)
INSERT INTO comissoes_parametros (chave, valor, descricao, tipo_dado) VALUES
  ('pontos_nova_adesao',                 '1.0', 'Pontos por nova adesão confirmada (1º boleto pago)', 'numero'),
  ('pontos_substituicao_placa',          '0.5', 'Pontos por substituição de placa', 'numero'),
  ('pontos_reativacao_120_dias',         '1.0', 'Pontos por reativação após 120 dias', 'numero'),
  ('pontos_cancelamento_antes_1_boleto', '0.0', 'Cancelamento antes do 1º boleto — não conta', 'numero')
ON CONFLICT (chave) DO NOTHING;

-- troca_titularidade_peso_ranking já existe, renomear para consistência
UPDATE comissoes_parametros 
SET chave = 'pontos_troca_titularidade', 
    descricao = 'Pontos por troca de titularidade'
WHERE chave = 'troca_titularidade_peso_ranking';
```

### 2. Migration: Atualizar `fn_fechamento_mensal_comissoes` 

Corrigir duas coisas na function SQL:
- Substituir `* 0.5` hardcoded por `fn_parametro_comissao('pontos_troca_titularidade')`
- Somar pontos de substituição de placa (de `substituicoes_veiculo`) no cálculo de `vendas_liquidas`

Trecho da linha 532-556 atualizado:

```sql
-- No loop de vendedores, adicionar subquery para substituições:
(SELECT COALESCE(SUM(sv.pontos_consultor), 0)
 FROM substituicoes_veiculo sv
 JOIN contratos ct ON ct.id = sv.contrato_id
 WHERE sv.consultor_id = c.vendedor_id
   AND sv.status = 'efetivada'
   AND EXTRACT(MONTH FROM sv.efetivada_em) = v_campanha.mes
   AND EXTRACT(YEAR FROM sv.efetivada_em) = v_campanha.ano
) as pontos_substituicao

-- Na linha de vendas_liquidas (554):
v_vendedor.vendas_confirmadas - v_vendedor.vendas_canceladas 
  + (v_vendedor.trocas_titularidade * fn_parametro_comissao('pontos_troca_titularidade'))
  + v_vendedor.pontos_substituicao
```

### 3. Edge Function: `efetivar-substituicao/index.ts`

**Linha 238** — substituir hardcode por leitura dinâmica:

```typescript
// Buscar pontos da tabela de parâmetros
const { data: paramPontos } = await supabase
  .from('comissoes_parametros')
  .select('valor')
  .eq('chave', 'pontos_substituicao_placa')
  .eq('ativo', true)
  .maybeSingle();

const pontosConsultor = paramPontos ? parseFloat(paramPontos.valor) : 0.5;

// Usar valor dinâmico
await supabase.from('substituicoes_veiculo')
  .update({ comissao_creditada: true, pontos_consultor: pontosConsultor })
  .eq('id', substituicao_id);

// Registrar evento de pontuação
await supabase.from('pontuacao_eventos').insert({
  vendedor_id: substituicao.consultor_id,
  tipo_operacao: 'substituicao_placa',
  pontos: pontosConsultor,
  contrato_id: substituicao.contrato_id,
  referencia_tipo: 'substituicao',
  referencia_id: substituicao.id,
});
```

### 4. Edge Function: `asaas-webhook/index.ts`

**4a. Pontuar ao confirmar 1º boleto (adesão paga)**

Após as duas ocorrências de `adesao_paga: true` (linhas ~157 e ~405), adicionar:

```typescript
// Buscar vendedor_id do contrato
const { data: contratoVendedor } = await supabase
  .from('contratos')
  .select('vendedor_id')
  .eq('id', contratoId)
  .maybeSingle();

if (contratoVendedor?.vendedor_id) {
  const { data: paramPontos } = await supabase
    .from('comissoes_parametros')
    .select('valor')
    .eq('chave', 'pontos_nova_adesao')
    .eq('ativo', true)
    .maybeSingle();

  const pontos = paramPontos ? parseFloat(paramPontos.valor) : 1.0;

  await supabase.from('pontuacao_eventos').insert({
    vendedor_id: contratoVendedor.vendedor_id,
    tipo_operacao: 'nova_adesao',
    pontos,
    contrato_id: contratoId,
    referencia_tipo: 'cobranca',
    referencia_id: cobranca?.id || null,
  });
  
  console.log(`[asaas-webhook] Pontuação ${pontos} registrada para vendedor ${contratoVendedor.vendedor_id}`);
}
```

**4b. Estorno ao cancelar cotação por falta de pagamento (PAYMENT_OVERDUE com adesão)**

Na seção de cancelamento por adesão vencida (~linha 798), após cancelar a cotação, adicionar:

```typescript
// Estornar pontuação se existir
const { data: eventoOriginal } = await supabase
  .from('pontuacao_eventos')
  .select('id, pontos')
  .eq('contrato_id', cobranca.contrato_id)
  .eq('tipo_operacao', 'nova_adesao')
  .eq('estornado', false)
  .maybeSingle();

if (eventoOriginal) {
  // Criar evento de estorno
  await supabase.from('pontuacao_eventos').insert({
    vendedor_id: contratoVendedor.vendedor_id,
    tipo_operacao: 'estorno_cancelamento',
    pontos: eventoOriginal.pontos * -1,
    contrato_id: cobranca.contrato_id,
    referencia_tipo: 'estorno',
    referencia_id: eventoOriginal.id,
    estorno_id: eventoOriginal.id,
  });
  // Marcar original como estornado
  await supabase.from('pontuacao_eventos')
    .update({ estornado: true })
    .eq('id', eventoOriginal.id);
}
```

**4c. Pontuar reativação 120+ dias**

Na seção de 120+ dias (~linha 628), quando a reativação for aprovada manualmente, adicionar pontuação. Como hoje o webhook **não reativa** automaticamente em 120+ dias (só notifica), a pontuação será adicionada no fluxo futuro de reativação manual. Por ora, preparar o parâmetro e documentar o ponto de inserção.

### 5. Helper centralizado (TypeScript)

Criar `supabase/functions/_shared/pontuacao-helper.ts` com funções reutilizáveis:

```typescript
export async function getParametroPontuacao(supabase, chave: string, fallback: number): Promise<number>
export async function registrarEventoPontuacao(supabase, params): Promise<void>
export async function estornarEventoPontuacao(supabase, eventoId: string, vendedorId: string, contratoId: string): Promise<void>
```

Essas funções encapsulam a leitura de `comissoes_parametros` e inserção/estorno em `pontuacao_eventos`, evitando duplicação de código entre `efetivar-substituicao` e `asaas-webhook`.

---

### Arquivos afetados

| Arquivo | Alteração |
|---------|-----------|
| Nova migration SQL | Criar `pontuacao_eventos`, inserir parâmetros, renomear chave |
| Nova migration SQL | Recriar `fn_fechamento_mensal_comissoes` com leitura dinâmica + substituições |
| `supabase/functions/_shared/pontuacao-helper.ts` | Novo helper centralizado |
| `supabase/functions/efetivar-substituicao/index.ts` | Remover 0.5 hardcoded, usar helper |
| `supabase/functions/asaas-webhook/index.ts` | Adicionar pontuação em adesão paga + estorno em cancelamento |

### O que NÃO será alterado

- `comissoes_ranking_mensal` (tabela mantida)
- Frontend de ranking (`ComissoesRankingTab.tsx`, `TabRanking.tsx`)
- Ranking de propostas (`usePropostasMetricas.ts`)

