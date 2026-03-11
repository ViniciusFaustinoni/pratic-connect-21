

# Feature: Solicitação de "FIPE Menor" com Aprovação do Supervisor

## Regra de Negócio (esclarecida pelo usuário)

A FIPE do veículo é reduzida em 1%. Se o valor resultante cair na faixa inferior da `tabelas_preco_mensalidade`, o vendedor pode solicitar enquadramento nessa faixa:

```text
Exemplo: FIPE = R$50.400
  → 1% de redução = R$50.400 × 0.99 = R$49.896
  → Faixa inferior: R$45.000,01 – R$50.000,00
  → R$49.896 ≤ R$50.000 → ELEGÍVEL ✓

Exemplo: FIPE = R$50.600
  → 1% de redução = R$50.600 × 0.99 = R$50.094
  → Faixa inferior max = R$50.000
  → R$50.094 > R$50.000 → NÃO ELEGÍVEL ✗
```

- A FIPE real **não muda** (cobertura em sinistro usa a FIPE original)
- Apenas a **mensalidade** é calculada pela faixa inferior
- Requer aprovação do Supervisor de Vendas
- Após aprovação do Analista de Cadastro, precisa também da aprovação do Supervisor antes de ativar

## Alterações

### 1. Migração SQL

**Nova tabela `aprovacoes_fipe_menor`**:
- `id` (uuid PK), `cotacao_id` (FK cotacoes), `solicitante_id` (FK auth.users), `supervisor_id` (FK auth.users, nullable)
- `fipe_real` (numeric) - valor original do veículo
- `fipe_faixa_original_min/max` (numeric) - faixa real onde o veículo se enquadra
- `fipe_faixa_solicitada_min/max` (numeric) - faixa inferior solicitada
- `valor_mensal_original`, `valor_mensal_reduzido` (numeric)
- `justificativa` (text), `status` (text: pendente/aprovado/recusado, default pendente)
- `observacao_supervisor` (text), `created_at`, `updated_at`, `respondido_em`
- RLS: vendedores veem as próprias, supervisores/diretores veem todas

**Novas colunas em `cotacoes`**:
- `solicitar_fipe_menor` (boolean, default false)
- `fipe_menor_aprovado` (boolean, nullable) - null=pendente, true=aprovado, false=recusado
- `fipe_faixa_cobranca_min` / `fipe_faixa_cobranca_max` (numeric, nullable) - faixa aprovada para cobrança

### 2. Frontend - Formulário de Cotação (`CotacaoFormDialog.tsx`)

- Adicionar lógica de elegibilidade: `valorFipe * 0.99 <= faixaAnterior.fipe_max`
- Se elegível, mostrar switch "Solicitar FIPE Menor" com preview: mensalidade atual vs. reduzida
- Se não elegível (1% não cai na faixa de baixo), switch desabilitado com tooltip explicando
- Campo de justificativa obrigatório quando ativado
- Ao salvar, criar registro em `aprovacoes_fipe_menor` e marcar `solicitar_fipe_menor = true` na cotação

### 3. Frontend - Tela de Aprovação do Supervisor (`src/pages/vendas/AprovacoesFipeMenor.tsx`)

- Nova página listando solicitações pendentes
- Cada card: nome do cliente, veículo, FIPE real, faixa original vs. solicitada, diferença de mensalidade, justificativa
- Botões Aprovar/Recusar com campo de observação
- Ao aprovar: atualiza `aprovacoes_fipe_menor.status`, grava faixa aprovada em `cotacoes`

### 4. Hook (`src/hooks/useAprovacoesFipeMenor.ts`)

- `useAprovacoesFipeMenor()` - lista solicitações com joins (cotação, vendedor, lead)
- `useAprovarFipeMenor()` - mutation para aprovar
- `useRecusarFipeMenor()` - mutation para recusar

### 5. Acompanhamento (`Acompanhamento.tsx`)

- Cotações com `solicitar_fipe_menor = true` e `fipe_menor_aprovado IS NULL` ficam retidas após análise de cadastro
- Nova fase visual "Aprovação FIPE" no pipeline entre "Contrato" e "Ativação" (ou badge no card existente)

### 6. Cálculo de Mensalidade

- Em `usePlanosCotacao.ts`: sem alteração (calcula sempre pela FIPE real)
- A faixa reduzida é calculada apenas para preview no formulário e para a tela de aprovação
- Após aprovação, o valor mensal da cotação/contrato usa a faixa aprovada

### 7. Rota

- Adicionar rota `/vendas/aprovacoes-fipe` em `App.tsx`
- Adicionar link no menu lateral para Supervisor/Diretor

### Arquivos novos
- `src/pages/vendas/AprovacoesFipeMenor.tsx`
- `src/hooks/useAprovacoesFipeMenor.ts`

### Arquivos modificados
- `src/components/cotacoes/CotacaoFormDialog.tsx` - switch + preview + justificativa
- `src/hooks/useCotacoes.ts` - persistir novos campos
- `src/pages/vendas/Acompanhamento.tsx` - nova fase/badge
- `src/App.tsx` - nova rota
- Migração SQL para tabela e colunas

