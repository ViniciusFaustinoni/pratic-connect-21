## Problema

Em **Vendas › Cotações › Outras Entradas › Substituição de Placa**, a busca pela placa só consulta o SGA Hinova (hook `useBuscaPlaca` → edge `sga-buscar-associado-completo`). Quando a placa existe **apenas na base local** (ou o SGA está fora), a tela mostra "Nenhum veículo ativo encontrado", mesmo havendo associado ativo no nosso banco.

Confirmado no caso reportado: placa `KZZ9E93` existe localmente (LUIZ AMARAL BARROS NETO) mas o SGA não devolve nada → lista vazia.

## Decisão de escopo

Listar **somente veículos ATIVOS**, somando duas fontes:
- **Local:** `veiculos.status = 'ativo'` **e** `associados.status = 'ativo'`
- **SGA:** comportamento atual (mantido como já é)

Veículos em `instalacao_pendente`, `pendente_vistoria`, `suspenso`, `cancelado` continuam fora — Substituição pressupõe associado já ativo. Isso significa que o **KZZ9E93 (hoje em `instalacao_pendente`) continuará não aparecendo** até ser ativado; a correção endereça os casos em que o SGA falha/atrasa para veículos que já são ativos no nosso lado.

## Mudanças

### 1. Novo hook `useBuscaPlacaLocal(placa)`
- Arquivo novo: `src/hooks/useBuscaPlacaLocal.ts`
- Query Supabase em `veiculos` com join em `associados`, filtrando:
  - `placa` (normalizada, com e sem hífen) igual ao termo
  - `veiculos.status = 'ativo'`
  - `associados.status = 'ativo'`
- Habilitado apenas quando o termo bate o regex Mercosul/antiga (mesma checagem do `useBuscaPlaca`).
- Retorna o mesmo shape `PlacaSearchResult` (sem `origem_sga: true`), com `associadoId` = UUID local.

### 2. Merge dos resultados em `OutrasEntradasMenu.tsx`
- Chamar `useBuscaPlacaLocal` em paralelo a `useBuscaPlaca` no ramo `isSubstituicao`.
- Construir `placaResultsMerged`: SGA primeiro (preserva integração existente), depois local, deduplicando por placa normalizada.
- `loadingPlacas` vira `loadingSGA || loadingLocal`.
- A mensagem "Nenhum veículo ativo encontrado com esta placa" só aparece quando **ambas** as fontes retornaram vazio e não há erro transitório.
- O banner `SgaTransientAlert` continua sendo mostrado quando o SGA falhou **e** o local também não achou — preserva o caminho de retry.

### 3. Fluxo de `handleSelectPlaca`
- Quando o resultado vem do local (sem `origem_sga`), `associadoId` já é UUID — usa direto, sem importar do SGA.
- Quando vem do SGA, mantém o caminho atual de import (já existe).

### 4. Sem mudanças em
- `useBuscaPlaca` / `useBuscaSGA` / `useVerificarVeiculoSGA` — outros fluxos (Troca de Titularidade, validação de duplicidade no cotador) continuam consultando o SGA do jeito que estão.
- Regras de inadimplência, repasse maior e demais gates da Substituição.

## Detalhes técnicos

- A normalização da placa precisa cobrir o hífen herdado (`KZZ-9E93`), por isso o filtro usa `or('placa.eq.KZZ9E93,placa.eq.KZZ-9E93')` (ou um `in(...)` com as duas variações).
- Manter dedupe estável: `Map<string, PlacaSearchResult>` com chave = placa normalizada — entradas SGA preexistentes não são sobrescritas pelas locais.
- Não criar trigger nem migration; é mudança puramente de frontend.
- Sem alteração de RLS: a tela só é usada por usuários internos (já têm SELECT em `veiculos`/`associados`).

## Fora de escopo

- Não relaxar a regra "associado precisa estar ativo".
- Não tocar no fluxo de Troca de Titularidade nem no cotador comum.
- Não criar tela/edge function nova — apenas hook + merge no componente existente.
