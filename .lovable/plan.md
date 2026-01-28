
# Plano de Revisão Completa da Área Financeira + Correção ASAAS

## Diagnóstico Final

### Problemas nas Páginas (UI não conectada)
1. **Dashboard** - Botões não abrem modais
2. **Cobranças** - Ações sem funcionalidade
3. **Contas a Pagar** - Modais não conectados
4. **Extrato** - Nova movimentação não funciona

### BUG CRÍTICO: Integração ASAAS
A edge function `asaas-cobrancas` tenta usar `dados.customer` que **nunca é passado** pelo hook. A chamada à API do ASAAS falha porque o campo `customer` é obrigatório.

---

## Correções Necessárias

### 1. Edge Function `asaas-cobrancas` (BUG CRÍTICO)

**Problema:** Linha 85 usa `dados.customer` que não é passado
**Solução:** Buscar o `asaas_id` do cliente pelo `associado_id` ANTES de criar a cobrança

```typescript
case 'criar': {
  if (!dados) throw new Error('Dados da cobrança são obrigatórios');
  
  // CORREÇÃO: Buscar asaas_id do cliente pelo associado_id
  let customerAsaasId = dados.customer;
  
  if (!customerAsaasId && associado_id) {
    const { data: clienteAsaas } = await supabase
      .from('asaas_clientes')
      .select('asaas_id')
      .eq('associado_id', associado_id)
      .maybeSingle();
    
    if (!clienteAsaas?.asaas_id) {
      throw new Error('Cliente não sincronizado com ASAAS. Sincronize primeiro.');
    }
    
    customerAsaasId = clienteAsaas.asaas_id;
  }
  
  if (!customerAsaasId) {
    throw new Error('customer ou associado_id é obrigatório');
  }

  // Agora usar customerAsaasId na chamada
  const asaasCobranca = await asaasRequest('/payments', 'POST', {
    customer: customerAsaasId,
    // ... resto dos dados
  });
```

---

### 2. Dashboard Financeiro (`FinanceiroDashboard.tsx`)

**Adicionar imports e estados:**
```typescript
import { NovaCobrancaModal } from '@/components/financeiro/NovaCobrancaModal';
import { NovaContaPagarModal } from '@/components/financeiro/NovaContaPagarModal';

const [modalCobranca, setModalCobranca] = useState(false);
const [modalDespesa, setModalDespesa] = useState(false);
```

**Conectar botões:**
- "Nova Cobrança" → `onClick={() => setModalCobranca(true)}`
- "Nova Despesa" → `onClick={() => setModalDespesa(true)}`
- "Gerar Faturamento" → `onClick={() => navigate('/financeiro/faturamento')}`

**Conectar Ações Rápidas:**
- "Gerar Faturamento Mensal" → `/financeiro/faturamento`
- "Ver Cobranças Pendentes" → `/financeiro/cobrancas?status=pendente`
- "Ver Contas a Pagar" → `/financeiro/contas-pagar`
- "Conciliação Bancária" → `/financeiro/extratos-bancarios`
- "Ver extrato completo" → `/financeiro/extrato`

**Renderizar modais no final:**
```tsx
<NovaCobrancaModal open={modalCobranca} onClose={() => setModalCobranca(false)} />
<NovaContaPagarModal open={modalDespesa} onClose={() => setModalDespesa(false)} />
```

---

### 3. Lista de Cobranças (`CobrancasList.tsx`)

**Adicionar imports e estados:**
```typescript
import { NovaCobrancaModal } from '@/components/financeiro/NovaCobrancaModal';
import { RegistrarPagamentoModal } from '@/components/financeiro/RegistrarPagamentoModal';

const [modalNovaCobranca, setModalNovaCobranca] = useState(false);
const [modalPagamento, setModalPagamento] = useState(false);
const [cobrancaSelecionada, setCobrancaSelecionada] = useState<any>(null);
```

**Conectar botão header:**
```tsx
<Button onClick={() => setModalNovaCobranca(true)}>
  <Plus className="mr-2 h-4 w-4" /> Nova Cobrança
</Button>
```

**Conectar ações do dropdown:**
- "Ver Detalhes" → `navigate(\`/financeiro/cobrancas/${cobranca.id}\`)`
- "Registrar Pagamento" → Abrir `RegistrarPagamentoModal`
- "Enviar WhatsApp" → Função com link do boleto

**Renderizar modais:**
```tsx
<NovaCobrancaModal open={modalNovaCobranca} onClose={() => setModalNovaCobranca(false)} />
<RegistrarPagamentoModal 
  open={modalPagamento} 
  onClose={() => setModalPagamento(false)}
  cobranca={cobrancaSelecionada}
/>
```

---

### 4. Contas a Pagar (`ContasPagar.tsx`)

**Adicionar imports e estados:**
```typescript
import { NovaContaPagarModal } from '@/components/financeiro/NovaContaPagarModal';
import { PagarContaModal } from '@/components/financeiro/PagarContaModal';

const [modalNovaConta, setModalNovaConta] = useState(false);
const [modalPagar, setModalPagar] = useState(false);
const [contaSelecionada, setContaSelecionada] = useState<any>(null);
```

**Adicionar mutation para cancelar:**
```typescript
const cancelarConta = useMutation({
  mutationFn: async (contaId: string) => {
    const { error } = await supabase
      .from('contas_pagar')
      .update({ status: 'cancelado', updated_at: new Date().toISOString() })
      .eq('id', contaId);
    if (error) throw error;
  },
  onSuccess: () => {
    toast.success('Conta cancelada com sucesso');
    queryClient.invalidateQueries({ queryKey: ['contas-pagar'] });
  },
  onError: () => toast.error('Erro ao cancelar conta'),
});
```

**Conectar ações:**
- "Nova Conta" → `onClick={() => setModalNovaConta(true)}`
- "Pagar" → Abrir `PagarContaModal`
- "Cancelar" → `cancelarConta.mutate(conta.id)`

---

### 5. Extrato (`Extrato.tsx`)

**Adicionar imports e estados:**
```typescript
import { NovaMovimentacaoModal } from '@/components/financeiro/NovaMovimentacaoModal';

const [modalMovimentacao, setModalMovimentacao] = useState(false);
```

**Conectar botão Nova Movimentação:**
```tsx
<Button variant="outline" onClick={() => setModalMovimentacao(true)}>
  <Plus className="mr-2 h-4 w-4" /> Nova Movimentação
</Button>
```

**Implementar exportação CSV:**
```typescript
const handleExportar = () => {
  if (!movimentacoes?.length) {
    toast.error('Nenhuma movimentação para exportar');
    return;
  }
  
  const headers = 'Data,Tipo,Categoria,Descrição,Valor\n';
  const rows = movimentacoes.map(m => 
    `${m.data_movimentacao},${m.tipo},${m.categoria || ''},${m.descricao || ''},${m.valor}`
  ).join('\n');
  
  const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `extrato_${filters.dataInicio}_${filters.dataFim}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('Extrato exportado!');
};
```

---

## Arquivos a Modificar

| Arquivo | Tipo | Alteração |
|---------|------|-----------|
| `supabase/functions/asaas-cobrancas/index.ts` | Edge Function | Buscar asaas_id antes de criar cobrança |
| `src/pages/financeiro/FinanceiroDashboard.tsx` | Página | Conectar modais + navegações |
| `src/pages/financeiro/CobrancasList.tsx` | Página | Modal nova cobrança + pagamento |
| `src/pages/financeiro/ContasPagar.tsx` | Página | Modal nova conta + pagar + cancelar |
| `src/pages/financeiro/Extrato.tsx` | Página | Modal movimentação + exportar CSV |

---

## Fluxo de Integração ASAAS Corrigido

```text
1. Usuário clica "Nova Cobrança"
2. Modal abre, usuário seleciona associado
3. Ao salvar (com "Gerar Boleto" marcado):
   a. Hook chama sincronizarCliente(associado_id)
      → Edge function cria/atualiza cliente no ASAAS
      → Salva asaas_id na tabela asaas_clientes
   b. Hook chama criarCobranca({ associado_id, ... })
      → Edge function BUSCA asaas_id pelo associado_id (CORREÇÃO)
      → Cria cobrança no ASAAS com customer correto
      → Gera boleto + PIX
      → Salva na tabela asaas_cobrancas
4. Sucesso! Cobrança criada com boleto/PIX funcionais
```

---

## Verificação Pós-Implementação

1. **Testar criação de cobrança com boleto** - Verificar se ASAAS gera corretamente
2. **Verificar logs da edge function** - Confirmar fluxo sem erros
3. **Testar todas as ações do dropdown** - Pagamento, cancelamento, WhatsApp
4. **Testar contas a pagar** - Criar, pagar, cancelar
5. **Testar extrato** - Nova movimentação, exportar CSV
