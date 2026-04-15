

## Plano: Aumentar altura do modal de elegibilidade no mobile

### Problema

O `DialogContent` base já tem `max-h-[90vh]` e `overflow-y-auto`. O `EligibilityRulesEditor` sobrescreve com `max-h-[85vh]`, o que na verdade **reduz** a altura disponível. No mobile (390px), isso corta conteúdo.

### Correção

**Arquivo: `src/components/admin/planos/EligibilityRulesEditor.tsx`** — linha 301

Trocar `max-h-[85vh]` por `max-h-[calc(100vh-2rem)]` para usar praticamente toda a altura da tela no mobile:

```tsx
<DialogContent 
  className="max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto" 
  onPointerDownOutside={(e) => e.preventDefault()}
>
```

Isso garante que o modal ocupe até `100vh - 32px`, dando espaço suficiente para todo o formulário (tipo de regra, modo, campos de valor, botão salvar) ser acessível via scroll.

