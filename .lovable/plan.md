

# Plano: Remover timeout de sessão

## Problema
Usuários estão sendo deslogados automaticamente pelo sistema de timeout customizado (`useSessionTimeout`). Isso prejudica o uso do sistema.

## O que será feito

Remover completamente o `SessionTimeoutProvider` dos 3 layouts onde ele é usado. O Supabase já gerencia sessão automaticamente com `autoRefreshToken: true` e `persistSession: true` — o token se renova sozinho enquanto o usuário tiver conexão.

## Alterações

| Arquivo | Ação |
|---------|------|
| `src/components/layout/AppLayout.tsx` | Remover `SessionTimeoutProvider` wrapper |
| `src/components/app/AppLayout.tsx` | Remover `SessionTimeoutProvider` wrapper |
| `src/components/layout/AgenciaLayout.tsx` | Remover `SessionTimeoutProvider` wrapper |

Os arquivos abaixo **não serão deletados** (para evitar riscos), mas ficarão sem uso:
- `src/components/auth/SessionTimeoutProvider.tsx`
- `src/components/auth/SessionTimeoutModal.tsx`
- `src/hooks/useSessionTimeout.ts`

## Resultado
- Nenhum usuário será deslogado por inatividade
- A sessão do Supabase continua sendo renovada automaticamente via refresh token
- Se o token expirar naturalmente (ex: usuário offline por dias), o Supabase cuida do redirect normalmente via `onAuthStateChange`

