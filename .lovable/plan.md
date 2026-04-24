Plano de correção

1. Bloquear vazamento de cotações no banco
- Ajustar as policies RLS da tabela `public.cotacoes` para que consultores vejam somente cotações próprias.
- Manter visão ampla apenas para perfis autorizados: diretoria/gerência, supervisor de vendas, analista de cadastro e super admin/desenvolvedor, conforme a regra já usada no frontend.
- Corrigir também UPDATE/DELETE para impedir que consultores alterem ou excluam cotações de outros consultores.
- Preservar o acesso público por token para a jornada do cliente (`/cotacao/:token`), sem liberar listagem autenticada indevida.

2. Fortalecer o filtro no frontend
- Atualizar `useCotacoes` para aplicar escopo seguro por padrão: se não houver permissão explícita de visão total, sempre filtrar por `vendedor_id = usuário logado`.
- Evitar depender somente de `viewScope` vindo da tela, porque qualquer falha nessa prop pode abrir a listagem inteira.
- Garantir que o cache de cotações continue separado por usuário/perfil.

3. Corrigir permissão de “analista de cadastro” no frontend/banco
- Hoje o frontend permite `analista_cadastro` ver todas as cotações, mas a RLS atual não contempla esse papel explicitamente.
- Alinhar banco e frontend para não gerar comportamento inconsistente: analista de cadastro continua com visão necessária para validação/análise, vendedores continuam restritos.

4. Melhorar a visualização mobile das cotações
- Substituir a tabela em telas pequenas por cards mobile próprios, evitando tabela espremida/rolagem horizontal ruim.
- Cada card exibirá claramente: status/etapa, cliente, telefone, veículo/placa, valor, data e consultor quando o usuário tiver visão ampla.
- O toque no card abrirá corretamente o modal de detalhes.
- As ações principais ficarão acessíveis em botões compactos/menu: abrir link, copiar link, PDF, WhatsApp, continuar cotação e detalhes.

5. Ajustar o modal de detalhes para mobile
- Tornar o `CotacaoDetalhesModal` responsivo em largura/altura, com header e ações sem estouro lateral.
- Ajustar grids de Cliente, Veículo e Valores para ficarem legíveis em telas pequenas.
- Evitar textos/botões cortados ou fora da viewport.

6. Validação
- Rodar build TypeScript após as alterações.
- Validar com a conta de diretor que a visão ampla continua funcionando.
- Validar com um consultor/vendedor que apenas suas próprias cotações aparecem.
- Validar em viewport mobile que clicar em cotações abre detalhes corretamente e sem layout quebrado.

Detalhes técnicos
- Arquivos principais envolvidos:
  - `src/hooks/useCotacoes.ts`
  - `src/pages/vendas/Cotacoes.tsx`
  - `src/components/cotacoes/CotacoesTable.tsx` ou novo componente mobile de cards
  - `src/components/cotacoes/CotacaoDetalhesModal.tsx`
  - nova migration Supabase para RLS de `public.cotacoes`
- A causa crítica identificada está nas policies atuais de `cotacoes`, que liberam visão ampla para `is_gerencia` e `supervisor_vendas`, mas a proteção precisa ser revisada e alinhada ao RBAC real. Também há necessidade de defesa em profundidade no hook para não depender apenas da UI.