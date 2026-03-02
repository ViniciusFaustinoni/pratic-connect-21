
# Substituir "Cobertura Total" por "Proteção 360º" em todas as interfaces

## Diagnostico

O template `cobertura_total_ativada` no `notificar-cliente` **ja foi atualizado** para "Proteção 360º" no codigo-fonte, mas a **edge function nao foi reimplantada** -- por isso a mensagem do WhatsApp ainda chega como "COBERTURA TOTAL".

Alem disso, existem **diversas outras ocorrencias** de "cobertura total" em textos voltados ao usuario que precisam ser corrigidas.

## Alteracoes Necessarias

### 1. Reimplantar edge function `notificar-cliente`
A funcao ja tem o texto correto no codigo mas precisa ser deployada para que a mudanca surta efeito no WhatsApp.

### 2. `supabase/functions/whatsapp-webhook/index.ts` (2 ocorrencias)
- Linha 799: `"Total (todos os serviços)"` -> `"Proteção 360º (todos os serviços)"`
- Linha 1775: `"TOTAL (tudo liberado)"` -> `"PROTEÇÃO 360º (tudo liberado)"`

### 3. `src/hooks/usePropostasPendentes.ts` (4 ocorrencias)
- Linha 1570: `"Cobertura total ativada."` -> `"Proteção 360º ativada."`
- Linha 1571: `"Aguardando instalação para cobertura total."` -> `"Aguardando instalação para Proteção 360º."`
- Linha 1691: `"Cobertura total ativada."` -> `"Proteção 360º ativada."`
- Linha 1692: `"Aguardando instalação para cobertura total."` -> `"Aguardando instalação para Proteção 360º."`

### 4. `src/pages/cadastro/PropostaAnalise.tsx` (1 ocorrencia)
- Linha 466: `"cobertura total"` -> `"Proteção 360º"`

### 5. Reimplantar edge function `whatsapp-webhook`
Para que as correcoes das linhas 799 e 1775 entrem em vigor.

## O que NAO sera alterado
- Colunas do banco (`cobertura_total`) -- permanecem iguais (logica interna)
- Comentarios de codigo e logs de debug -- nao sao voltados ao usuario
- Variaveis e nomes de funcoes -- nao afetam o usuario

## Resultado
- Mensagens do WhatsApp mostrarao "Proteção 360º" em vez de "Cobertura Total"
- Textos internos do sistema (historico, toasts, modais) tambem atualizados
- 3 arquivos editados + 2 edge functions reimplantadas
