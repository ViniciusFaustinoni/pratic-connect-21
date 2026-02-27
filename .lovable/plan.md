

# Controle de Visibilidade de Abas/Modulos por Perfil

## Problema Atual

A visibilidade dos modulos no sidebar esta **hardcoded** no `usePermissions.ts` e no `AppSidebar.tsx`, com logica especial para cada perfil (ex: `isAnalistaCadastroOnly`, `isVendedorOnly`). Isso impede:

- Configurar dinamicamente quais abas cada perfil ve
- Usuarios com multiplos perfis verem a uniao dos modulos
- Administradores ajustarem visibilidade sem alterar codigo

## Solucao Proposta

### Conceito: Permissao vs Visibilidade

```text
+------------------+     +-------------------+
|   PERMISSAO      |     |   VISIBILIDADE    |
|  (o que FAZ)     |     |  (o que VE)       |
|                  |     |                   |
|  usePermissions  |     |  role_visibility  |
|  (hardcoded)     |     |  (tabela no DB)   |
+------------------+     +-------------------+
```

- **Permissao**: continua como esta (hardcoded no `usePermissions.ts`) - define o que o usuario pode FAZER
- **Visibilidade**: nova tabela no banco - define quais modulos/abas o usuario pode VER no sidebar

### 1. Nova tabela `role_module_visibility`

```sql
CREATE TABLE role_module_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  module_id TEXT NOT NULL,
  visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role, module_id)
);
```

- `module_id` corresponde ao `id` dos grupos no sidebar (ex: `dashboard`, `vendas`, `cadastro`, `monitoramento`, etc.)
- Seed inicial com os valores da matriz existente no `Perfis.tsx` (linhas 107-123)
- RLS: leitura para todos autenticados, escrita apenas para diretor/desenvolvedor/admin_master

### 2. Novo hook `useModuleVisibility`

Consulta a tabela `role_module_visibility` e, com base nos roles do usuario (que podem ser multiplos), retorna a **uniao** dos modulos visiveis.

```text
Usuario com roles: [coordenador_monitoramento, analista_eventos]
  -> Modulos visiveis do coord_monitoramento: [dashboard, monitoramento]
  -> Modulos visiveis do analista_eventos: [dashboard, eventos, assistencia, oficinas]
  -> UNIAO FINAL: [dashboard, monitoramento, eventos, assistencia, oficinas]
```

### 3. Alteracao no `AppSidebar.tsx`

Substituir a logica hardcoded de `getVisibleGroups()` (linhas 519-555) pelo hook `useModuleVisibility`. Em vez de verificar `isAnalistaCadastroOnly`, `isVendedorOnly`, etc., o sidebar simplesmente filtra os grupos cujo `module_id` esta na lista de modulos visiveis do usuario.

### 4. Tela de configuracao na pagina Perfis

Na pagina `Perfis.tsx`, a matriz que hoje e apenas visual (client-side) passara a ler e gravar na tabela `role_module_visibility`. O botao "Salvar" persistira as alteracoes no banco.

### 5. Alteracao no `useRouteGuard.ts`

O guard de rotas tambem usara o `useModuleVisibility` para validar acesso, substituindo as verificacoes hardcoded por perfil.

## Arquivos Modificados

1. **Migracao SQL** - Criar tabela `role_module_visibility` com seed dos dados iniciais e RLS
2. **`src/hooks/useModuleVisibility.ts`** (novo) - Hook que consulta visibilidade e calcula uniao dos roles do usuario
3. **`src/components/layout/AppSidebar.tsx`** - Substituir logica hardcoded de `getVisibleGroups()` pelo hook
4. **`src/pages/configuracoes/Perfis.tsx`** - Conectar matriz a tabela do banco (ler/salvar)
5. **`src/hooks/useRouteGuard.ts`** - Usar visibilidade do banco em vez de verificacoes hardcoded

## Detalhes Tecnicos

### Migracao SQL completa

A migracao incluira:
- Criacao da tabela com constraint UNIQUE(role, module_id)
- INSERT dos 15 roles x 16 modulos (~240 registros) baseado na matriz existente
- Politicas RLS: SELECT para authenticated, INSERT/UPDATE/DELETE apenas via `has_role` para diretor/desenvolvedor
- Funcao `get_visible_modules(uuid)` que retorna array de module_ids visiveis para um usuario (uniao de todos os seus roles)

### Hook useModuleVisibility

```typescript
// Retorna { visibleModules: string[], isLoading: boolean }
// Calcula uniao automaticamente quando usuario tem multiplos roles
```

### Logica do Sidebar simplificada

```typescript
// ANTES (hardcoded):
if (permissions.isAnalistaCadastroOnly) {
  return baseGroups.filter(g => g.id === 'cadastro');
}

// DEPOIS (dinamico):
const { visibleModules } = useModuleVisibility();
return baseGroups.filter(g => visibleModules.includes(g.id));
```

### Modulos configuráveis (16 total)

dashboard, vendas, cadastro, monitoramento, eventos, assistencia, oficinas, financeiro, cobranca, contabilidade, juridico, rh, marketing, ouvidoria, diretoria, relatorios, documentos, configuracoes

