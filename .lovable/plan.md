

# Plano: Remover pagina admin/planos

## Contexto

A gestao de planos, linhas, coberturas e beneficios ja esta completamente disponivel em **Diretoria > Gestao Comercial**. A rota `/admin/planos` e redundante e deve ser removida. Nao ha link no sidebar apontando para ela.

Os componentes em `src/components/admin/planos/` (PlanFormModal, LinhaFormModal, etc.) continuam sendo usados por Gestao Comercial e outras paginas — nao serao removidos.

## Alteracoes

### 1. `src/App.tsx`
- Remover o import lazy de `PlanosAdmin`
- Remover a rota `<Route path="/admin/planos" ...>`

### 2. `src/pages/admin/PlanosAdmin.tsx`
- Deletar o arquivo

### 3. Tabs exclusivas da pagina admin (opcionais para limpeza)
Os arquivos abaixo so eram usados por `PlanosAdmin.tsx` e podem ser removidos:
- `src/components/admin/planos/PlanosTab.tsx`
- `src/components/admin/planos/BeneficiosTab.tsx`
- `src/components/admin/planos/CoberturasTab.tsx`
- `src/components/admin/planos/LinhasTab.tsx`

Antes de deletar, confirmarei que nenhum outro arquivo os importa.

## Resultado

A unica forma de gerenciar planos, linhas, coberturas e beneficios passa a ser por **Diretoria > Gestao Comercial**. Acessar `/admin/planos` redirecionara para 404 (comportamento padrao do router).

