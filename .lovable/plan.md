

# Plano: Corrigir Navegacao e Notificacoes Push do Instalador

## Problema 1 — Botao "Navegar" nao funciona

A funcao `abrirNavegacao` usa `window.open(url, '_blank')` que e **bloqueado em PWA standalone** no iOS e Android. O navegador nao abre porque em modo standalone nao existe conceito de "nova aba".

**Correcao**: Trocar para `window.location.href = url` que abre o Google Maps nativamente no celular. Aplicar em:
- `src/components/vistoriador/TarefaAtualCard.tsx` (L105-109)
- `src/components/vistoriador/EncaixeCard.tsx` (L42-47)
- `src/pages/monitoramento/Encaixes.tsx` (L58-63)
- `src/pages/instalador/ExecutarManutencao.tsx` (L100-106)

Tambem corrigir o botao "WhatsApp Suporte" em `InstaladorHome.tsx` (L172) que tem o mesmo problema com `window.open`.

## Problema 2 — Push Notifications falhando

A funcao `subscribe` chama a edge function `send-push-profissional` para obter a VAPID key, mas se a chamada falha (erro de rede, CORS, etc.), usa o `VAPID_PUBLIC_KEY_FALLBACK` que e uma string **placeholder invalida**. Isso faz `pushManager.subscribe` lancar erro generico, resultando no toast "Nao foi possivel ativar as notificacoes".

**Correcoes**:
1. Remover o fallback invalido — se nao conseguir obter a VAPID key real, retornar erro claro em vez de tentar com chave falsa
2. Melhorar tratamento de erro: adicionar `reason: 'vapid_unavailable'` e mensagem especifica no banner
3. Adicionar mais logging para diagnostico

## Arquivos afetados

| Arquivo | Alteracao |
|---|---|
| `src/components/vistoriador/TarefaAtualCard.tsx` | `window.open` → `window.location.href` |
| `src/components/vistoriador/EncaixeCard.tsx` | `window.open` → `window.location.href` |
| `src/pages/monitoramento/Encaixes.tsx` | `window.open` → `window.location.href` |
| `src/pages/instalador/ExecutarManutencao.tsx` | `window.open` → `window.location.href` |
| `src/pages/instalador/InstaladorHome.tsx` | WhatsApp `window.open` → `window.location.href` |
| `src/hooks/usePushNotificationsProfissional.ts` | Remover fallback VAPID invalido, melhorar erros |
| `src/components/instalador/PushNotificationBanner.tsx` | Adicionar case `vapid_unavailable` |

