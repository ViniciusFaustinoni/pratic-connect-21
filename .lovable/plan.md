Plano para renomear a rota no sidebar:

1. Alterar o item do sidebar principal do módulo **Comissões**:
   - De: `Atribuição de Grades`
   - Para: `Hierarquia de Comissões`
   - Mantendo a mesma rota atual: `/comissoes/atribuicao`
   - Mantendo o mesmo ícone e permissões.

2. Ajustar também o rótulo equivalente em **Configurações**, caso essa entrada apareça por lá como atalho/redirecionamento:
   - De: `Atribuição de Grades`
   - Para: `Hierarquia de Comissões`
   - Mantendo a rota `/configuracoes/atribuicao-comissoes`, que redireciona para `/comissoes/atribuicao`.

3. Não alterar a estrutura da tela, abas, permissões, vínculos ou lógica de grades/hierarquia. Será apenas renomeação visual do menu/rota exibida ao usuário.

Arquivos previstos:
- `src/components/layout/AppSidebar.tsx`
- `src/pages/configuracoes/ConfiguracoesLayout.tsx`