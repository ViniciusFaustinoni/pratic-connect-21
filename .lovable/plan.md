## Contexto

Endpoint `GET /buscar/situacao-financeira-veiculo/:codigo_ou_placa` já está integrado:
- Wrapper: `supabase/functions/_shared/hinova-client.ts` (`fetchSituacaoFinanceiraVeiculo`)
- Edge function: `sga-sync-financeiro-veiculo` — chama o endpoint, retorna `{ situacao_financeira, boletos... }` e persiste `situacao_financeira_sga` + `situacao_financeira_sga_em` na tabela `veiculos`
- Já é consumido em `src/components/cadastro/VeiculoFinanceiroSGA.tsx`

Falta apenas exibir essa informação no modal `TrocaTitularidadeDialog` (a tela do print).

## O que será feito

Arquivo: `src/components/associados/TrocaTitularidadeDialog.tsx`

1. Novo hook leve `useSituacaoFinanceiraVeiculos(veiculoIds)`:
   - Para cada `veiculoId` da lista atual do select, dispara `supabase.functions.invoke('sga-sync-financeiro-veiculo', { body: { veiculo_id } })` em paralelo (com `useQueries`).
   - `staleTime` ~5 min, `enabled` apenas quando o modal está aberto e há veículos.
   - Retorna mapa `{ [veiculoId]: 'ADIMPLENTE' | 'INADIMPLENTE' | 'desconhecido', loading }`.

2. Atualizar o `<select>` de veículos para acrescentar sufixo na descrição:
   - `Toyota Corolla 2014 - LTB4J74 — ADIMPLENTE` (ou `INADIMPLENTE`, ou `…` enquanto carrega).

3. Abaixo do select, ao escolher um veículo, mostrar um badge dedicado:
   - Verde para ADIMPLENTE, vermelho para INADIMPLENTE, neutro para desconhecido.
   - Texto `Última verificação: dd/mm/yyyy hh:mm` (vindo do retorno da edge function ou do campo persistido).

4. Reutilizar a seção existente de "Boletos pendentes" (já renderiza quando há boletos abertos do SGA). Nenhuma mudança nessa parte.

## Detalhes técnicos

- Não alterar a edge function nem o schema.
- `useQueries` do `@tanstack/react-query` para paralelizar por veículo, com `queryKey: ['troca-tit-sit-fin', veiculoId]`.
- Fallback: se a edge function falhar para um veículo, ler `situacao_financeira_sga` da tabela `veiculos` (já está em `veiculosLocais`/fallback) como valor de exibição secundário.
- Tokens semânticos do design system (`text-success`, `text-destructive`, etc.) — sem cores hardcoded.

## Fora de escopo

- Mudanças na edge function `sga-sync-financeiro-veiculo`.
- Mudanças no schema de `veiculos`.
- Mudanças na tela de Cadastro (`VeiculoFinanceiroSGA`).
