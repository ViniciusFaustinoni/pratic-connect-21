

# Tela de Log de Envios de Templates Meta

## Resumo
Criar uma nova seção na aba WhatsApp (Integrações) que exibe o histórico de envios de templates Meta, incluindo sucessos e erros, usando dados já existentes na tabela `whatsapp_mensagens`.

## Fonte de dados
A tabela `whatsapp_mensagens` já registra todos os envios com:
- `direcao = 'saida'` para mensagens enviadas
- `status` (`enviada`, `erro`, `entregue`, `lida`)
- `erro_mensagem`, `erro_codigo` para falhas
- `template_id`, `template_variaveis` para identificar o template usado
- `telefone`, `created_at`, `provedor`

Não é necessário criar migration — os dados já existem.

## Alterações

### 1. Novo hook `src/hooks/useWhatsAppEnvioLogs.ts`
- Query em `whatsapp_mensagens` filtrando `direcao = 'saida'`
- Ordenado por `created_at DESC`
- Suporta filtros: status (todos/enviada/erro), busca por telefone, intervalo de datas
- Paginação (20 por página)
- Join com `whatsapp_instancias` para nome da instância

### 2. Novo componente `src/components/integracoes/WhatsAppEnvioLogs.tsx`
- Tabela com colunas: Data/Hora, Telefone, Template/Mensagem, Status (badge verde/vermelho), Erro, Provedor
- Filtros no topo: campo de busca, seletor de status, date range
- Badge de status: verde para `enviada/entregue/lida`, vermelho para `erro`
- Tooltip ou expansão para ver `erro_mensagem` completa e `template_variaveis`
- Paginação inferior

### 3. Modificar `src/components/integracoes/WhatsAppTab.tsx`
- Adicionar o componente `WhatsAppEnvioLogs` como nova seção após Templates Meta, com título "Log de Envios"

## Layout da tabela

| Data/Hora | Telefone | Mensagem | Status | Erro | Provedor |
|-----------|----------|----------|--------|------|----------|
| 03/04 22:31 | 5571... | Template: assinatura_doc... | ✅ Enviada | — | Meta |
| 03/04 22:30 | 5511... | Template: boas_vindas | ❌ Erro | Rate limit | Meta |

## Impacto
- 0 migrations
- 2 arquivos novos (hook + componente)
- 1 arquivo modificado (WhatsAppTab.tsx)

