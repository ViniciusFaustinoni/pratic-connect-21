

# Remover "Prestadores" duplicado do menu Oficinas

## Problema

O item "Prestadores" aparece em dois menus do sidebar:
- **Assistencia 24h** -> Prestadores (`/assistencia/prestadores`) -- CORRETO, deve permanecer
- **Oficinas** -> Prestadores (`/oficinas/prestadores`) -- DUPLICADO, deve ser removido

## Correcoes

### 1. Remover item do menu lateral

**Arquivo:** `src/components/layout/AppSidebar.tsx`

Remover a linha `{ title: 'Prestadores', url: '/oficinas/prestadores', icon: Puzzle }` do grupo "Oficinas" (linha 233).

### 2. Remover rota duplicada

**Arquivo:** `src/App.tsx`

Remover a rota `<Route path="/oficinas/prestadores" element={<PrestadoresPage />} />` (linha 574) e o import `PrestadoresPage` (linha 89), ja que a pagina de prestadores e acessada via `/assistencia/prestadores`.

### 3. Remover pagina duplicada (opcional)

**Arquivo:** `src/pages/oficinas/Prestadores.tsx`

Se a rota `/assistencia/prestadores` usa um componente diferente, manter ambos. Caso contrario, o arquivo pode ser removido.

## Arquivos Afetados

| Acao | Arquivo |
|---|---|
| Modificar | `src/components/layout/AppSidebar.tsx` -- remover item Prestadores do grupo Oficinas |
| Modificar | `src/App.tsx` -- remover rota e import de oficinas/prestadores |
| Avaliar | `src/pages/oficinas/Prestadores.tsx` -- remover se nao for usado em outro lugar |

