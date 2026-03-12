

# Adicionar ação "Disparo de Teste" para templates aprovados

## O que muda

Adicionar um botão de "Disparo de Teste" (ícone de envio/foguete) no menu de ações de cada template com status `APPROVED`. Ao clicar, abre um modal simples com campo para digitar o número de telefone e botão de enviar. O disparo usa a edge function `whatsapp-send-text` já existente, passando `template_name` e `template_params` com valores de exemplo do template.

## Mudanças

### `src/components/integracoes/WhatsAppMetaTemplates.tsx`

1. Adicionar estado `testTemplate` para controlar qual template está sendo testado
2. Adicionar estado `testPhone` para o número digitado
3. Na linha de ações (linha 137-175), após o botão de duplicar e antes do delete, adicionar botão visível apenas para templates `APPROVED`:
   - Ícone `Send` (ou `Rocket`) com tooltip "Disparo de teste"
   - Ao clicar: `setTestTemplate(t)`
4. Adicionar novo `AlertDialog` para o modal de teste:
   - Título: "Enviar disparo de teste"
   - Subtítulo com nome do template
   - Campo `Input` com máscara para número de WhatsApp (com placeholder "5511999999999")
   - Botão "Enviar teste" que invoca `supabase.functions.invoke('whatsapp-send-text', { body: { telefone, template_name: t.nome, template_params: valores_exemplo } })`
   - Loading state durante envio
   - Toast de sucesso/erro
5. Os `template_params` serão extraídos de `t.variaveis_exemplo` (já salvo no banco) — se não houver, envia array vazio ou valores placeholder como `["teste1", "teste2"]` baseado nas `{{n}}` encontradas no corpo

### Nenhum arquivo novo necessário

Toda a lógica fica no componente existente, usando a edge function `whatsapp-send-text` que já suporta `template_name` + `template_params`.

