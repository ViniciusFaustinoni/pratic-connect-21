

# Plano: Mover overlay de almoco para o layout global

## Problema
O `AlmocoBloqueioOverlay` esta apenas no `InstaladorHome` (aba "Inicio"). Quando o profissional navega para "Tarefas", "Mapa" ou "Perfil", o bloqueio desaparece.

## Solucao
Mover o `AlmocoBloqueioOverlay` do `InstaladorHome.tsx` para o `InstaladorLayout.tsx`, antes do container principal. Como o layout envolve todas as abas, o overlay cobrira qualquer tela.

## Alteracoes

| Arquivo | Acao |
|---------|------|
| `src/components/instalador/InstaladorLayout.tsx` | Importar e renderizar `AlmocoBloqueioOverlay` logo apos o `InstaladorGuard`, antes de todo o conteudo |
| `src/pages/instalador/InstaladorHome.tsx` | Remover o import e uso do `AlmocoBloqueioOverlay` (evitar duplicacao) |

O overlay usa `fixed inset-0 z-[100]`, entao ja cobre toda a tela independente de onde e renderizado. Basta garantir que ele exista no layout compartilhado.

