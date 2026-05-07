## Problema

A aba **Titularidade** do `/cadastro/processos` mostra contador `1` (correto), mas a lista vem vazia ("Nenhuma solicitação nesta aba").

Causa: `useSolicitacoesTroca` faz `select` em `veiculos!veiculo_id(id, marca, modelo, ano, placa)`, mas a tabela `veiculos` **não tem** coluna `ano` — apenas `ano_modelo` e `ano_fabricacao`. O PostgREST retorna `42703 column veiculos_1.ano does not exist` e o React Query joga o erro fora silenciosamente. O contador funciona porque é uma query separada com `count: 'exact', head: true` (sem joins).

Confirmado via curl direto no PostgREST: a query do hook retorna erro 42703; sem o campo `ano` ela retorna a solicitação `b4c8b25d…` (KREITON ← MARCOS, placa KOU6D37) normalmente.

## Correção

Em `src/hooks/useSolicitacoesTroca.ts`:

1. Trocar `ano` por `ano_modelo, ano_fabricacao` nos dois `select` (`useSolicitacoesTroca` linha 59 e `useSolicitacaoTroca` linha 82).
2. Atualizar o tipo `SolicitacaoTroca.veiculo` (linha 46) para `ano_modelo: number | null; ano_fabricacao: number | null` (remover `ano`).

Em `src/pages/cadastro/ProcessosOperacionais.tsx` linha 105:
- Trocar `s.veiculo?.ano` por `s.veiculo?.ano_modelo ?? s.veiculo?.ano_fabricacao ?? ''`.

Verificar se `ModalDetalhesTroca.tsx` referencia `veiculo.ano` — se sim, aplicar mesma normalização (já confirmei via grep que não referencia).

## Validação

Após o fix, a aba "Aguardando Cadastro" deve listar a solicitação do KREITON (associado antigo: MARCOS VINICIUS DATIVO MACHADO, placa KOU6D37).