

# Correcao do payload de veiculo na sincronizacao SGA Hinova

## Problema Identificado

O payload enviado para a API Hinova no endpoint `veiculo/cadastrar` esta faltando campos criticos e referenciando colunas que nao existem na tabela `veiculos`:

### Campos ausentes no payload
- **marca** -- existe no banco mas NAO e enviado
- **modelo** -- existe no banco mas NAO e enviado

### Campos referenciando colunas inexistentes (sempre vao como vazio/zero)
- `veiculo.km` e `veiculo.quilometragem` -- nao existem na tabela, `kilometragem` sempre vai como 0
- `veiculo.numero_motor` -- nao existe na tabela, sempre vai como string vazia
- `veiculo.tipo` -- nao existe na tabela, `codigo_tipo_veiculo` sempre vai como fallback 1 (automovel)

### Mapeamento de combustivel falha
- O banco armazena valores como `GASOLINA/ALCOOL/GAS NATURAL` ou `FLEX`, mas o mapeamento busca correspondencia exata com `gasolina`, `flex`, etc. Valores compostos como `GASOLINA/ALCOOL/GAS NATURAL` nunca encontram match e vao como null.

## Solucao

### Arquivo: `supabase/functions/sga-hinova-sync/index.ts`

**1. Adicionar `marca` e `modelo` ao payload do veiculo (linhas 807-825)**

Incluir os campos `marca` e `modelo` diretamente do registro do veiculo.

**2. Inferir `codigo_tipo_veiculo` a partir da categoria do contrato**

Buscar `veiculo_categoria` da tabela `contratos` (que ja esta sendo consultada para o vendedor). Usar isso para mapear o tipo de veiculo corretamente (moto, carro, caminhao, etc.) em vez de depender de um campo inexistente.

**3. Melhorar o mapeamento de combustivel**

Criar logica de normalizacao que converta valores compostos do banco (ex: `GASOLINA/ALCOOL/GAS NATURAL`) para o valor mapeavel mais proximo (`flex` ou `gnv`). Tratar tambem `ALCOOL/GASOLINA` como `flex`.

**4. Remover referencias a campos inexistentes**

- Substituir `veiculo.km || veiculo.quilometragem || 0` por apenas `0` (ou buscar de outra fonte se disponivel)
- Substituir `veiculo.numero_motor || ''` por string vazia (campo nao existe)

**5. Buscar dados complementares do contrato**

Expandir a query existente do contrato (ja buscando `vendedor_id`) para tambem trazer `veiculo_categoria` e usar para inferir o tipo de veiculo.

## Resumo das alteracoes no payload

```text
ANTES (campos faltando/errados):
  placa, chassi, renavam, ano_fabricacao, ano_modelo,
  codigo_fipe, valor_fipe,
  kilometragem: 0 (campo inexistente),
  numero_motor: '' (campo inexistente),
  codigo_tipo_veiculo: 1 (sempre fallback),
  codigo_cor: null (se cor nao mapeada),
  codigo_combustivel: null (valor composto nao mapeavel)

DEPOIS (corrigido):
  marca, modelo,  <-- NOVOS
  placa, chassi, renavam, ano_fabricacao, ano_modelo,
  codigo_fipe, valor_fipe,
  kilometragem: 0,
  numero_motor: '',
  codigo_tipo_veiculo: inferido da categoria do contrato,
  codigo_cor: mapeado (ja funciona para valores simples),
  codigo_combustivel: normalizado antes do mapeamento
```

## Arquivo a modificar

- `supabase/functions/sga-hinova-sync/index.ts` -- corrigir o payload do veiculo, expandir query do contrato, normalizar combustivel

