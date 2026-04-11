

## Plano: Remover etapa de assinatura do laudo de vistoria

### Resumo

O laudo de vistoria/instalação deixa de depender de assinatura via Autentique. Quando gerado, é anexado diretamente aos documentos do associado com status "aprovado". Toda a UI e lógica de "pendente assinatura do laudo" será removida.

### Alterações

**1. `src/hooks/useServicos.ts`** (useAprovarVeiculoServico)
- Remover todo o bloco de envio para Autentique (linhas ~1143-1225): chamada a `autentique-create-laudo`, busca de associado/veículo para WhatsApp, envio de link de assinatura
- Manter apenas a geração do laudo PDF via `gerar-laudo-vistoria` (linhas 1132-1141) — o laudo já é anexado automaticamente pela edge function
- Alterar mensagem WhatsApp: em vez de "revise e assine", enviar "instalação concluída com sucesso"

**2. `src/pages/public/AcompanhamentoProposta.tsx`**
- Remover PRIORIDADE 0 "pendente_assinatura_laudo" (linhas 267-282)
- Remover status "laudo_assinado" com badge verde (linhas 284-298)
- Remover botão fixo "Assinar Laudo de Instalação" (linhas 1367-1381)
- Remover badge "Laudo Assinado ✅" (linhas ~1149-1165)
- Remover condição de padding extra baseada em `laudo_autentique_url` (linha 788)
- Limpar referências a `laudo_autentique_url`, `laudo_assinado`, `laudo_assinado_em` do interface e query

**3. `src/pages/cadastro/PropostasPendentes.tsx`**
- Remover badge "Pend. Laudo" (linhas 60-63)
- Alterar badge "Laudo ✅" para mostrar quando o laudo PDF existe (sem depender de `laudo_assinado`)

**4. `src/hooks/usePropostasPendentes.ts`**
- Remover campos `laudo_assinado`, `laudo_autentique_url`, `laudo_pdf_assinado_url` da query e interface

**5. `supabase/functions/autentique-webhook/index.ts`**
- Remover bloco de tratamento de laudo (linhas ~790-860) que processa `laudo_autentique_id` — não haverá mais documentos de laudo no Autentique

**6. Edge function `autentique-create-laudo`**
- Pode ser mantida sem deploy (dead code) ou removida — nenhum caller a invocará mais

**7. `supabase/functions/gerar-laudo-vistoria/index.ts`**
- Sem alterações — já salva o PDF no storage e insere na tabela `documentos` com tipo `laudo_vistoria` e status `aprovado`

### O que NÃO muda
- A geração do laudo PDF continua funcionando normalmente
- O laudo continua sendo anexado aos documentos do associado automaticamente
- A edge function `gerar-laudo-vistoria` permanece intacta
- Os campos `laudo_assinado`/`laudo_autentique_id` no banco permanecem (não precisa de migration), apenas não serão mais usados

