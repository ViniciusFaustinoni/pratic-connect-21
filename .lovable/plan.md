

# Permitir acesso a multiplos apps para usuarios com roles mistos

## Problema identificado

No `Dashboard.tsx` (linha 297-301), existe um check **hardcoded** que redireciona para `/instalador`:

```ts
const isInstaladorVistoriadorOnly = isInstaladorVistoriador && 
  !isDiretor && !isGerencia && !isDesenvolvedor && !isAdminMaster;
```

Este check nao considera `coordenador_monitoramento` (nem outros roles nao-operacionais). Resultado: um usuario com `coordenador_monitoramento` + `instalador_vistoriador` e redirecionado para `/instalador` e nunca consegue acessar o app de gestao.

O hook `usePermissions` ja calcula `isInstaladorVistoriadorOnly` corretamente (usa `userIsOnlyOperational` que verifica se TODOS os roles sao operacionais). Como `coordenador_monitoramento` tem `is_operational = false` no banco, a flag correta seria `false` — o usuario deveria ficar no app de gestao.

## Alteracoes

### 1. `src/pages/Dashboard.tsx` — Remover check hardcoded

Remover as linhas 297-301 que recalculam `isInstaladorVistoriadorOnly` localmente. Usar a flag `isInstaladorVistoriadorOnly` que ja vem do `usePermissions()` (importada na linha 294).

Tambem remover o `useEffect` de redirect (linhas 304-308) e o loading guard (linhas 331-337), substituindo por um unico check usando a flag correta do `usePermissions`.

### 2. `src/components/instalador/InstaladorLayout.tsx` — Adicionar botao "App de Gestao"

Para usuarios que tem `instalador_vistoriador` MAS tambem tem roles nao-operacionais (ex: coordenador_monitoramento), adicionar um item no dropdown menu do header:
- "Ir para Gestao" com icone `LayoutDashboard`
- Navega para `/dashboard`

Isso permite que o usuario alterne entre os dois apps. Usar `usePermissions` para verificar se `!userIsOnlyOperational` (tem roles alem de operacionais).

### 3. `src/components/layout/AppHeader.tsx` — Adicionar botao "App do Instalador"

No header do app de gestao, para usuarios que tem `hasRole('instalador_vistoriador')`, adicionar um botao/link para `/instalador` para facilitar a navegacao de volta.

## Resumo

| Arquivo | Mudanca |
|---------|---------|
| `Dashboard.tsx` | Usar `isInstaladorVistoriadorOnly` do `usePermissions` em vez de check hardcoded |
| `InstaladorLayout.tsx` | Botao "Ir para Gestao" no dropdown para usuarios com roles mistos |
| `AppHeader.tsx` | Botao "App Instalador" para usuarios com role instalador |

3 arquivos, correcao de logica + navegacao bidirecional entre apps.

