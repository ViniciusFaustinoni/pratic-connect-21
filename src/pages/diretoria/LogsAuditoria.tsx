import { Fragment, useState } from 'react';
import { FileText, Download, ChevronDown, ChevronUp, GitBranch } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  iniciar: { label: 'Iniciar', className: 'border-primary/30 bg-primary/10 text-primary' },
  concluir: { label: 'Concluir', className: 'border-success/30 bg-success/10 text-success' },
  cancelar: { label: 'Cancelar', className: 'border-destructive/30 bg-destructive/10 text-destructive' },
  sincronizar: { label: 'Sincronizar', className: 'border-primary/30 bg-primary/10 text-primary' },
  configuracao: { label: 'Configuração', className: 'border-warning/30 bg-warning/10 text-warning' },
  exportar: { label: 'Exportar', className: 'border-primary/30 bg-primary/10 text-primary' },
};

const moduloOptions = [
  'operacoes', 'vistorias', 'instalacoes', 'eventos',
  'cotacoes', 'contratos', 'associados', 'veiculos', 'documentos',
  'aprovacoes', 'comissoes', 'planos', 'marketing',
  'cobrancas', 'juridico', 'usuarios', 'configuracoes', 'diretoria',
  'financeiro', 'rh', 'monitoramento', 'sinistros', 'sistema',
];

const tabelaLabels: Record<string, string> = {
  grades_comissao: 'Grades de comissão',
  grades_comissao_versoes: 'Versões de grades',
  usuario_grade_comissao: 'Atribuição de grade',
  hierarquia_vendas: 'Hierarquia de vendas',
  comissoes: 'Comissões',
  comissoes_pagamentos: 'Pagamentos de comissões',
  comissoes_pagamento_itens: 'Itens de pagamento',
};

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

type LogFilters = {
  acao: string;
  modulo: string;
  tabela: string;
  dataInicio: string;
  dataFim: string;
};

const DEFAULT_FILTERS: LogFilters = {
  acao: '',
  modulo: '',
  tabela: '',
  dataInicio: '',
  dataFim: '',
};

import { useServerList } from '@/hooks/useServerList';
import { ListToolbar } from '@/components/lists/ListToolbar';
import { ServerPagination } from '@/components/lists/ServerPagination';

export default function LogsAuditoria() {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const list = useServerList<any, LogFilters>({
    key: 'logs',
    defaultPageSize: 50,
    defaultFilters: DEFAULT_FILTERS,
    fetcher: async ({ search, page, pageSize, filters }) => {
      let query = (supabase as any)
        .from('logs_auditoria')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (filters.acao) query = query.eq('acao', filters.acao);
      if (filters.modulo) query = query.eq('modulo', filters.modulo);
      if (filters.tabela) query = query.eq('tabela', filters.tabela);
      if (filters.dataInicio) query = query.gte('created_at', filters.dataInicio);
      if (filters.dataFim) query = query.lte('created_at', `${filters.dataFim}T23:59:59`);
      if (search.trim()) {
        const term = search.trim().replace(/[%_]/g, '');
        const orParts = [
          `descricao.ilike.%${term}%`,
          `usuario_nome.ilike.%${term}%`,
          `tabela.ilike.%${term}%`,
          `modulo.ilike.%${term}%`,
        ];
        // Só inclui registro_id se for UUID válido (evita erro de cast)
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(term)) {
          orParts.push(`registro_id.eq.${term}`);
        }
        query = query.or(orParts.join(','));
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data, error, count } = await query.range(from, to);
      if (error) throw error;
      return { data: data || [], count: count ?? 0 };
    },
  });

  const logs = list.items;
  const isLoading = list.isLoading;

  const { data: tabelaOptions = [] } = useQuery({
    queryKey: ['logs-auditoria-tabelas'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('logs_auditoria')
        .select('tabela')
        .not('tabela', 'is', null)
        .order('tabela', { ascending: true })
        .limit(1000);
      if (error) throw error;
      const set = new Set<string>((data || []).map((r: any) => r.tabela).filter(Boolean));
      return Array.from(set).sort();
    },
  });

  const { data: historicoHierarquia = [], isLoading: isLoadingHierarquia } = useQuery({
    queryKey: ['logs-auditoria-hierarquia'],
    queryFn: async () => {
      const [{ data: logsHierarquia, error: logsError }, { data: hierarquias, error: hierError }] = await Promise.all([
        (supabase as any)
          .from('logs_auditoria')
          .select('*')
          .eq('tabela', 'hierarquia_vendas')
          .order('created_at', { ascending: false })
          .limit(200),
        (supabase as any)
          .from('hierarquia_vendas')
          .select('*')
          .order('vigente_desde', { ascending: true })
          .limit(500),
      ]);

      if (logsError) throw logsError;
      if (hierError) throw hierError;

      const loggedIds = new Set((logsHierarquia || []).map((log: any) => log.registro_id).filter(Boolean));
      const profileIds = Array.from(new Set((hierarquias || []).flatMap((h: any) => [
        h.vendedor_id, h.supervisor_id, h.gerente_id, h.agencia_id, h.created_by,
      ]).filter(Boolean)));

      const { data: profiles, error: profilesError } = profileIds.length
        ? await (supabase as any).from('profiles').select('id, nome, email').in('id', profileIds)
        : { data: [], error: null };
      if (profilesError) throw profilesError;

      const profileById = new Map<string, any>((profiles || []).map((profile: any) => [profile.id, profile]));
      const snapshot = (id?: string | null): any => id ? (profileById.get(id) || { id }) : null;
      const previousByVendor = new Map<string, any>();
      const syntheticLogs = (hierarquias || []).map((hierarquia: any) => {
        const anterior = previousByVendor.get(hierarquia.vendedor_id) || null;
        previousByVendor.set(hierarquia.vendedor_id, hierarquia);

        return {
          id: `hierarquia-${hierarquia.id}`,
          created_at: hierarquia.vigente_desde || hierarquia.created_at,
          usuario_nome: snapshot(hierarquia.created_by)?.nome || snapshot(hierarquia.created_by)?.email || 'Sistema',
          usuario_id: hierarquia.created_by,
          acao: 'editar',
          modulo: 'comissoes',
          tabela: 'hierarquia_vendas',
          registro_id: hierarquia.id,
          descricao: 'Histórico de alteração de hierarquia',
          dados_anteriores: anterior ? {
            hierarquia_id: anterior.id,
            vendedor: snapshot(anterior.vendedor_id),
            supervisor: snapshot(anterior.supervisor_id),
            gerente: snapshot(anterior.gerente_id),
            agencia: snapshot(anterior.agencia_id),
            observacoes: anterior.observacoes,
            vigente_desde: anterior.vigente_desde,
            vigente_ate: anterior.vigente_ate,
          } : null,
          dados_novos: {
            hierarquia_id: hierarquia.id,
            vendedor: snapshot(hierarquia.vendedor_id),
            supervisor: snapshot(hierarquia.supervisor_id),
            gerente: snapshot(hierarquia.gerente_id),
            agencia: snapshot(hierarquia.agencia_id),
            observacoes: hierarquia.observacoes,
            vigente_desde: hierarquia.vigente_desde,
            vigente_ate: hierarquia.vigente_ate,
            alterado_por: snapshot(hierarquia.created_by),
          },
        };
      }).filter((log: any) => !loggedIds.has(log.registro_id));

      return [...(logsHierarquia || []), ...syntheticLogs]
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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

  const renderLogsTable = (items: any[] | undefined, loading: boolean, emptyLabel: string) => (
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
            {loading ? (
              <TableRow><TableCell colSpan={7} className="py-8 text-center">Carregando...</TableCell></TableRow>
            ) : !items?.length ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  {emptyLabel}
                </TableCell>
              </TableRow>
            ) : (
              items.map((log: any) => {
                const resumo = gerarResumoAuditoria(log);
                return (
                  <Fragment key={log.id}>
                    <TableRow className="border-b-0">
                      <TableCell className="font-mono text-sm">{format(new Date(log.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}</TableCell>
                      <TableCell>{log.usuario_nome || log.usuario_id?.slice(0, 8) || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={acaoConfig[log.acao]?.className || 'border-border bg-muted text-muted-foreground'}>
                          {acaoConfig[log.acao]?.label || log.acao}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize">{log.modulo || '-'}</TableCell>
                      <TableCell className="font-mono text-xs">{tabelaLabels[log.tabela] || log.tabela || '-'}</TableCell>
                      <TableCell className="max-w-[340px] truncate">{log.descricao}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}>
                          {expandedRow === log.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedRow === log.id && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/50">
                          <div className="space-y-4 p-4">
                            <div className="grid gap-3 text-sm md:grid-cols-3">
                              <div><span className="text-muted-foreground">Registro:</span> <span className="font-mono">{log.registro_id || '-'}</span></div>
                              <div><span className="text-muted-foreground">IP:</span> <span className="font-mono">{log.ip_address || '-'}</span></div>
                              <div><span className="text-muted-foreground">Origem:</span> <span className="font-mono">{tabelaLabels[log.tabela] || log.tabela || '-'}</span></div>
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
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

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
                  {tabelaOptions.map((tabela) => <SelectItem key={tabela} value={tabela}>{tabelaLabels[tabela] || tabela}</SelectItem>)}
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

      <Tabs defaultValue="todos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="todos" className="gap-2">
            <FileText className="h-4 w-4" />
            Todos os logs
          </TabsTrigger>
          <TabsTrigger value="hierarquia" className="gap-2">
            <GitBranch className="h-4 w-4" />
            Histórico de Hierarquia ({historicoHierarquia.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="todos">
          {renderLogsTable(logs, isLoading, 'Nenhum log encontrado')}
        </TabsContent>
        <TabsContent value="hierarquia">
          {renderLogsTable(historicoHierarquia, isLoadingHierarquia, 'Nenhum histórico de hierarquia encontrado')}
        </TabsContent>
      </Tabs>
    </div>
  );
}
