
# Ajustes nos Perfis de Acesso por Etapa do Fluxo de Eventos

## Resumo das 3 mudancas solicitadas

### 1. Remover "Triagem Inicial" - o Analista nao entra antes da vistoria

**Situacao atual:** Na listagem de sinistros (`SinistrosList.tsx`), o Analista de Eventos tem acesso ao botao "Analisar" quando o status e `comunicado` ou `em_analise`. Isso implica uma "triagem inicial" que nao deveria existir.

**Mudanca:** O Analista de Eventos so deve ver/acessar eventos a partir do status `aguardando_analise` (pos-vistoria do regulador). Os status `comunicado`, `em_analise`, `documentacao_pendente` e `aguardando_vistoria` sao fases onde apenas o **associado** (via link) e o **regulador** (vistoria) atuam. O Diretor mantem acesso total.

**Alteracoes:**
- `src/pages/eventos/SinistrosList.tsx` (linha 537): Mudar a condicao do botao "Analisar" para que o analista so veja quando status for `aguardando_analise` (e nao `comunicado` nem `em_analise`)
- Revisar filtros de listagem para que o analista nao veja eventos em status de pre-analise na listagem principal (ja implementado parcialmente via `useEventosAnalise`)

### 2. Link unico de evento (sem "Link 1" e "Link 2")

**Situacao atual:** O sistema ja utiliza um link unico `/evento/:token` com etapas progressivas. Porem, em alguns pontos da interface do analista, podem existir referencias a "gerar novo link" ou "Link 1/Link 2".

**Mudanca:** Garantir que toda a interface e comunicacao use apenas o conceito de um unico link de evento. A IA e qualquer outro canal envia sempre o mesmo link, que direciona o associado para a etapa pendente (auto-vistoria, B.O., agendamento ou pagamento).

**Alteracoes:**
- `src/components/eventos/EventoLinkCard.tsx`: Revisar se ha mencoes a "Link 1" ou "Link 2" e unificar para "Link do Evento"
- Edge functions (`gerar-link-evento`, `validar-link-evento`): Ja trabalham com token unico - apenas confirmar que nao ha logica de links multiplos

### 3. Adicionar "Enviar para Oficina" como etapa do Analista apos cotacao

**Situacao atual:** O botao "Enviar para Oficina" na listagem (`SinistrosList.tsx`, linha 548) so aparece para **Diretores** quando o status e `aprovado` e cota paga. Apos `pecas_em_cotacao`, o analista ja tem o botao "Marcar Pecas como Recebidas" que transiciona para `em_reparo`.

**Mudanca:** Permitir que o **Analista de Eventos** tambem tenha acesso ao botao "Enviar para Oficina" na listagem, alem do Diretor. Isso reconhece que o analista e responsavel por encaminhar o veiculo a oficina apos a cotacao.

**Alteracoes:**
- `src/pages/eventos/SinistrosList.tsx` (linha 548): Mudar `isDiretor` para `(isDiretor || isAnalistaEventos)` no botao "Enviar para Oficina"
- Na tela de analise (`SinistroAnalise.tsx`): O analista ja tem acesso ao fluxo de atribuir fornecedores e marcar pecas recebidas, entao o fluxo pos-cotacao ja esta correto

## Detalhes tecnicos

### Arquivo: `src/pages/eventos/SinistrosList.tsx`

**Mudanca 1 - Restringir acesso do analista (linha 537):**
```typescript
// DE:
{(isDiretor || isAnalistaEventos) && (sinistro.status === 'comunicado' || sinistro.status === 'em_analise' || sinistro.status === 'aguardando_analise') && (

// PARA:
{(isDiretor || (isAnalistaEventos && sinistro.status === 'aguardando_analise')) && (
```
Isso garante que o analista so ve o botao "Analisar" quando a vistoria ja foi concluida. O diretor mantem acesso a todos os status.

**Mudanca 3 - Analista pode enviar para oficina (linha 548):**
```typescript
// DE:
{isDiretor && sinistro.status === 'aprovado' && (sinistro as any).cota_paga === true && (

// PARA:
{(isDiretor || isAnalistaEventos) && sinistro.status === 'aprovado' && (sinistro as any).cota_paga === true && (
```

### Arquivo: `src/components/eventos/EventoLinkCard.tsx`

**Mudanca 2:** Revisar textos e labels para garantir que nao ha referencia a "Link 1" ou "Link 2", apenas "Link do Evento".

### Resultado

- O fluxo fica: **Associado comunica** -> **Sistema registra** -> **Associado preenche link (auto-vistoria, B.O., agendamento)** -> **Regulador faz vistoria** -> **Analista recebe para analise** -> **Decisao** -> **Oficina/Cotacao** -> **Resolucao**
- Um unico link acompanha o associado durante todo o processo
- O analista ganha autonomia para encaminhar veiculos a oficinas
