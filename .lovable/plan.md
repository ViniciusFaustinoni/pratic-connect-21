

## Sistema de Comissionamento Automático de Vendedores

### Resumo Executivo

Implementar um módulo completo de cálculo automático de comissões para vendedores, com suporte a diferentes tipos de regras (percentual fixo, escalonado por metas, por tipo de vendedor CLT/Externo), cálculo automático ao ativar contratos e dashboard de acompanhamento.

---

### Análise da Arquitetura Atual

**Estrutura existente utilizada:**
- `metas_vendas`: Tabela de metas com campos `meta_contratos`, `meta_valor`, `realizado_*`
- `contratos`: Contratos com `vendedor_id`, `valor_mensal`, `valor_adesao`, `status`, `data_ativacao`
- `cotacoes`: Cotações com `valor_adesao`, `valor_total_mensal`, `vendedor_id`
- `user_roles`: Diferenciação entre `vendedor_clt` e `vendedor_externo`
- `profiles`: Dados dos vendedores

**Valores disponíveis para base de comissão:**
- `valor_adesao` (taxa de adesão paga na entrada)
- `valor_mensal` (mensalidade do contrato)
- `valor_total_mensal` da cotação

---

### Estrutura de Dados

#### Tabela: `comissoes_config` (Configuração de Regras)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| nome | varchar | Nome da regra (ex: "CLT Padrão") |
| tipo_vendedor | varchar | 'vendedor_clt', 'vendedor_externo', 'todos' |
| base_calculo | varchar | 'valor_adesao', 'valor_mensal', 'ambos' |
| tipo_calculo | varchar | 'percentual_fixo', 'escalonado_metas', 'escalonado_valor' |
| percentual_base | numeric | Percentual base (ex: 10%) |
| bonus_meta_atingida | numeric | Bônus adicional ao atingir 100% da meta |
| bonus_meta_superada | numeric | Bônus ao superar 120% da meta |
| valor_minimo | numeric | Piso de comissão por contrato |
| valor_maximo | numeric | Teto de comissão por contrato |
| ativo | boolean | Se a regra está ativa |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### Tabela: `comissoes` (Comissões Calculadas)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| vendedor_id | uuid | FK para profiles |
| contrato_id | uuid | FK para contratos |
| config_id | uuid | FK para comissoes_config (regra usada) |
| mes_referencia | integer | Mês (1-12) |
| ano_referencia | integer | Ano |
| valor_base | numeric | Valor usado como base do cálculo |
| percentual_aplicado | numeric | Percentual efetivamente aplicado |
| valor_comissao | numeric | Valor calculado da comissão |
| bonus_meta | numeric | Valor de bônus por meta atingida |
| valor_total | numeric | valor_comissao + bonus_meta |
| status | varchar | 'pendente', 'aprovada', 'paga', 'cancelada' |
| aprovado_por | uuid | Quem aprovou |
| aprovado_em | timestamptz | |
| pago_em | timestamptz | |
| observacoes | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### Tabela: `comissoes_pagamentos` (Histórico de Pagamentos)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| vendedor_id | uuid | FK |
| mes_referencia | integer | |
| ano_referencia | integer | |
| valor_total | numeric | Total pago |
| quantidade_comissoes | integer | Número de comissões no lote |
| data_pagamento | date | |
| comprovante_url | text | Link do comprovante |
| observacoes | text | |
| created_at | timestamptz | |

---

### Fluxo de Funcionamento

```text
1. CONFIGURAÇÃO (Gerência)
   └── Define regras de comissão por tipo de vendedor
       ├── Vendedor CLT: 5% sobre adesão + bônus por meta
       └── Vendedor Externo: 10% sobre adesão

2. CÁLCULO AUTOMÁTICO
   └── Trigger ao ativar contrato (status = 'ativo')
       ├── Identifica tipo do vendedor
       ├── Busca regra de comissão aplicável
       ├── Calcula valor base * percentual
       ├── Verifica se atingiu meta do mês
       ├── Aplica bônus se aplicável
       └── Cria registro em comissoes

3. APROVAÇÃO (Supervisor/Gerente)
   └── Revisar comissões pendentes
       ├── Aprovar individualmente
       └── Aprovar em lote por período

4. PAGAMENTO (Financeiro)
   └── Processar comissões aprovadas
       ├── Gerar relatório de pagamento
       ├── Marcar como pagas
       └── Registrar comprovante
```

---

### Componentes a Criar

#### 1. Páginas

| Componente | Descrição | Acesso |
|------------|-----------|--------|
| `ComissoesConfig.tsx` | Configuração de regras de comissão | Gerência/Diretoria |
| `ComissoesDashboard.tsx` | Visão geral de comissões do mês | Gerência |
| `MinhasComissoes.tsx` | Vendedor visualiza suas comissões | Vendedores |

#### 2. Hooks

| Hook | Descrição |
|------|-----------|
| `useComissoesConfig` | CRUD de configurações de comissão |
| `useComissoes` | Buscar/filtrar comissões por período e vendedor |
| `useMinhasComissoes` | Comissões do vendedor logado |
| `useCalcularComissao` | Função de cálculo automático |

#### 3. Componentes UI

| Componente | Descrição |
|------------|-----------|
| `ComissaoCard` | Card com resumo de comissão individual |
| `ComissaoResumoMensal` | Resumo do mês com totais |
| `ComissaoAprovacaoList` | Lista para aprovação em lote |
| `ComissaoRegraBadge` | Badge mostrando regra aplicada |

---

### Regras de Negócio

#### Cálculo Base
```text
valor_comissao = valor_base × (percentual_base / 100)
```

#### Bônus por Meta
```text
Se realizado_contratos >= meta_contratos:
   bonus = valor_comissao × (bonus_meta_atingida / 100)
   
Se realizado_contratos >= meta_contratos × 1.2:
   bonus = valor_comissao × (bonus_meta_superada / 100)
```

#### Exemplo Prático

**Cenário:** Vendedor CLT fecha contrato com adesão R$ 500,00
- Percentual base: 5%
- Meta do mês: 10 contratos
- Realizado: 12 contratos (120%)
- Bônus por meta superada: 50%

**Cálculo:**
```text
Comissão base: R$ 500 × 5% = R$ 25,00
Bônus (meta superada): R$ 25 × 50% = R$ 12,50
TOTAL: R$ 37,50
```

---

### Integração com Sistema Existente

#### Trigger ao Ativar Contrato

Adicionar lógica após a ativação em `ativar-associado` ou criar trigger no banco:

```sql
-- Pseudo-código da lógica
AFTER UPDATE ON contratos
WHEN NEW.status = 'ativo' AND OLD.status != 'ativo'
THEN
  INSERT INTO comissoes (...)
  SELECT calcular_comissao(NEW.id);
```

#### Dashboard do Vendedor

Adicionar card de "Minhas Comissões" no Dashboard quando o usuário é vendedor, mostrando:
- Total de comissões do mês
- Comissões pendentes de aprovação
- Último pagamento recebido

---

### Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/migrations/xxx.sql` | Criar | Tabelas comissoes_config, comissoes, comissoes_pagamentos |
| `src/hooks/useComissoes.ts` | Criar | Hooks de comissões |
| `src/pages/vendas/ComissoesConfig.tsx` | Criar | Página de configuração |
| `src/pages/vendas/Comissoes.tsx` | Criar | Dashboard de comissões |
| `src/pages/MinhasComissoes.tsx` | Criar | Visão do vendedor |
| `src/components/comissoes/ComissaoCard.tsx` | Criar | Card de comissão |
| `src/components/comissoes/ComissaoResumoMensal.tsx` | Criar | Resumo mensal |
| `src/components/comissoes/ConfiguracaoComissaoForm.tsx` | Criar | Form de configuração |
| `src/App.tsx` | Modificar | Adicionar rotas |
| `src/components/layout/sidebar-items.ts` | Modificar | Adicionar menu |
| `supabase/functions/calcular-comissao/index.ts` | Criar | Edge function para cálculo |

---

### Permissões

| Ação | Quem pode |
|------|-----------|
| Configurar regras | Diretor, Admin Master, Desenvolvedor |
| Ver todas comissões | Gerência, Supervisores |
| Aprovar comissões | Gerente Comercial, Diretor |
| Marcar como paga | Financeiro, Diretor |
| Ver próprias comissões | Vendedores |

---

### Estimativa de Implementação

| Fase | Tarefas | Status |
|------|---------|--------|
| 1 | Criar tabelas e migrations | ✅ Concluído |
| 2 | Hooks e tipos TypeScript | ✅ Concluído |
| 3 | Página de configuração de regras | ✅ Concluído |
| 4 | Dashboard de comissões (gerência) | ✅ Concluído |
| 5 | Página "Minhas Comissões" (vendedor) | ✅ Concluído |
| 6 | Trigger de cálculo automático (banco) | ✅ Concluído |
| 7 | Integrar com ativação de contrato | ✅ Concluído |
| 8 | Adicionar rotas e menu | ✅ Concluído |

---

### Arquivos Criados

| Arquivo | Descrição |
|---------|-----------|
| `src/types/comissoes.ts` | Tipos TypeScript para comissões |
| `src/hooks/useComissoesConfig.ts` | Hook para CRUD de configurações |
| `src/hooks/useComissoes.ts` | Hook para gerenciar comissões |
| `src/hooks/useMinhasComissoes.ts` | Hook para vendedor ver próprias comissões |
| `src/components/comissoes/ComissaoCard.tsx` | Card de comissão |
| `src/components/comissoes/ComissaoResumoMensal.tsx` | Resumo mensal |
| `src/pages/vendas/ComissoesConfig.tsx` | Página de configuração de regras |
| `src/pages/vendas/Comissoes.tsx` | Dashboard de comissões (gerência) |
| `src/pages/vendas/MinhasComissoes.tsx` | Página do vendedor |

### Rotas Adicionadas

- `/vendas/comissoes` - Dashboard de comissões (gerência)
- `/vendas/comissoes/config` - Configuração de regras
- `/vendas/minhas-comissoes` - Visão do vendedor

### Banco de Dados

Tabelas criadas:
- `comissoes_config` - Regras de comissionamento
- `comissoes` - Comissões calculadas por contrato
- `comissoes_pagamentos` - Histórico de pagamentos

Funções criadas:
- `calcular_comissao_contrato(contrato_id)` - Calcula comissão para um contrato
- `trigger_calcular_comissao()` - Trigger automático ao ativar contrato

