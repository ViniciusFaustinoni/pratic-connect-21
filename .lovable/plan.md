
# Correção: Scroll do Modal de Resultado da Manutenção

## Problema Identificado

O modal "Resultado da Manutenção" em `ExecutarManutencao.tsx` (linhas 450-735) não permite scroll no dispositivo móvel, impedindo o vistoriador de acessar os botões "Cancelar" e "Confirmar".

### Causa Raiz

A estrutura atual usa:
```tsx
<DialogContent className="max-w-md max-h-[90vh] overflow-hidden flex flex-col">
  <DialogHeader>...</DialogHeader>
  <ScrollArea className="flex-1 -mx-6 px-6">
    ...conteúdo...
  </ScrollArea>
  <DialogFooter>...</DialogFooter>
</DialogContent>
```

O problema está na combinação de:
1. **`overflow-hidden` no DialogContent** - bloqueia qualquer overflow
2. **`ScrollArea` com `flex-1`** - o `flex-1` não calcula corretamente a altura disponível quando não há altura fixa
3. **`-mx-6 px-6`** - margem negativa pode causar problemas de touch em mobile

### Solução

Substituir a estrutura atual por um layout mais robusto que funcione corretamente em dispositivos móveis:

1. **Remover `overflow-hidden`** do DialogContent
2. **Usar altura fixa no ScrollArea** com `max-h-[calc(90vh-180px)]` para garantir espaço para header/footer
3. **Adicionar `overscroll-contain`** para melhor experiência de scroll em mobile
4. **Garantir que o footer permaneça visível** fora da área de scroll

---

## Alterações

### Arquivo: `src/pages/instalador/ExecutarManutencao.tsx`

**Linha 452 - DialogContent**:
Remover `overflow-hidden` e ajustar estrutura:

```tsx
// ANTES:
<DialogContent className="max-w-md max-h-[90vh] overflow-hidden flex flex-col">

// DEPOIS:
<DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0">
```

**Linhas 453-455 - DialogHeader**:
Adicionar padding:

```tsx
<DialogHeader className="p-4 pb-2 flex-shrink-0">
  <DialogTitle>Resultado da Manutenção</DialogTitle>
</DialogHeader>
```

**Linha 457 - ScrollArea**:
Usar altura máxima calculada e remover margens negativas:

```tsx
// ANTES:
<ScrollArea className="flex-1 -mx-6 px-6">

// DEPOIS:
<ScrollArea className="flex-1 max-h-[calc(90vh-140px)] px-4 overscroll-contain">
```

**Linha 705 - DialogFooter**:
Garantir que fique sempre visível:

```tsx
// ANTES:
<DialogFooter className="flex-row gap-2 pt-4 border-t">

// DEPOIS:
<DialogFooter className="flex-row gap-2 p-4 border-t flex-shrink-0 bg-background">
```

---

## Estrutura Final

```tsx
<DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0">
  <DialogHeader className="p-4 pb-2 flex-shrink-0">
    <DialogTitle>Resultado da Manutenção</DialogTitle>
  </DialogHeader>

  <ScrollArea className="flex-1 max-h-[calc(90vh-140px)] px-4 overscroll-contain">
    <div className="space-y-4 pb-4">
      {/* Todo o conteúdo scrollável */}
    </div>
  </ScrollArea>

  <DialogFooter className="flex-row gap-2 p-4 border-t flex-shrink-0 bg-background">
    <Button variant="outline" ...>Cancelar</Button>
    <Button ...>Confirmar</Button>
  </DialogFooter>
</DialogContent>
```

---

## Resumo das Alterações

| Linha | Alteração |
|-------|-----------|
| 452 | Remover `overflow-hidden`, adicionar `p-0` |
| 453-455 | Adicionar `className="p-4 pb-2 flex-shrink-0"` ao DialogHeader |
| 457 | Trocar `flex-1 -mx-6 px-6` por `flex-1 max-h-[calc(90vh-140px)] px-4 overscroll-contain` |
| 705 | Adicionar `flex-shrink-0 bg-background` e trocar `pt-4` por `p-4` no DialogFooter |

---

## Resultado Esperado

Após a correção:
- O conteúdo do modal será scrollável normalmente
- O header e footer ficarão fixos (sempre visíveis)
- Os botões "Cancelar" e "Confirmar" estarão sempre acessíveis
- O scroll funcionará corretamente tanto em desktop quanto em dispositivos móveis
