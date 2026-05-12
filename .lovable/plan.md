## Diagnóstico — KOU6D37

**Fato técnico:**
- Veículo `KOU6D37` (Ford Fiesta, FIPE R$ 30.835) tem **1 único serviço concluído** na tabela `servicos`:
  - `tipo = 'vistoria_entrada'`
  - `status = 'concluida'`
  - `decisao_instalador = 'aprovado'`
  - `concluida_em = 2026-05-12 21:53`
- Estado atual: `veiculos.status = instalacao_pendente`, `contratos.cadastro_aprovado = true`, `associados.status = aguardando_instalacao`.

**Por que foi para "Propostas Pendentes" (Cadastro) e não para "Aprovação de Associados" (Monitoramento):**

A fila **Aprovação de Associados** (`useInstalacoesAguardandoAprovacao` + `useInstalacoesAguardandoAtivacao` + `useAprovacoesMonitoramentoCount`) filtra **estritamente por `tipo = 'instalacao'`**. Como o serviço executado em campo foi `vistoria_entrada` (Vistoria Base), ele **nunca aparece** nessa fila.

Com isso o card permanece em **Cadastro › Propostas Pendentes** com o badge "Pendente Vistoria Inicial" (regra `propostas-pendentes-saida-por-vistoria`: cadastro só sai quando há **instalação concluída**), embora a vistoria já tenha sido aprovada pelo instalador.

Isso é exatamente o gap entre duas regras documentadas:
1. `base-nao-duplica-instalacao` — quando há Vistoria Base, **não** se cria `tipo='instalacao'` paralelo.
2. `vistoria-sem-rastreador-flow` / `propostas-pendentes-saida-por-vistoria` — vistoria concluída **deve** cair em fila de aprovação manual do Monitoramento.

Resultado: nenhum registro `tipo='instalacao'` existe → as filas de Monitoramento não enxergam o caso → o associado fica preso em "Propostas Pendentes".

## Plano de correção

**Escopo:** ajustar somente o filtro das filas/contadores do Monitoramento. Não mexer em triggers, não criar serviço fantasma, não alterar regra de "Propostas Pendentes".

### 1. `src/hooks/useAprovacaoMonitoramento.ts`
Trocar `.eq('tipo', 'instalacao')` por `.in('tipo', ['instalacao', 'vistoria_entrada'])` nas duas queries (lista de pendentes e contagem do header).

### 2. `src/hooks/useVistoriaCompletaAnalise.ts` (linha 308)
Mesma substituição na query que monta os itens "ativacao" da fila.

### 3. `src/hooks/useAprovacoesMonitoramentoCount.ts`
Atualizar o bloco "Aprovação de Associados" para considerar também `tipo='vistoria_entrada'` concluída com veículo ainda sem `cobertura_total` e associado não ativo.

### 4. Reconciliação imediata do KOU6D37
Após o ajuste, o card aparecerá automaticamente na aba **Monitoramento › Aprovações › Aprovação de Associados**. O Coordenador aprova → trigger `fn_reativar_cobertura_pos_instalacao` + `ativar-associado` promovem associado/veículo para `ativo` (ver memória `single-source-activation`).

### 5. Validação
- `psql`/`read_query`: confirmar que o item passa a aparecer no resultado da query da fila.
- UI: abrir `/monitoramento/aprovacoes#associados` logado como diretor e verificar o card.

### Observação
Não criar registro `tipo='instalacao'` retroativo — violaria `base-nao-duplica-instalacao` e poderia disparar triggers indevidos. A fila precisa enxergar o tipo correto.
