

## Plano: Assinatura em todas as páginas do documento Autentique

### Diagnóstico

Identifiquei dois problemas no fluxo:

**1. Anexos sem bloco de assinatura no HTML**
Os templates anexados (Regulamento, Manual 24h, etc.) são inseridos como `<div>` com conteúdo puro — sem nenhum bloco visual de assinatura (linhas 678-686 em `autentique-create` e 537-544 em `autentique-create-by-token`). O `sanitizeSignatureBlocks` remove blocos de assinatura dos templates, e o `generateSecaoAssinatura` só é chamado uma vez para o documento principal, antes dos anexos.

**2. Posição fixa da assinatura Autentique**
O `gerarPosicoesAssinatura` coloca INITIALS em (78%, 95%) — sempre no rodapé. Nas páginas que têm um bloco visual reservado para assinatura (com linha, nome, CPF), a assinatura digital deveria coincidir com esse bloco, mas aparece deslocada no rodapé.

### Correção

**1. `supabase/functions/_shared/template-utils.ts`**
- Criar função `generateAssinaturaAnexo(dados)` — versão compacta do bloco de assinatura para anexos (Local/Data + linha + Nome/CPF do associado)

**2. `supabase/functions/autentique-create/index.ts` (linhas 678-686)**
- No loop de anexos, após substituir variáveis:
  - Aplicar `sanitizeSignatureBlocks` no conteúdo do anexo
  - Verificar com `hasSignatureArea` se o conteúdo original tinha área de assinatura
  - Sempre adicionar `generateAssinaturaAnexo(templateData)` ao final de cada anexo
- Isso garante que cada anexo tenha seu próprio bloco visual de assinatura

**3. `supabase/functions/autentique-create-by-token/index.ts` (linhas 537-544)**
- Mesma correção do ponto 2

**4. `supabase/functions/_shared/autentique-positions.ts`**
- Adicionar suporte a posições diferenciadas por página:
  - Páginas com bloco de assinatura visual: posicionar INITIALS/SIGNATURE nas coordenadas do bloco (ex: x=65%, y=85%)
  - Páginas sem bloco: manter posição padrão no rodapé (x=78%, y=95%)
- Como não é possível saber exatamente quais páginas do PDF terão o bloco, usar a abordagem: colocar **SIGNATURE** (assinatura completa) em **todas** as páginas em vez de INITIALS, posicionada no rodapé. O Autentique garante que cada página é assinada independentemente da posição do bloco visual.

### Resultado esperado

```text
Documento no Autentique:
┌──────────────────────┐
│ Termo de Filiação    │
│ (conteúdo)           │
│ _____ ASSINATURA ___ │ ← bloco visual + assinatura digital
├──────────────────────┤
│ REGULAMENTO          │
│ (conteúdo)           │
│ _____ ASSINATURA ___ │ ← bloco visual adicionado + assinatura digital
├──────────────────────┤
│ MANUAL 24H           │
│ (conteúdo)           │
│ _____ ASSINATURA ___ │ ← bloco visual adicionado + assinatura digital
└──────────────────────┘
```

### Arquivos
- **Editar**: `supabase/functions/_shared/template-utils.ts` (nova função `generateAssinaturaAnexo`)
- **Editar**: `supabase/functions/_shared/autentique-positions.ts` (SIGNATURE em todas as páginas)
- **Editar**: `supabase/functions/autentique-create/index.ts` (inserir assinatura nos anexos)
- **Editar**: `supabase/functions/autentique-create-by-token/index.ts` (mesma correção)
- **Deploy**: as 4 edge functions afetadas

