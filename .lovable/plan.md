# Corrigir erro "Object.hasOwn is not a function" no Chat IA / Relacionamento

## Causa raiz
O erro mostrado na tela do operador é um runtime error do **browser**, não da regra de acesso `relacionamento`. `Object.hasOwn` é ES2022 e só existe em:
- Chrome/Edge 93+ (set/2021)
- Firefox 92+
- Safari 15.4+ (mar/2022)

Dependências modernas do bundle (Radix UI, @tanstack/react-query, react-hook-form, etc.) usam `Object.hasOwn` internamente. Em qualquer browser/WebView mais velho que isso, **qualquer rota** que carregue esses chunks explode — só "parece" ser do Relacionamento porque foi a rota visitada.

A permissão `relacionamento` está OK: `/eventos/chat-ia` não tem `allowedRoles` restritivo, o `AppErrorBoundary` é que pinta a tela de erro.

## O que fazer

### 1. Adicionar polyfill universal em `src/main.tsx`
Inserir, antes de qualquer `import` de app, um shim mínimo:

```ts
if (typeof Object.hasOwn !== 'function') {
  Object.defineProperty(Object, 'hasOwn', {
    value: (obj: object, prop: PropertyKey) =>
      Object.prototype.hasOwnProperty.call(obj, prop),
    configurable: true,
    writable: true,
  });
}
```

Isso resolve **todas** as rotas, não só Chat IA. Custo: ~150 bytes, zero impacto em browsers modernos.

### 2. Subir o target de build do Vite/esbuild
Em `vite.config.ts`, garantir `build.target` explícito coerente com `Object.hasOwn` (ex.: `es2022`) para evitar regressão futura — e documentar que browsers abaixo de Chrome 93 / Safari 15.4 não são suportados.

### 3. Verificação pós-fix
- Pedir ao operador para recarregar (`Ctrl+Shift+R`) após o deploy.
- Conferir o user-agent dele (Omnidesk/Callix embarcado costuma usar Chromium velho — se for o caso, sugerir abrir no Chrome do sistema).

## Fora de escopo
- Não mexer em `ProtectedRoute`, `useRouteGuard`, `useModuleVisibility` nem nos perfis de Relacionamento — não há bug ali.
- Não tocar na lógica do Chat IA.
