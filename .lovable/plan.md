
## PLANO: REFORMAR PÁGINA COMISSOES.TSX E ESTENDER HOOKS

### 1. ANÁLISE DA ARQUITETURA ATUAL

**Hooks Existentes:**
- `useComissoes.ts`: Query de comissões + 4 mutations (aprovar, aprovar lote, pagar, cancelar) ✅
- `useComissoesFaixas.ts`: Queries para 5 tabelas de faixas + parametros + mutations genéricas ✅
- `useComissoesCampanhas.ts`: Query campanhas + mutations criar/fechar ✅

**Componentes Existentes:**
- `ComissaoCard.tsx`: Card individual de comissão com status badges e ações
- `ComissaoResumoMensal.tsx`: Resumo mini com totais por status

**Padrões Identificados:**
- React Query para data fetching + React Router para navegação
- Shadcn UI components (Card, Badge, Tabs, Select, Button, Dialog)
- Sonner para toasts
- Formatação de moeda em pt-BR
- Icons do Lucide React

---

### 2. PASSO 1: ESTENDER HOOK USECOMISSOES.TS

**Adicionar 3 novas Queries:**

1. **resumoVendedores**: Agrupa comissões por vendedor + mês/ano
   - SELECT: vendedor_id, nome, avatar_url, SUM(valor_total) por tipo_comissao
   - JOIN: profiles para nome/avatar
   - GROUP BY: vendedor_id, tipo_comissao
   - Ordenar por: valor_total DESC

2. **deducoesMensal**: Busca todas as deduções do mês
   - SELECT: * de comissoes_deducoes
   - JOIN: profiles (vendedor) para nome
   - Filtrar por: mes_referencia, ano_referencia
   - Agrupar por vendedor para resumo

3. **auditoriaRecente**: Últimos registros de auditoria
   - SELECT: * de comissoes_auditoria
   - LIMIT 50, ORDER BY created_at DESC
   - JOIN: profiles (usuario_id) para nome

**Adicionar 2 novas Mutations:**

1. **contestarComissao**: UPDATE comissoes SET status='contestada', contestada_em, contestacao_motivo
2. **executarFechamento**: Chama RPC `fn_fechamento_mensal_comissoes(p_mes, p_ano, p_usuario_id)`
   - Usa `supabase.rpc()`
   - Retorna JSONB com resultado da execução
   - Invalidates queries: ['comissoes'], ['comissoes-campanhas']

**Padrão a seguir:**
- Usar mesmo padrão dos mutations existentes (toast success/error)
- Usar queryClient.invalidateQueries() para refresh automático
- Error handling com mensagens claras

---

### 3. PASSO 2: CRIAR HOOK USECOMISSOESRANKING.TS

**Estrutura:**

```typescript
export function useComissoesRanking(mes?: number, ano?: number) {
  // Query: Busca de comissoes_ranking_mensal
  // - SELECT: * com JOIN profiles(nome, avatar_url)
  // - Filtrar por: ano, mes
  // - ORDER BY: vendas_liquidas DESC, posicao_ranking ASC
  // - Retorna array tipado com campos adicionais (vendedor nome/avatar)
  
  // Estados derivados (computados do array):
  // - rankingInterno1Ano: filter + sort
  // - rankingInterno1AnoPlus: filter + sort
  // - rankingExterno: filter + sort
  // - totalPlacas: SUM(vendas_confirmadas)
  // - faixaPlacas: 300/400/500 baseado no total
  
  return { ranking, rankingPorCategoria, totalPlacas, faixaPlacas, isLoading, error }
}
```

---

### 4. PASSO 3: REFORMAR PÁGINA COMISSOES.TSX

**Layout com 5 Tabs principais:**

**TAB 1: RESUMO EXECUTIVO**
- Header com seletor de mês/ano (reusar do layout atual)
- Badge de status da campanha (aberta/em_apuracao/fechada/paga)
- Grid 4 KPI Cards:
  - Total Comissões (DollarSign, verde): SUM de todas as comissões
  - Vendedores Ativos (Users, azul): COUNT distinct vendedor_id
  - Vendas Confirmadas (TrendingUp, roxo): da campanha do mês
  - Deduções (AlertTriangle, laranja): SUM de deducoes_mensal
- BarChart Recharts (top 10 vendedores, barras empilhadas por tipo_comissao)
- Tabela resumo (Vendedor | Tipo | Vendas | Adesão | Recorrente | ... | Total)
  - Usar Table do Shadcn (simples, responsive com scroll)
  - Últimas linhas: linha de TOTAL
  - onClick linha → abre aba Detalhes com vendedor selecionado

**TAB 2: RANKING MENSAL**
- Se há campanha: mostra faixa de placas (300/400/500) em Card destaque
- 3 subtabs (ou seções): "Interno +1 Ano" | "Interno -1 Ano" | "Externo"
- Para cada: Tabela com # | Vendedor | Vendas Líquidas | Trocas | Prêmio
  - Top 3 com badges 🥇🥈🥉 e cor destaque
  - Demais em cinza claro
  - ORDER BY posicao_ranking ASC
- Se sem campanha: mensagem + botão "Criar Campanha"

**TAB 3: FECHAMENTO MENSAL**
- Card com stepper visual (4 etapas em linha horizontal ou vertical)
- **Etapa 1 - Campanha:**
  - Status badge da campanha
  - Se não existir: Botão "Criar Campanha" (chama mutation)
  - Mostra datas (início, fim, pagamento 1ª fase, apuração boletos)
- **Etapa 2 - Cálculo:**
  - Botão "Executar Fechamento" (com AlertDialog confirmação)
  - Durante: Progress bar + "Processando {x} vendedores..."
  - Ao concluir: Resumo em json box (ou pretty print)
  - Chama: executarFechamento.mutate(mes, ano)
- **Etapa 3 - Aprovação:**
  - Tabela de comissões status='pendente' ou 'calculada'
  - Checkbox seleção múltipla
  - Botão "Aprovar Selecionadas"
  - Botão "Aprovar Todas"
  - Para cada linha: Botão aprovar individual
  - Colunas: Vendedor | Tipo | Valor | Ações
- **Etapa 4 - Pagamento:**
  - Tabela de comissões status='aprovada'
  - Botão "Marcar como Pago"
  - Colunas: Vendedor | Tipo | Valor | Data Aprovação | Ações

**TAB 4: DETALHES POR VENDEDOR**
- Combobox/Select pesquisável de vendedores (filtra por nome)
- Ao selecionar:
  - Card identificação: foto + nome + tipo + tempo de casa + placas ativas
  - 6 Cards de comissão do mês (lado a lado, grid responsivo):
    1. Bonificação Adesão (blue): vendas | % | bruto | deducoes | liquido
    2. Recorrente (green): placas | boletos | % | valor
    3. Produção (purple): placas | valor (ou N/A)
    4. Classificação (orange): posição | prêmio
    5. Crescimento (cyan): último marco | próximo | valor
    6. Recorde (yellow): recorde | mês | vendas | bônus
  - Tabela de deduções do mês (Tipo | Descrição | Valor | Data)
  - Tabela de comissões por contrato (Contrato | Associado | Adesão | Dedução | Líquido)

**TAB 5: HISTÓRICO / AUDITORIA**
- 2 subtabs:
  - **Pagamentos**: Tabela comissoes_pagamentos (Vendedor | Mês | Qtd | Valor | Data | Comprovante)
    - Filtros: vendedor, mês/ano, status
    - Paginação se muitos registros
  - **Auditoria**: Tabela comissoes_auditoria (Data | Usuário | Tabela | Ação | Detalhes)
    - Clicar em Detalhes abre Dialog com diff (antes/depois em json)
    - Filtros: tabela, ação, data range

---

### 5. DESIGN E COMPONENTES

**Cores por Tipo:**
- adesao: blue-500
- recorrente: green-500
- producao: purple-500
- classificacao: orange-500
- crescimento: cyan-500
- recorde: yellow-500

**Status Badges:**
- pendente: gray-500
- calculada: blue-500
- em_apuracao: yellow-500
- aprovada: green-500
- paga: emerald-500
- contestada: red-500
- cancelada: slate-500

**Shadcn Components a Usar:**
- Tabs (layout principal)
- Card (KPI, seções)
- Badge (status, tipo)
- Table (listas)
- Dialog (formulários, detalhes)
- AlertDialog (confirmações)
- Select (filtros, seletor vendedor)
- Combobox (seletor pesquisável vendedor)
- Button (ações)
- Progress (loading)

**Icons (Lucide React):**
- DollarSign, Users, TrendingUp, AlertTriangle (KPIs)
- Check, X, Clock, CheckCircle, Wallet (status/ações)
- ChevronDown, ChevronUp (expand/collapse)
- Medal (ranking - 1º, 2º, 3º lugar)

**Recharts:**
- BarChart: eixo X = vendedores, barras empilhadas = tipo_comissao
- ResponsiveContainer para responsividade
- Custom tooltip mostrando valores em R$

---

### 6. PERMISSÕES E ACESSO

**Implementar PermissionGate:**
- Roles permitidos: 'diretor', 'gerente_comercial', 'supervisor_vendas'
- Se vendedor ou sem role: redireciona ou mostra mensagem
- Botões de aprovação/pagamento: apenas 'diretor' e 'gerente_comercial'
- Supervisor: visualiza tudo mas sem botões

**RLS Policies (confirmadas):**
- Comissões: leitura para gestores, escrita para sistema
- Deduções: leitura por vendedor (próprias) ou gestor
- Ranking: leitura por vendedor (ranking public) ou gestor

---

### 7. SEQUENCE DE DESENVOLVIMENTO

1. **Estender useComissoes.ts**
   - Adicionar 3 queries + 2 mutations
   - Testar queries devolvem dados corretos

2. **Criar useComissoesRanking.ts**
   - Query + estados derivados
   - Testes unitários simples

3. **Reformar Comissoes.tsx**
   - Layout Tabs principal
   - Implementar Tab 1 (Resumo)
   - Implementar Tab 2 (Ranking)
   - Implementar Tab 3 (Fechamento)
   - Implementar Tab 4 (Detalhes)
   - Implementar Tab 5 (Histórico)
   - PermissionGate no topo

4. **Testar end-to-end**
   - Navegar entre abas
   - Executar fechamento
   - Aprovar comissões
   - Marcar como pago

---

### 8. VALIDAÇÕES ESPERADAS

✅ Hook useComissoes estendido sem quebrar existente
✅ Hook useComissoesRanking retorna dados + estados derivados
✅ Página Comissoes renderiza 5 abas
✅ KPIs mostram números corretos (ou 0)
✅ Gráfico Recharts renderiza com dados reais
✅ Ranking mostra top 10 por categoria
✅ Botão Fechamento chama RPC (logs no console)
✅ Aprovação individual/lote funciona
✅ PermissionGate restringe acesso corretamente
✅ MinhasComissoes.tsx continua funcionando
✅ Responsive: abas funcionam em mobile

---

### 9. RISCOS TÉCNICOS

⚠️ **Recharts**: Validar instalação + data format (pode precisar transformação)
⚠️ **Performance**: Tabelas com muitos registros → considerar paginação/virtualização
⚠️ **RPC**: fn_fechamento_mensal_comissoes pode ser lento → usar loading state adequado
⚠️ **RLS**: Validar que comissoes_ranking_mensal tem políticas corretas para leitura

