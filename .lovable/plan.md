## Contexto

Hoje o modal de Troca de Titularidade carrega ao abrir, em UMA única chamada (`useBoletosSgaPorAssociado` → `sga-listar-boletos-associado`), os veículos do associado E os boletos de cada um. Por isso a lista de boletos pendentes pode aparecer antes/independentemente da consulta de situação financeira.

A edge function `sga-sync-financeiro-veiculo` já:
- chama o endpoint `/buscar/situacao-financeira-veiculo/:codigo`
- baixa os boletos do veículo na Hinova e faz upsert em `cobrancas` (com `link_boleto`, `linha_digitavel`, `data_vencimento`, `valor`, `situacao`)

Ou seja, ao terminar a consulta de situação para o veículo selecionado, os boletos correspondentes já estão atualizados em `cobrancas`.

## Mudança

Arquivo: `src/components/associados/TrocaTitularidadeDialog.tsx`

1. **Remover a exibição imediata** dos boletos vindos de `useBoletosSgaPorAssociado` (parar de usar `boletosPorIdLocal`/`saldoPorIdLocal` para renderizar a UI). A lista de veículos continua vindo desse hook (e o fallback local segue intacto).

2. **Gating por situação** — o card "Boletos pendentes do veículo" só aparece **depois que a query de situação financeira do veículo selecionado resolver**, e somente quando `status === 'INADIMPLENTE'`. Enquanto a consulta de situação não terminar para o veículo selecionado, mostrar apenas o estado "Consultando situação financeira…" já existente.

3. **Fonte dos boletos = `cobrancas` (pós-sync)** — adicionar uma nova query (`useQuery`) com `queryKey: ['troca-tit-cobrancas', veiculoId]`, **`enabled` apenas quando**:
   - há `veiculoId` selecionado,
   - a query de situação para esse veículo terminou com sucesso (`isSuccess`),
   - e `status === 'INADIMPLENTE'`.

   A query lê de `cobrancas` filtrando por `veiculo_id`, `status in ('aberto','vencido','pendente')` (status SGA já normalizado), ordenado por `data_vencimento`. Como a `sga-sync-financeiro-veiculo` acabou de rodar, os dados estão frescos.

4. **Render** — usar exatamente o mesmo layout atual (linhas com data, valor, badge vencido/pendente, botões "Abrir boleto" e "Copiar linha digitável"), porém populado com os campos de `cobrancas` (`link_boleto`, `linha_digitavel`, `valor`, `data_vencimento`, `situacao`). Total = soma de `valor`.

5. **Estados auxiliares**:
   - Situação carregando para o veículo selecionado → "Consultando situação financeira no SGA…" (já existe).
   - Situação = ADIMPLENTE → manter a linha "Sem boletos pendentes para este veículo." (sem chamar a query de cobranças).
   - Situação = desconhecido / erro → mostrar aviso curto "Situação financeira indisponível no SGA — boletos não consultados." e não renderizar boletos.
   - Cobranças carregando → spinner pequeno "Buscando boletos em atraso…".
   - Cobranças vazias mesmo com INADIMPLENTE → "Nenhum boleto em aberto registrado."

## Detalhes técnicos

- Não alterar edges; reusar `sga-sync-financeiro-veiculo` (já chamada pela query de situação) e ler de `cobrancas`.
- `useQuery` para cobranças com `staleTime: 60_000`.
- Manter os tokens semânticos do design system (sem cores hardcoded novas).

## Fora de escopo

- Mudanças em `sga-sync-financeiro-veiculo`, `sga-listar-boletos-associado` ou no schema de `cobrancas`.
- Mudanças no fallback local (`useTrocaTitularidadeFallbackLocal`).
- Tela de Cadastro (`VeiculoFinanceiroSGA`).
