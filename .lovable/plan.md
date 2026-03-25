

# Remover "Config. Plataformas" do menu Monitoramento

## Problema
O item "Config. Plataformas" aparece no menu lateral de Monitoramento, mas essa funcionalidade já existe em Configurações > Integrações. É duplicado.

## Alterações

### 1. `src/components/layout/AppSidebar.tsx` (~linha 233-237)
Remover o item `Config. Plataformas` do array de itens do menu Monitoramento.

### 2. `src/App.tsx` (~linha 631)
Redirecionar a rota `/monitoramento/config-plataformas` para a página de configurações de integrações (em vez de manter a rota duplicada).

### 3. `src/components/layout/GlobalBreadcrumb.tsx` (~linha 117)
Remover a entrada de breadcrumb `/monitoramento/config-plataformas`.

3 arquivos, remoção de item duplicado.

