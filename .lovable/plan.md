

# Adicionar card "API do Sistema" na tela de Integrações

## Resumo

Adicionar um novo card na categoria "Automação & Developers" da página de Integrações, redirecionando para `/configuracoes/api`. Visível apenas para diretores.

## Arquivo

| Arquivo | Acao |
|---------|------|
| `src/pages/configuracoes/Integracoes.tsx` | **Editar** |

## Detalhes

1. Importar `Code2` de lucide-react e `usePermissions` de `@/hooks/usePermissions`.

2. Adicionar novo item na categoria "Automação & Developers" (após "Chaves de API"):
   - `id: 'api-docs'`, `nome: 'API do Sistema'`, `descricao: 'Documentação e testes de endpoints'`, `icon: Code2`, `href: '/configuracoes/api'`, `sempreAtivo: true`, `diretorOnly: true`

3. Adicionar campo `diretorOnly?: boolean` na interface `IntegracaoCard`.

4. Na renderização dos cards (onde itera `categoria.items`), filtrar items com `diretorOnly` quando o usuário não for diretor/desenvolvedor (usando `usePermissions`).

