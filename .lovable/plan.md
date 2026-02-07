
## Problema Identificado

A imagem mostra que o menu de seleção de rastreador está truncando o nome do rastreador. Observando a lista de "Rastreador Substituto", o item está sendo cortado, exibindo apenas "RAT-86266708340368" e "IMEI: 86266708340368", mas o layout não permite expansão adequada do conteúdo.

## Causa

Na estrutura HTML (linhas 537-556 em `ExecutarManutencao.tsx`), o container div para cada item do rastreador tem:
- `className="p-3 cursor-pointer transition-colors"`
- Este container está dentro de `max-h-48 overflow-y-auto border rounded-lg`

O problema é que **não há `break-words` ou `word-break` nos textos**, e o texto longo (números de série/IMEI) está sendo truncado pela largura do container. O elemento pode estar com overflow hidden implícito ou com width restrita pelo modal.

## Solução

Adicionar propriedades CSS ao item do rastreador para garantir que:

1. **Quebra de texto**: Adicionar `break-words` ou `break-all` para números longos (IMEI com 15-16 dígitos)
2. **Padding adequado**: Garantir que o texto tenha espaço suficiente
3. **Width 100%**: Garantir que o container use toda a largura disponível
4. **Overflow handling**: Usar `overflow-wrap: break-word` para a seção de metadados

### Alteração Específica

Na seção do item do rastreador (linhas 537-556), atualizar a estrutura:

```tsx
<div
  key={r.id}
  onClick={() => setRastreadorNovoId(r.id)}
  className={cn(
    "p-3 cursor-pointer transition-colors w-full",  // Adicionar w-full
    rastreadorNovoId === r.id 
      ? "bg-primary/10 border-l-2 border-l-primary" 
      : "hover:bg-muted/50"
  )}
>
  <p className="font-medium text-sm break-words">{r.codigo}</p>
  <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground overflow-wrap-break-word">
    {r.numero_serie && (
      <span className="break-all">S/N: <span className="font-mono">{r.numero_serie}</span></span>
    )}
    {r.imei && (
      <span className="break-all">IMEI: <span className="font-mono">{r.imei}</span></span>
    )}
  </div>
</div>
```

### Classes CSS a Aplicar

- **`w-full`**: No container div do item para usar toda a largura
- **`break-words`**: Na linha de código para quebrar palavras longas
- **`break-all`**: Nos spans de S/N e IMEI para quebrar números longos se necessário
- **Alternativa**: Usar `whitespace-normal` para garantir quebra natural de linhas

### Resultado Esperado

Quando o vistoriador visualizar a lista de rastreadores disponíveis para substituição, todos os textos (código, S/N, IMEI) serão exibidos completamente sem truncamento, com quebra de linhas natural para números longos se necessário.

