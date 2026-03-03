

# Corrigir Cotacoes que Persistem Apos Exclusao

## Diagnostico

As duas cotacoes (Nissan Versa / teste 04 e Fiat Siena / Caio Da Silva) **ainda existem no banco de dados**. A edge function `delete-cotacao` esta deployada e responde, porem os logs mostram **zero invocacoes**, indicando que as tentativas de exclusao do usuario falharam silenciosamente no frontend (possivelmente erro de auth ou rede que foi engolido pelo catch).

As cotacoes nao possuem dependencias (0 contratos, 0 agendamentos, 0 instalacoes pendentes), entao a exclusao e direta.

## Correcoes

### 1. Excluir os 2 registros orfaos do banco
Deletar diretamente as cotacoes via SQL (usando service role):
- `d1747122-5aef-4b49-850e-65c506c91257` (Nissan Versa - teste 04)
- `b42c0337-b488-4eb8-8a68-1782e45bb33d` (Fiat Siena - Caio Da Silva)

### 2. Melhorar tratamento de erro no frontend
No `useExcluirCotacao` (em `useCotacoes.ts`), o `onError` mostra o toast mas nao loga detalhes suficientes. Adicionar log do response body para diagnosticar falhas futuras.

### 3. Reimplantar a edge function `delete-cotacao`
Para garantir que a versao mais recente esta no ar e funcionando corretamente.

## Arquivos afetados
- Execucao de DELETE via SQL (2 registros)
- `src/hooks/useCotacoes.ts` — melhorar error handling no `useExcluirCotacao`
- Deploy: `delete-cotacao`

