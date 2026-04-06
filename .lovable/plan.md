

# Plano: Substituição de placa acessível para vendedores

## Problema
Ao clicar em "Substituição de Placa" na cotação, o sistema navega para `/cadastro/associados/:id/substituicao`. O vendedor não tem acesso ao módulo `cadastro`, então o `useRouteGuard` redireciona-o para outra página.

## Solução
Criar uma rota espelho sob `/vendas/substituicao/:associadoId` que renderiza o mesmo componente `SubstituicaoVeiculoPage`, e atualizar a navegação da cotação para usar essa rota.

## Alterações

### 1. Adicionar rota em `src/App.tsx`
- Dentro do grupo de rotas `/vendas`, adicionar:
  `<Route path="/vendas/substituicao/:associadoId" element={<SubstituicaoVeiculoPage />} />`

### 2. Atualizar navegação em `src/pages/vendas/Cotacao.tsx`
- Linha 363: trocar `navigate('/cadastro/associados/${associadoId}/substituicao')` para `navigate('/vendas/substituicao/${associadoId}')`.

### 3. Registrar prefixo no `MODULE_ROUTES` (`src/hooks/useModuleVisibility.ts`)
- Adicionar `'/vendas/substituicao'` ao array do módulo `vendas` para que o route guard permita acesso.

## Arquivos modificados
- `src/App.tsx`
- `src/pages/vendas/Cotacao.tsx`
- `src/hooks/useModuleVisibility.ts`

