
## Contexto — o que já existe vs. o que falta

Já temos:
- Tabela `solicitacoes_troca_titularidade` + edge functions `criar-solicitacao-troca-titularidade`, `enviar-termo-cancelamento-troca`, `aprovar-troca-cadastro`, `aprovar-troca-monitoramento`, `efetivar-troca-titularidade`, `reprovar-troca-titularidade`.
- `TrocaTitularidadeDialog` partindo de `Cadastro > Associado Detalhe` (busca placas no SGA, cria cotação com `dados_extras.tipo_entrada='troca_titularidade'`).
- `TelaAnaliseTrocaTitularidade` na cotação pública (associado novo só prossegue após `liberada_para_assinatura`).
- Painéis de aprovação em `/cadastro/processos?tab=titularidade` e Monitoramento.
- `useBuscaSGA` + `useVerificarDebitosAssociado` + `DebitosCard` (linhas digitáveis, links de boleto) — usado no fluxo de cotação geral.

Falta (conforme spec):
1. **Entrada via Cotação** (não só pelo Associado Detalhe). Hoje o consultor só abre troca dentro do cadastro do antigo.
2. Disparo **automático** do termo ao criar a solicitação (hoje é botão manual) + envio também via **WhatsApp** (não só email).
3. Botão **"Copiar link do Termo de Cancelamento"** na cotação enquanto aguarda assinatura.
4. **Bloqueio efetivo da placa**: impedir novas cotações com a placa enquanto solicitação ativa (hoje não há guard).
5. Após assinatura do termo: automação **desvincular do SGA + alertar Relacionamento + marcar placa como "LIBERADA"** com badge na cotação.
6. **CPF do novo titular** dentro da cotação: três cenários (limpo / reativação obrigatória / com débito) já parcialmente cobertos por `useVerificarDebitosAssociado`, mas:
   - bloqueio é hoje "soft" — precisa virar **bloqueio explícito no painel do consultor** com badge `ASSOCIADO COM PENDÊNCIA`;
   - reativação **não obriga revisão cadastral** — precisa flag `atualizacao_cadastral_obrigatoria`;
   - **não existe pooling diário** das pendências para liberar automaticamente.
7. Badge `PLACA LIBERADA` / `ASSOCIADO COM PENDÊNCIA` / `ASSOCIADO LIBERADO` na lista de cotações com prioridade para "PLACA LIBERADA".

---

## Plano

### 1. Nova entrada "Cotação > Troca de Titularidade"
- Adicionar opção no menu de "Nova cotação" (`src/pages/cotacoes` / componente de criação) → abre `IniciarTrocaTitularidadeDialog`.
- Reusa `TrocaTitularidadeDialog` mas **sem** receber `associadoId` — o consultor digita o CPF do antigo, busca via `useBuscaSGA({cpf})`, lista placas SGA. Na seleção: se houver associado local com aquele CPF/placa, usa o `associado_antigo_id` local; se não, a edge `criar-solicitacao-troca-titularidade` precisa aceitar criar solicitação informando **CPF do antigo** ao invés do UUID local (resolver internamente; criar stub local somente quando inevitável).
- Manter a entrada antiga (Associado Detalhe) como atalho.

### 2. Disparo automático do Termo + WhatsApp
- Em `criar-solicitacao-troca-titularidade`: após criar solicitação, chamar `enviar-termo-cancelamento-troca` inline (mesma transação lógica) e mover status para `aguardando_cadastro` (assinatura do antigo). Hoje o estado inicial é `cotacao_em_andamento` e o termo só é enviado por botão.
- Em `enviar-termo-cancelamento-troca`: após Autentique retornar a URL do documento (ou link público), enfileirar mensagem WhatsApp via `enviar-whatsapp-template` com link da assinatura.
- Persistir `termo_cancelamento_url` (URL pública Autentique) — hoje só guardamos `termo_cancelamento_autentique_id`.

### 3. Botão "Copiar link do Termo de Cancelamento" + status na cotação
- Na visão da cotação no painel do consultor (componente da página de cotação) renderizar:
  - badge "Aguardando assinatura do antigo" + botão "Copiar link" (usa `termo_cancelamento_url`);
  - botão secundário "Reenviar para WhatsApp/email".

### 4. Bloqueio da placa enquanto solicitação ativa
- Constraint funcional: criar índice/trigger ou função `placa_bloqueada_por_troca(placa)` que retorne true quando existir solicitação em status `cotacao_em_andamento|aguardando_cadastro|aguardando_monitoramento|aguardando_vistoria|liberada_para_assinatura`.
- Em `criar-cotacao` / fluxo de cotação geral: se `placa_bloqueada_por_troca(placa)` → bloquear com mensagem "Placa em processo de troca de titularidade".

### 5. Pós-assinatura do termo (webhook Autentique)
- No webhook `autentique-webhook` (existente), quando documento for `termo_cancelamento_autentique_id`:
  - marcar `termo_cancelamento_assinado_em`;
  - status → `aguardando_cadastro` aprovar (já existe), e em paralelo:
    - **desvincular veículo do SGA** chamando rota Hinova `/veiculo/alterar-situacao` (situação CANCELADO) — função reusa `_shared/hinova-client.ts`;
    - inserir registro em uma fila/tabela `relacionamento_debitos_pendentes` com `cpf=associado_antigo.cpf`, `solicitacao_id`, `valor_total` (puxar do SGA);
    - atualizar `cotacao.dados_extras.placa_liberada=true` para destravar UI do consultor.

### 6. Sub-fluxo "CPF do novo titular" dentro da cotação
- Componente `NovoTitularStep` (na cotação de troca):
  - Input CPF → `useBuscaSGA` + lookup local em `associados`;
  - **Cenário A (limpo)**: prossegue para escolha de plano.
  - **Cenário B (já associado, sem débito)**: pré-popula dados e força flag `cotacao.dados_extras.atualizacao_cadastral_obrigatoria=true`. UI obriga consultor a percorrer steps de revisão antes de habilitar "avançar para plano".
  - **Cenário C (débito no SGA)**: renderiza `DebitosCard` (já existe), bloqueia botão "avançar para plano" até `tem_debito=false`. Marca `cotacao.dados_extras.novo_titular_status='pendente_debito'`.
- **Pooling diário**: nova edge `cron-recheck-debitos-troca` agendada à meia-noite via pg_cron:
  - varre cotações de troca em `pendente_debito`;
  - reconsulta SGA (`sga-buscar-associado-completo`);
  - se não há mais débito → atualiza `dados_extras.novo_titular_status='liberado'` e dispara WhatsApp/notificação ao consultor.

### 7. Badges na lista de cotações
- Em `useCotacoesList` (ou hook equivalente) e nos cards/linhas:
  - `PLACA LIBERADA` (prioridade alta, verde) quando `dados_extras.placa_liberada=true && novo_titular_status != 'liberado'`;
  - `ASSOCIADO LIBERADO` (verde) quando ambos liberados;
  - `ASSOCIADO COM PENDÊNCIA` (amarelo) quando `novo_titular_status='pendente_debito'`;
  - `AGUARDANDO TERMO` (azul) quando `aguardando_cadastro` e termo não assinado.
- Ordenação: trocas com `placa_liberada=true` sobem para o topo.

### 8. Banco
Migrations necessárias:
- `solicitacoes_troca_titularidade.termo_cancelamento_url text` (se ainda não existir).
- Função `placa_bloqueada_por_troca(p_placa text) returns boolean security definer`.
- Tabela `relacionamento_debitos_pendentes` (id, solicitacao_id, cpf, nome, valor, status, created_at, resolvido_em).
- pg_cron job para `cron-recheck-debitos-troca` (00:00 BRT diário).

### 9. Atualizações de memory
- Nova entrada `mem://features/troca-titularidade/fluxo-cotacao-v1` consolidando: entrada via cotação, automação do termo, bloqueio de placa, badges, pooling de débito.

---

## Arquivos a alterar / criar

**Criar**
- `src/components/cotacao/IniciarTrocaTitularidadeDialog.tsx` (entrada via cotação, sem associado pré-selecionado).
- `src/components/cotacao/badges/StatusTrocaBadges.tsx`.
- `supabase/functions/cron-recheck-debitos-troca/index.ts`.
- Migrations conforme item 8.

**Editar**
- `src/components/associados/TrocaTitularidadeDialog.tsx` (extrair lógica reaproveitável).
- `src/hooks/useSolicitacoesTroca.ts` (ações: copiar link, reenviar termo, status novo titular).
- `supabase/functions/criar-solicitacao-troca-titularidade/index.ts` (auto-disparo do termo, aceitar CPF antigo opcional).
- `supabase/functions/enviar-termo-cancelamento-troca/index.ts` (persistir URL, disparar WhatsApp).
- `supabase/functions/autentique-webhook/index.ts` (acionar desvínculo SGA + débitos relacionamento + flag placa liberada).
- Lista de cotações (componente de cards/tabela) para os badges + ordenação.
- Hook de criação de cotação para guard `placa_bloqueada_por_troca`.

---

## Pontos a confirmar antes da execução
1. **WhatsApp do termo**: usar template já existente ou criar template novo "Termo de Cancelamento — Troca"?
2. **Desvínculo SGA**: confirmar se a operação correta é `alterar-situacao` para CANCELADO ou `excluir veículo do associado`. Vou usar `alterar-situacao` (rastreável, não destrutivo) salvo se você indicar outra.
3. **"Relacionamento"**: já existe alguma fila/tela para esse setor? Se sim, qual rota? (Se não houver, crio uma seção em `/financeiro/cobrancas` filtrando `origem='troca_titularidade'`.)
4. **Cron 00:00**: BRT (UTC-3) confirmado?
