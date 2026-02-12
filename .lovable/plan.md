

# Termo de Cancelamento + Troca de Titularidade via IA

## Resumo

Implementar um fluxo completo onde o associado, via IA (chat ou WhatsApp), pode solicitar **cancelamento** ou **troca de titularidade**. A IA coleta os dados, cria a solicitacao pendente, agenda vistoria (com retirada de rastreador no cancelamento) e gera o **Termo de Cancelamento** para assinatura via Autentique.

---

## Visao Geral do Fluxo

```text
Associado fala com IA (App Chat ou WhatsApp)
  "Quero cancelar" ou "Quero trocar a titularidade"
        |
        v
IA confirma intencao e coleta dados:
  - CANCELAMENTO: motivo, confirmacao
  - TROCA TITULARIDADE: dados do novo titular (nome, CPF, email, telefone)
        |
        v
IA cria solicitacao em chat_solicitacoes_ia
  tipo = "cancelamento" ou "troca_titularidade"
  status = "pendente"
        |
        v
Diretor aprova em SolicitacoesIA.tsx
        |
        v
Edge Function aprovar-solicitacao-ia:
  1. Agenda vistoria do tipo adequado
  2. Se CANCELAMENTO: tipo_servico = vistoria_retirada (retirada de rastreador)
  3. Se TROCA: tipo_servico = vistoria_entrada (vistoria do veiculo para novo titular)
  4. Envia link de envio de documentos (troca) ou notificacao (cancelamento)
        |
        v
Vistoriador executa vistoria (mesmo fluxo existente)
  - Fotos, video, assinatura
  - Se CANCELAMENTO: informa IMEI do rastreador retirado (atribui ao seu porte)
  - Se TROCA: vistoria completa do veiculo
        |
        v
Pos-vistoria:
  CANCELAMENTO -> Gera Termo de Cancelamento (Autentique) -> Associado assina
  TROCA -> Gera Termo de Cancelamento para titular atual + Termo de Filiacao para novo titular
```

---

## Alteracoes Necessarias

### 1. Banco de Dados

**Novo document_type:**
- `code: 'termo_cancelamento'`, `name: 'Termo de Cancelamento'`

**Adicionar colunas em `chat_solicitacoes_ia`:**
- `dados_novo_titular` (jsonb, nullable) - para troca de titularidade (nome, CPF, email, telefone do novo associado)

**Nota:** Os tipos `tipo_servico` do enum `tipo_servico` ja incluem `vistoria_retirada` (para cancelamento). Para troca de titularidade, sera usada uma nova vistoria do tipo `instalacao` ou `vistoria_entrada` para o novo titular. O campo `origem` da tabela `servicos` sera usado para identificar a origem ("troca_titularidade" ou "cancelamento_ia").

### 2. Atualizar `assistente-chat` (IA do App)

Adicionar ao SYSTEM_PROMPT novas instrucoes:
- Reconhecer intencoes de "cancelar", "sair da associacao", "trocar titularidade", "vendi meu carro"
- Fluxo de **cancelamento**: confirmar intencao, coletar motivo, avisar sobre retirada de rastreador obrigatoria, criar solicitacao
- Fluxo de **troca de titularidade**: confirmar intencao, coletar dados do novo titular (nome, CPF, email, telefone), criar solicitacao

Adicionar novas tools:
- `criar_solicitacao_cancelamento`: cria solicitacao com tipo "cancelamento" e dados (motivo, confirmacao)
- `criar_solicitacao_troca_titularidade`: cria solicitacao com tipo "troca_titularidade" e dados (novo_nome, novo_cpf, novo_email, novo_telefone)

### 3. Atualizar `whatsapp-webhook` (IA do WhatsApp)

Espelhar as mesmas novas tools e instrucoes do `assistente-chat` para que o fluxo funcione tambem via WhatsApp.

### 4. Atualizar `aprovar-solicitacao-ia`

Adicionar tratamento para os novos tipos:

**Cancelamento:**
- Criar servico do tipo `vistoria_retirada` (agendamento de retirada de rastreador)
- Enviar WhatsApp notificando agendamento
- Marcar origem = 'cancelamento_ia'

**Troca de titularidade:**
- Criar servico do tipo `vistoria_entrada` para vistoria do veiculo
- Gerar link unico para o novo titular enviar documentos (usar fluxo existente de cotacao/link ou criar pagina publica simplificada)
- Enviar WhatsApp notificando ambos (titular atual e novo)
- Marcar origem = 'troca_titularidade'

### 5. Atualizar `SolicitacoesIA.tsx`

- Reconhecer e exibir os novos tipos "cancelamento" e "troca_titularidade"
- Exibir dados do novo titular (quando troca)
- Exibir motivo (quando cancelamento)
- Icones e labels adequados

### 6. Nova Edge Function: `autentique-cancelamento-create`

Gera o Termo de Cancelamento via Autentique:
- Busca template do tipo `termo_cancelamento`
- Substitui variaveis: associado, veiculo, contrato, motivo, data
- Envia para Autentique
- Salva documento_id no contrato ou no registro de cancelamento

Variaveis do template:
```text
associado.nome, cpf, telefone, email, endereco
veiculo.placa, marca, modelo, ano, cor, chassi
contrato.numero, data_inicio, valor_mensal
cancelamento.motivo, cancelamento.data
empresa.*
sistema.data_atual
```

### 7. Integrar assinatura no fluxo de conclusao

**Cancelamento:**
- Apos a vistoria de retirada ser concluida (concluir-retirada), gerar automaticamente o Termo de Cancelamento via `autentique-cancelamento-create`
- Associado assina via email (Autentique)
- Webhook atualiza status

**Troca de titularidade:**
- Apos vistoria concluida:
  1. Gerar Termo de Cancelamento para titular atual -> assina
  2. Criar novo associado/contrato com dados do novo titular
  3. Gerar Termo de Filiacao para novo titular (autentique-create existente) -> assina
  4. Transferir veiculo para o novo associado

### 8. Atualizar `autentique-webhook`

Adicionar fallback para Termos de Cancelamento (buscar em contratos por um novo campo ou tabela de cancelamentos).

### 9. Fluxo do Vistoriador (App)

Para **cancelamento com retirada**: O fluxo ja existe via `vistoria_retirada`. O vistoriador:
- Informa o IMEI do rastreador retirado
- O rastreador e atribuido ao porte do profissional (portador_id)
- Status do rastreador muda para 'estoque'
- Tudo isso ja funciona via `concluir-retirada`

Para **troca de titularidade**: Usa o fluxo de vistoria padrao (fotos, video, assinatura).

---

## Arquivos Modificados/Criados

| Arquivo | Acao |
|---|---|
| Migration SQL | Novo document_type + coluna dados_novo_titular |
| `supabase/functions/assistente-chat/index.ts` | Novas tools e instrucoes |
| `supabase/functions/whatsapp-webhook/index.ts` | Novas tools e instrucoes |
| `supabase/functions/aprovar-solicitacao-ia/index.ts` | Tratar cancelamento e troca |
| `supabase/functions/autentique-cancelamento-create/index.ts` | NOVO |
| `supabase/functions/autentique-webhook/index.ts` | Fallback cancelamento |
| `supabase/functions/concluir-retirada/index.ts` | Chamar autentique-cancelamento apos conclusao |
| `supabase/functions/_shared/template-utils.ts` | Variaveis de cancelamento |
| `src/pages/diretoria/SolicitacoesIA.tsx` | Exibir novos tipos |
| `supabase/config.toml` | Registrar nova edge function |

---

## Detalhes Tecnicos

### Novas tools no assistente-chat:
```text
criar_solicitacao_cancelamento:
  - motivo (string): Motivo do cancelamento
  - confirmacao (boolean): Associado confirmou que deseja cancelar

criar_solicitacao_troca_titularidade:
  - novo_nome (string): Nome completo do novo titular
  - novo_cpf (string): CPF do novo titular
  - novo_email (string): Email do novo titular
  - novo_telefone (string): Telefone/WhatsApp do novo titular
  - motivo (string): "venda_veiculo" ou outro
```

### Instrucoes adicionais para a IA:
```text
## CANCELAMENTO E TROCA DE TITULARIDADE

Quando o associado manifestar interesse em:
- "Quero cancelar", "Quero sair", "Nao quero mais"
- "Vendi meu carro", "Quero trocar o titular"

### Cancelamento:
1. Confirme: "Voce tem certeza que deseja cancelar sua filiacao?"
2. Colete motivo
3. Informe: "Sera necessario agendar a retirada do rastreador do veiculo"
4. Crie a solicitacao

### Troca de Titularidade:
1. Confirme: "Voce vendeu o veiculo e deseja transferir para o novo proprietario?"
2. Colete: nome, CPF, email e telefone do novo titular
3. Informe: "Sera agendada uma vistoria do veiculo e o novo titular recebera um link para envio de documentos"
4. Crie a solicitacao
```

### Mensagem WhatsApp apos aprovacao (cancelamento):
```text
Ola {{associado.nome}},

Sua solicitacao de cancelamento foi recebida.

Sera agendada a retirada do rastreador do seu veiculo *{{veiculo.marca}} {{veiculo.modelo}}* placa *{{veiculo.placa}}*.

Voce recebera o agendamento em breve.

ABP PraticCar
```

### Mensagem WhatsApp apos aprovacao (troca titularidade):
```text
Ola {{associado.nome}},

Sua solicitacao de troca de titularidade foi recebida.

Sera agendada uma vistoria do veiculo *{{veiculo.marca}} {{veiculo.modelo}}* placa *{{veiculo.placa}}*.

O novo titular recebera um link para envio de documentos.

ABP PraticCar
```

### Sequencia de execucao recomendada:
1. Migration (document_type + coluna)
2. Edge function `autentique-cancelamento-create`
3. Atualizar `assistente-chat` e `whatsapp-webhook` (tools)
4. Atualizar `aprovar-solicitacao-ia` (novos tipos)
5. Atualizar `SolicitacoesIA.tsx` (UI)
6. Atualizar `autentique-webhook` (fallback)
7. Atualizar `concluir-retirada` (gerar termo apos retirada)
8. Deploy de todas as edge functions

