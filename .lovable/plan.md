
## Diagnóstico

O motivo mais provável para esse veículo ficar sem plano não é a região nem a regra Especial/Select em si.

Pelo código e pelos logs, o sistema está tratando esse cenário como se o veículo estivesse caindo na linha de motos/`advanced`, porque no console só aparecem avaliações de:

- `ADVANCED`
- `ADVANCED+`

Para um **Chevrolet Meriva Maxx 2009**, isso está errado. Sendo carro, os planos `advanced` deveriam ser ignorados antes mesmo da elegibilidade.

## O que encontrei

### 1) O filtro de preço existe para esse veículo
No banco existem faixas válidas para FIPE `R$ 26.860` em:

- `select`
- `select-one`
- `especial`
- `especial-plus`

Ou seja: não é falta de tabela de preço.

### 2) O modelo é elegível
Também existem regras ativas para:

- `CHEVROLET / MERIVA` em `select`
- `CHEVROLET / MERIVA` em `select-one`
- `CHEVROLET / MERIVA` em `especial`

Ou seja: não é falta de elegibilidade do modelo.

### 3) O problema está antes disso: detecção do tipo do veículo no fluxo da Cotação Rápida
No `CotacaoFormDialog`, o tipo do veículo é montado a partir de duas fontes:

- dados reais do veículo encontrado
- estado manual da UI de FIPE (`tipoFipeSelecionado`)

Hoje esse fluxo pode contaminar a cotação com estado manual anterior e fazer um carro entrar como `moto`, o que explica exatamente o sintoma de só avaliar `ADVANCED`.

## Observação importante

No banco atual, o `SELECT EXCLUSIVE` está configurado como `tipo_uso = aplicativo`, então ele **não aparece em passeio** pela regra atual.  
Então existem dois assuntos separados:

1. o bug que está zerando todos os planos para o Meriva  
2. a configuração comercial do `Select Exclusive`, que hoje não está como passeio

Pelo seu relato, eu trataria só o item 1 agora, para não mexer em regra comercial sem necessidade.

## Plano de correção

### Arquivo principal
- `src/components/cotacoes/CotacaoFormDialog.tsx`

### Ajustes
1. **Isolar a detecção de tipo do veículo no fluxo por placa**
   - Se `veiculoEncontrado` existir, o cotador deve usar somente os dados reais do veículo encontrado.
   - O estado manual `tipoFipeSelecionado` não deve influenciar a cotação nesse caso.

2. **Restringir o override manual de moto**
   - A regra `if (marcaSelecionada && tipoFipeSelecionado === 'motos') return 'moto'`
   - deve valer apenas no fluxo manual FIPE
   - e não quando a cotação veio por placa / veículo já resolvido.

3. **Resetar estado manual ao buscar placa**
   - Ao carregar um veículo por placa, resetar explicitamente o contexto manual de FIPE que possa vazar para o cálculo:
   - `tipoFipeSelecionado`
   - `marcaSelecionada`
   - `modeloSelecionado`
   - `anoSelecionado`

4. **Manter o restante do motor intacto**
   - Não mexer em `usePlanosCotacao`
   - Não mexer em regra regional
   - Não mexer na whitelist de elegibilidade
   - Não mexer em preços

## Resultado esperado após o ajuste

Para esse Meriva 2009, o sistema deve voltar a tratá-lo como `carro`, permitindo avaliar as linhas corretas:

- `Select`
- `Select One`
- eventualmente `Especial/Especial Plus`, conforme a regra de ano/categoria

## Detalhe técnico

Fluxo atual problemático:
```text
Cotação Rápida
→ busca por placa
→ veículo real carregado
→ estado manual de FIPE ainda pode influenciar tipoVeiculo
→ carro pode ser tratado como moto
→ sobram só planos da linha advanced
→ advanced é negado
→ nenhum plano aparece
```

Fluxo corrigido:
```text
Cotação Rápida
→ busca por placa
→ veículo real carregado
→ tipoVeiculo derivado só do veículo real
→ linhas de carro avaliadas
→ Select / Select One voltam a aparecer
```
