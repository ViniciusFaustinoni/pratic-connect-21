

# Fix: Botão "Criar Cotação" cortado no mobile

## Problema
O `DialogContent` usa `max-h-[90vh] overflow-y-auto` com o botão **dentro** da área de scroll. Em dispositivos mobile (especialmente Safari), barras de navegação reduzem o viewport real, fazendo o botão ficar cortado ou inacessível.

## Solução
Reestruturar o layout do dialog para que o botão fique **fixo no rodapé** (sticky), sempre visível, enquanto apenas o conteúdo do formulário faz scroll.

### Arquivo: `src/components/cotacoes/CotacaoFormDialog.tsx`

**Linha 1144** — Alterar o `DialogContent` para usar flex layout sem overflow próprio:
```tsx
<DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden p-0" ...>
```

**Linhas 1145-1163 (Header)** — Adicionar padding ao header:
```tsx
<DialogHeader className="px-6 pt-6 pb-2">
```

**Área do formulário** — Envolver o conteúdo do form em um div com scroll:
```tsx
<Form ...>
  <form ...>
    <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-4">
      {/* todo o conteúdo dos blocos 1-4 */}
    </div>
    
    {/* BLOCO 5: AÇÕES - fora do scroll */}
    <div className="sticky bottom-0 bg-background border-t px-6 py-3 flex items-center justify-end">
      <Button ...>Criar Cotação</Button>
    </div>
  </form>
</Form>
```

Isso garante que o botão fica sempre visível em qualquer tamanho de tela.

