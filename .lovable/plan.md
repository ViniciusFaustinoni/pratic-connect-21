
# Auditoria Técnica — Conversa com o Agente IA (Checklist 8.1–8.17)

## Resumo Executivo

O **Agente Consultor IA (Maya)** existe na interface de configuração (UI), mas **NÃO possui backend implementado**. O fluxo de mensagens para não-associados no `whatsapp-webhook` e `whatsapp-meta-webhook` trata leads com uma resposta genérica fixa e números desconhecidos pedindo CPF. Nenhuma edge function consome as configurações da tabela `agente_ia_config` para gerar respostas inteligentes de vendas.

---

## Resultado por Item

| Item | Status | Detalhe |
|------|--------|---------|
| 8.1 — Primeira mensagem | ❌ NÃO FUNCIONA | Número desconhecido recebe "informe seu CPF", não a apresentação do agente |
| 8.2 — Nome do agente | ❌ NÃO IMPLEMENTADO | Nenhuma edge function lê `agente_ia_config.nome_agente` |
| 8.3 — Listar planos | ❌ NÃO IMPLEMENTADO | Não existe fluxo de cotação com IA para não-associados |
| 8.4 — Plano desativado | ❌ N/A | Sem fluxo de planos |
| 8.5 — Tom de conversa | ❌ N/A | Respostas são hardcoded, não geradas por IA |
| 8.6–8.8 — Coleta de dados | ❌ NÃO IMPLEMENTADO | Nenhum fluxo de coleta de nome/veículo/CEP |
| 8.9 — CPF desativado | ❌ NÃO IMPLEMENTADO | Toggle `dados_cotacao_opcionais.cpf` nunca é lido no backend |
| 8.10–8.11 — Dados faltando/inválido | ❌ N/A | Sem fluxo de coleta |
| 8.12 — Fora do escopo | ❌ N/A | Sem agente IA ativo |
| 8.13 — Sinistro | ❌ NÃO IMPLEMENTADO | Não redireciona para equipe |
| 8.14 — Solicitar humano | ❌ NÃO IMPLEMENTADO | Não gera notificação interna |
| 8.15 — Humano ativo | ⚠️ PARCIAL | Tabela `agente_ia_contatos.status` existe mas nenhum backend a verifica |
| 8.16 — Histórico | ❌ NÃO IMPLEMENTADO | Sem memória de conversa para não-associados |
| 8.17 — Mensagem longa | ❌ N/A | Sem geração de respostas longas |

---

## Diagnóstico Técnico

### O que existe
1. **Tabelas no banco**: `agente_ia_config` (configurações) e `agente_ia_contatos` (contatos/leads do agente)
2. **UI de configuração**: `AgenteConsultorIA.tsx` — 4 abas completas (Planos, Comportamento, Contatos, Preview)
3. **Webhook de associados**: `whatsapp-webhook` processa mensagens de associados existentes com IA (assistente PRATIC, tool calling)

### O que falta (backend do Agente Consultor)
Uma edge function (ou lógica dentro do `whatsapp-webhook`) que:
1. Identifica números que não são associados nem leads existentes
2. Lê `agente_ia_config` (nome, apresentação, instruções, horário, dados opcionais, follow-up)
3. Lê `planos` com `disponivel_agente = true` para apresentar ao contato
4. Mantém histórico de conversa por telefone
5. Usa Lovable AI para gerar respostas contextuais de vendas
6. Verifica horário comercial antes de responder
7. Respeita flag `atendimento_humano` em `agente_ia_contatos`
8. Divide respostas longas (>1000 chars) em múltiplas mensagens
9. Registra contatos em `agente_ia_contatos` e atualiza status do funil

---

## Plano de Implementação

Escopo muito grande para uma única iteração. Proposta de implementação em **2 fases**:

### Fase 1 — Fluxo Core do Agente (prioridade)
| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/whatsapp-webhook/index.ts` | Antes de pedir CPF para desconhecidos, redirecionar para o fluxo do agente consultor |
| `supabase/functions/whatsapp-meta-webhook/index.ts` | Mesma lógica: redirecionar desconhecidos para o agente |
| `supabase/functions/agente-consultor-ia/index.ts` | **NOVA** — Edge function dedicada ao agente de vendas |

A nova edge function `agente-consultor-ia`:
- Recebe `{ telefone, texto, tipo_msg }` via POST
- Busca/cria registro em `agente_ia_contatos`
- Verifica `status !== 'atendimento_humano'` — se humano, ignora
- Lê `agente_ia_config` para persona, horário, instruções
- Verifica horário comercial — se fora, envia `mensagem_fora_horario`
- Busca planos com `disponivel_agente = true`
- Busca histórico de conversa (últimas N mensagens da `whatsapp_mensagens`)
- Chama Lovable AI com system prompt construído dinamicamente
- Divide resposta >1000 chars em partes
- Envia via `whatsapp-send-text`
- Salva mensagens no histórico

### Fase 2 — Funcionalidades Avançadas
- Coleta estruturada de dados (nome, veículo, CEP, CPF opcional)
- Geração e envio de link de cotação
- Follow-up automático com cron
- Detecção de intenção de sinistro → transferência
- Pedido de humano → notificação interna

---

## Recomendação

Devido à complexidade (nova edge function com ~400 linhas + modificações em 2 webhooks existentes), recomendo iniciar pela **Fase 1** para ter o fluxo básico funcional. Deseja prosseguir com a implementação da Fase 1?
