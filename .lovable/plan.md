# Normalizar `tipo_entrada` em todos os caminhos de escrita

## Diagnóstico (varredura no código)

Confirmado: `'substituicao'` e `'substituicao_placa'` representam a mesma coisa em `cotacoes.tipo_entrada` / `contratos.tipo_entrada`, mas são gravados em pontos distintos sem normalização:

| Arquivo | Linha | O que grava hoje |
|---|---|---|
| `src/components/substituicao/ModalDetalhesSubstituicao.tsx` | 80 | URL param `tipo_entrada=substituicao` (alias, fonte do bug) |
| `src/components/cotacoes/CotacaoFormDialog.tsx` | 1804, 1835 | Ternário inline — OK no fluxo canônico, mas vulnerável quando `tipoCotacao` vier do URL acima |
| `src/components/contratos/ContratoWizard.tsx` | 798 | `tipo_entrada: tipoOperacao` cru |
| `src/components/associados/reativacao/ReativacaoWizard.tsx` | 233 | `'reativacao'` (valor diferente, OK) |
| `supabase/functions/contrato-gerar/index.ts` | 1018, 1192 | Já normaliza inline — vamos extrair para util |

Leitores tolerantes (`autentique-create`, `autentique-create-by-token`, `template-utils`) seguem aceitando ambos como rede de segurança.

Fora de escopo: `useVistoriaManutencao` / `vistoriaManutencao.ts` — `resultado='substituicao'` é substituição de RASTREADOR, domínio diferente.

## Mudanças

### 1. Util compartilhado (front)
**Novo:** `src/lib/cotacoes/tipoEntrada.ts`
```ts
export type TipoEntradaCanonico =
  | 'adesao' | 'inclusao' | 'migracao' | 'reativacao'
  | 'substituicao_placa' | 'troca_titularidade';

export function normalizarTipoEntrada(v: string | null | undefined): TipoEntradaCanonico | null {
  if (!v) return null;
  if (v === 'substituicao') return 'substituicao_placa';
  if (v === 'nova') return 'adesao';
  return v as TipoEntradaCanonico;
}
```

### 2. Util compartilhado (edge)
**Novo:** `supabase/functions/_shared/tipo-entrada.ts` — espelho exato (Deno-compatível).

### 3. Aplicar nos pontos de escrita
- **`ModalDetalhesSubstituicao.tsx:80`** — trocar `tipo_entrada: 'substituicao'` por `'substituicao_placa'` no URLSearchParams. Causa raiz.
- **`CotacaoFormDialog.tsx:1804, 1835`** — envolver o resultado do ternário com `normalizarTipoEntrada(...)`.
- **`ContratoWizard.tsx:798`** — `tipo_entrada: normalizarTipoEntrada(tipoOperacao)`.
- **`Cotacoes.tsx:286-288`** — aceitar ambos aliases ao ler URL param (`tipoEntrada === 'substituicao' || tipoEntrada === 'substituicao_placa'`).
- **`contrato-gerar/index.ts:1018`** — substituir ternário inline por `normalizarTipoEntrada()` do novo shared.

### 4. Migration (data backfill)
```sql
UPDATE public.cotacoes SET tipo_entrada = 'substituicao_placa'
  WHERE tipo_entrada = 'substituicao';
UPDATE public.contratos SET tipo_entrada = 'substituicao_placa'
  WHERE tipo_entrada = 'substituicao';
UPDATE public.cotacoes
  SET dados_extras = jsonb_set(dados_extras, '{tipo_entrada}', '"substituicao_placa"')
  WHERE dados_extras->>'tipo_entrada' = 'substituicao';
```
Sem CHECK constraint (valores legados de domínios paralelos podem existir); a normalização vira garantia via util.

### 5. Verificação
- `rg "'substituicao'" src --type ts` deve sobrar só nos leitores tolerantes (autentique/template-utils) e em `vistoriaManutencao` (outro domínio).
- Build TS passa.
- Query rápida pós-migration: `SELECT COUNT(*) FROM cotacoes WHERE tipo_entrada='substituicao'` deve dar 0.

## Fora de escopo
- Remover a tolerância dos leitores (defesa em profundidade fica).
- Renomear `'nova'` → `'adesao'` historicamente (só normaliza no novo write).
- Domínio `vistoria_manutencao.resultado='substituicao'`.
