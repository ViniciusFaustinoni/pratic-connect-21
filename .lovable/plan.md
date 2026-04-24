Plano para corrigir o comportamento do sidebar:

1. Ajustar a lógica de autoabertura do menu
   - Hoje o `AppSidebar` abre automaticamente o grupo que contém a rota ativa.
   - Como a página atual está dentro de `/financeiro/...`, o grupo Financeiro é reaberto em toda atualização da página.
   - Vou remover esse comportamento de autoabrir grupos normais no refresh.

2. Preservar apenas o estado escolhido pelo usuário
   - O módulo só deve abrir quando o usuário clicar nele.
   - Se o usuário fechar Financeiro, ele deve permanecer fechado durante a navegação interna, sem reabrir sozinho.

3. Manter funcionamento visual e navegação
   - A rota ativa continuará destacada quando o grupo estiver aberto.
   - O clique em links e o fechamento no mobile continuarão funcionando.
   - Para diretores, o supergrupo Administrativo também não deve ser reaberto automaticamente apenas por estar em uma rota financeira.

Detalhes técnicos:
- Arquivo principal: `src/components/layout/AppSidebar.tsx`.
- Remover/ajustar os `useEffect` que fazem merge automático do grupo ativo em `openGroups` e `openSuperGroups` após mudança de rota/carregamento de permissões.
- Inicializar os grupos fechados por padrão, ou no máximo preservar estado manual do usuário, evitando autoabertura baseada em `location.pathname`.
- Depois da alteração, validar que atualizar uma página financeira não abre o Financeiro sem clique.