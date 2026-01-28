
# Plano de Revisão Completa da Área de Contabilidade

## Diagnóstico Atual

Após análise detalhada de todas as páginas, hooks e componentes da área de contabilidade, identifiquei:

### O que está funcionando corretamente:
- **Dashboard**: KPIs reais, lista de últimos lançamentos, ações rápidas
- **Plano de Contas**: CRUD completo (39 contas já cadastradas no banco)
- **Novo Lançamento**: Formulário, editor de partidas, validação de balanceamento
- **Detalhe do Lançamento**: Visualização e estorno
- **Balancete, Balanço Patrimonial, DRE**: Relatórios com dados reais
- **Fechamentos**: Verificação e fechamento de períodos
- **Razão da Conta**: Movimentação analítica por conta
- **Integração com Financeiro**: Já implementada! Os modais `PagarContaModal` e `RegistrarPagamentoModal` já criam lançamentos contábeis automaticamente

### Problemas Identificados:

| # | Problema | Arquivo | Impacto |
|---|----------|---------|---------|
| 1 | Hook `useLancamentos` não busca partidas | `useContabilidade.ts` | Lista mostra R$ 0,00 em todas as linhas |
| 2 | Botões Imprimir/Download não implementados | Balancete, BP, DRE, Razão | Botões não fazem nada |
| 3 | Gráfico de categoria é placeholder | Dashboard | Área em branco |
| 4 | Falta navegação para Razão da Conta | Dashboard | Menu não tem acesso |

### Não há dados mock
Todos os dados vêm do banco de dados real (atualmente vazio porque não houve operações financeiras).

---

## Correções Necessárias

### 1. BUG CRÍTICO: Hook `useLancamentos` sem partidas

**Arquivo**: `src/hooks/useContabilidade.ts`
**Linha**: 169

**Problema**: O select usa apenas `*` e não traz as partidas vinculadas.

**Solução**:
```typescript
export function useLancamentos(filtros?: FiltrosLancamentos) {
  return useQuery({
    queryKey: ['lancamentos', filtros],
    queryFn: async () => {
      let query = supabase
        .from('lancamentos_contabeis')
        .select(`
          *,
          partidas:lancamentos_partidas(
            id, tipo, valor, ordem,
            conta:plano_contas(codigo, descricao)
          )
        `)
        .order('data_competencia', { ascending: false })
        .order('created_at', { ascending: false });
      // ... resto mantém igual
```

Isso permite que a página `LancamentosList.tsx` calcule corretamente os totais de débito/crédito em cada linha.

---

### 2. Implementar Exportação PDF (Balancete, BP, DRE, Razão)

Criar função utilitária de exportação e conectar aos botões.

**Novo arquivo**: `src/lib/contabilidade-exports.ts`

```typescript
import jsPDF from 'jspdf';

interface ExportConfig {
  titulo: string;
  periodo: string;
  dados: any[];
  colunas: { header: string; key: string; align?: 'left' | 'right' }[];
}

export function exportarRelatorioPDF(config: ExportConfig) {
  const doc = new jsPDF();
  const { titulo, periodo, dados, colunas } = config;
  
  // Cabeçalho
  doc.setFontSize(16);
  doc.text('SGA PRATIC - ASSOCIAÇÃO DE PROTEÇÃO VEICULAR', 105, 20, { align: 'center' });
  doc.setFontSize(14);
  doc.text(titulo, 105, 30, { align: 'center' });
  doc.setFontSize(10);
  doc.text(periodo, 105, 38, { align: 'center' });
  
  // Tabela simplificada
  let y = 50;
  // ... implementação da tabela
  
  doc.save(`${titulo.toLowerCase().replace(/ /g, '_')}_${periodo}.pdf`);
}

export function exportarRelatorioCSV(config: ExportConfig) {
  const { titulo, periodo, dados, colunas } = config;
  
  const headers = colunas.map(c => c.header).join(';');
  const rows = dados.map(d => 
    colunas.map(c => d[c.key] || '').join(';')
  ).join('\n');
  
  const csv = `${headers}\n${rows}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${titulo.toLowerCase().replace(/ /g, '_')}_${periodo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
```

---

### 3. Conectar Botões de Exportação nos Relatórios

#### 3.1 Balancete (`Balancete.tsx`)

**Linhas 114-119**: Conectar botões

```typescript
const handlePrint = () => {
  window.print();
};

const handleExportPDF = () => {
  if (!balancete?.length) {
    toast.error('Nenhum dado para exportar');
    return;
  }
  // Chamar função de exportação
  toast.success('PDF gerado!');
};

// Nos botões:
<Button variant="outline" size="icon" onClick={handlePrint}>
  <Printer className="h-4 w-4" />
</Button>
<Button variant="outline" size="icon" onClick={handleExportPDF}>
  <Download className="h-4 w-4" />
</Button>
```

#### 3.2 Balanço Patrimonial (`BalancoPatrimonial.tsx`)
#### 3.3 DRE (`DRE.tsx`)
#### 3.4 Razão da Conta (`RazaoConta.tsx`)

Mesma lógica aplicada em todos os relatórios.

---

### 4. Gráfico de Categoria no Dashboard

**Arquivo**: `ContabilidadeDashboard.tsx`
**Linhas 386-398**: Substituir placeholder por gráfico real

**Solução**: Usar Recharts (já instalado) para mostrar despesas por categoria

```typescript
// Adicionar query para buscar despesas por categoria
const { data: despesasPorCategoria } = useQuery({
  queryKey: ['despesas-categoria', mesAtual, anoAtual],
  queryFn: async () => {
    const { data: partidas } = await supabase
      .from('lancamentos_partidas')
      .select(`
        valor,
        conta:plano_contas!inner(codigo, descricao, tipo),
        lancamento:lancamentos_contabeis!inner(data_competencia, status)
      `)
      .eq('tipo', 'debito')
      .eq('conta.tipo', 'despesa')
      .eq('lancamento.status', 'ativo')
      .gte('lancamento.data_competencia', inicioMes)
      .lt('lancamento.data_competencia', fimMes);
    
    // Agrupar por descrição da conta
    const agrupado = partidas?.reduce((acc, p) => {
      const desc = p.conta.descricao;
      acc[desc] = (acc[desc] || 0) + p.valor;
      return acc;
    }, {});
    
    return Object.entries(agrupado || {}).map(([name, value]) => ({ name, value }));
  }
});

// Renderizar com Recharts
<ResponsiveContainer width="100%" height={250}>
  <PieChart>
    <Pie data={despesasPorCategoria} dataKey="value" nameKey="name" />
    <Tooltip formatter={(value) => formatCurrency(value)} />
    <Legend />
  </PieChart>
</ResponsiveContainer>
```

---

### 5. Adicionar Link para Razão no Dashboard

**Arquivo**: `ContabilidadeDashboard.tsx`
**Seção Ações Rápidas** (linha ~440)

```typescript
<Button 
  variant="outline" 
  className="w-full justify-start"
  onClick={() => navigate('/contabilidade/razao')}
>
  <BookOpen className="h-4 w-4 mr-2" />
  Razão da Conta
</Button>
```

---

## Resumo das Alterações

| Arquivo | Tipo | Alteração |
|---------|------|-----------|
| `src/hooks/useContabilidade.ts` | Hook | Adicionar partidas no select de `useLancamentos` |
| `src/lib/contabilidade-exports.ts` | **Novo** | Funções de exportação PDF/CSV |
| `src/pages/contabilidade/Balancete.tsx` | Página | Conectar botões de exportação |
| `src/pages/contabilidade/BalancoPatrimonial.tsx` | Página | Conectar botões de exportação |
| `src/pages/contabilidade/DRE.tsx` | Página | Conectar botões de exportação |
| `src/pages/contabilidade/RazaoConta.tsx` | Página | Conectar botões de exportação |
| `src/pages/contabilidade/ContabilidadeDashboard.tsx` | Página | Gráfico real + link Razão |

---

## Integração com Área Financeira

**Já implementada e não precisa alteração!**

A integração já existe nos seguintes pontos:

1. **`PagarContaModal.tsx`** (linha 161): Ao pagar uma conta, cria lançamento contábil automático
   - Débito: Conta de despesa conforme categoria
   - Crédito: Banco Conta Movimento

2. **`RegistrarPagamentoModal.tsx`** (linha 135): Ao receber pagamento, cria lançamento contábil
   - Débito: Banco Conta Movimento
   - Crédito: Conta de receita conforme tipo

3. **`contabilidade-config.ts`**: Mapeamento de tipos/categorias para contas contábeis

---

## Verificação Pós-Implementação

1. Acessar **Lista de Lançamentos** e verificar se débitos/créditos aparecem corretamente
2. Testar **exportação PDF** em Balancete, BP, DRE e Razão
3. Verificar se o **gráfico de categorias** aparece no Dashboard
4. Criar uma **cobrança no Financeiro**, registrar pagamento, e verificar se o lançamento contábil foi criado automaticamente
5. Criar uma **conta a pagar**, pagar, e verificar o lançamento contábil gerado

---

## Observação

**Não há necessidade de alterações em outras áreas do sistema.** A integração Contabilidade ↔ Financeiro já está implementada e funcionando. Os lançamentos contábeis serão criados automaticamente quando:
- Pagamentos de cobranças forem registrados
- Contas a pagar forem pagas
