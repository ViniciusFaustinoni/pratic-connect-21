

## PLANO: PARTE 5 — VISÃO DO VENDEDOR, AUTOMAÇÃO E INTEGRAÇÃO ASAAS

### 1. ARQUITETURA ATUAL ANALISADA

**Estrutura de dados existente:**
- Hook `useMinhasComissoes.ts`: 4 queries básicas (comissoes, resumoMensal, ultimosPagamentos, totalAcumulado)
- Página `MinhasComissoes.tsx`: Layout simples com 4 KPIs + tabs de status
- BD: Tabelas de comissoes, comissoes_recorrentes, comissoes_deducoes, comissoes_ranking_mensal, comissoes_crescimento_log já existem (Parte 1)
- SQL: Funções `fn_tipo_consultor()`, `fn_tempo_casa_consultor()`, `fn_placas_ativas_consultor()` já existem
- Edge Functions: Padrão estabelecido com Supabase client direto, CORS headers, service role key

**Padrões de código identificados:**
- React Query (useQuery, useMutation) com queryKey estruturado e cacheamento
- Supabase RPC para funções PostgreSQL complexas
- Edge Functions usando Deno com `serve()` e CORS
- Toast notifications via Sonner para feedback
- Formatação pt-BR para moeda e datas

---

### 2. PASSO 1: ESTENDER HOOK USEMIN

HASCOMISSOES.TS

**Novas queries a adicionar:**

1. **meuResumoMensal(mes, ano)**: 
   - `SELECT tipo_comissao, COUNT(*), SUM(valor_total) FROM comissoes WHERE vendedor_id=? AND mes=? AND ano=?`
   - Agrupa por tipo_comissao → retorna array com { tipo, quantidade, valor_total }
   - Habilitar com `enabled: !!mes && !!ano`

2. **meuRanking(mes, ano)**:
   - Query em `comissoes_ranking_mensal` com JOIN `comissoes_campanhas`
   - Filter: vendedor_id + campanha(mes, ano)
   - Retorna: { posicao_ranking, vendas_liquidas, valor_premio, total_participantes }
   - Se não houver ranking/campanha: retorna null (não erro)

3. **meuRecorrente(mes, ano)**:
   - Query em `comissoes_recorrentes` where vendedor_id + mes + ano
   - Retorna única linha: { placas_ativas, total_boletos_pagos, percentual_aplicado, valor_recorrente }

4. **minhasDeducoes(mes, ano)**:
   - Query em `comissoes_deducoes` where vendedor_id + aplicada_em between start/end
   - Retorna array: { id, tipo, descricao, contrato_id, associado_id, valor, aplicada_em }
   - ORDER BY aplicada_em DESC

5. **meuCrescimento**:
   - Query em `comissoes_crescimento_log` where vendedor_id
   - Retorna array: { marco_placas, data_atingido, valor_pago, percentual_recorrente_garantido }
   - ORDER BY marco_placas ASC
   - Não precisa de mes/ano (histórico completo)

6. **meuHistorico(meses=12)**:
   - Query last 12 months de `comissoes`
   - GROUP BY mes_referencia, ano_referencia
   - Retorna: { mes, ano, vendas_confirmadas (count), adesao, recorrente, producao, ranking, crescimento, deducoes, total, status }

7. **minhasMetas(mes, ano)**:
   - Query em `metas_vendas` (tabela que pode não existir — verificar se existe, se não, retornar null)
   - Se existir: { meta_leads, meta_cotacoes, meta_contratos, meta_valor, realizado_leads, realizado_cotacoes, realizado_contratos, realizado_valor }

**Nova mutation:**

- **contestarComissao(id, motivo)**:
  - UPDATE comissoes SET contestada=true, contestada_em=now(), contestacao_motivo=motivo WHERE id=?
  - Invalidate queryKey: ['minhas-comissoes']
  - Toast: "Comissão marcada como contestada"

**Padrão a seguir:**
- Mesma estrutura que queries existentes (enabled, error handling, queryKey)
- userID vem de `useAuth()` em TODAS as queries
- Validar que mes/ano são válidos (1-12, ano >= 2020)

---

### 3. PASSO 2: REFORMAR MINHASCOMISSOES.TSX

**Nova estrutura da página:**

**Header:**
- h1: "Minhas Comissões" (Wallet icon)
- Select: Mês/Ano com default = mês atual
- Badge: Tipo consultor (interno/externo) — derivado de `fn_tipo_consultor()` via RPC chamado 1x ao carregar
- Breadcrumb: Vendas > Minhas Comissões (adicionar link)

**Seção 1: Resumo do Mês (4 Cards KPI, sempre visível)**
- "Total do Mês": SUM de todas as comissões | DollarSign ícone | cor verde | texto grande
- "Vendas Confirmadas": COUNT de adesões | ShoppingCart ícone | cor blue
- "Placas Ativas": valor de `fn_placas_ativas_consultor()` | Car ícone | cor purple
- "Posição Ranking": meuRanking.posicao_ranking | Trophy ícone | cor gold se top 3, senão gray

**Seção 2: Detalhamento (6 Tabs usando Shadcn Tabs)**

**Tab 1: "Bonificação Adesão" (condicional: só se internal):**
- 3 Cards informativos:
  1. Vendas no mês (contagem) | Próxima faixa (incentivo de +2 vendas) | Faixa atingida (%)
  2. Valor total adesões (R$) | Valor bruto após percentual | Deduções do mês (R$ + lista inline)
  3. Antecipado 10% (R$) | **TOTAL LÍQUIDO 1ª FASE (R$ grande em verde)**

- Barra de progresso visual:
  - `<Progress>` mostrando posição nas faixas
  - Texto: "Faltam X vendas para atingir Y%"

- Tabela de vendas individuais (scroll horizontal):
  | # | Associado | Placa | Adesão | Tipo Atend. | Dedução | Líquido |
  - Linhas de comissoes_adesao do mês

**Tab 2: "Recorrente" (condicional: só se placas >= 10 para interno, sempre para externo):**
- Card:
  - Placas ativas (número)
  - Faixa atual (X placas = Y%)
  - Próxima faixa (incentivo)
  - Total boletos pagos (mês anterior) em R$
  - **VALOR RECORRENTE (R$ grande)**
  - Se interno: "Mínimo garantido: Z%" (se existe em crescimento_log)

- Barra de progresso (se interno e < 10 placas):
  - "Você precisa de X placas ativas para habilitar o recorrente"
  - Progress bar até 10

**Tab 3: "Produção" (condicional: só se externo):**
- Card:
  - Placas confirmadas (contagem)
  - Faixa atingida (X placas = R$ valor)
  - Próxima faixa (incentivo)
  - **VALOR PRODUÇÃO (R$)**

- Se < 30 placas:
  - "Faltam X placas para habilitar bonificação de produção"
  - Progress bar até 30

**Tab 4: "Ranking":**
- Card de destaque:
  - Se top 3: emoji grande (🥇🥈🥉) + "Parabéns!" + posição
  - Se não: posição + "Faltam X vendas para alcançar 3º lugar"

- Tabela pública (sem valores de prêmios de outros, só do vendedor):
  | # | Vendedor | Vendas Líquidas |
  - Apenas nomes (sem valores/avatar de outros)
  - Destacar linha do vendedor com bg-highlight

- Info: "Faixa: X placas | Seu Prêmio: R$ Y (se aplicável)"

**Tab 5: "Crescimento":**
- Visual tipo "achievement tracker":
  - Marcos em cards lado a lado: 100, 200, 300, 400, 500, 600 placas
  - Atingido: green badge + valor recebido
  - Próximo: yellow badge + "Faltam X"
  - Futuros: gray badge (disabled)

- Informação:
  - Base ativa atual: X placas
  - Próximo marco: Y placas (faltam Z)
  - Recorrente mínimo garantido: W%

**Tab 6: "Histórico":**
- LineChart (Recharts):
  - X: últimos 12 meses
  - Y1: Total comissões (verde)
  - Y2 (secondary axis): Vendas confirmadas (azul, scaled)

- Tabela:
  | Mês/Ano | Vendas | Adesão | Recorrente | Produção | Ranking | Crescimento | Deduções | Total | Status |
  - Badge de status: paga (green), aprovada (blue), pendente (gray)
  - ORDER BY ano DESC, mes DESC

**Tab 7: "Deduções":**
- Tabela completa do mês:
  | Tipo | Descrição | Associado | Contrato | Valor | Data |
  - Badge de tipo colorido:
    - repasse_volante: gray
    - taxa_cartao: blue
    - cancelamento: red
    - inadimplencia: orange
    - fraude: dark-red

- Resumo gráfico:
  - Pie chart pequeno (Recharts): distribuição por tipo
  - "Total deduções do mês: R$ X"

**Seção 3: Contestação (inline em cada comissão)**
- Em cada comissão pendente: Botão "Contestar"
- Dialog: Campo textarea (motivo) + Botão enviar
- Ao enviar: Mark como contestada, badge yellow "Contestada"
- Se respondido: Mostrar resposta da gerência em dialog

**Design:**
- Clean, números grandes e destacados
- Cores motivacionais: verde (valores), blue (meta/ranking)
- Mobile-first: cards/tabs empilham
- Barras de progresso = incentivo visual
- Sem dados de outros vendedores (exceto ranking público limitado)

---

### 4. PASSO 3: EDGE FUNCTION CALCULAR-COMISSOES-MENSAIS

**Localização:** `supabase/functions/calcular-comissoes-mensais/index.ts`

**Lógica:**

1. **Determinar mês/ano:**
   - Mês anterior (e.g., se hoje é fev, processar jan)
   - `const agora = new Date(); const mes = agora.getMonth() === 0 ? 12 : agora.getMonth(); const ano = agora.getMonth() === 0 ? agora.getFullYear() - 1 : agora.getFullYear();`

2. **Processar mês anterior:**
   - Buscar campanha do mês anterior
   - Se `status === 'aberta'`: chamar `fn_fechamento_mensal_comissoes` via RPC
   - Registrar resultado

3. **Criar campanha mês atual:**
   - Verificar se campanha já existe para mês/ano atual
   - Se não existir: INSERT nova com `status='aberta'` e datas corretas

4. **Apuração de inadimplência (60 dias):**
   - Buscar `asaas_cobrancas` com:
     - `tipo='mensalidade'`
     - `status IN ('PENDING', 'OVERDUE')`
     - `data_vencimento <= (hoje - 60 dias)`
     - `mes_referencia <= 2`
   - Para cada cobrança não-duplicada: INSERT deducao com tipo='inadimplencia_2_boletos'
   - Vincular ao vendedor via contratos join

5. **Retornar resultado:**
   - JSON com timestamp, resultados de cada etapa, erros (se houver)

**Padrão Deno:**
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { /* ... */ };
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  // ... lógica ...
  return new Response(JSON.stringify({ success, data }), { headers: corsHeaders });
});
```

---

### 5. PASSO 4: INTEGRAÇÃO WEBHOOK ASAAS

**Modificação em:** `supabase/functions/asaas-webhook/index.ts`

**Após processar evento de pagamento (linha 200+, após UPDATE de asaas_cobrancas):**

```typescript
if (payment.status === 'RECEIVED' || payment.status === 'CONFIRMED') {
  if (cobranca.tipo === 'mensalidade') {
    // 1. Chamar função para incrementar boletos
    await supabase.rpc('fn_incrementar_boletos_associado', {
      p_associado_id: cobranca.associado_id
    });
    
    // 2. Se primeiro boleto, registrar data
    if (cobranca.mes_referencia === 1) {
      await supabase
        .from('associados')
        .update({ data_primeiro_boleto_pago: new Date().toISOString() })
        .eq('id', cobranca.associado_id)
        .is('data_primeiro_boleto_pago', null);
    }
  }
}
```

**Nova função SQL:** `fn_incrementar_boletos_associado(p_associado_id UUID)`
```sql
CREATE OR REPLACE FUNCTION fn_incrementar_boletos_associado(p_associado_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE associados 
  SET qtd_boletos_pagos = COALESCE(qtd_boletos_pagos, 0) + 1,
      updated_at = now()
  WHERE id = p_associado_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### 6. PASSO 5: CONFIGURAR CRON

**No Supabase Dashboard > Database > Extensions:**

1. Habilitar `pg_cron` (se já não estiver)
2. Executar SQL (em Run SQL):

```sql
SELECT cron.schedule(
  'calcular-comissoes-mensais',
  '0 3 1 * *',
  $$
    SELECT
      net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/calcular-comissoes-mensais',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
      ) as request_id;
  $$
);
```

**Se pg_cron não disponível:**
- Instruir usuário a ir em Dashboard > Database > Extensions e ativar
- Ou usar alternativa: configurar em app via mutation + schedule com date-fns

---

### 7. VALIDAÇÃO ESPERADA

✅ Hook estendido com 7 queries + 1 mutation (sem quebrar existentes)
✅ MinhasComissoes renderiza com 7 tabs (1 condicional por tipo)
✅ KPIs mostram dados reais
✅ Barras de progresso calculam corretamente (faixas adesão/recorrente/produção)
✅ Ranking mostra posição do vendedor com privacidade
✅ Histórico mostra 12 meses com gráfico Recharts
✅ Contestação abre dialog + salva no BD
✅ Edge Function compila e não tem erros de import
✅ Função `fn_incrementar_boletos_associado` criada
✅ Webhook ASAAS integrado (lógica ADICIONADA, não substituída)
✅ CRON agendado (ou instruções fornecidas)
✅ Todas as 3 páginas funcionam: Comissoes (gerência), MinhasComissoes (vendedor), ComissoesConfig (config)

---

### 8. RISCOS TÉCNICOS

⚠️ **Query N+1 em meuHistorico:** Pode ser lento se usar loop. Usar aggregation SQL.
⚠️ **Tabela metas_vendas pode não existir:** Verificar antes de query, retornar null se não.
⚠️ **CRON timezone:** Postgres usa UTC por padrão. Dia 1 00:00 UTC = dia anterior em BR.
⚠️ **RLS policies:** Vendedor só deve ver suas comissões (RLS garante via vendedor_id).
⚠️ **Formatação de data em queries:** JavaScript getMonth é 0-indexed, SQL 1-indexed.

