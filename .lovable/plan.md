

# Gatilho de prazo expirado para confirmação de vistoria/instalação

## Resumo

Atualmente o sistema envia confirmações matinais via WhatsApp (`confirmar-vistorias-manha-cron`) e aguarda resposta "SIM", mas **não existe nenhum mecanismo para expirar confirmações não respondidas**. O serviço fica eternamente em `aguardando_confirmacao_manha` sem consequência.

A solução é criar uma nova edge function cron que verifica confirmações pendentes e, se o prazo configurável expirar sem resposta, envia um template Meta informando o associado e cancela/reagenda o serviço.

## Arquivos

| Arquivo | Ação |
|---------|------|
| `supabase/functions/cron-expirar-confirmacoes/index.ts` | **Criar** — nova cron que expira confirmações não respondidas |
| `supabase/functions/cron-atribuir-tarefas/index.ts` | **Editar** — ignorar serviços com `confirmacao_whatsapp = 'expirada'` |
| `src/pages/diretoria/ConfigInstalacaoRotas.tsx` | **Editar** — adicionar campo configurável "Prazo para confirmação (horas)" |

## Detalhes

### 1. Configuração dinâmica (tabela `configuracoes`)

Nova chave: `prazo_confirmacao_agendamento_horas` com valor padrão `4` (horas). O Diretor poderá ajustar na aba Instalação e Rotas.

### 2. Nova edge function `cron-expirar-confirmacoes`

Lógica:
1. Ler prazo configurável via `getConfiguracaoNumero(supabase, 'prazo_confirmacao_agendamento_horas', 4)`
2. Buscar serviços com `confirmacao_whatsapp IN ('aguardando_confirmacao_manha', 'aguardando_confirmacao_encaixe')` onde o registro em `confirmacoes_agendamento` tem `mensagem_enviada_em` mais antigo que X horas atrás
3. Para cada serviço expirado:
   - Atualizar `confirmacao_whatsapp = 'expirada'` e `status = 'cancelada'`
   - Enviar template WhatsApp Meta ao associado informando que o prazo de confirmação expirou e orientando a reagendar
   - Atualizar `confirmacoes_agendamento.status = 'expirada'`
   - Criar notificação interna para o coordenador

### 3. Template WhatsApp

Usar o template `notificacao_geral_v1` (fallback seguro) com mensagem informando:
- "Seu agendamento de [tipo] para [data] não foi confirmado no prazo"
- "Entre em contato para reagendar"

### 4. Ajuste no `cron-atribuir-tarefas`

Adicionar `'expirada'` à lista de status de `confirmacao_whatsapp` que devem ser ignorados nos filtros de busca de serviços, para que serviços expirados não entrem na fila de atribuição.

### 5. Config na Diretoria

Adicionar um campo numérico "Prazo para confirmação do agendamento (horas)" na aba de Instalação e Rotas, vinculado à chave `prazo_confirmacao_agendamento_horas`.

### Fluxo resultante

```text
7h: Confirmação matinal enviada → confirmacao_whatsapp = 'aguardando_confirmacao_manha'
│
├── Associado responde SIM → 'confirmada' → entra na fila de atribuição
├── Associado responde NÃO → reagendamento (fluxo existente)
└── Sem resposta após X horas → cron-expirar-confirmacoes:
    ├── confirmacao_whatsapp = 'expirada'
    ├── status = 'cancelada'
    ├── WhatsApp: "Prazo expirado, reagende"
    └── Notificação interna ao coordenador
```

