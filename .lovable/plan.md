

## Correção: Checklist apenas informativo, sem bloqueio

### Problema
O checklist foi implementado com bloqueio: o botão "Confirmar Ativação" fica desabilitado quando `checklist.pronto === false` e o texto muda para "Dados incompletos". Isso não foi solicitado.

### Alteração necessária

**Arquivo:** `src/components/cadastro/BotaoAtivarSGA.tsx`

**Linha 174-179** — Remover o `disabled` e o texto condicional:

De:
```tsx
<AlertDialogAction
  onClick={handleAtivar}
  className="bg-blue-600 hover:bg-blue-700"
  disabled={!checklist.pronto}
>
  {!checklist.pronto ? 'Dados incompletos' : 'Confirmar Ativação'}
```

Para:
```tsx
<AlertDialogAction
  onClick={handleAtivar}
  className="bg-blue-600 hover:bg-blue-700"
>
  Confirmar Ativação
```

Isso é a única mudança. O checklist continua aparecendo como diagnóstico visual dentro do dialog, mas não impede a ativação.

