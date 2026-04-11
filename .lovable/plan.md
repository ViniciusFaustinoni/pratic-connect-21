
## Plano: consolidar a assinatura completa apenas na última página real do termo

### Diagnóstico
Há dois problemas combinados no fluxo atual:

1. O sistema ainda usa `assinatura_total_paginas = 20` na tabela `configuracoes` e envia a `SIGNATURE` fixa para a página 20. Se o documento real tiver menos páginas, a Autentique ignora essa posição e a última página real fica sem assinatura completa.
2. Ainda existem blocos visuais/manuais de assinatura em alguns geradores/templates. Isso explica:
   - “token”/carimbo visual aparecendo no meio do texto
   - locais que parecem pedir assinatura completa, mas não recebem a assinatura Autentique
   - ausência da consolidação final correta

As rubricas estão corretas porque `INITIALS` nas páginas intermediárias está funcionando; o erro está na determinação da última página e na limpeza incompleta dos blocos manuais.

### Alterações
**1. `supabase/functions/_shared/autentique-positions.ts`**
- Refatorar para gerar posições com base na **última página real do documento**
- Manter `INITIALS` nas páginas 1..N-1
- Colocar `SIGNATURE` apenas na página N
- Remover a dependência prática do valor fixo `20` como “última página”

**2. `supabase/functions/autentique-create/index.ts`**
- Ajustar a criação do documento para determinar a página final real antes de montar `positions`
- Garantir que a posição de assinatura completa use a última página válida do HTML final, incluindo anexos/aditivos

**3. `supabase/functions/autentique-create-by-token/index.ts`**
- Aplicar a mesma correção do item anterior no fluxo público
- Garantir consistência entre geração interna e pública

**4. `supabase/functions/_shared/template-utils.ts`**
- Fortalecer `sanitizeSignatureBlocks()` para remover mais padrões de assinatura manual/remanescente dos templates ativos
- Cobrir melhor:
  - linhas “Local / Data”
  - blocos com nome + CPF/CNPJ em contexto de assinatura
  - cabeçalhos “ASSINATURA” sem campos reais
  - placeholders/estruturas que ainda empurram o carimbo para dentro do texto

**5. Revisão dos geradores com assinatura visual embutida**
- Remover/neutralizar blocos finais de assinatura visual onde ainda existem, especialmente nos fluxos que montam HTML manualmente
- Arquivos já identificados para revisão:
  - `supabase/functions/_shared/termo-afiliacao-template.ts`
  - `supabase/functions/autentique-evento-create/index.ts`
  - `supabase/functions/autentique-os-saida-create/index.ts`
  - `supabase/functions/autentique-cancelamento-create/index.ts`
  - verificar se há resquícios similares em outros criadores Autentique

### Resultado esperado
- Todas as rubricas continuam nas páginas intermediárias
- A assinatura completa aparece somente na **última página real**
- A última página passa a concentrar corretamente as assinaturas necessárias
- Não haverá mais blocos manuais concorrendo com a assinatura da Autentique dentro do corpo do texto

### Detalhes técnicos
Hoje o sistema envia a assinatura final para uma página fixa (`20`). Isso só funciona se o documento realmente tiver 20 páginas. Como o termo varia conforme template, anexos e aditivos, a página final precisa ser calculada dinamicamente no momento da geração. Em paralelo, os blocos HTML de assinatura manual precisam ser removidos de forma mais agressiva para não criar “áreas falsas” de assinatura dentro do documento.
