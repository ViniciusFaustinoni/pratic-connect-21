

# Sistema de Conta Corrente de Vendedores Externos

## Escopo

Sistema completo de conta corrente para vendedores externos, com lançamentos automáticos baseados nos 4 cenários de venda, abatimento sequencial de débitos, gestão financeira e tela de extrato para o vendedor.

## Banco de Dados (Migration)

### Tabela `cc_vendedor_lancamentos`
Tabela central da conta corrente. Cada linha é um lançamento (crédito ou débito).

```sql
CREATE TYPE public.cc_tipo_lancamento AS ENUM ('credito', 'debito');
CREATE TYPE public.cc_status_lancamento AS ENUM (
  'pendente', 'a_pagar', 'pago', 'antecipado', 'cancelado', 'em_abatimento'
);

CREATE TABLE public.cc_vendedor_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id uuid NOT NULL REFERENCES public.profiles(id),
  associado_id uuid REFERENCES public.associados(id),
  contrato_id uuid REFERENCES public.contratos(id),
  tipo cc_tipo_lancamento NOT NULL,
  categoria text NOT NULL, -- 'adesao', 'volante', 'recorrente', 'estorno', 'antecipacao', 'cancelamento'
  descricao text NOT NULL,
  valor_bruto numeric(12,2) NOT NULL DEFAULT 0,
  valor_abatimento numeric(12,2) NOT NULL DEFAULT 0,
  valor_liquido numeric(12,2) NOT NULL DEFAULT 0,
  saldo_apos numeric(12,2), -- saldo acumulado após este lançamento
  parcela_numero integer, -- para recorrentes: 1..N
  parcela_total integer,  -- N
  debito_volante_ref_id uuid REFERENCES public.cc_vendedor_lancamentos(id), -- ref ao débito que está sendo abatido
  status cc_status_lancamento NOT NULL DEFAULT 'pendente',
  data_lancamento date NOT NULL DEFAULT CURRENT_DATE,
  data_pagamento date,
  observacao_pagamento text,
  pago_por uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.cc_vendedor_lancamentos ENABLE ROW LEVEL SECURITY;

-- Vendedor vê seus próprios lançamentos
CREATE POLICY "vendedor_own" ON public.cc_vendedor_lancamentos
  FOR SELECT TO authenticated
  USING (vendedor_id = auth.uid());

-- Diretor/Admin vê tudo (via has_role)
CREATE POLICY "admin_all" ON public.cc_vendedor_lancamentos
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'diretor') OR
    public.has_role(auth.uid(), 'admin_master')
  );

CREATE INDEX idx_cc_vendedor ON public.cc_vendedor_lancamentos(vendedor_id);
CREATE INDEX idx_cc_associado ON public.cc_vendedor_lancamentos(associado_id);
CREATE INDEX idx_cc_status ON public.cc_vendedor_lancamentos(status);
```

### View `vw_cc_vendedor_saldo`
Calcula saldo atual por vendedor.

```sql
CREATE OR REPLACE VIEW public.vw_cc_vendedor_saldo AS
SELECT
  vendedor_id,
  COALESCE(SUM(CASE WHEN tipo = 'credito' AND status NOT IN ('cancelado') THEN valor_liquido ELSE 0 END), 0)
  - COALESCE(SUM(CASE WHEN tipo = 'debito' AND status NOT IN ('cancelado') THEN valor_liquido ELSE 0 END), 0) AS saldo_atual,
  COALESCE(SUM(CASE WHEN status = 'a_pagar' AND tipo = 'credito'
    AND EXTRACT(MONTH FROM data_lancamento) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(YEAR FROM data_lancamento) = EXTRACT(YEAR FROM CURRENT_DATE)
    THEN valor_liquido ELSE 0 END), 0) AS a_receber_mes,
  COALESCE(SUM(CASE WHEN status = 'antecipado' AND tipo = 'credito' THEN valor_liquido ELSE 0 END), 0) AS antecipacoes_abertas
FROM public.cc_vendedor_lancamentos
GROUP BY vendedor_id;
```

## Arquivos Novos

### 1. `src/hooks/useContaCorrenteVendedor.ts`
Hook principal com:
- **Query de lançamentos** com filtros (período, tipo, status) e paginação
- **Query de saldo** (3 cards do topo)
- **Mutation `registrarPagamento`**: muda status de `a_pagar` → `pago`, grava data e observação
- **Mutation `gerarLancamentosAtivacao`**: recebe dados da venda (vendedor_id, associado_id, contrato_id, valor_adesao, tipo_instalacao) e aplica os 4 cenários:
  - Cenário 1: crédito adesão + débito volante + N parcelas pendentes
  - Cenário 2: débito volante + N parcelas pendentes (com flag de abatimento)
  - Cenário 3: nenhum lançamento
  - Cenário 4: crédito adesão + N parcelas pendentes
- **Mutation `confirmarParcelaRecorrente`**: aplica regra de abatimento sequencial e muda status
- **Mutation `cancelarVendaPreBoleto`**: cancela parcelas pendentes, estorna adesão se creditada, mantém débito volante
- **Função `recalcularSaldos`**: recalcula `saldo_apos` sequencialmente

Lê configs da Fase 1 via `useComissaoExternaConfig` (percentual adesão, valor volante, tipo/valor/parcelas recorrente).

### 2. `src/pages/financeiro/ContaCorrenteVendedor.tsx`
Tela de extrato do vendedor (Parte D). Acessível em `/perfil/conta-corrente` e `/financeiro/venda-externa/:vendedorId`.

Componentes:
- 3 cards de resumo (saldo, a receber, antecipações)
- Filtros (período com DatePickerWithRange, tipo select, status select)
- Tabela com colunas: Data, Descrição, Tipo, Valor bruto, Abatimento, Valor líquido, Status, Saldo após
- Cores: créditos em verde, débitos em vermelho, abatimento com badge laranja
- Paginação
- Botão exportar PDF (futuro)

### 3. `src/pages/financeiro/GestaoContaVendedor.tsx`
Painel financeiro (Parte E). Igual ao extrato mas com ações administrativas:
- Botão "Registrar pagamento" em parcelas `a_pagar` (modal com data + observação)
- Seletor de vendedor no topo
- Botão "Antecipar parcelas" (placeholder para Fase 3)

### 4. `src/components/financeiro/RegistrarPagamentoModal.tsx`
Modal para registrar pagamento de parcela com campos: data e observação.

## Alterações em Arquivos Existentes

### `src/App.tsx`
Adicionar rotas:
- `/perfil/conta-corrente` → ContaCorrenteVendedor (próprio vendedor)
- `/financeiro/venda-externa` → GestaoContaVendedor (admin)
- `/financeiro/venda-externa/:vendedorId` → GestaoContaVendedor

### `src/components/layout/AppSidebar.tsx`
- Adicionar "Conta Corrente" no menu do perfil (visível para vendedor_clt e vendedor_externo)
- Adicionar "Venda Externa" no submenu Financeiro (visível para diretor e admin)

### `src/components/layout/GlobalBreadcrumb.tsx`
Adicionar breadcrumbs para as novas rotas.

## Lógica de Abatimento Sequencial (Cenário 2)

Quando `confirmarParcelaRecorrente` é chamada:
1. Buscar débitos volante do vendedor com saldo pendente (`categoria = 'volante'`, `status != 'pago'`)
2. Calcular saldo devedor restante (soma dos débitos volante não quitados - soma dos abatimentos já feitos)
3. Se saldo devedor > 0:
   - `valor_abatimento = min(valor_bruto_parcela, saldo_devedor)`
   - `valor_liquido = valor_bruto - valor_abatimento`
   - Atualizar descrição com detalhes do abatimento
4. Se saldo devedor = 0: `valor_liquido = valor_bruto`
5. Mudar status para `a_pagar`

## Notas

- Vendedor CLT visualiza apenas débitos de vistoria volante (sem comissões recorrentes) — filtro por role no hook
- Cenário 3 não gera lançamentos (verificação explícita)
- Cenário 4 não gera débitos (sem volante)
- A geração de lançamentos será chamada no momento da ativação do associado (hook existente ou trigger)
- O link de adesão zerada (card comemorativo) será tratado no componente de pagamento existente do ASAAS

