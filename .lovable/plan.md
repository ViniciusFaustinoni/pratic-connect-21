

# Esconder Area de Comissoes em Vendas

## O que sera feito

Ocultar completamente a area de Comissoes do modulo de Vendas, incluindo os itens do menu lateral e as rotas.

## Alteracoes

### 1. `src/components/layout/AppSidebar.tsx`

Remover o item de menu "Comissoes" (linha 154) do grupo de Vendas:
```
{ title: 'Comissões', url: '/vendas/comissoes', icon: DollarSign, permission: 'isGerencia' },
```

Remover tambem a logica que substitui "Comissoes" por "Minhas Comissoes" para vendedores (linhas 520-522).

### 2. `src/App.tsx`

Remover as 3 rotas relacionadas a comissoes (linhas 377-379):
```
<Route path="/vendas/comissoes" element={<Comissoes />} />
<Route path="/vendas/comissoes/config" element={<ComissoesConfig />} />
<Route path="/vendas/minhas-comissoes" element={<MinhasComissoes />} />
```

E os imports correspondentes (linhas 192-194).

### O que NAO sera alterado
- Nenhum componente ou hook de comissoes sera deletado (apenas ficam inacessiveis pela navegacao)
- Nenhuma tabela de banco de dados
- Pagina de RH/Folha de Pagamento (que tambem referencia comissoes mas e outro contexto)

