

# Consolidar Retiradas, Instalações e Vistorias em um Único Submenu

## Contexto

Hoje no sidebar de Monitoramento existem dois itens separados:
- **Instalações e Vistorias** → página com tabs (Instalações, Vistorias, Encaixes, Viagens)
- **Retiradas** → página separada

Todos são tipos de serviços de campo. A ideia é consolidar tudo em uma única entrada no submenu, adicionando "Retiradas" como mais uma tab na página existente.

## Alterações

### 1. Sidebar — Remover item "Retiradas"
Remover a entrada separada de Retiradas do submenu de Monitoramento em `AppSidebar.tsx`. Renomear o item existente para "Serviços de Campo" ou manter "Instalações e Vistorias" (incluindo retiradas).

### 2. Página `VistoriasInstalacoesMon.tsx` — Adicionar tab "Retiradas"
- Importar o conteúdo de `RetiradasPage` (extrair como componente embeddable ou importar diretamente)
- Adicionar nova tab "Retiradas" com ícone `PackageX`
- Atualizar título/descrição para refletir a consolidação

### 3. Breadcrumb e módulos
- Atualizar `GlobalBreadcrumb.tsx` para remover a rota `/monitoramento/retiradas` separada
- Atualizar `modules.ts` para remover "retiradas" como item separado do módulo monitoramento

### 4. Rota no App.tsx
- Manter a rota `/monitoramento/retiradas` como redirect para a página consolidada (compatibilidade com links existentes em substituições)

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/components/layout/AppSidebar.tsx` | Remover item "Retiradas" do submenu monitoramento |
| `src/pages/monitoramento/VistoriasInstalacoesMon.tsx` | Adicionar tab "Retiradas" importando conteúdo do RetiradasPage |
| `src/pages/monitoramento/RetiradasPage.tsx` | Extrair conteúdo principal como componente exportável (para ser usado como tab) |
| `src/components/layout/GlobalBreadcrumb.tsx` | Remover breadcrumb separado de retiradas |
| `src/config/modules.ts` | Consolidar "retiradas" dentro de "instalacoes" ou renomear |
| `src/App.tsx` | Adicionar redirect de `/monitoramento/retiradas` → `/monitoramento/vistorias-instalacoes-mon` |

