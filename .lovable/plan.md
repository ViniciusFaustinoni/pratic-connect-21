

# Corrigir Dados da API Não Exibidos no Painel do Associado

## Problema

Dois problemas distintos:

1. **API descarta campos enviados**: Os campos `telefone_secundario`, `data_adesao`, `codigo_hinova`, `sincronizado_hinova`, `sincronizado_hinova_em` não estão na lista `optionalFields` da edge function, então são silenciosamente ignorados no INSERT.

2. **Painel não exibe campos novos**: O detalhe do associado não mostra `cnh_numero`, `cnh_categoria`, `data_cadastro_sga`. O campo "CNH vence" lê de `contrato.cliente_cnh_validade` em vez de `associado.cnh_validade`.

## Alterações

### 1. `supabase/functions/api-externa/index.ts`

Adicionar à lista `optionalFields`:
- `telefone_secundario`
- `data_adesao`
- `codigo_hinova`
- `sincronizado_hinova`
- `sincronizado_hinova_em`

### 2. `src/components/associados/detalhe/AssociadoResumoTab.tsx`

- **CNH vence**: Priorizar `associado.cnh_validade` sobre `contrato.cliente_cnh_validade`

### 3. `src/pages/cadastro/AssociadoDetalhe.tsx` — Aba "Dados Pessoais"

Adicionar na seção de dados pessoais:
- **CNH**: Número (`cnh_numero`), Categoria (`cnh_categoria`), Validade (`cnh_validade`)
- **Data cadastro SGA** (`data_cadastro_sga`)
- **Código Hinova** (`codigo_hinova`)

### 4. `src/components/api-docs/apiEndpoints.ts`

Documentar os campos adicionados: `telefone_secundario`, `data_adesao`, `codigo_hinova`, `sincronizado_hinova`, `sincronizado_hinova_em`.

## Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/api-externa/index.ts` | Adicionar 5 campos faltantes ao `optionalFields` |
| `src/components/associados/detalhe/AssociadoResumoTab.tsx` | CNH vence usar `associado.cnh_validade` |
| `src/pages/cadastro/AssociadoDetalhe.tsx` | Exibir CNH, data SGA, código Hinova na aba dados |
| `src/components/api-docs/apiEndpoints.ts` | Documentar novos campos opcionais |

