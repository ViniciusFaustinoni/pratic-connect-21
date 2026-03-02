

# Diferenciar fotos obrigatorias por tipo de veiculo (carro vs moto)

## Problema

A funcao `detectarTipoVeiculo` em `src/data/vistoriaConfigCompleta.ts` so aceita um parametro `tipoVeiculoStr`, que vem de `veiculos.tipo_veiculo` -- uma coluna que **nao existe** na tabela. O resultado: sempre retorna `'automovel'`, exibindo 31 fotos de carro mesmo para motos.

## Solucao

Expandir a deteccao para usar tambem `marca` e `modelo` do veiculo (campos que ja existem na tabela). Sao 3 arquivos com alteracoes minimas:

### 1. `src/data/vistoriaConfigCompleta.ts` -- Melhorar `detectarTipoVeiculo`

Adicionar listas de keywords e marcas exclusivas de moto, e aceitar `modelo` e `marca` como parametros opcionais:

- Keywords de modelo: 'moto', 'motocicleta', 'nxr', 'bros', 'cg', 'cb', 'cbr', 'pcx', 'biz', 'pop', 'titan', 'fan', 'xre', 'lander', 'tenere', 'crosser', 'fazer', 'ybr', 'neo', 'burgman', 'intruder', 'factor', 'scooter', 'ciclomotor', 'triciclo'
- Marcas exclusivas: YAMAHA, SUZUKI, KAWASAKI, HARLEY-DAVIDSON, TRIUMPH, DUCATI, KTM, DAFRA, SHINERAY, KASINSKI

Ordem de deteccao:
1. Se `tipo_veiculo` explicito contem 'moto' -> moto
2. Se `modelo` contem keyword de moto -> moto
3. Se `marca` e exclusiva de moto -> moto
4. Senao -> automovel

### 2. `src/pages/instalador/InstaladorChecklist.tsx` (linha 185-188)

Passar `modelo` e `marca` do veiculo para a funcao de deteccao:

```
detectarTipoVeiculo(veiculoData?.tipo_veiculo, veiculoData?.modelo, veiculoData?.marca)
```

### 3. `src/pages/instalador/ExecutarVistoriaCompleta.tsx` (linha 170-174)

Mesma correcao -- usar `detectarTipoVeiculo` importada com os 3 parametros em vez da logica inline atual.

## Resultado

- Motos detectadas automaticamente: exibem 10 fotos (7 veiculo + 3 rastreador)
- Carros continuam com 31 fotos
- Sem migration de banco -- usa campos `marca` e `modelo` ja existentes
- 3 arquivos editados
