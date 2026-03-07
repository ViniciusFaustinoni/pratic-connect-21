

# Plan: Feedback de Rejeição + Validação IA Pré-envio de Templates

## O que existe hoje

1. O campo `motivo_rejeicao` já existe na tabela `whatsapp_meta_templates` e é preenchido pela sincronização com a Meta
2. O motivo de rejeição já aparece no dialog de visualização (botão "olho"), mas **não na tabela principal** -- fácil de perder
3. Não existe nenhuma validação pré-envio com IA

## O que será feito

### 1. Mostrar motivo de rejeição diretamente na tabela

Na `WhatsAppMetaTemplates.tsx`, para templates com status `REJECTED`:
- Exibir o `motivo_rejeicao` como uma linha extra na célula de status (texto vermelho pequeno abaixo do badge)
- Tornar mais visível sem precisar abrir o dialog

### 2. Criar Edge Function de validação IA (`whatsapp-template-validar`)

Nova edge function que usa Lovable AI (LOVABLE_API_KEY já disponível) para analisar o template antes de enviar à Meta.

**Prompt do sistema**: Instruções sobre as regras da Meta para templates WhatsApp Business (sem conteúdo proibido, variáveis com exemplos, formatação correta, limites de caracteres, boas práticas de categoria, etc.)

**Input**: nome, categoria, corpo, header, rodapé, variáveis de exemplo

**Output via tool calling**: score (1-10), aprovado (boolean), problemas encontrados, sugestões de melhoria

### 3. Botão "Validar com IA" no Drawer de criação/edição

No `WhatsAppMetaTemplateDrawer.tsx`:
- Novo botão "Validar com IA" (ícone Bot) ao lado dos botões existentes
- Ao clicar, chama a edge function com os dados do formulário
- Exibe resultado em um card dentro do drawer: score, lista de problemas e sugestões
- Se score < 7, mostra alerta recomendando correções antes de enviar

### Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `src/components/integracoes/WhatsAppMetaTemplates.tsx` | Mostrar `motivo_rejeicao` na linha da tabela |
| `src/components/integracoes/WhatsAppMetaTemplateDrawer.tsx` | Botão "Validar com IA" + exibição do resultado |
| `supabase/functions/whatsapp-template-validar/index.ts` | Nova edge function com Lovable AI |
| `supabase/config.toml` | Registrar nova function |

