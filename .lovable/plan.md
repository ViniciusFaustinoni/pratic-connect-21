## Causa-raiz

`src/components/servicos-campo/ServicoDetailModal.tsx` (L228) usa `<ScrollArea className="flex-1">` envolvendo `<Tabs>`. Dentro da `ScrollArea` do Radix, o viewport interno tem `display:table`, o que quebra `flex-1` do filho e impede o conteúdo (Fotos, Histórico, etc.) de rolar até o fim — o scroll fica "travado" como reportado.

## Fix

Substituir o `ScrollArea` por um `div` simples com `flex-1 min-h-0 overflow-y-auto`. A barra continua nativa do navegador, e o `min-h-0` libera o flex-child a respeitar o `max-h-[92vh]` do `DialogContent`.

```diff
- <ScrollArea className="flex-1">
+ <div className="flex-1 min-h-0 overflow-y-auto">
   <Tabs ...>
   ...
   </Tabs>
- </ScrollArea>
+ </div>
```

Linha 393 (`</ScrollArea>`) → `</div>`.

Sem outras mudanças.