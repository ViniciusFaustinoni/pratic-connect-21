

# Controle de Visibilidade de Abas e Menus por Perfil

## O que vai mudar

Hoje o sistema controla apenas quais **modulos** (grupos do sidebar) cada perfil ve. O objetivo e expandir para controlar tambem:

1. **Quais sub-itens/abas** dentro de cada modulo ficam visiveis por perfil
2. **Modo de acesso**: se o perfil pode apenas **visualizar** ou tambem **editar** em cada modulo
3. **Restricao**: somente o Diretor pode gerenciar essas configuracoes

## Alteracoes

### 1. Nova tabela `role_module_item_visibility`

Controla visibilidade no nivel de sub-item (abas dentro de cada modulo).

```text
role_module_item_visibility
- id (uuid, PK)
- role (app_role)
- module_id (text) -- ex: "vendas", "monitoramento"
- item_id (text)   -- ex: "leads", "cotacoes", "mapa"
- visible (boolean, default true)
- created_at, updated_at
- UNIQUE(role, module_id, item_id)
```

### 2. Adicionar coluna `can_edit` na tabela existente `role_module_visibility`

```text
ALTER TABLE role_module_visibility 
ADD COLUMN can_edit boolean DEFAULT true;
```

Isso permite definir: "Coord. Monitoramento pode VER o modulo Oficinas, mas nao pode EDITAR nada la."

### 3. Restringir gerenciamento ao Diretor

**Arquivo**: `src/hooks/usePermissions.ts`

Alterar `canManagePermissions` para incluir apenas `isDiretor` (remover `isAdminMaster`):

```text
canManagePermissions: isDesenvolvedor || isDiretor,
```

Admin Master continua com outras permissoes, mas nao pode mais alterar visibilidade de modulos/abas.

### 4. Expandir a pagina Perfis com controle de sub-itens

**Arquivo**: `src/pages/configuracoes/Perfis.tsx`

Ao clicar em um modulo na matriz de visibilidade, abrir um painel que mostra os sub-itens daquele modulo (ex: Vendas -> Leads, Cotacao, Propostas, Ativacoes...) com toggles por perfil.

Adicionar tambem uma coluna "Pode Editar" ao lado do toggle de visibilidade de cada modulo na matriz principal.

### 5. Hook `useModuleItemVisibility`

**Novo arquivo**: `src/hooks/useModuleItemVisibility.ts`

Consulta `role_module_item_visibility` para calcular a uniao dos sub-itens visiveis do usuario logado, similar ao `useModuleVisibility` existente.

### 6. Aplicar filtro de sub-itens no Sidebar

**Arquivo**: `src/components/layout/AppSidebar.tsx`

Na funcao `getVisibleGroups`, alem de filtrar grupos por `visibleModules`, filtrar tambem os `items` de cada grupo usando o novo hook `useModuleItemVisibility`.

### 7. Aplicar `can_edit` no contexto

**Arquivo**: `src/hooks/useModuleVisibility.ts`

Alem de retornar `visibleModules`, retornar tambem `editableModules` -- lista de modulos onde o usuario tem `can_edit = true`. Componentes de edicao podem usar isso para desabilitar botoes de salvar/editar quando o usuario so tem acesso de leitura.

## Resumo de Arquivos

| Arquivo | Acao |
|---|---|
| Nova migration SQL | Criar tabela `role_module_item_visibility` + adicionar `can_edit` em `role_module_visibility` |
| `src/hooks/usePermissions.ts` | Restringir `canManagePermissions` a diretor/dev |
| `src/hooks/useModuleVisibility.ts` | Adicionar `editableModules` baseado em `can_edit` |
| `src/hooks/useModuleItemVisibility.ts` | **NOVO** - Hook para visibilidade de sub-itens |
| `src/pages/configuracoes/Perfis.tsx` | Expandir matriz com sub-itens e coluna "Pode Editar" |
| `src/components/layout/AppSidebar.tsx` | Filtrar sub-itens do menu por visibilidade |

## Fluxo Visual

```text
Configuracoes > Perfis e Acessos > Aba "Perfis" > Botao "Visibilidade"

+------------------------------------------------------------------+
| Visibilidade de Modulos por Perfil                               |
+------------------------------------------------------------------+
| Modulo           | Dir | GerC | SupV | AnCad | CrdM | ... | Ed  |
|------------------|-----|------|------|-------|------|-----|-----|
| Dashboard        | [v] | [v]  | [v]  | [v]   | [v]  | ... | [v] |
| > (sem sub-itens)|     |      |      |       |      |     |     |
| Vendas           | [v] | [v]  | [v]  | [ ]   | [ ]  | ... | [v] |
| > Leads          | [v] | [v]  | [v]  | ---   | ---  | ... |     |
| > Cotacao        | [v] | [v]  | [v]  | ---   | ---  | ... |     |
| > Propostas      | [v] | [v]  | [ ]  | ---   | ---  | ... |     |
| > Ativacoes      | [v] | [v]  | [ ]  | ---   | ---  | ... |     |
| Monitoramento    | [v] | [ ]  | [ ]  | [ ]   | [v]  | ... | [v] |
| > Equipe         | [v] | ---  | ---  | ---   | [v]  | ... |     |
| > Instalacoes    | [v] | ---  | ---  | ---   | [v]  | ... |     |
| > Mapa           | [v] | ---  | ---  | ---   | [ ]  | ... |     |
+------------------------------------------------------------------+
                                          [Salvar] [Descartar]
```

- `[v]` = visivel, `[ ]` = oculto, `---` = modulo oculto (sub-itens desabilitados)
- Coluna "Ed" = pode editar (se desligado, usuario ve mas nao pode alterar dados)
- Somente Diretores veem os toggles editaveis
