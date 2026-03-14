

# Fix: PWA prompt em WebView + overlay "Sem comunicação" bloqueando mapa

## Problema 1: PWA install não oferecido
O associado acessou via **WhatsApp WebView** (visível no topo do screenshot). WebViews **não disparam** o evento `beforeinstallprompt` e não suportam instalação PWA. O hook `usePWAInstall` retorna `isInstallable: false` porque `deferredPrompt` nunca é capturado, e como não é iOS, o prompt nunca aparece.

**Solução**: Detectar WebView e mostrar um banner orientando o usuário a "Abrir no Chrome/Safari" para instalar. Também mostrar o modal PWA automaticamente no primeiro login do associado (independente do `beforeinstallprompt`), usando localStorage para controlar exibição única.

**Arquivos**:
- `src/hooks/usePWAInstall.ts` — adicionar detecção de WebView e flag `isWebView`
- `src/components/pwa/PWAInstallPrompt.tsx` — quando WebView, mostrar banner "Abrir no navegador" com botão que copia URL
- `src/pages/app/AppHome.tsx` (ou equivalente) — mostrar modal PWA no primeiro login via flag `pwa-first-login-shown`

## Problema 2: "Sem comunicação" bloqueando o mapa na primeira visualização
O rastreador foi ativado recentemente mas a `ultima_comunicacao` no banco estava com 8h de atraso. O overlay de "Sem comunicação" (>= 4h) cobre **100% da tela**, impedindo o associado de ver qualquer coisa. Após refresh manual a edge function `posicao-veiculo` buscou dados frescos da Softruck e funcionou.

**Solução**: Trocar o overlay full-screen por um **banner de aviso** no topo do mapa (não bloqueante), permitindo que o mapa apareça por baixo com a última posição conhecida. O botão "Tentar reconectar" continua disponível. O overlay full-screen só deve aparecer quando **não há nenhuma posição válida** (lat/lng nulas).

**Arquivo**:
- `src/pages/app/AppRastreamento.tsx` — linhas 393-411: converter overlay "Sem comunicação prolongada" de bloqueante para banner não-bloqueante quando há posição válida

### Resumo das mudanças

1. `src/hooks/usePWAInstall.ts` — adicionar `isWebView` detection
2. `src/components/pwa/PWAInstallPrompt.tsx` — banner alternativo para WebView ("Abra no Chrome")
3. `src/pages/app/AppRastreamento.tsx` — "Sem comunicação" vira banner quando há posição válida, overlay só quando sem posição

