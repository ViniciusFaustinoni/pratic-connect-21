

# Plano: Eliminar hardcodes de regra de negócio (11 correções + inserts + nova tabela)

## PARTE 1 — Inserir registros na tabela `configuracoes` (insert tool)

Inserir 11 registros:

| chave | valor | tipo | categoria |
|-------|-------|------|-----------|
| carencia_dias_padrao | 120 | numero | operacional |
| carencia_dias_migracao | 0 | numero | operacional |
| multa_rastreador | 400 | moeda | operacional |
| taxa_repasse_volante | 50 | moeda | operacional |
| taxa_substituicao_placa | 50 | moeda | operacional |
| taxa_revistoria | 50 | moeda | operacional |
| taxa_troca_titularidade | 50 | moeda | operacional |
| cota_participacao_default | 6 | numero | atuarial |
| cota_minima_default | 1200 | moeda | atuarial |
| cota_desagio_default | 8 | numero | atuarial |
| cota_minima_desagio_default | 2000 | moeda | atuarial |

Nota: `cota_participacao_default` e `cota_minima_default` podem já existir (hooks já referenciam). Será usado INSERT ON CONFLICT para não duplicar.

## PARTE 2 — Criar tabela `faixas_producao` (migration)

```sql
CREATE TABLE IF NOT EXISTS faixas_producao (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  placas_min integer NOT NULL,
  placas_max integer,
  valor_bonus numeric NOT NULL,
  descricao text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE faixas_producao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read faixas_producao" ON faixas_producao FOR SELECT TO authenticated USING (true);
```

Depois, inserir 6 registros via insert tool:
- (30, 39, 500), (40, 49, 700), (50, 59, 1000), (60, 79, 1500), (80, 99, 2000), (100, NULL, 3000)

## PARTE 3 — Correções de código (11 arquivos)

### CORREÇÃO 1 — `src/components/eventos/EmitirParecerModal.tsx`
- Adicionar `import { useConfiguracaoNumero } from '@/hooks/useConteudosSistema'`
- Dentro do componente: `const { data: limiteDanoParcial = 0.75 } = useConfiguracaoNumero('limite_dano_parcial_fipe', 0.75)`
- Substituir 4 ocorrências de `* 0.75` por `* limiteDanoParcial` (linhas 100, 137, 154, 184)

### CORREÇÃO 2 — `supabase/functions/efetivar-substituicao/index.ts`
- No início, buscar da tabela configuracoes:
  ```ts
  const { data: cfgCarencia } = await supabase.from('configuracoes').select('valor').eq('chave','carencia_dias_padrao').single()
  const carenciaDias = cfgCarencia ? parseInt(cfgCarencia.valor) : 120
  ```
- Substituir todos os `120` hardcoded (linhas 113, 120, 125, 127, 246, 259) por `carenciaDias`
- Lógica migração: verificar `substituicao.is_migracao` — se true, buscar `carencia_dias_migracao` (valor 0)

### CORREÇÃO 3 — `src/components/substituicao/StepFinanceiro.tsx`
- Adicionar `import { useConfiguracaoNumero } from '@/hooks/useConteudosSistema'`
- `const { data: carenciaDias = 120 } = useConfiguracaoNumero('carencia_dias_padrao', 120)`
- Linha 175: `addDays(dataEfetivacao, 120)` → `addDays(dataEfetivacao, carenciaDias)`
- Linha 226: `carencia_dias: 120` → `carencia_dias: carenciaDias`
- Linhas 511, 513, 569: substituir textos "120" pelo valor dinâmico `{carenciaDias}`

### CORREÇÃO 4 — `src/components/eventos/NovoSinistroModal.tsx`
- Adicionar `useConfiguracaoNumero` import
- `const { data: carenciaDias = 120 } = useConfiguracaoNumero('carencia_dias_padrao', 120)`
- Linha 1120: `carência de 120 dias` → `carência de ${carenciaDias} dias`

### CORREÇÃO 5 — `src/types/retirada.ts`
- Remover `export const VALOR_MULTA_NAO_DEVOLUCAO = 400.00`
- Não pode usar hook em arquivo de types → criar hook `useMultaRastreador` em `useConteudosSistema.ts`:
  ```ts
  export function useMultaRastreador() {
    return useConfiguracaoNumero('multa_rastreador', 400);
  }
  ```

### CORREÇÃO 6 — `supabase/functions/notificar-retirada-whatsapp/index.ts`
- Buscar `multa_rastreador` da tabela configuracoes antes de montar mensagem
- Substituir `multa de R$400` pelo valor dinâmico

### CORREÇÃO 7 — `src/pages/instalador/ExecutarRetirada.tsx`
- Importar `useMultaRastreador` e usar no componente
- Linha 751: `Multa de R$ 400,00` → dinâmico

### Correções adicionais em componentes que importam `VALOR_MULTA_NAO_DEVOLUCAO`:
- `src/components/monitoramento/retirada/AplicarMultaModal.tsx` — usar `useMultaRastreador()`
- `src/components/monitoramento/retirada/TratarAusenciaRetiradaModal.tsx` — usar `useMultaRastreador()`
- `src/components/cadastro/RastreadorVinculadoModal.tsx` — usar `useMultaRastreador()`

### CORREÇÃO 8 — Edge functions (termo-afiliacao)
- `supabase/functions/_shared/termo-afiliacao-utils.ts` linha 333-334: `|| 10` → buscar de configuracoes `cota_participacao_default` (fallback 6), `|| 3000` → buscar `cota_minima_default` (fallback 1200)
- `supabase/functions/_shared/termo-afiliacao-template.ts` linha 540, 545: mesma correção
- `supabase/functions/_shared/template-utils.ts` linha 99, 101: mesma correção
- Cada uma dessas funções recebe `supabase` client — buscar config no início

### CORREÇÃO 9 — `supabase/functions/aprovar-sinistro/index.ts` e `autentique-webhook/index.ts`
- Linha 87-88 e 507-508: `|| 6` → buscar `cota_participacao_default`, `|| 1200` → buscar `cota_minima_default`

### CORREÇÃO 10 — `src/hooks/usePlanosCotacao.ts`
- Adicionar hooks: `useCotaDesagioDefault` e `useCotaMinimaDesagioDefault` em `useConteudosSistema.ts`
- Linha 229: `|| 8` → usar valor do hook
- Linha 230: `|| 3000` → usar valor do hook (correto: 2000)

### CORREÇÃO 11 — `src/components/comissoes/vendedor/TabProducao.tsx`
- Remover array `FAIXAS_PRODUCAO` hardcoded
- Buscar da nova tabela `faixas_producao` via useQuery
- Mover `getFaixaAtual` e `getProximaFaixa` para usar dados do banco

### CORREÇÃO adicional — `src/components/substituicao/StepBeneficios.tsx`
- Linha 120: `carência de 120 dias` → dinâmico via `useConfiguracaoNumero`

## Arquivos que NÃO serão tocados
- `DesligamentoModal.tsx` (FGTS/CLT)
- `comissoes.ts` (label cosmético)
- `executar-regua-cobranca/index.ts` (aguardando decisão)

## Resumo de entregas
- 11 registros inseridos em `configuracoes`
- 1 tabela `faixas_producao` criada + 6 registros
- ~18 arquivos alterados
- 2 novos hooks em `useConteudosSistema.ts` (`useMultaRastreador`, `useCotaDesagioDefault`, `useCotaMinimaDesagioDefault`, `useCarenciaDiasPadrao`)

