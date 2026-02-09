

# Corrigir Layout da Pagina ExecutarRetirada

## Problemas Identificados (screenshot)

1. **Footer fixo sobreposto pela bottom nav**: O footer com "Concluir Retirada" e "Associado Ausente" usa `fixed bottom-0`, mas a bottom nav do `InstaladorLayout` fica por cima, cortando o texto de validacao e tornando botoes parcialmente inacessiveis.
2. **Texto de validacao cortado**: As mensagens como "Complete o checklist", "Selecione integridade" aparecem truncadas e sobrepostas pela barra de navegacao.

## Solucao

### Arquivo: `src/pages/instalador/ExecutarRetirada.tsx`

**Mudanca no footer (linha 729):** Adicionar `bottom-16` (ou `bottom-20` com safe area) ao invez de `bottom-0`, para posicionar o footer ACIMA da bottom nav do InstaladorLayout que tem ~64px de altura.

```
// De:
<footer className="fixed bottom-0 left-0 right-0 border-t border-slate-700 bg-slate-800 p-4 space-y-2">

// Para:
<footer className="fixed bottom-16 left-0 right-0 border-t border-slate-700 bg-slate-800 p-4 pb-2 space-y-2 z-40">
```

**Ajustar padding inferior do container (linha 370):** Aumentar de `pb-40` para `pb-56` para acomodar o footer reposicionado + espaco extra.

```
// De:
<div className="flex min-h-screen flex-col bg-slate-900 pb-40">

// Para:
<div className="flex min-h-screen flex-col bg-slate-900 pb-56">
```

**Tambem corrigir a tela de erro (linha 364):** O botao "Voltar" ainda aponta para `/vistoriador/tarefas`.

```
// De:
<Button onClick={() => navigate('/vistoriador/tarefas')}>Voltar</Button>

// Para:
<Button onClick={() => navigate('/instalador/tarefas')}>Voltar</Button>
```

## Resultado

- O footer ficara visivel acima da barra de navegacao
- Todo o texto de validacao sera legivel
- Os botoes serao totalmente clicaveis no mobile

