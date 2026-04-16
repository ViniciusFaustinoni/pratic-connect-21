

## Diagnóstico

A tela "Linhas e Planos" em `src/components/gestao-comercial/LinhasPlanos.tsx` mostra **"0 cob."** para vários planos da regional SP (ex.: Select Exclusive Diesel, Select One, etc.), mas **no banco esses planos têm 9 coberturas e 7-8 benefícios cadastrados corretamente**.

Causa raiz comprovada por SQL:

1. `useLinhasComPlanos()` busca `planos_coberturas` em chunks de 80 plano_ids por vez (linhas 233-247).
2. O PostgREST (Supabase) tem **limite default de 1.000 linhas por query**.
3. Total de `planos_coberturas` no projeto: **2.241 linhas** distribuídas em 287 planos.
4. Quando um chunk de 80 planos cai numa região com média ≥ 12-13 coberturas/plano (ex.: Lançamento + Select com 9 coberturas + extras), o resultado pode ultrapassar 1.000 linhas e o PostgREST **corta silenciosamente**.
5. Os planos cortados ficam sem entrada no `coberturasMap` → exibem `coberturas_count: 0` na UI.
6. O mesmo acontece com `planos_beneficios` (linhas 251-265) e `entity_eligibility_rules` (linhas 274-285), agravando o problema.

A imagem do usuário mostra exatamente isso: planos legítimos com "0 cob." enquanto o SQL prova que têm 9.

## Mudanças

### 1. `src/components/gestao-comercial/LinhasPlanos.tsx` — função `useLinhasComPlanos`

- **Reduzir tamanho de chunk** de 80 → 30 planos por requisição (margem segura: 30 × 15 cobs ≈ 450 linhas, bem abaixo de 1.000).
- **Adicionar `.range(0, 9999)` ou `.limit(10000)` explícito** em todas as queries paginadas (`planos_coberturas`, `planos_beneficios`, `entity_eligibility_rules`) para garantir que mesmo com chunks maiores não haja corte silencioso.
- **Reduzir chunk de `entity_eligibility_rules`** de 100 → 50 entidades.
- Adicionar log de aviso (apenas em dev) caso o número de linhas retornadas em algum chunk se aproxime do limite, para facilitar diagnóstico futuro.

### 2. Validação após aplicar

- Recarregar a tela "Gestão Comercial → Linhas e Planos".
- Verificar que `Select Exclusive Diesel - Deságio 70% - SP`, `Select Exclusive Passeio - SP`, `Select One - Passeio - SP`, `Select Premium - SP` etc. agora mostram "9 cob." em vez de "0 cob.".
- Conferir que valor mensal e listas expandidas voltam a popular corretamente.

## Arquivos a editar

- `src/components/gestao-comercial/LinhasPlanos.tsx` (apenas a função `useLinhasComPlanos`, linhas 206-330)

## Não vou mexer

- Banco de dados (`planos_coberturas`, `planos_beneficios`) — os dados estão íntegros.
- Lógica de cotação/preço (já lê via outra query e não sofre o corte).
- Outras telas de gestão.

## Resultado esperado

A tela "Linhas e Planos" passa a mostrar a contagem real de coberturas e benefícios para todos os 287 planos visíveis, eliminando o falso "0 cob." causado pelo limite de paginação do PostgREST.

