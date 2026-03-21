

# Plano: Criar templates Meta dedicados para notificações que NÃO são sinistro

## Problema

O template `sinistro_atualizado` (corpo: "Olá {{1}}, há uma atualização no seu sinistro {{2}}: {{3}}") está sendo usado como fallback genérico para TODOS os tipos de notificação -- instalações, vistorias, pagamentos, confirmações, etc. Isso gera mensagens confusas como "há uma atualização no seu sinistro INSTALAÇÃO: FULANO".

## Solução

Criar templates Meta dedicados por contexto e substituir as referências nos edge functions. Cada template precisa ser aprovado pela Meta antes de funcionar, mas precisa ser registrado no banco como DRAFT para depois ser enviado para aprovação.

### 1. Novos templates Meta (SQL)

Registrar na tabela `whatsapp_meta_templates`:

| Template | Corpo | Uso |
|----------|-------|-----|
| `servico_atribuido_v1` | `Olá {{1}}! Um novo serviço foi atribuído a você: {{2}}. Detalhes: {{3}}. Acesse o app para mais informações.` | Notificar instalador/vistoriador sobre atribuição |
| `confirmacao_agendamento_v1` | `Olá {{1}}! Seu(a) {{2}} está agendado(a) para hoje. {{3}}. Responda SIM para confirmar ou solicite reagendamento.` | Confirmação matinal e 1h antes |
| `notificacao_geral_v1` | `Olá {{1}}! {{2}}: {{3}}. Acompanhe pelo app.` | Fallback genérico que NÃO menciona sinistro |

Status inicial: `DRAFT` (precisa ser enviado para aprovação via painel de templates Meta).

### 2. Atualizar `cron-atribuir-tarefas/index.ts`

- Linha 713: trocar `template_name: 'sinistro_atualizado'` por `'servico_atribuido_v1'`
- Ajustar `template_params` para os parâmetros do novo template

### 3. Atualizar `confirmar-agendamento-cron/index.ts`

- Linha 155: trocar `template_name: 'sinistro_atualizado'` por `'confirmacao_agendamento_v1'`

### 4. Atualizar `confirmar-vistorias-manha-cron/index.ts`

- Trocar referência ao template `sinistro_atualizado` por `'confirmacao_agendamento_v1'`

### 5. Atualizar `notificar-inicio-rota/index.ts`

- Linha 222: trocar `template_name: 'sinistro_atualizado'` por `'servico_atribuido_v1'`

### 6. Atualizar `notificar-cliente/index.ts`

- Substituir os usos de `sinistro_atualizado` para tipos que NÃO são sinistro (instalação, vistoria, documento, status) por `'notificacao_geral_v1'`
- Manter `sinistro_atualizado` apenas para notificações que realmente envolvem sinistro

### 7. Outros edge functions afetados

As seguintes functions também usam `sinistro_atualizado` fora de contexto de sinistro e devem ser atualizadas:
- `confirmar-retirada` → `notificacao_geral_v1`
- `asaas-webhook` (pagamento) → `notificacao_geral_v1`
- `notificar-manutencao-whatsapp` → `notificacao_geral_v1`
- `gerar-os-cotacao-aprovada` → pode manter `sinistro_atualizado` pois é contexto de sinistro
- `notificar-etapa-os` → pode manter, é contexto de sinistro

### 8. Fallback inteligente no `whatsapp-send-text`

- Quando um template DRAFT/não aprovado é solicitado, em vez de falhar, tentar usar `notificacao_geral_v1` como fallback (se aprovado), e só depois `sinistro_atualizado`
- Isso garante transição suave enquanto templates novos aguardam aprovação

## Nota importante

Os templates novos vão ser criados como DRAFT. O usuário precisa enviá-los para aprovação da Meta pelo painel de templates. Enquanto não forem aprovados, o sistema usará o fallback.

## Arquivos afetados

| Arquivo | Alteração |
|---------|-----------|
| SQL (migração) | Inserir 3 novos templates Meta |
| `cron-atribuir-tarefas/index.ts` | Usar `servico_atribuido_v1` |
| `confirmar-agendamento-cron/index.ts` | Usar `confirmacao_agendamento_v1` |
| `confirmar-vistorias-manha-cron/index.ts` | Usar `confirmacao_agendamento_v1` |
| `notificar-inicio-rota/index.ts` | Usar `servico_atribuido_v1` |
| `notificar-cliente/index.ts` | Separar sinistro de não-sinistro |
| `confirmar-retirada/index.ts` | Usar `notificacao_geral_v1` |
| `asaas-webhook/index.ts` | Usar `notificacao_geral_v1` |
| `notificar-manutencao-whatsapp/index.ts` | Usar `notificacao_geral_v1` |
| `whatsapp-send-text/index.ts` | Fallback inteligente |

