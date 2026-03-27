

# Corrigir Nome da Empresa no Termo de Filiação

## Problema

O nome "ABP PRATICCAR" e "ASSOCIAÇÃO DE BENEFÍCIOS PRATICCAR" aparecem no termo de filiação. O correto é **"ASSOCIAÇÃO DE PROTEÇÃO PATRIMONIAL PARA MOTORISTAS DE APLICATIVO PRATICCAR"**.

## Alterações

### 1. `src/components/cadastro/TermoFiliacaoTemplate.tsx` (React/PDF)

- Linha 110: `ABP PRATICCAR` → `PRATICCAR`
- Linha 113: `ASSOCIAÇÃO DE BENEFÍCIOS PRATICCAR` → `ASSOCIAÇÃO DE PROTEÇÃO PATRIMONIAL PARA MOTORISTAS DE APLICATIVO PRATICCAR`
- Linha 418: `ABP PraticCar é uma ASSOCIAÇÃO DE SOCORRO MÚTUO` → `PRATICCAR é uma ASSOCIAÇÃO DE PROTEÇÃO PATRIMONIAL PARA MOTORISTAS DE APLICATIVO`
- Linha 493: `ASSOCIAÇÃO DE BENEFÍCIOS PRATICCAR` → `ASSOCIAÇÃO DE PROTEÇÃO PATRIMONIAL PARA MOTORISTAS DE APLICATIVO PRATICCAR`
- Linha 495: `ABP PRATICCAR` → `PRATICCAR`
- Demais referências a `ABP PraticCar` no corpo do template (declarações 5.1, 5.8, 5.9, 6.x) → substituir por `PRATICCAR`

### 2. `supabase/functions/_shared/termo-afiliacao-template.ts` (Edge Function HTML)

- Linha 290: `ABP PRATICCAR` → `PRATICCAR`
- Linha 292: `ASSOCIAÇÃO DE BENEFÍCIOS PRATICCAR` → `ASSOCIAÇÃO DE PROTEÇÃO PATRIMONIAL PARA MOTORISTAS DE APLICATIVO PRATICCAR`
- Todas as referências a `ABP PraticCar` no corpo das declarações → `PRATICCAR`

### 3. `supabase/functions/_shared/termo-afiliacao-utils.ts` (defaults)

- Linha 455: fallback `"ABP PraticCar"` → `"PRATICCAR"`
- Linha 456: fallback `"Associação de Benefícios PraticCar"` → `"ASSOCIAÇÃO DE PROTEÇÃO PATRIMONIAL PARA MOTORISTAS DE APLICATIVO PRATICCAR"`

### 4. `supabase/functions/_shared/template-utils.ts` (defaults)

- Linha 176: fallback `'ASSOCIAÇÃO DE BENEFÍCIOS PRATICCAR'` → `'ASSOCIAÇÃO DE PROTEÇÃO PATRIMONIAL PARA MOTORISTAS DE APLICATIVO PRATICCAR'`
- Linha 726: fallback `'ASSOCIAÇÃO DE BENEFÍCIOS PRATICCAR'` → `'ASSOCIAÇÃO DE PROTEÇÃO PATRIMONIAL PARA MOTORISTAS DE APLICATIVO PRATICCAR'`

### 5. `src/components/documentos/templatePreviewData.ts`

- Linha 100: `'empresa.nome'` preview → `'ASSOCIAÇÃO DE PROTEÇÃO PATRIMONIAL PARA MOTORISTAS DE APLICATIVO PRATICCAR'`

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `src/components/cadastro/TermoFiliacaoTemplate.tsx` | Atualizar nome da empresa em todos os pontos |
| `supabase/functions/_shared/termo-afiliacao-template.ts` | Atualizar nome nos headers e declarações |
| `supabase/functions/_shared/termo-afiliacao-utils.ts` | Atualizar fallbacks do nome |
| `supabase/functions/_shared/template-utils.ts` | Atualizar fallbacks do nome |
| `src/components/documentos/templatePreviewData.ts` | Atualizar preview do nome da empresa |

