## Problema

No modal de Cotação Rápida (usado também em Substituição de Placa), quando a placa retorna 2+ versões FIPE, o `SelectTrigger` mostra o conteúdo completo do `SelectItem` selecionado (descrição em uma linha + linha secundária com valor e código). Como o trigger tem altura fixa `h-9` e o item interno é um `flex-col` de duas linhas, no mobile o texto:

- transborda para fora do trigger,
- sobrepõe visualmente o rótulo de aviso âmbar acima ("2 versões FIPE encontradas — confira…"),
- e deixa a linha "R$ 40.393 · cód. 001242-4" vazando logo abaixo do campo.

É o que aparece no print enviado.

Arquivo afetado: `src/components/cotacoes/CotacaoFormDialog.tsx`, bloco do seletor entre as linhas **2426–2471**.

## Correção (somente UI / responsividade)

Mudanças mínimas no mesmo bloco, sem mexer em lógica, estado ou regras de negócio:

1. **Forçar o trigger a mostrar apenas a descrição em uma linha, truncada**
   Passar uma string controlada como filho de `SelectValue` (sobrescreve o render padrão que copia os children do item):
   ```tsx
   <SelectValue placeholder="Selecione a versão correta">
     {veiculoEncontrado.fipeData?.descricao || veiculoEncontrado.vehicleData?.modelo || 'Selecione a versão correta'}
   </SelectValue>
   ```

2. **Truncar dentro do trigger no mobile** (Radix envolve o valor em um `<span>`):
   No `SelectTrigger`, ajustar a className para:
   ```
   className="h-9 bg-background w-full [&>span]:block [&>span]:truncate [&>span]:text-left text-sm"
   ```

3. **Garantir respiro entre o rótulo âmbar e o select** no container do bloco (linha 2428):
   trocar `space-y-1` por `space-y-2` e o `Label` ganhar `block leading-snug` para o aviso de duas linhas não encostar no trigger.

4. **Dropdown abre dentro da viewport mobile**: trocar `SelectContent` `max-w-[600px]` por `className="max-w-[calc(100vw-2rem)] sm:max-w-[600px]"` para evitar overflow horizontal em telas pequenas. Cada `SelectItem` mantém as duas linhas (descrição + valor/código), mas com `whitespace-normal break-words` no `<span className="font-medium">` para descrições muito longas quebrarem corretamente dentro do dropdown.

## Fora do escopo

- Nada de lógica do `onValueChange`, parsing FIPE, regra do 1%, busca por placa ou fluxo de Substituição.
- Nenhum outro componente além desse bloco do `CotacaoFormDialog.tsx`.
- Sem mudança em tokens do design system ou no `index.css`.

## Verificação

Reproduzir no preview em viewport 360–414 px com uma placa que retorne múltiplas variantes FIPE (ex.: o caso da Fiat Idea Adventure do print): o trigger fica em uma linha truncada, o aviso âmbar e o subtítulo "R$ … · cód. …" deixam de sobrepor, e o dropdown abre dentro da tela.
