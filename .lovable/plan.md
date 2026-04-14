

## Diagnóstico

O problema tem duas causas:

1. **`scope: "/"` nos manifests PWA** — Ambos os manifests (`manifest-associado.json` e `manifest-profissional.json`) definem `"scope": "/"`, fazendo com que qualquer link do mesmo domínio (ex: `/cotacao/...`, `/acompanhar/...`) abra **dentro da PWA** em vez de no navegador externo.

2. **`navigateFallbackAllowlist` restritiva no Service Worker** — O Workbox só serve `index.html` como fallback para rotas `/instalador` e `/app`. Quando o usuário navega para `/cotacao/...` ou `/acompanhar/...` dentro da PWA, o SW não faz fallback, e a rota falha com React error #300.

## Plano

### 1. Restringir `scope` nos manifests

- `public/manifest-associado.json`: mudar `"scope": "/"` para `"scope": "/app/"`
- `public/manifest-profissional.json`: mudar `"scope": "/"` para `"scope": "/instalador/"`

Isso faz com que links fora do escopo (como `/cotacao/...`, `/acompanhar/...`) abram automaticamente no navegador do sistema, não dentro da PWA.

### 2. Expandir `navigateFallbackAllowlist` no Workbox

Em `vite.config.ts`, adicionar rotas públicas ao allowlist para que, caso o usuário ainda consiga navegar para elas, o SW sirva o `index.html` corretamente:

```
navigateFallbackAllowlist: [/^\/instalador/, /^\/app/, /^\/cotacao/, /^\/acompanhar/]
```

### Arquivos editados
- `public/manifest-associado.json`
- `public/manifest-profissional.json`
- `vite.config.ts`

