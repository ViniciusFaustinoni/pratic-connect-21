## Objetivo

Na tela pública de "Escolha do Plano" da Troca de Titularidade (link enviado ao novo titular), garantir que sempre haja pelo menos um plano para o novo titular escolher:

- **Vendedor não incluiu nenhum plano na cotação** → mostrar **automaticamente o plano vigente do associado antigo** como única opção (referência da troca).
- **Vendedor incluiu 1 ou mais planos** (`planos_comparacao`) → mostrar **todos os planos incluídos** (comportamento atual, sem mudança).

A escolha continua sendo feita pelo novo titular no link público (clicar no card + "Continuar com este plano"), gravando em `cotacoes.plano_escolhido_id`.

## Hoje x Depois

Hoje, em `useCotacaoContratacao.planosDisponiveis`:
1. Se `dados_extras.planos_comparacao` tem itens → lista todos.
2. Senão, se `cotacao.plano_id` existe → lista 1 (plano principal).
3. Senão → lista vazia (caso atual da troca de titularidade quando o consultor não montou comparação nem definiu plano principal — resulta na tela vazia do screenshot).

Depois, na **mesma função**, adicionar regra **somente quando for Troca de Titularidade** e a lista resultante estiver vazia: buscar o **plano vigente do contrato ativo do associado antigo + veículo** vinculados à `solicitacoes_troca_titularidade` daquela cotação e usar como o único `PlanoOpcao`.

## Mudanças técnicas

1. **Novo hook público `useTrocaPlanoAtualPublico(cotacaoId)`**
   - Igual ao `useTrocaPlanoAtual` existente, mas usando `publicSupabase` (role `anon`).
   - Lê `solicitacoes_troca_titularidade` (já acessível ao anon — `useSolicitacaoTrocaPublicaPorCotacao` confirma) → pega `associado_antigo_id` e `veiculo_id`.
   - Lê o `contratos` ativo correspondente e o `planos` (id, nome, código, coberturas, valor_adesao, valor_mensal).
   - Retorna no formato `PlanoOpcao` (`{ id, nome, codigo, valorMensal, valorAdesao, coberturas, nivel }`).
   - Se RLS anon bloquear `contratos`/`planos` para esse caso, criar edge function pública `troca-plano-atual-publico` (input: token da cotação, output: PlanoOpcao do plano vigente). Usar a edge somente como fallback.

2. **`useCotacaoContratacao.ts`**
   - Detectar `isTrocaTitularidade` por `dados_extras.tipo_entrada === 'troca_titularidade'` (já usado em `CotacaoContratacao.tsx`).
   - Chamar o novo hook quando `isTrocaTitularidade` e `planosDisponiveis` estiver vazio.
   - Mesclar: se `planos_comparacao` tem itens → usa eles; senão se `plano_id` existe → usa ele; senão se troca de titularidade → usa plano vigente do antigo.
   - Sem alterar a mutation `selecionarPlano` (já grava `plano_escolhido_id`, funciona com qualquer id de plano real).

3. **UI (`EscolhaPlano.tsx`) — pequena indicação opcional**
   - Quando o card mostrado vier do "plano atual do antigo titular" (flag opcional na `PlanoOpcao`, ex.: `origem: 'plano_vigente_antigo'`), exibir um badge sutil "Plano atual do veículo" acima/abaixo do nome. Mantém o mesmo botão "Selecionar" e a mesma jornada.
   - Sem alterar layout, animações ou demais comportamentos.

## Fora de escopo

- Permitir que o novo titular troque para qualquer plano do catálogo (apenas plano vigente quando vendedor não incluiu nenhum).
- Mudanças no fluxo interno do consultor / na geração da cotação.
- Mudanças em pagamento, vistoria, contrato.

## Arquivos afetados

- `src/hooks/useTrocaPlanoAtualPublico.ts` (novo)
- `src/hooks/useCotacaoContratacao.ts` (ajuste em `planosDisponiveis`)
- `src/components/cotacao-publica/EscolhaPlano.tsx` (badge opcional "Plano atual do veículo")
- (Condicional) `supabase/functions/troca-plano-atual-publico/index.ts` — só se RLS anon bloquear leitura direta.
