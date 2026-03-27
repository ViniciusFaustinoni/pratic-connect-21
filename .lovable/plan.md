

# Remover a Palavra "Contrato" dos Termos Gerados

## Problema

No cabeçalho dos documentos gerados via `template-utils.ts`, aparece **"Contrato Nº CTR-..."**. O correto é exibir apenas **"Nº CTR-..."** (sem a palavra "Contrato"), como já é feito no `termo-afiliacao-template.ts` e no `TermoFiliacaoTemplate.tsx`.

## Alteração

### `supabase/functions/_shared/template-utils.ts`

- **Linha 730**: `Contrato Nº ${dados.contrato.numero}` → `Nº ${dados.contrato.numero}`

Este é o único arquivo onde a palavra "Contrato" ainda precede o número no cabeçalho dos termos. Os demais templates já usam apenas `Nº`.

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `supabase/functions/_shared/template-utils.ts` | Remover "Contrato" da linha 730 |

