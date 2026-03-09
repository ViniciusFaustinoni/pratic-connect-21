

# Correção: WhatsApp Não Entrega Mensagens (Meta API)

## Diagnóstico Raiz

A mensagem do Marcus Vinicius **foi aceita pela Meta API** (status `enviada`, message_id `wamid.HB...`), mas **não foi entregue**. Causa raiz:

O sistema envia **texto livre** via Meta Cloud API. A Meta exige que mensagens proativas (iniciadas pela empresa, fora da janela de 24h) sejam enviadas como **templates aprovados**. Mensagens de texto livre são aceitas pela API (retorna 200 + message_id), mas **silenciosamente descartadas** se não houver conversa ativa nas últimas 24h.

Todos os envios proativos do sistema (aprovação, boas-vindas, credenciais, cobrança, etc.) estão sendo enviados como texto livre — por isso nenhum chega ao destinatário.

Já existe o template `boas_vindas_associado` aprovado: `"Olá {{1}}! Seja bem-vindo(a) à PraticCar. Seu cadastro foi aprovado e seu veículo {{2}} já está protegido."`

## Dois Problemas Separados

### Problema 1: Mensagens não entregues (TODOS os envios proativos)
A função `whatsapp-send-text` envia texto livre quando o provedor é `meta_oficial`. Precisa detectar que é um envio proativo e usar template.

### Problema 2: Credenciais não enviadas (ativar-associado nunca chamado)
Para roubo/furto sem instalação concluída, `ativar-associado` nunca é invocado — já identificado no plano anterior.

## Plano de Correção

### 1. `usePropostasPendentes.ts` — Chamar `ativar-associado` para TODAS as aprovações
Após o bloco de criação de instalação (~linha 1566), adicionar chamada ao `ativar-associado` quando `!jaTemInstalacaoConcluida`, garantindo criação de conta e envio de credenciais.

### 2. `notificar-cliente/index.ts` — Usar template aprovado `boas_vindas_associado` para envio via Meta
Quando o provedor ativo for `meta_oficial`, enviar a notificação de aprovação usando `template_name: 'boas_vindas_associado'` com os parâmetros corretos (nome e placa), em vez de texto livre.

### 3. `ativar-associado/index.ts` — Enviar credenciais via template ou texto com fallback
Atualizar a chamada a `whatsapp-send-text` para incluir `template_name` quando disponível, ou pelo menos logar claramente se o envio falhou.

### 4. `whatsapp-send-text/index.ts` — Melhorar detecção de falha silenciosa
Adicionar log quando enviando texto livre via Meta sem template, alertando que pode não ser entregue fora da janela de 24h.

### Arquivos a editar
| Arquivo | Alteração |
|---|---|
| `src/hooks/usePropostasPendentes.ts` | Chamar `ativar-associado` para aprovações sem instalação concluída |
| `supabase/functions/notificar-cliente/index.ts` | Passar `template_name` ao `whatsapp-send-text` para tipos de notificação com template aprovado |
| `supabase/functions/ativar-associado/index.ts` | Enviar credenciais com template ou fallback claro |
| `supabase/functions/whatsapp-send-text/index.ts` | Log de alerta quando texto livre é usado via Meta (risco de não entrega) |

