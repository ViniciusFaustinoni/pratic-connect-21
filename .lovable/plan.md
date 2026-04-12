

## Plano: Adicionar submenu "Logs" na Gestão Comercial

### O que será feito

Adicionar um novo grupo **"Logs"** no menu lateral da Gestão Comercial com dois sub-itens:
1. **Log do Sistema** — tudo que acontece no sistema (logins, criações, edições, exclusões, etc.) usando a tabela `logs_auditoria`
2. **Log de Requisições** — logs de todas as APIs/edge functions do sistema usando a tabela `auth_logs` + Supabase analytics

### Alterações

**1. `src/components/gestao-comercial/TabNavigation.tsx`**
- Adicionar grupo "Logs" com ícone `ScrollText` e dois itens:
  - `{ label: 'Log do Sistema', shortLabel: 'Sistema', icon: Activity, description: 'Ações de usuários no sistema' }`
  - `{ label: 'Log de Requisições', shortLabel: 'Requisições', icon: Globe, description: 'Chamadas de APIs e funções' }`

**2. `src/pages/diretoria/GestaoComercial.tsx`**
- Adicionar banners para index 8 e 9
- Importar e renderizar os dois novos componentes nos índices correspondentes

**3. Criar `src/components/gestao-comercial/LogSistemaTab.tsx`**
- Consulta à tabela `logs_auditoria` com filtros por módulo, ação, usuário e período
- Lista estilizada com avatar do usuário, badge de ação colorido, descrição, módulo, data/hora
- Filtros: busca por nome/descrição, select de módulo, select de ação, date range
- Paginação ou scroll infinito (limit 200)

**4. Criar `src/components/gestao-comercial/LogRequisicoesTab.tsx`**
- Consulta à tabela `auth_logs` (já usada no Logs.tsx existente em configurações)
- Mostrar email, ação, IP, navegador, data/hora, metadata
- Filtros: busca por email, tipo de ação
- Reaproveitar a mesma estrutura visual do `Logs.tsx` existente, adaptada ao contexto

### Resultado
- Menu Gestão Comercial terá 5 grupos: Produtos, Financeiro, Operação, Cadastros e Logs
- Diretores terão visibilidade completa de auditoria e requisições direto na Gestão Comercial

