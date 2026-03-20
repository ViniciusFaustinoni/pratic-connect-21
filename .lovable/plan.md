

# Garantir entrega de todas as mensagens WhatsApp

## Resultado da auditoria completa

Todas as 23+ edge functions que chamam `whatsapp-send-text` foram verificadas. **Apenas 1 bug restante** impede a entrega:

### Bug encontrado

**`cron-atribuir-tarefas/index.ts` — chamada ao vistoriador (linha 671-684)**

O campo `mensagem` está ausente no body da requisição. A edge function `whatsapp-send-text` verifica `if (!telefone || !mensagem)` e retorna erro 400. A mensagem do vistoriador **nunca é enviada**.

### Correção

Adicionar o campo `mensagem` com texto descritivo na chamada do vistoriador, assim como já existe na chamada do instalador (linha 598 com `mensagem: msgInstalador`).

```
mensagem: `Nova vistoria atribuída: ${servico.associado_nome} - ${endereco} - ${dataFormatada}`
```

### Status das demais funções (todas OK)

| Função | Template | Status |
|--------|----------|--------|
| notificar-inicio-rota | sinistro_atualizado | ✅ |
| cron-atribuir-tarefas (instalador) | sinistro_atualizado | ✅ |
| cron-atribuir-tarefas (vistoriador) | tarefa_vistoriador_v2 | ❌ falta `mensagem` |
| aprovar-sinistro | sinistro_atualizado | ✅ |
| notificar-retirada-whatsapp | sinistro_atualizado | ✅ |
| notificar-manutencao-whatsapp | sinistro_atualizado | ✅ |
| despacho-reboque-atribuir (prestador) | sinistro_atualizado | ✅ |
| atribuir-proxima-tarefa | sinistro_atualizado | ✅ |
| aprovar-solicitacao-ia (cancelamento) | sinistro_atualizado | ✅ |
| aprovar-solicitacao-ia (troca titular) | sinistro_atualizado | ✅ |
| retroativo-pagamento-termo | sinistro_atualizado | ✅ |
| notificar-cliente | META_TEMPLATE_MAP | ✅ |
| ativar-associado | cadastro_aprovado_botao | ✅ |
| enviar-link-reagendamento | reagendamento_servico | ✅ |
| autentique-create-by-token | assinatura_documento_v2 | ✅ |
| enviar-lembretes-vencimento | cobranca_mensalidade | ✅ |
| gerar-cobrancas-mensais | cobranca_mensalidade | ✅ |
| disparar-boletos-lote | cobranca_mensalidade | ✅ |
| notificar-sinistro | comunicacao_sinistro | ✅ |
| notificar-etapa-os | sinistro_atualizado | ✅ |
| confirmar-agendamento-cron | sinistro_atualizado | ✅ |
| confirmar-vistorias-manha-cron | sinistro_atualizado | ✅ |
| despacho-reboque-status | templates por status | ✅ |
| notificar-status-assistencia | template dinâmico | ✅ |
| whatsapp-meta-webhook (Maya) | allow_text (janela 24h) | ✅ |
| processar-fila-ia (erro) | allow_text (janela 24h) | ✅ |

## Arquivo a modificar

- `supabase/functions/cron-atribuir-tarefas/index.ts` — adicionar campo `mensagem` na chamada do vistoriador (linha 671)

## Impacto

Correção pontual que desbloqueará o envio de notificações WhatsApp aos vistoriadores quando tarefas são atribuídas automaticamente. Todas as demais mensagens já estão configuradas corretamente.

