## Objetivo

Permitir busca por **chassi** na tela `Cadastro › Associados`, junto com os filtros já existentes (nome, CPF, telefone, placa).

## Mudanças

### 1. `src/lib/buscaUtils.ts`
- Adicionar dois campos ao retorno de `normalizarBusca`:
  - `chassi: string | null` — alfanumérico uppercase com 4–17 chars (superset que cobre placa e chassi parcial/completo).
  - `chassiForte: string | null` — quando o termo tem >8 chars alfanuméricos com letras+dígitos (claramente chassi, não placa nem CPF).
- Atualizar a interface `BuscaNormalizada`.

### 2. `src/hooks/useAssociados.ts`
Bloco `if (filters?.search)`:
- Renomear `associadoIdsByPlaca` → `associadoIdsByVeiculo`.
- Substituir o lookup em `veiculos` por uma única query com `.or('placa.ilike.%X%,chassi.ilike.%X%')` quando `placa` OU `chassi` estiverem presentes (passando os respectivos termos normalizados).
- Ramo `placaForte || chassiForte`: mantém restrição a `nome + id.in(...)` (evita falso positivo em CPF/telefone). Se nenhum veículo casar, mantém o sentinela `id.eq.00000000-...`.
- Ramo padrão: continua adicionando `id.in.(...)` quando houver matches.

### 3. `src/pages/cadastro/Associados.tsx` (linha 542)
- Placeholder do input: `"Buscar por nome, CPF, telefone, placa ou chassi..."`.

## Fora do escopo
- Outras telas que usam o mesmo placeholder/hook (manter foco em Associados — útil ressaltar se quiser propagar depois).
- Mudanças em índices do Postgres (chassi já tem índice na maioria dos cenários — verificar somente se houver lentidão real).
- Nova UI de filtro avançado.

## Verificação
- Buscar pelos últimos 6 dígitos do chassi de um associado conhecido → retorna o associado.
- Buscar pelo chassi completo (17 chars) → retorna o associado.
- Buscar uma placa existente → continua funcionando.
- Buscar um CPF parcial de 3+ dígitos → continua funcionando (sem ser confundido com chassi).