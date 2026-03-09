

# Plano: Garantir que TODAS as mensagens do sistema usem Templates Meta

## Problema

Quando a Meta API está ativa, mensagens enviadas como `type: "text"` (texto livre) são aceitas pela API mas **não entregues** se o contato não interagiu nas últimas 24h. Apenas mensagens com `type: "template"` são sempre entregues. Atualmente, **10 edge functions** enviam mensagens sem `template_name`, resultando em texto livre que nunca chega.

## Templates aprovados disponíveis (12)

| Template | Parâmetros |
|---|---|
| `assistencia_confirmada` | {{1}} nome, {{2}} prestador, {{3}} minutos |
| `boas_vindas_associado` | {{1}} nome, {{2}} placa |
| `cobranca_mensalidade` | {{1}} nome, {{2}} valor, {{3}} vencimento |
| `documentacao_pendente` | {{1}} nome, {{2}} documentos |
| `despacho_reboque_novo` | {{1}} veículo, {{2}} placa, {{3}} local, {{4}} horário, {{5}} link |
| `orcamento_oficina` | {{1}} nome, {{2}} veículo, {{3}} placa, {{4}} problema |
| `reboque_a_caminho` | {{1}} prestador, {{2}} distância, {{3}} estimativa, {{4}} link, {{5}} telefone |
| `reboque_chegou_local` | {{1}} reboquista, {{2}} link |
| `reboque_entregue` | {{1}} destino, {{2}} horário |
| `reboque_veiculo_carregado` | {{1}} nome, {{2}} placa, {{3}} destino, {{4}} link |
| `sinistro_aberto` | {{1}} nome, {{2}} protocolo |
| `sinistro_atualizado` | {{1}} nome, {{2}} protocolo, {{3}} atualização |

## Funções que precisam de correção

### 1. `notificar-cliente/index.ts` — Tipos sem template mapeado

11 tipos mapeados no `META_TEMPLATE_MAP`. Faltam **10 tipos**:

| Tipo faltante | Template a usar | Params |
|---|---|---|
| `vistoria_reprovada` | `sinistro_atualizado` | nome, "vistoria", motivo |
| `vistoria_nova_tentativa` | `sinistro_atualizado` | nome, "vistoria", motivo |
| `documento_aprovado` | `sinistro_atualizado` | nome, "documento", tipo_documento |
| `documento_reprovado` | `documentacao_pendente` | nome, tipo_documento |
| `status_atualizado` | `sinistro_atualizado` | nome, "cadastro", status |
| `proposta_aprovada_roubo_furto` | `boas_vindas_associado` | ✅ já mapeado |
| `cobertura_total_ativada` | `boas_vindas_associado` | ✅ já mapeado |
| `veiculo_negado_orientacoes` | `sinistro_atualizado` | nome, "avaliação", resumo |
| `followup_recusa_dia3` | `sinistro_atualizado` | nome, "avaliação", lembrete |
| `followup_recusa_dia7` | `sinistro_atualizado` | nome, "proteção", lembrete |

### 2. `notificar-sinistro/index.ts` — Sem template (L300-304)

Envia `{ telefone, mensagem }` sem `template_name`. Usar `sinistro_aberto` ou `sinistro_atualizado` conforme o contexto.

### 3. `disparar-notificacao/index.ts` — Sem template (L365-370)

Envio genérico de notificações sem template. Adicionar mapeamento por tipo de template de notificação.

### 4. `cron-contato-sinistro/index.ts` — Sem template (L78-84, L191-197)

Envia mensagem pré-definida e mensagem de sinistro longa sem template. Usar `sinistro_aberto` com params resumidos.

### 5. `gerar-faturas-mensais/index.ts` — Sem template (L446-448)

Envia cobrança sem usar `cobranca_mensalidade`. Adicionar `template_name: 'cobranca_mensalidade'` com params nome, valor, vencimento.

### 6. `notificar-etapa-os/index.ts` — Sem template (L73-74)

Etapas de OS (lanternagem, pintura, etc.) sem template. Usar `sinistro_atualizado` como genérico: nome, "reparo", etapa concluída.

### 7. `processar-termo-evento/index.ts` — Sem template (L496-501, L590-595)

Confirmação de pagamento sem template. Usar `sinistro_atualizado`: nome, protocolo, "pagamento confirmado".

### 8. `autentique-webhook/index.ts` — Sem template (L721-728)

Link de pagamento pós-assinatura sem template. Usar `sinistro_atualizado`: nome, protocolo, mensagem resumida.

### 9. `notificar-retirada-whatsapp/index.ts` — Sem template (L50-51)

Retirada de rastreador sem template. Usar `assistencia_confirmada`: nome, "Praticcar", data/período.

### 10. `notificar-manutencao-whatsapp/index.ts` — Sem template (L55)

Manutenção de rastreador sem template. Usar `assistencia_confirmada`: nome, "Técnico Praticcar", data/período.

### 11. `notificar-status-assistencia/index.ts` — Sem template (L218-224)

Status de assistência sem template. Usar `assistencia_confirmada`: nome, prestador, previsão.

### 12. `despacho-reboque-disparar/index.ts` — Sem template (L246-249)

Despacho para reboquistas sem template. Usar `despacho_reboque_novo`: veículo, placa, local, horário, link.

### 13. `gerar-os-cotacao-aprovada/index.ts` — Sem template (L155-163)

Peças aprovadas sem template. Usar `sinistro_atualizado`: nome, protocolo/placa, "peças aprovadas".

## Mudança no `whatsapp-send-text` — Bloquear texto livre quando Meta ativo

Alterar a função `enviarViaMeta` para **recusar** envio sem template quando Meta está ativo, em vez de enviar silenciosamente como texto livre. Isso previne que novos chamadores repitam o erro.

```text
// Se não tem template_name e Meta ativo → ERRO, não enviar silenciosamente
if (!templateName) {
  throw new Error("Meta API ativa: template_name obrigatório. Texto livre não será entregue.");
}
```

## Arquivos afetados

| Arquivo | Alteração |
|---|---|
| `supabase/functions/whatsapp-send-text/index.ts` | Bloquear texto livre quando Meta ativo |
| `supabase/functions/notificar-cliente/index.ts` | Adicionar 8 tipos faltantes ao META_TEMPLATE_MAP |
| `supabase/functions/notificar-sinistro/index.ts` | Adicionar template_name |
| `supabase/functions/disparar-notificacao/index.ts` | Adicionar template_name |
| `supabase/functions/cron-contato-sinistro/index.ts` | Adicionar template_name |
| `supabase/functions/gerar-faturas-mensais/index.ts` | Adicionar template_name cobranca_mensalidade |
| `supabase/functions/notificar-etapa-os/index.ts` | Adicionar template_name |
| `supabase/functions/processar-termo-evento/index.ts` | Adicionar template_name (2 locais) |
| `supabase/functions/autentique-webhook/index.ts` | Adicionar template_name |
| `supabase/functions/notificar-retirada-whatsapp/index.ts` | Adicionar template_name |
| `supabase/functions/notificar-manutencao-whatsapp/index.ts` | Adicionar template_name |
| `supabase/functions/notificar-status-assistencia/index.ts` | Adicionar template_name |
| `supabase/functions/despacho-reboque-disparar/index.ts` | Adicionar template_name |
| `supabase/functions/gerar-os-cotacao-aprovada/index.ts` | Adicionar template_name |

## Ordem de execução

1. Atualizar `whatsapp-send-text` para bloquear texto livre com Meta ativa
2. Corrigir `notificar-cliente` (8 tipos faltantes)
3. Corrigir as 11 edge functions restantes (todas passam `template_name` + `template_params`)
4. Deploy de todas as funções

