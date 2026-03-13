

## Permitir edição e reenvio de templates Pendentes e Rejeitados com IA

### Problema atual
Templates com status `PENDING` não podem ser editados nem reenviados pela interface. O `canEdit` e `canSend` só permitem `DRAFT` e `REJECTED`. Para corrigir um template pendente, o usuário precisa esperar a rejeição.

### Solução

**1. `src/components/integracoes/WhatsAppMetaTemplates.tsx`**
- Adicionar `PENDING` ao `canEdit` e `canSend` para permitir edição e reenvio de templates pendentes

**2. `src/components/integracoes/WhatsAppMetaTemplateDrawer.tsx`**
- Permitir edição do corpo, rodapé, header e botões em templates PENDING (manter nome bloqueado)
- Mostrar alerta informativo quando o template está PENDING ou REJECTED, indicando que ao reenviar o anterior será substituído
- Ao reenviar, o backend já faz delete + recreate automaticamente (fluxo `jaExiste`)

**3. `supabase/functions/whatsapp-meta-templates/index.ts`**
- No fluxo `enviar`, quando o status atual é PENDING, forçar delete do template anterior na Meta antes de enviar a nova versão (garantir que o delete+recreate aconteça mesmo sem erro "already exists")

### Detalhes técnicos

- A edge function já possui lógica de auto-retry (delete + recreate) quando detecta "already exists". Para templates PENDING, precisamos forçar esse fluxo proativamente: deletar o template existente na Meta antes de enviar o novo corpo.
- O nome do template permanece bloqueado (não-DRAFT) para evitar problemas com o cooldown de 4 semanas da Meta.
- A validação com IA já funciona para templates editados (passa `motivo_rejeicao` quando disponível).

