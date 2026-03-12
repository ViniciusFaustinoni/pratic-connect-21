

## Análise: Template `cobertura_total_ativada`

### Status Atual

O template está **corretamente mapeado** em `notificar-cliente/index.ts` (linha 364-371) e é chamado em **3 pontos** do sistema quando `cobertura_total = true` é setado:

1. **`useAprovarVeiculoVistoria`** (`useVistoriaCompleta.ts`, linha 143) — aprovação de vistoria completa
2. **`useAtivarRastreador`** (`useVistoriaCompletaAnalise.ts`, linha 205) — ativação manual de rastreador
3. **`useAprovarVeiculoServico`** (`useServicos.ts`, linha 1039) — aprovação de veículo em serviço com autovistoria prévia

### Problema Encontrado

Todos os 3 chamadores enviam apenas `{ placa }` no campo `dados`, mas **não enviam `marca` e `modelo`**. O template `cobertura_total_ativada` tem 3 variáveis: `{{1}}` nome, `{{2}}` placa, `{{3}}` marca/modelo. Como marca e modelo não são enviados, o parâmetro `{{3}}` sempre cai no fallback `"seu veículo"`.

### Correção

**Alterar os 3 chamadores** para buscar e enviar `marca` e `modelo` junto com `placa`:

**1. `src/hooks/useVistoriaCompleta.ts`** (linha ~143):
- Já tem `veiculoData` com dados do veículo via join — adicionar `marca` e `modelo` no `dados`

**2. `src/hooks/useVistoriaCompletaAnalise.ts`** (linha ~199):
- Já faz `select('placa')` no veículo — expandir para `select('placa, marca, modelo')`

**3. `src/hooks/useServicos.ts`** (linha ~1034):
- Já faz `select('placa')` no veículo — expandir para `select('placa, marca, modelo')`

Cada chamada passará: `dados: { placa, marca, modelo }` para que o template preencha corretamente as 3 variáveis.

