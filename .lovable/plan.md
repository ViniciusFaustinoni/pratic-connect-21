

# Erros no Link Publico — Agendamento de Vistoria

Apos analise completa do fluxo publico (`/cotacao/:token`), identifiquei **5 erros** que causam falhas no agendamento:

## Erros Encontrados

### 1. `useAgendamentoBase.ts` usa cliente autenticado (`supabase`) em pagina publica
Os hooks `useConfiguracaoBase`, `useHorariosDisponiveis` e `useCriarAgendamentoBase` usam `supabase` (requer login). Na pagina publica, o usuario nao esta autenticado — as queries falham silenciosamente por RLS. Deve usar `publicSupabase`.

### 2. `useVagasPeriodo.ts` usa cliente autenticado em pagina publica
O hook que verifica vagas disponiveis por periodo (`manha`/`tarde`) consulta a tabela `servicos` com o cliente autenticado. Falha na pagina publica. Deve usar `publicSupabase`.

### 3. `EtapaVistoria` nao recebe dados do cliente
Em `CotacaoContratacao.tsx` (linha 538), o componente `EtapaVistoria` e renderizado **sem** as props `clienteNome`, `clienteTelefone`, `clienteEmail`, `veiculoPlaca`, `veiculoDescricao`. Quando o usuario escolhe "Agendar na Base", o `AgendamentoBase` recebe strings vazias — o agendamento e criado sem nome do cliente.

### 4. Status `vistoria_agendada` nao reconhecido pelo stepper
`useCriarAgendamentoBase` define `status_contratacao: 'vistoria_agendada'`, mas `determinarEtapa()` em `useCotacaoContratacao.ts` nao tem esse case no switch. Cai no `default` (retorna 0), enviando o usuario de volta para a etapa de escolha de plano.

### 5. `useFinalizarVistoriaCotacao` (autovistoria) usa cliente autenticado
Na linha 164, o fluxo de autovistoria atualiza `cotacoes` via `supabase` (auth). Como a pagina publica usa role `anon`, a operacao falha por RLS.

## Correcoes

### `src/hooks/useAgendamentoBase.ts`
- Trocar `import { supabase }` por `import { publicSupabase }` nos hooks `useConfiguracaoBase`, `useHorariosDisponiveis` e `useCriarAgendamentoBase`
- Manter `supabase` (auth) apenas em `useAgendamentosBaseDia` e `useAtualizarAgendamentoBase` (usados no painel interno)

### `src/hooks/useVagasPeriodo.ts`
- Trocar para `publicSupabase` na query de vagas

### `src/pages/public/CotacaoContratacao.tsx`
- Passar props de dados do cliente para `EtapaVistoria`:
  - `clienteNome={cotacao.nome_solicitante}`
  - `clienteTelefone={cotacao.telefone1_solicitante}`
  - `clienteEmail={cotacao.email_solicitante}`
  - `veiculoPlaca={cotacao.veiculo_placa}`
  - `veiculoDescricao={...marca modelo...}`

### `src/hooks/useCotacaoContratacao.ts`
- Adicionar `case 'vistoria_agendada':` no switch de `determinarEtapa`, retornando etapa 4 (pagamento)

### `src/hooks/useCotacaoVistoria.ts`
- Linha 164: trocar `supabase` por `publicSupabase` no update da cotacao (fluxo autovistoria)

## Arquivos a modificar

| Arquivo | Correcao |
|---|---|
| `src/hooks/useAgendamentoBase.ts` | Trocar 3 hooks para `publicSupabase` |
| `src/hooks/useVagasPeriodo.ts` | Trocar para `publicSupabase` |
| `src/pages/public/CotacaoContratacao.tsx` | Passar props do cliente para EtapaVistoria |
| `src/hooks/useCotacaoContratacao.ts` | Adicionar `vistoria_agendada` no switch |
| `src/hooks/useCotacaoVistoria.ts` | Trocar para `publicSupabase` no fluxo autovistoria |

5 arquivos.

