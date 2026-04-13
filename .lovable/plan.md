

## Plano: Assinatura Autentique apenas por email (sem botões de link direto)

### Problema
A página pública de assinatura do contrato (filiação) exibe botões como "Assinar Contrato Agora", "Copiar Link" e "Gerar Link" que permitem ao associado assinar via link direto. O desejado é que a assinatura seja feita **exclusivamente pelo email** enviado pela Autentique, e o sistema reconheça automaticamente quando foi assinado.

### O que já funciona
- O polling de 15s e o webhook já detectam automaticamente quando o contrato é assinado
- O email já é enviado pela Autentique ao criar o documento

### Alterações

**1. `src/components/cotacao-publica/EtapaAssinaturaContrato.tsx`**
- Remover toda a seção de botões diretos (linhas ~728-811): "Assinar Contrato Agora", `CopyLinkButton`, "Gerar Link"
- Remover o componente `CopyLinkButton` (não será mais usado)
- Manter o bloco de instruções "Como assinar via Email" (passos 1-3)
- Manter o alerta de segurança, o status "Aguardando sua assinatura" e o botão "Já assinei, verificar agora"
- Remover toda lógica de `linkAssinatura` e `linkTimeout` que não será mais necessária no render

**2. `supabase/functions/autentique-create/index.ts`**
- Adicionar `delivery_method: "DELIVERY_METHOD_EMAIL"` ao `signerObj` para garantir que o Autentique envie apenas por email (sem gerar link público)
- Remover os blocos de retry/fallback para buscar `short_link` e `createLinkToSignature` (não são mais necessários)
- Ainda salvar `autentique_documento_id` no contrato para o polling de status funcionar

### Escopo
- 2 arquivos modificados
- Redeploy de 1 Edge Function (`autentique-create`)
- O reconhecimento automático (polling 15s + webhook) permanece inalterado

