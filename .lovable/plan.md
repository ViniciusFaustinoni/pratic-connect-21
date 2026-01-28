
# Plano de Revisao Completa: Diretoria

## Diagnostico Atual

### Status do Banco de Dados
| Tabela | Registros |
|--------|-----------|
| planos | 18 |
| tabelas_preco | 12 |
| configuracoes | 33 |
| faixas_cotas | 33 |
| funcionarios (profiles) | 236 |
| user_roles | 236 |
| logs_auditoria | 58 |
| indicadores_atuariais | 0 |
| rateios | 0 |

### Conclusao Principal
**NAO HA DADOS MOCK** - Todas as paginas estao conectadas ao Supabase com queries reais.

---

## O que esta funcionando corretamente

| Pagina | Funcionalidade | Status |
|--------|----------------|--------|
| DiretoriaDashboard | KPIs (associados, receita, sinistralidade, conversao, inadimplencia, resultado) | OK |
| DiretoriaDashboard | Graficos de evolucao mensal | OK |
| DiretoriaDashboard | Metricas de tempo (transito, execucao) | OK |
| DiretoriaDashboard | Rastreadores por portador | OK |
| Usuarios | CRUD completo de usuarios | OK |
| Usuarios | Filtros (tipo, perfil, status) | OK |
| Usuarios | Ativar/Desativar/Bloquear/Resetar senha | OK |
| RateioSinistros | Calcular rateio por cotas | OK |
| RateioSinistros | Aprovar e aplicar rateio | OK |
| RateioSinistros | Historico de rateios | OK |
| ProdutosGestao | CRUD de planos | OK |
| ProdutosGestao | Toggle ativo/inativo | OK |
| ProdutoDetalhe | Visualizacao de precos e coberturas | OK |
| Configuracoes | CRUD de todas configuracoes por categoria | OK |
| LogsAuditoria | Listagem com filtros | OK |
| LogsAuditoria | Exportacao CSV | OK |
| LogsAuditoria | Expansao de detalhes (dados anteriores/novos) | OK |
| FaixasCotas | CRUD de ajustes percentuais | OK |
| FaixasCotas | Aplicar ajuste em grupo | OK |
| FaixasCotas | Historico de alteracoes | OK |
| FaixasCotas | Simulacao de impacto | OK |
| PerfisAcesso | Visualizacao por perfil | OK |
| PerfisAcesso | Edicao de roles por usuario | OK |
| SolicitacoesIA | Listagem de solicitacoes pendentes/aprovadas/rejeitadas | OK |
| SolicitacoesIA | Aprovar/Rejeitar via Edge Function | OK |

---

## Problemas Identificados

| # | Problema | Arquivo | Linha | Impacto |
|---|----------|---------|-------|---------|
| 1 | Botao "Exportar" sem onClick | DiretoriaDashboard.tsx | 265-268 | Nao exporta dados do dashboard |
| 2 | handleGerarRelatorio so exibe toast | RelatoriosGerenciais.tsx | 130-139 | Nao gera arquivo real |
| 3 | Botao "Importar" sem funcionalidade | TabelaPrecos.tsx | 117-119 | Nao importa tabela de precos |
| 4 | Botao "Exportar" sem funcionalidade | TabelaPrecos.tsx | 120-124 | Nao exporta tabela de precos |
| 5 | Botao "History" sem funcionalidade | TabelaPrecos.tsx | 263-265 | Nao mostra historico de alteracoes |
| 6 | Botao "Delete" sem confirmacao/acao | TabelaPrecos.tsx | 266-267 | Nao exclui faixa de preco |
| 7 | Botao "Recalcular" permanentemente disabled | IndicadoresAtuariais.tsx | 104 | Nao permite recalcular indicadores |

---

## Correcoes Necessarias

### 1. DiretoriaDashboard - Implementar Exportacao

**Arquivo**: `src/pages/diretoria/DiretoriaDashboard.tsx`

Criar funcao que exporta PDF/Excel com:
- KPIs atuais
- Grafico de evolucao (como tabela)
- Indicadores operacionais

```typescript
const handleExportar = async () => {
  if (!stats) return;
  
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text('Dashboard Executivo', 14, 22);
  
  doc.setFontSize(12);
  doc.text(`Periodo: ${periodo}`, 14, 32);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 40);
  
  // KPIs
  const kpis = [
    ['Associados Ativos', stats.associadosAtivos.toLocaleString()],
    ['Receita', formatCurrency(stats.receitaMes)],
    ['Sinistralidade', `${stats.sinistralidade.toFixed(1)}%`],
    ['Taxa Conversao', `${stats.taxaConversao.toFixed(1)}%`],
    ['Inadimplencia', `${stats.taxaInadimplencia.toFixed(1)}%`],
    ['Resultado', formatCurrency(stats.resultado)],
  ];
  
  autoTable(doc, {
    startY: 50,
    head: [['Indicador', 'Valor']],
    body: kpis,
  });
  
  doc.save(`dashboard-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  toast.success('Relatorio exportado!');
};
```

### 2. RelatoriosGerenciais - Implementar Geracao Real

**Arquivo**: `src/pages/diretoria/RelatoriosGerenciais.tsx`

Implementar geracao real de cada tipo de relatorio buscando dados do Supabase e gerando PDF/Excel.

```typescript
const handleGerarRelatorio = async () => {
  if (!reportFilters.dataInicio || !reportFilters.dataFim) {
    toast.error('Selecione o periodo');
    return;
  }

  toast.loading('Gerando relatorio...');

  try {
    let dados: any[] = [];

    // Buscar dados baseado no tipo de relatorio
    switch (selectedReport?.id) {
      case 'associados-status':
        const { data: associados } = await supabase
          .from('associados')
          .select('status')
          .gte('created_at', reportFilters.dataInicio)
          .lte('created_at', reportFilters.dataFim);
        // Agrupar por status
        break;
      
      case 'vendas-periodo':
        const { data: leads } = await supabase
          .from('leads')
          .select('*')
          .gte('created_at', reportFilters.dataInicio)
          .lte('created_at', reportFilters.dataFim);
        dados = leads || [];
        break;
      
      // ... demais casos
    }

    if (reportFilters.formato === 'pdf') {
      gerarPDF(selectedReport?.titulo || '', dados);
    } else if (reportFilters.formato === 'excel' || reportFilters.formato === 'csv') {
      gerarCSV(selectedReport?.titulo || '', dados);
    }

    toast.dismiss();
    toast.success('Relatorio gerado!');
  } catch (error) {
    toast.dismiss();
    toast.error('Erro ao gerar relatorio');
  }
  
  setSelectedReport(null);
};
```

### 3. TabelaPrecos - Implementar Import/Export e Delete

**Arquivo**: `src/pages/diretoria/TabelaPrecos.tsx`

#### Exportar
```typescript
const handleExportar = () => {
  if (!precos?.length) return;
  
  const csv = [
    ['Plano', 'FIPE De', 'FIPE Ate', 'Valor Cota', 'Taxa Admin', 'Rastreamento', 'Assistencia', 'Vigencia Inicio', 'Vigencia Fim', 'Ativo'].join(';'),
    ...precos.map(p => [
      p.plano?.nome || '',
      p.fipe_de,
      p.fipe_ate,
      p.valor_cota,
      p.taxa_administrativa || '',
      p.valor_rastreamento || '',
      p.valor_assistencia || '',
      p.vigencia_inicio || '',
      p.vigencia_fim || '',
      p.ativo ? 'Sim' : 'Nao'
    ].join(';'))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tabela-precos-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  toast.success('Exportado!');
};
```

#### Importar (upload de CSV)
```typescript
const handleImportar = (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      // Parsear CSV e inserir no banco
      toast.success('Importacao concluida!');
      queryClient.invalidateQueries({ queryKey: ['tabela-precos'] });
    } catch (error) {
      toast.error('Erro na importacao');
    }
  };
  reader.readAsText(file);
};
```

#### Delete com confirmacao
```typescript
const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

const deletarFaixa = useMutation({
  mutationFn: async (id: string) => {
    const { error } = await supabase
      .from('tabelas_preco')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
  onSuccess: () => {
    toast.success('Faixa excluida!');
    queryClient.invalidateQueries({ queryKey: ['tabela-precos'] });
    setDeleteConfirm(null);
  },
});
```

#### Historico de alteracoes
Criar modal `HistoricoPrecoModal` que busca de uma tabela de historico (se existir) ou exibe mensagem que nao ha historico.

### 4. IndicadoresAtuariais - Habilitar Recalcular

**Arquivo**: `src/pages/diretoria/IndicadoresAtuariais.tsx`

```typescript
// Adicionar mutation para recalcular
const recalcularMutation = useMutation({
  mutationFn: async () => {
    // Buscar dados do periodo
    const mesAtual = new Date().getMonth() + 1;
    const anoAtual = new Date().getFullYear();
    
    const [receita, sinistros, associados, novos, cancelados] = await Promise.all([
      supabase.from('cobrancas')
        .select('valor_pago')
        .eq('status', 'pago')
        .gte('data_pagamento', `${anoAtual}-${String(mesAtual).padStart(2, '0')}-01`),
      supabase.from('sinistros')
        .select('valor_indenizacao')
        .in('status', ['aprovado', 'indenizado'])
        .gte('data_ocorrencia', `${anoAtual}-${String(mesAtual).padStart(2, '0')}-01`),
      supabase.from('associados')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ativo'),
      supabase.from('associados')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ativo')
        .gte('created_at', `${anoAtual}-${String(mesAtual).padStart(2, '0')}-01`),
      supabase.from('associados')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'cancelado')
        .gte('updated_at', `${anoAtual}-${String(mesAtual).padStart(2, '0')}-01`),
    ]);
    
    const receitaBruta = receita.data?.reduce((s, r) => s + (r.valor_pago || 0), 0) || 0;
    const despesasSinistros = sinistros.data?.reduce((s, r) => s + (r.valor_indenizacao || 0), 0) || 0;
    const totalAssociados = associados.count || 0;
    const qtdSinistros = sinistros.data?.length || 0;
    
    const sinistralidade = receitaBruta > 0 ? (despesasSinistros / receitaBruta) * 100 : 0;
    const frequencia = totalAssociados > 0 ? qtdSinistros / totalAssociados : 0;
    const ticketMedio = qtdSinistros > 0 ? despesasSinistros / qtdSinistros : 0;
    const resultado = receitaBruta - despesasSinistros;
    const margem = receitaBruta > 0 ? (resultado / receitaBruta) * 100 : 0;
    
    const { error } = await supabase
      .from('indicadores_atuariais')
      .upsert({
        mes: mesAtual,
        ano: anoAtual,
        receita_bruta: receitaBruta,
        despesas_sinistros: despesasSinistros,
        sinistralidade_bruta: sinistralidade,
        frequencia_sinistros: frequencia,
        ticket_medio_sinistro: ticketMedio,
        resultado_operacional: resultado,
        margem_operacional: margem,
        total_associados: totalAssociados,
        novos_associados: novos.count || 0,
        cancelamentos: cancelados.count || 0,
      }, { onConflict: 'mes,ano' });
    
    if (error) throw error;
  },
  onSuccess: () => {
    toast.success('Indicadores recalculados!');
    queryClient.invalidateQueries({ queryKey: ['indicadores-atuariais'] });
    queryClient.invalidateQueries({ queryKey: ['indicador-atual'] });
  },
});

// No botao:
<Button 
  variant="outline" 
  onClick={() => recalcularMutation.mutate()}
  disabled={recalcularMutation.isPending}
>
  <RefreshCw className={cn("h-4 w-4 mr-2", recalcularMutation.isPending && "animate-spin")} />
  Recalcular
</Button>
```

---

## Resumo das Alteracoes

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `src/pages/diretoria/DiretoriaDashboard.tsx` | Modificar | Implementar exportacao PDF |
| `src/pages/diretoria/RelatoriosGerenciais.tsx` | Modificar | Implementar geracao real de relatorios |
| `src/pages/diretoria/TabelaPrecos.tsx` | Modificar | Implementar import/export/delete/historico |
| `src/components/diretoria/HistoricoPrecoModal.tsx` | **Novo** | Modal de historico de alteracoes |
| `src/pages/diretoria/IndicadoresAtuariais.tsx` | Modificar | Habilitar e implementar recalculo |

---

## Integracoes Existentes (NAO MEXER)

A area Diretoria ja possui integracao correta com:

1. **Associados**: Dashboard busca KPIs de associados ativos/inadimplentes
2. **Leads**: Dashboard busca leads e conversoes
3. **Cobrancas**: Dashboard e Indicadores buscam receita
4. **Sinistros**: Dashboard, Rateio e Indicadores buscam sinistros
5. **Instalacoes/Chamados**: Dashboard busca indicadores operacionais
6. **Profiles/UserRoles**: Usuarios e PerfisAcesso gerenciam roles
7. **Rastreadores**: Dashboard exibe metricas de tempo

**Nao e necessario alterar outras areas do sistema.**

---

## Verificacao Pos-Implementacao

1. Acessar Dashboard e clicar em Exportar - deve baixar PDF
2. Acessar Relatorios Gerenciais e gerar cada tipo - deve baixar arquivo
3. Acessar Tabela de Precos:
   - Clicar Exportar - deve baixar CSV
   - Clicar Importar - deve permitir upload
   - Clicar Delete em uma faixa - deve pedir confirmacao
   - Clicar History em uma faixa - deve mostrar historico
4. Acessar Indicadores Atuariais e clicar Recalcular - deve calcular e salvar
5. Verificar se dados persistem apos refresh
