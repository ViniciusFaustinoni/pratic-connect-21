## Causa raiz

Em `src/hooks/useRastreadores.ts` (linhas 129–177), o filtro de busca aplica fallback por nome **e CPF** mesmo quando o termo é claramente uma placa.

Fluxo do bug com `search = "TCU6B84"`:
1. `normalizarBusca` retorna `digits = "684"`, `placa = "TCU6B84"`, `placaForte = "TCU6B84"`.
2. O código busca veículos por placa ✓ (correto).
3. Em seguida busca associados por `nome ilike '%TCU6B84%'` (sem match) **e** por `cpf ilike '%684%'` — esse último casa com vários CPFs aleatórios.
4. Todos os veículos desses associados são adicionados ao conjunto `veiculoIdsByPlaca`.
5. O filtro final vira `or(codigo.ilike.%TCU6B84%, numero_serie.ilike.%TCU6B84%, imei.ilike.%TCU6B84%, veiculo_id.in.(...lista poluída...))`, retornando rastreadores não relacionados (RAT-..., KXB9D77, RJV8D32, RUL5F15 no print).

`buscaUtils.ts` já expõe o flag `placaForte` exatamente para esse caso, mas o hook não o usa.

## Correção

Editar apenas `src/hooks/useRastreadores.ts`, bloco `if (filters?.search)`:

- Quando `placaForte` estiver presente:
  - **Pular** completamente a busca por nome/CPF (e a expansão de veículos por associado).
  - **Restringir** a query a `rastreadores.veiculo_id IN (ids dos veículos cuja placa casa)`.
  - Se nenhum veículo casar a placa, retornar resultado vazio imediatamente (sem cair no `directFilter` por código/serie/imei, que poderia casar substrings dos dígitos).
- Quando `placaForte` não estiver presente (busca por nome, CPF, código de equipamento, IMEI, etc.): manter o comportamento atual (placa parcial + nome + CPF + código/serie/imei).

Sem mudanças em outros arquivos, sem migração SQL, sem alteração de UI.

## Validação esperada

- "TCU6B84" → retorna apenas o rastreador vinculado ao veículo TCU6B84.
- "ABC1D23" inexistente → lista vazia (com o banner "Buscar na Softruck" já existente).
- "Tovar" (nome) → continua funcionando normalmente.
- "12345678901" (CPF) → continua funcionando.
- "863829078798368" (IMEI) → continua funcionando (não vira `placaForte` por ter só dígitos).
- "RAT-202604" (código) → continua funcionando (não tem dígitos suficientes para virar `placaForte` ou cai no fallback).
