
# Liberar rotas de Assistência 24h para Analista de Eventos

## Problema

O Analista de Eventos tenta acessar as subseções de "Assistência 24h" (Dashboard, Fila de Chamados, Prestadores) mas é redirecionado de volta ao Dashboard. Isso acontece porque o route guard (`useRouteGuard.ts`) só permite caminhos específicos para esse perfil, e `/assistencia` não está na lista.

## Solução

Adicionar `/assistencia` ao array `allowedPaths` do bloco `isAnalistaEventosOnly` no arquivo `src/hooks/useRouteGuard.ts`.

Rotas que serão liberadas:
- `/assistencia` — Dashboard de Assistência
- `/assistencia/chamados` — Fila de Chamados (e detalhes `/assistencia/chamados/:id`)
- `/assistencia/prestadores` — Lista de Prestadores (e detalhes `/assistencia/prestadores/:id`)

## Arquivo a modificar

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useRouteGuard.ts` | Adicionar `'/assistencia'` ao array `allowedPaths` do `isAnalistaEventosOnly` |

## Detalhe técnico

A verificação usa `startsWith(path + '/')`, então adicionar apenas `'/assistencia'` já cobre todas as sub-rotas (`/assistencia/chamados`, `/assistencia/chamados/:id`, `/assistencia/prestadores`, etc.).
