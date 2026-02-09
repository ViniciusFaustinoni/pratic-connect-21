
# Corrigir Design Mobile da ExecutarRetirada

## Problema

O footer (botoes "Concluir Retirada" e "Associado Ausente") se estende pela largura total da tela, enquanto a bottom nav do layout usa `max-w-md mx-auto`. Isso cria uma inconsistencia visual onde os botoes ficam maiores que o conteudo da pagina. Alem disso, o texto de validacao ainda fica parcialmente cortado.

## Solucao

### Arquivo: `src/pages/instalador/ExecutarRetirada.tsx`

**1. Footer - adicionar `max-w-md mx-auto` para alinhar com a bottom nav (linha 729):**

```typescript
// De:
<footer className="fixed bottom-16 left-0 right-0 border-t border-slate-700 bg-slate-800 p-4 pb-2 space-y-2 z-40">

// Para:
<footer className="fixed bottom-16 left-0 right-0 border-t border-slate-700 bg-slate-800 p-4 pb-2 space-y-2 z-40 max-w-md mx-auto">
```

**2. Container raiz - limitar largura para consistencia mobile (linha 370):**

```typescript
// De:
<div className="flex min-h-screen flex-col bg-slate-900 pb-56">

// Para:
<div className="flex min-h-screen flex-col bg-slate-900 pb-56 max-w-md mx-auto">
```

**3. Tela de erro - mesmo tratamento (linha 361):**

```typescript
// De:
<div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-900 p-4">

// Para:
<div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-900 p-4 max-w-md mx-auto">
```

**4. Modal de confirmacao - ja usa `max-w-md`, sem mudanca necessaria.**

## Resultado

- Footer, conteudo e bottom nav ficam todos alinhados dentro do `max-w-md`
- Design harmonico e consistente no mobile
- Botoes nao se estendem alem da area visivel do app
