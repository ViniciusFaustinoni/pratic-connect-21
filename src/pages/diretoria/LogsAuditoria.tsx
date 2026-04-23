import { useState } from 'react';
import { FileText, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { gerarResumoAuditoria, resumoAuditoriaTexto } from '@/lib/auditoria-formatters';

const acaoConfig: Record<string, { label: string; className: string }> = {
  login: { label: 'Login', className: 'border-primary/30 bg-primary/10 text-primary' },
  logout: { label: 'Logout', className: 'border-muted-foreground/30 bg-muted text-muted-foreground' },
  criar: { label: 'Criar', className: 'border-success/30 bg-success/10 text-success' },
  editar: { label: 'Editar', className: 'border-warning/30 bg-warning/10 text-warning' },
  excluir: { label: 'Excluir', className: 'border-destructive/30 bg-destructive/10 text-destructive' },
  aprovar: { label: 'Aprovar', className: 'border-primary/30 bg-primary/10 text-primary' },
  reprovar: { label: 'Reprovar', className: 'border-destructive/30 bg-destructive/10 text-destructive' },
  rejeitar: { label: 'Rejeitar', className: 'border-destructive/30 bg-destructive/10 text-destructive' },
  atribuir: { label: 'Atribuir', className: 'border-accent/30 bg-accent/10 text-accent-foreground' },
  ativar: { label: 'Ativar', className: 'border-success/30 bg-success/10 text-success' },
  desativar: { label: 'Desativar', className: 'border-muted-foreground/30 bg-muted text-muted-foreground' },
  reativar: { label: 'Reativar', className: 'border-success/30 bg-success/10 text-success' },
  configuracao: { label: 'Configuração', className: 'border-warning/30 bg-warning/10 text-warning' },
  exportar: { label: 'Exportar', className: 'border-primary/30 bg-primary/10 text-primary' },
};

const moduloOptions = [
  'comissoes', 'configuracoes', 'diretoria', 'financeiro', 'cobrancas', 'contratos',
  'associados', 'planos', 'usuarios', 'rh', 'marketing', 'monitoramento', 'sinistros',
];

const tabelaOptions = [
  'grades_comissao', 'grades_comissao_versoes', 'usuario_grade_comissao',
  'hierarquia_vendas', 'comissoes', 'comissoes_pagamentos', 'comissoes_pagamento_itens',
];

const csvEscape = (value: unknown) => {
  const text = value === null || value === undefined ? '-' : typeof value === 'string' ? value : JSON.stringify(value);
  return `"${String(text).replace(/"/g, '""')}"`;
};

const formatJSON = (data: unknown) => {
  if (!data) return '-';
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
};

export default function LogsAuditoria() {
  const [filters, setFilters] = useState({
    acao: '',
    modulo: '',
    tabela: '',
    busca: '',
    dataInicio: '',
    dataFim: '',
  });
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { data: logs, isLoading } = useQuery({
    queryKey: ['logs-auditoria', filters],
    queryFn: async () => {
      let query = (supabase as any)
        .from('logs_auditoria')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (filters.acao) query = query.eq('acao', filters.acao);
      if (filters.modulo) query = query.eq('modulo', filters.modulo);
      if (filters.tabela) query = query.eq('tabela', filters.tabela);
      if (filters.dataInicio) query = query.gte('created_at', filters.dataInicio);
      if (filters.dataFim) query = query.lte('created_at', `${filters.dataFim}T23:59:59`);
      if (filters.busca.trim()) {
        const term = filters.busca.trim().replace(/[%_]/g, '');
        query = query.or(`descricao.ilike.%${term}%,usuario_nome.ilike.%${term}%,tabela.ilike.%${term}%,modulo.ilike.%${term}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const handleExport = () => {
    if (!logs?.length) return;

    const csv = [
      ['Data/Hora', 'Usuário executor', 'Ação', 'Módulo', 'Tabela', 'Registro ID', 'Descrição', 'Resumo da alteração', 'Dados anteriores', 'Dados novos', 'IP'].map(csvEscape).join(';'),
      ...logs.map((log: any) => [
        format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss'),
        log.usuario_nome || log.usuario_id || '-',
        log.acao,
        log.modulo || '-',
        log.tabela || '-',
        log.registro_id || '-',
        log.descricao || '-',
        resumoAuditoriaTexto(log) || '-',
        log.dados_anteriores || '-',
        log.dados_novos || '-',
        log.ip_address || '-',
      ].map(csvEscape).join(';')),
    ].join('\n');

    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-auditoria-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Logs de Auditoria</h1>
          <p className="text-muted-foreground">Histórico de ações, versões de grades e atribuições comerciais</p>
        </div>
        <Button onClick={handleExport} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Exportar
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <div>
              <label className="mb-1 block text-sm font-medium">Busca</label>
              <Input
                value={filters.busca}
                onChange={(e) => setFilters((f) => ({ ...f, busca: e.target.value }))}
                placeholder="Usuário, grade, vendedor ou ID"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Ação</label>
              <Select value={filters.acao} onValueChange={(value) => setFilters((f) => ({ ...f, acao: value === 'all' ? '' : value }))}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {Object.entries(acaoConfig).map(([key, { label }]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Módulo</label>
              <Select value={filters.modulo} onValueChange={(value) => setFilters((f) => ({ ...f, modulo: value === 'all' ? '' : value }))}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {moduloOptions.map((modulo) => <SelectItem key={modulo} value={modulo}>{modulo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Origem/Tabela</label>
              <Select value={filters.tabela} onValueChange={(value) => setFilters((f) => ({ ...f, tabela: value === 'all' ? '' : value }))}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {tabelaOptions.map((tabela) => <SelectItem key={tabela} value={tabela}>{tabela}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Data Início</label>
              <Input type="date" value={filters.dataInicio} onChange={(e) => setFilters((f) => ({ ...f, dataInicio: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Data Fim</label>
              <Input type="date" value={filters.dataFim} onChange={(e) => setFilters((f) => ({ ...f, dataFim: e.target.value }))} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">Data/Hora</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead className="w-[115px]">Ação</TableHead>
                <TableHead className="w-[120px]">Módulo</TableHead>
                <TableHead className="w-[190px]">Origem</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-[80px]">Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="py-8 text-center">Carregando...</TableCell></TableRow>
              ) : !logs?.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
                    Nenhum log encontrado
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log: any) => {
                  const resumo = gerarResumoAuditoria(log);
                  return (
                    <Collapsible key={log.id} open={expandedRow === log.id} asChild>
                      <>
                        <TableRow className="border-b-0">
                          <TableCell className="font-mono text-sm">{format(new Date(log.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}</TableCell>
                          <TableCell>{log.usuario_nome || log.usuario_id?.slice(0, 8) || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={acaoConfig[log.acao]?.className || 'border-border bg-muted text-muted-foreground'}>
                              {acaoConfig[log.acao]?.label || log.acao}
                            </Badge>
                          </TableCell>
                          <TableCell className="capitalize">{log.modulo || '-'}</TableCell>
                          <TableCell className="font-mono text-xs">{log.tabela || '-'}</TableCell>
                          <TableCell className="max-w-[340px] truncate">{log.descricao}</TableCell>
                          <TableCell>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm" onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}>
                                {expandedRow === log.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                            </CollapsibleTrigger>
                          </TableCell>
                        </TableRow>
                        <CollapsibleContent asChild>
                          <TableRow>
                            <TableCell colSpan={7} className="bg-muted/50">
                              <div className="space-y-4 p-4">
                                <div className="grid gap-3 text-sm md:grid-cols-3">
                                  <div><span className="text-muted-foreground">Registro:</span> <span className="font-mono">{log.registro_id || '-'}</span></div>
                                  <div><span className="text-muted-foreground">IP:</span> <span className="font-mono">{log.ip_address || '-'}</span></div>
                                  <div><span className="text-muted-foreground">Origem:</span> <span className="font-mono">{log.tabela || '-'}</span></div>
                                </div>
                                {resumo && (
                                  <div className="rounded-md border bg-background p-3">
                                    <h4 className="mb-2 font-medium">{resumo.titulo}</h4>
                                    <ul className="space-y-1 text-sm text-muted-foreground">
                                      {resumo.linhas.map((linha, idx) => <li key={idx}>{linha}</li>)}
                                    </ul>
                                  </div>
                                )}
                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                  <div>
                                    <h4 className="mb-2 font-medium">Dados Anteriores</h4>
                                    <pre className="max-h-64 overflow-auto rounded border bg-background p-3 text-xs">{formatJSON(log.dados_anteriores)}</pre>
                                  </div>
                                  <div>
                                    <h4 className="mb-2 font-medium">Dados Novos</h4>
                                    <pre className="max-h-64 overflow-auto rounded border bg-background p-3 text-xs">{formatJSON(log.dados_novos)}</pre>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
