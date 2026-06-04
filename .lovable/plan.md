## Diagnóstico — por que a IA errou nesta conversa

Investiguei `agente_ia_contatos` e o histórico de `whatsapp_mensagens` do telefone **5521992593830**:

- O contato tem identidade **cacheada do dia anterior**: `nome='THAIS GURUCEAGA DOS SANTOS'`, `cpf='15230046732'`, capturado em **2026-06-03 16:24 BRT**.
- Hoje (04/06 06:52 BRT) o usuário escreve "Oi". É o **Vinicius**, mas o telefone está cacheado como Thais.
- O agente: (1) pulou o gate de saudação/identificação porque o contato é "identificado", (2) cumprimentou como **"Oi, Thais!"**, (3) ao pedir reboque, puxou o **veículo da Thais (FIAT ARGO KYA9B12)** via SGA pelo CPF cacheado.

**Causas raiz (3 falhas de design da habilidade `relacionamento` / "Atendimento Pratic"):**

1. **Identidade é eternamente "sticky" por telefone.** Uma vez cacheado CPF/nome, a IA nunca mais reconfirma — telefones compartilhados, trocas de dono e capturas erradas viram erro permanente.
2. **Citação proativa de veículo.** A IA usa SGA pelo CPF cacheado e cita marca/modelo/placa sem o cliente ter dito "é esse carro". Isso multiplica o erro de identidade.
3. **Sem reset por divergência.** Não há gatilho que detecte "não sou X" / "meu nome é Y" / "não é esse carro" para zerar `cpf` + `nome` no contato e reentrar no gate canônico.

A configuração fixada em `/relacionamento/config-ia` (saudação "Olá! Tudo bem? … *nome completo* ou *CPF*. 😁", `regras_absolutas` exigindo não-vácuo + escalar em dúvida) está correta — o problema é que **o gate é pulado** quando há cache, então a saudação nunca aparece para usuários "identificados".

---

## Plano

### 1. Reconfirmação leve por sessão (anti-telefone-compartilhado)

Em `supabase/functions/agente-consultor-ia/index.ts`, no roteador / gate de identificação:

- Considerar identidade "fresca" apenas se `cpf_capturado_em` é do **mesmo dia BRT** OU houve interação nas últimas **2h**.
- Fora dessa janela, mesmo com cache, enviar **pré-saudação de confirmação**: "Olá! Tudo bem? Antes de continuar, me confirma: estou falando com *Vinicius* ([nome cacheado])? Se preferir, me envia seu *CPF*. 😁" — e travar o resto até a resposta.
- Resposta afirmativa ("sim", "sou eu", "isso") → atualiza `ultima_interacao` e `nome_confirmado_em`, libera fluxo. Negativa ou nome/CPF diferente → executar reset (passo 3).

Coluna nova: `agente_ia_contatos.ultima_reconfirmacao_em timestamptz` (debounce de 2h para não reperguntar dentro da mesma sessão).

### 2. Proibição de citação proativa de identidade/veículo

Adicionar bloco **REGRAS DE IDENTIDADE** ao system prompt da habilidade `relacionamento` (injetado em código, não na coluna `regras_absolutas`, para garantir presença):

- Nunca cumprimentar pelo primeiro nome na primeira mensagem do dia — usar "Olá!" neutro até reconfirmação.
- Nunca mencionar marca/modelo/placa do veículo proativamente. Sempre **perguntar** "Qual veículo?" e só depois consultar SGA com a placa/descrição que o cliente confirmou.
- Tool de lookup de veículo (`buscar_veiculos_associado`) só pode ser chamada após o cliente ter (a) confirmado identidade nesta sessão **e** (b) mencionado o veículo, OU quando há apenas 1 veículo ativo no associado e o cliente confirma a identidade.

### 3. Reset automático de identidade em divergência

No pré-processamento da mensagem do cliente (antes do LLM):

- Detectar padrões `^(não\s+sou|meu\s+nome\s+(é|e)|aqui\s+(é|e|quem\s+fala\s+é))\s+([A-Za-zÀ-ÿ ]{3,})` e CPFs (11 dígitos válidos) diferentes do cacheado.
- Se divergência → `UPDATE agente_ia_contatos SET cpf=NULL, nome=NULL, cpf_capturado_em=NULL, sga_associado_id=NULL, sga_associado_status=NULL, sga_associado_encontrado=false, nome_confirmado_em=NULL WHERE telefone=...` + log `[reset_identidade]` + responder com saudação canônica do gate.

Mesmo gatilho quando o cliente diz "não tenho esse carro", "esse carro não é meu", "veículo errado" → resetar identidade (não só veículo, porque a divergência de veículo implica divergência de pessoa quando o lookup veio do CPF cacheado).

### 4. Correção imediata deste contato

Migration de saneamento pontual: zerar identidade cacheada de **5521992593830** para forçar o gate na próxima mensagem.

### 5. Observabilidade

- Log `[reconfirmacao_identidade] telefone=... cache=Thais resposta=...` quando pré-saudação for enviada.
- Log `[reset_identidade] telefone=... motivo=(negacao_nome|cpf_divergente|veiculo_negado)` quando reset disparar.
- Métrica futura (não nesta entrega): contar quantos contatos passam pela reconfirmação por dia — sinal de cache obsoleto em escala.

---

## Detalhes técnicos

**Arquivos:**
- `supabase/functions/agente-consultor-ia/index.ts` — gate de identificação, pré-processamento de reset, injeção de regras de identidade.
- `supabase/functions/agente-consultor-ia/lib/roteador.ts` — leitura da janela de frescor da identidade.
- Migration: adicionar coluna `ultima_reconfirmacao_em` em `agente_ia_contatos` + UPDATE de saneamento do telefone do caso.
- Memória `mem://logic/operations/maya-saudacao-e-identificacao-canonica` — atualizar com a regra de reconfirmação por sessão e proibição de citação proativa de veículo.

**Não-objetivos:** não mexer no painel `/relacionamento/config-ia`; não criar nova habilidade; não alterar tools existentes além do gate de `buscar_veiculos_associado`.

Aprovação para implementar?
