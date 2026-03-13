

## Reenvio automático com IA para templates Pendentes/Rejeitados

### O que será feito

Ao clicar no botão de reenviar (Send) na lista de templates com status PENDING ou REJECTED, o sistema automaticamente:
1. Chama a IA (`whatsapp-template-validar`) passando o corpo atual + motivo de rejeição
2. Se a IA retornar `corpo_sugerido`, aplica automaticamente o novo texto
3. Salva o template atualizado no banco
4. Reenvia para aprovação da Meta (delete + recreate)
5. Exibe toast com feedback do processo

Para templates DRAFT ou sem problemas, o fluxo continua igual (envio direto).

### Alterações

**`src/components/integracoes/WhatsAppMetaTemplates.tsx`**

Substituir o `onClick` do botão Send (linha 152) para templates PENDING/REJECTED por uma nova função `handleReenviarComIA`:

- Função assíncrona que:
  1. Busca o template completo do array `templates`
  2. Invoca `whatsapp-template-validar` com corpo + motivo_rejeicao
  3. Se houver `corpo_sugerido`, atualiza o template via `useAtualizarMetaTemplate`
  4. Chama `enviar.mutateAsync(id)` para reenviar
  5. Toast informando: "IA ajustou o texto e reenviou para aprovação"
- Se o status for DRAFT, mantém o comportamento atual (envio direto)
- Adicionar loading state dedicado para o reenvio com IA
- Importar `useAtualizarMetaTemplate` no componente

**Nenhuma alteração em edge functions** — a lógica de validação e reenvio já existe.

