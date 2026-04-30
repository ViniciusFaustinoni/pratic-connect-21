## Problema

Placa **FIC9E65** (Chevrolet Agile LTZ 1.4 MPFI) retorna o modelo errado: o sistema está mostrando uma variante "EASYTRONIC" (câmbio automatizado), quando o CRLV indica a versão manual flex.

## Causa raiz

Em `supabase/functions/plate-lookup/index.ts` (linhas 142, 207–211):

```ts
const fipesArray = apiData.data?.fipes || apiData.fipes || [];
...
const fipeData = fipesArray[0] ? { codigo, valor, mesReferencia } : null;
```

A API `placas.fipeapi.com.br` devolve **várias variantes FIPE** (manual, automatizado/Easytronic, automático, anos próximos, etc.). O código pega cegamente `fipesArray[0]`, sem comparar com:
- combustível do CRLV (`veiculo.combustivel`)
- câmbio do CRLV (`veiculo.caixa_cambio`)
- ano modelo do CRLV (`veiculo.ano_modelo`)

Resultado: para o Agile, a primeira posição do array é a variante Easytronic, então é escolhida indevidamente. Além disso, o `modelo` exibido no formulário vem de `marca_modelo` (texto cru da API, sem versão), e o "EASYTRONIC" aparece via o **código FIPE** selecionado (que carrega a descrição da variante quando o front busca o nome na tabela FIPE).

## Plano

### 1. Heurística de matching no `plate-lookup` (edge function)

Substituir `fipesArray[0]` por uma função `escolherMelhorFipe(fipes, veiculo)` com pontuação:

- **+10** se a descrição FIPE (`fipes[i].descricao` / `modelo` / `texto_modelo`) bate com o combustível do CRLV (FLEX/GASOLINA/DIESEL/ÁLCOOL).
- **+8** se o câmbio do CRLV é **manual** e a descrição **NÃO** contém `AUT`, `EASYTRONIC`, `CVT`, `DCT`, `TIPTRONIC`, `S-TRONIC`. Inverso para automático.
- **+5** se o ano FIPE (`fipes[i].ano` ou ano referenciado) coincide com `ano_modelo`.
- **+2** se a descrição menciona a cilindrada do CRLV (1.0 / 1.4 / 1.6 / 1.8 / 2.0…).
- Desempate: menor diferença de valor para a mediana das variantes (evita outliers); persistindo empate, mantém ordem original.

Logar o array completo + pontuações no `console.log` para inspeção via OCR/Audit logs.

### 2. Retornar todas as variantes para o front

Ampliar o payload:

```ts
fipeData: { codigo, valor, mesReferencia, descricao },
fipeAlternativas: fipesArray.map(f => ({ codigo, valor, descricao, ano }))
```

Assim o usuário pode trocar manualmente quando a heurística errar.

### 3. UI: seletor de variante FIPE

Em `src/components/cotacao/EtapaConsultaFipe.tsx` e `src/components/cotacoes/CotacaoFormDialog.tsx`:

- Quando `fipeAlternativas.length > 1`, exibir um `Select` "Confirme a versão FIPE" com cada variante (descrição + valor + código).
- Selecionar por padrão a recomendada pela heurística, mas permitir troca.
- Ao trocar, atualizar `codigoFipe`, `valorFipe` e o campo `modelo` (concatenando a descrição da variante quando útil).

### 4. Auditoria (opcional, baixo custo)

Persistir em `ocr_execution_logs` (ou nova tabela `plate_lookup_logs`) a placa consultada, o array de variantes recebido, a escolhida e a "fonte" (`heuristica` vs `usuario_trocou`) para futuras análises de erro como este do Agile.

## Arquivos afetados

- `supabase/functions/plate-lookup/index.ts` — heurística + payload com alternativas.
- `src/hooks/useFipe.ts` — tipagem `PlateResult` ganha `fipeAlternativas`.
- `src/components/cotacao/EtapaConsultaFipe.tsx` — Select de variante.
- `src/components/cotacoes/CotacaoFormDialog.tsx` — Select de variante.
- (Opcional) migration criando `plate_lookup_logs` + aba na tela de Logs de Auditoria.

## Validação

1. Refazer consulta com placa **FIC9E65**: deve sugerir a variante manual flex (Agile LTZ 1.4) com base no CRLV (câmbio "—"/manual, combustível ÁLCOOL/GASOLINA), e mostrar Easytronic apenas como alternativa.
2. Testar uma placa de carro automático (ex.: HB20 Automático) para garantir que a heurística inverte corretamente.
3. Confirmar que os logs mostram pontuação de cada variante.
