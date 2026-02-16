
# Adicionar Controle de Recebimento de Pecas e Bloqueio de Envio para Oficina

## Situacao Atual

Apos o pagamento da cota, o status muda para `pecas_em_cotacao`. Uma cotacao e aprovada e gera uma OS automaticamente, mas NAO existe nenhum botao ou acao para o analista confirmar que as pecas chegaram fisicamente. O botao "Enviar para Oficina" aparece com base em `aprovado && cota_paga`, ignorando completamente a etapa de pecas.

## Novo Fluxo Proposto

```text
Pagamento confirmado
       |
       v
pecas_em_cotacao (cotacao sendo feita com auto centers)
       |
       v
Cotacao aprovada (analista aprova a melhor cotacao)
       |
       v
Analista clica "Marcar Pecas como Recebidas"
       |
       v
pronto_para_oficina (desbloqueado para enviar a oficina)
       |
  [WhatsApp ao associado: pecas chegaram, veiculo sera enviado]
       |
       v
Enviar para Oficina (cria OS)
```

## Alteracoes

### Arquivo 1: `src/pages/eventos/SinistroAnalise.tsx`

**Acoes para status `pecas_em_cotacao`** (atualmente nao existe nenhum bloco de acoes para este status):

- Adicionar bloco no painel de acoes (entre `pagamento_confirmado` e `em_analise`):
  - Mensagem informativa: "Pecas em cotacao - aguardando recebimento"
  - Se existe cotacao aprovada: exibir botao **"Marcar Pecas como Recebidas"**
  - Ao clicar: atualizar sinistro para `pronto_para_oficina`, registrar historico, disparar WhatsApp ao associado

**Ajustar guarda do botao "Enviar para Oficina"** (linha 1571):

- Trocar condicao de `sinistro.status === 'aprovado' && sinistro.cota_paga` para `sinistro.status === 'pronto_para_oficina'`

**Incluir `pecas_em_cotacao` na lista de status que mostram a aba Cotacoes** (linha 606):

- Adicionar `pecas_em_cotacao` ao array `showCotacoesTab`

**Excluir `pecas_em_cotacao` dos status que bloqueiam acoes adicionais** (linha 1538):

- Adicionar `pecas_em_cotacao` a lista de status que escondem botoes de sindicancia/juridico etc

### Arquivo 2: `src/hooks/useCotacoesEvento.ts`

**Remover geracao automatica de OS ao aprovar cotacao** (linhas 119-132):

- A OS nao deve ser gerada ao aprovar cotacao, pois as pecas ainda nao chegaram
- A OS sera gerada apenas quando o analista enviar para oficina (fluxo existente via `EnviarParaOficinaDialog`)

### Arquivo 3: Notificacao WhatsApp

Ao marcar pecas como recebidas, enviar mensagem via `whatsapp-send-text`:

```text
Ola {nome},

As pecas para o reparo do seu veiculo foram recebidas!
Em breve seu veiculo sera encaminhado para a oficina parceira.
Acompanhe o andamento pelo nosso canal.
```

## Resumo das alteracoes

| Arquivo | Alteracao |
|---|---|
| `src/pages/eventos/SinistroAnalise.tsx` | Adicionar bloco de acoes para `pecas_em_cotacao` com botao "Marcar Pecas como Recebidas", ajustar guarda do "Enviar para Oficina" para `pronto_para_oficina`, incluir `pecas_em_cotacao` na aba cotacoes |
| `src/hooks/useCotacoesEvento.ts` | Remover geracao automatica de OS na aprovacao de cotacao (OS sera criada apenas ao enviar para oficina) |
