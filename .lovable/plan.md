Plano para criar a área “Conta Corrente de Comissões”

1. Consolidar a área no módulo de Comissões
- Criar/renomear a rota visual para “Conta Corrente” dentro do módulo Comissões.
- Reaproveitar a estrutura já existente de conta corrente (`cc_vendedor_lancamentos`) quando fizer sentido, mas adaptar para o novo fluxo de comissões oficiais da tabela `comissoes`.
- Manter a área do perfil do vendedor como visão própria, mas a nova área será mais completa e respeitará hierarquia.

2. Regras de visibilidade por perfil logado
- Diretor / admin / desenvolvedor: vê todas as contas correntes e todas as comissões.
- Gerente comercial: vê a própria conta e os usuários abaixo dele na hierarquia (`hierarquia_vendas.gerente_id`).
- Supervisor: vê a própria conta e os usuários abaixo dele (`hierarquia_vendas.supervisor_id`).
- Agência: vê a própria conta e os usuários vinculados à agência (`hierarquia_vendas.agencia_id`).
- Vendedor CLT / externo: vê somente a própria conta.
- A tela não permitirá selecionar vendedores fora do escopo permitido.

3. Criar extrato completo
- Listar todos os lançamentos de comissão por usuário com:
  - data do lançamento;
  - data de pagamento quando houver;
  - usuário destinatário;
  - role/perfil da comissão;
  - origem/vendedor do contrato quando disponível;
  - associado/contrato;
  - plano;
  - linha do plano;
  - parcela;
  - status;
  - valor da comissão;
  - saldo acumulado visual no extrato.
- O extrato será somente visualização para vendedores/supervisores/gerentes/agências; ações financeiras sensíveis continuam restritas à diretoria/gestão permitida.

4. Saldo do usuário
- Mostrar cards de resumo:
  - Saldo atual;
  - Comissões pagas;
  - Comissões aprovadas/a pagar;
  - Comissões pendentes;
  - Total no período filtrado.
- Regra de saldo: quando uma comissão for marcada como `paga`, ela passa a compor o saldo disponível/recebido do usuário.
- Comissões pendentes/aprovadas aparecem como “a receber”, mas não entram no saldo pago até serem liquidadas.

5. Vincular pagamento de comissão ao saldo
- Ajustar a função de pagamento `fn_marcar_comissao_paga` para também gerar, de forma idempotente, um lançamento correspondente na conta corrente quando uma comissão for marcada como paga.
- Evitar duplicidade: a mesma comissão não poderá gerar dois lançamentos de conta corrente.
- Incluir referência à `comissao_id` no lançamento de conta corrente ou criar tabela/visão de extrato que una comissão + pagamento de forma segura.

6. Filtros solicitados
- Data início e data fim.
- Período rápido: mês atual, mês anterior, últimos 30 dias, ano atual e personalizado.
- Plano.
- Linha do plano.
- Status da comissão.
- Usuário/destinatário, limitado ao escopo permitido.
- Busca por associado/contrato quando os dados estiverem disponíveis.

7. Segurança e RLS
- Criar uma função segura no banco para retornar os IDs visíveis do usuário logado conforme hierarquia.
- Ajustar políticas/consultas para impedir que um usuário veja comissões de outros fora da sua hierarquia.
- Não depender apenas de filtro no frontend para segurança.
- Corrigir inconsistências atuais onde algumas políticas antigas permitem supervisor/gerente verem mais do que deveriam.

8. Navegação
- Adicionar item “Conta Corrente” no grupo “Comissões” do sidebar.
- Opcionalmente, manter redirects das rotas antigas (`/perfil/conta-corrente` e `/financeiro/venda-externa`) para não quebrar links existentes, mas apontando para a nova experiência quando aplicável.

Detalhes técnicos previstos
- Criar um hook novo, por exemplo `useContaCorrenteComissoes`, para buscar extrato, resumo, filtros e usuários visíveis.
- Criar uma página nova, por exemplo `src/pages/comissoes/ContaCorrente.tsx`.
- Alterar `App.tsx` para registrar `/comissoes/conta-corrente`.
- Alterar `AppSidebar.tsx` para exibir o novo item.
- Criar migração para:
  - garantir referência idempotente entre conta corrente e comissão paga;
  - criar função de escopo hierárquico;
  - ajustar `fn_marcar_comissao_paga` para alimentar o saldo;
  - reforçar RLS/policies necessárias.

Resultado esperado
- Cada usuário verá uma área de conta corrente com extrato completo e saldo.
- Vendedores verão somente suas próprias comissões.
- Supervisores, gerentes, agências e diretoria verão conforme sua hierarquia/permissão.
- Ao marcar uma comissão como paga, ela entra automaticamente no saldo/extrato do usuário.
- A tela terá filtros por data, período, plano e linha.