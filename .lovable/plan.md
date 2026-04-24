Plano de ajuste: Conta Corrente de Comissões no Financeiro

1. Reposicionar a área no menu
- Adicionar “Conta Corrente de Comissões” dentro do grupo “Financeiro” no sidebar.
- Remover/ocultar o item duplicado “Conta Corrente” do grupo “Comissões”, para a área ficar centralizada em Financeiro.
- Atualizar breadcrumb para a nova rota financeira.

2. Ajustar a rota
- Criar a rota principal `/financeiro/conta-corrente-comissoes` apontando para a página já existente de Conta Corrente de Comissões.
- Manter `/comissoes/conta-corrente` como redirecionamento para a nova rota, evitando links quebrados.

3. Garantir visão completa para Diretor
- Revisar o hook da tela para que, quando o usuário logado for Diretor/Admin/Desenvolvedor, o filtro padrão “Todos usuários visíveis” carregue o extrato completo de movimentações de comissões.
- Manter RBAC/hierarquia para os demais perfis: gerentes/supervisores/agências veem apenas seus escopos; vendedores veem apenas seus próprios lançamentos.

4. Corrigir a origem dos dados do extrato
- Ajustar a tela para consultar a conta corrente real (`cc_vendedor_lancamentos`) como fonte do extrato completo de movimentações, incluindo créditos e débitos.
- Manter o resumo da comissão associada quando houver `comissao_id`, exibindo cliente, plano, linha, contrato e instalação.
- Para débitos ou lançamentos sem comissão vinculada, exibir a descrição/categoria do próprio lançamento sem quebrar a tabela.

5. Resumos com filtros aplicados
- Recalcular no topo: saldo atual, total creditado no período e total debitado no período usando os lançamentos filtrados da conta corrente.
- Preservar filtros por data/período, usuário, plano, linha, status e busca.

Detalhes técnicos
- Arquivos principais: `src/components/layout/AppSidebar.tsx`, `src/App.tsx`, `src/components/layout/GlobalBreadcrumb.tsx`, `src/hooks/useContaCorrenteComissoes.ts`, `src/pages/comissoes/ContaCorrente.tsx`.
- A função SQL existente `fn_comissoes_usuarios_visiveis` já contempla Diretor/Admin/Desenvolvedor com todos os usuários; só será necessário ajustar a consulta frontend para consumir os lançamentos da conta corrente real e respeitar as políticas RLS existentes.