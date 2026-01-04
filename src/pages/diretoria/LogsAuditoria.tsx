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

const acaoConfig: Record<string, { label: string; class: string }> = {
  login: { label: 'Login', class: 'bg-blue-100 text-blue-800' },
  logout: { label: 'Logout', class: 'bg-gray-100 text-gray-800' },
  criar: { label: 'Criar', class: 'bg-green-100 text-green-800' },
  editar: { label: 'Editar', class: 'bg-yellow-100 text-yellow-800' },
  excluir: { label: 'Excluir', class: 'bg-red-100 text-red-800' },
  aprovar: { label: 'Aprovar', class: 'bg-purple-100 text-purple-800' },
  configuracao: { label: 'Configuração', class: 'bg-orange-100 text-orange-800' },
};

const moduloOptions = [
  'vendas', 'cadastro', 'financeiro', 'cobranca', 'contabilidade', 
  'juridico', 'rh', 'marketing', 'monitoramento', 'diretoria', 'sinistros'
];

export default function LogsAuditoria() {
  const [filters, setFilters] = useState({
    acao: '',
    modulo: '',
    dataInicio: '',
    dataFim: ''
  });
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { data: logs, isLoading } = useQuery({
    queryKey: ['logs-auditoria', filters],
    queryFn: async () => {
      let query = supabase
        .from('logs_auditoria')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (filters.acao) {
        query = query.eq('acao', filters.acao);
      }
      if (filters.modulo) {
        query = query.eq('modulo', filters.modulo);
      }
      if (filters.dataInicio) {
        query = query.gte('created_at', filters.dataInicio);
      }
      if (filters.dataFim) {
        query = query.lte('created_at', `${filters.dataFim}T23:59:59`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const handleExport = () => {
    if (!logs?.length) return;
    
    const csv = [
      ['Data/Hora', 'Usuário', 'Ação', 'Módulo', 'Descrição', 'IP'].join(';'),
      ...logs.map(log => [
        format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss'),
        log.usuario_nome || log.usuario_id || '-',
        log.acao,
        log.modulo,
        log.descricao,
        log.ip_address || '-'
      ].join(';'))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-auditoria-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const formatJSON = (data: unknown) => {
    if (!data) return '-';
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Logs de Auditoria</h1>
          <p className="text-muted-foreground">Histórico de ações realizadas no sistema</p>
        </div>
        <Button onClick={handleExport} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Exportar
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Ação</label>
              <Select 
                value={filters.acao} 
                onValueChange={(value) => setFilters(f => ({ ...f, acao: value === 'all' ? '' : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas as ações" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as ações</SelectItem>
                  {Object.entries(acaoConfig).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Módulo</label>
              <Select 
                value={filters.modulo} 
                onValueChange={(value) => setFilters(f => ({ ...f, modulo: value === 'all' ? '' : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os módulos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os módulos</SelectItem>
                  {moduloOptions.map(modulo => (
                    <SelectItem key={modulo} value={modulo}>
                      {modulo.charAt(0).toUpperCase() + modulo.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Data Início</label>
              <Input
                type="date"
                value={filters.dataInicio}
                onChange={(e) => setFilters(f => ({ ...f, dataInicio: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Data Fim</label>
              <Input
                type="date"
                value={filters.dataFim}
                onChange={(e) => setFilters(f => ({ ...f, dataFim: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Data/Hora</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead className="w-[120px]">Ação</TableHead>
                <TableHead className="w-[120px]">Módulo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-[100px]">IP</TableHead>
                <TableHead className="w-[80px]">Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : !logs?.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <FileText className="mx-auto h-8 w-8 mb-2 opacity-50" />
                    Nenhum log encontrado
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <Collapsible key={log.id} open={expandedRow === log.id}>
                    <TableRow className="border-b-0">
                      <TableCell className="font-mono text-sm">
                        {format(new Date(log.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {log.usuario_nome || log.usuario_id?.slice(0, 8) || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="secondary" 
                          className={acaoConfig[log.acao]?.class || 'bg-muted'}
                        >
                          {acaoConfig[log.acao]?.label || log.acao}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize">{log.modulo || '-'}</TableCell>
                      <TableCell className="max-w-[300px] truncate">
                        {log.descricao}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {log.ip_address || '-'}
                      </TableCell>
                      <TableCell>
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                          >
                            {expandedRow === log.id ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                      </TableCell>
                    </TableRow>
                    <CollapsibleContent asChild>
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/50">
                          <div className="grid grid-cols-2 gap-4 p-4">
                            <div>
                              <h4 className="font-medium mb-2">Dados Anteriores</h4>
                              <pre className="text-xs bg-background p-3 rounded border overflow-auto max-h-48">
                                {formatJSON(log.dados_anteriores)}
                              </pre>
                            </div>
                            <div>
                              <h4 className="font-medium mb-2">Dados Novos</h4>
                              <pre className="text-xs bg-background p-3 rounded border overflow-auto max-h-48">
                                {formatJSON(log.dados_novos)}
                              </pre>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    </CollapsibleContent>
                  </Collapsible>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
