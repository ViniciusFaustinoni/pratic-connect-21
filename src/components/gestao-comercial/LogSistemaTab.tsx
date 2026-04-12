import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollText, Search, Plus, Edit, Trash, Eye, CheckCircle, XCircle, Ban, RotateCcw, Send, Copy, Download, Upload, Power, PowerOff, UserCheck, ArrowDown, LogIn, LogOut, Activity } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

const acoesConfig: Record<string, { label: string; icon: any; color: string }> = {
  criar: { label: 'Criação', icon: Plus, color: 'text-blue-500 bg-blue-500/10' },
  editar: { label: 'Edição', icon: Edit, color: 'text-yellow-500 bg-yellow-500/10' },
  excluir: { label: 'Exclusão', icon: Trash, color: 'text-red-500 bg-red-500/10' },
  visualizar: { label: 'Visualização', icon: Eye, color: 'text-gray-500 bg-gray-500/10' },
  aprovar: { label: 'Aprovação', icon: CheckCircle, color: 'text-green-500 bg-green-500/10' },
  reprovar: { label: 'Reprovação', icon: XCircle, color: 'text-red-500 bg-red-500/10' },
  cancelar: { label: 'Cancelamento', icon: Ban, color: 'text-orange-500 bg-orange-500/10' },
  reativar: { label: 'Reativação', icon: RotateCcw, color: 'text-teal-500 bg-teal-500/10' },
  enviar: { label: 'Envio', icon: Send, color: 'text-indigo-500 bg-indigo-500/10' },
  duplicar: { label: 'Duplicação', icon: Copy, color: 'text-purple-500 bg-purple-500/10' },
  exportar: { label: 'Exportação', icon: Download, color: 'text-cyan-500 bg-cyan-500/10' },
  importar: { label: 'Importação', icon: Upload, color: 'text-cyan-500 bg-cyan-500/10' },
  ativar: { label: 'Ativação', icon: Power, color: 'text-green-500 bg-green-500/10' },
  desativar: { label: 'Desativação', icon: PowerOff, color: 'text-orange-500 bg-orange-500/10' },
  atribuir: { label: 'Atribuição', icon: UserCheck, color: 'text-blue-500 bg-blue-500/10' },
  baixar: { label: 'Download', icon: ArrowDown, color: 'text-gray-500 bg-gray-500/10' },
  login: { label: 'Login', icon: LogIn, color: 'text-green-500 bg-green-500/10' },
  logout: { label: 'Logout', icon: LogOut, color: 'text-gray-500 bg-gray-500/10' },
};

const modulosLabels: Record<string, string> = {
  cotacoes: 'Cotações', leads: 'Leads', contratos: 'Contratos', associados: 'Associados',
  vistorias: 'Vistorias', instalacoes: 'Instalações', veiculos: 'Veículos', planos: 'Planos',
  cobrancas: 'Cobranças', sinistros: 'Sinistros', processos: 'Processos', documentos: 'Documentos',
  rotas: 'Rotas', usuarios: 'Usuários', configuracoes: 'Configurações', acordos: 'Acordos',
  rh: 'RH', marketing: 'Marketing', monitoramento: 'Monitoramento', diretoria: 'Diretoria',
};

export function LogSistemaTab() {
  const [search, setSearch] = useState('');
  const [filterAcao, setFilterAcao] = useState('todas');
  const [filterModulo, setFilterModulo] = useState('todos');
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const { data, isLoading } = useQuery({
    queryKey: ['logs-sistema', search, filterAcao, filterModulo, page],
    queryFn: async () => {
      let query = supabase
        .from('logs_auditoria')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (search) {
        query = query.or(`usuario_nome.ilike.%${search}%,descricao.ilike.%${search}%`);
      }
      if (filterAcao !== 'todas') query = query.eq('acao', filterAcao);
      if (filterModulo !== 'todos') query = query.eq('modulo', filterModulo);

      const { data, error, count } = await query;
      if (error) throw error;
      return { items: data || [], total: count || 0 };
    }
  });

  const logs = data?.items || [];
  const totalPages = Math.ceil((data?.total || 0) / pageSize);

  const getInitials = (name: string) => {
    if (!name) return '??';
    return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou descrição..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-10 bg-background" />
        </div>
        <Select value={filterModulo} onValueChange={v => { setFilterModulo(v); setPage(0); }}>
          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Módulo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os módulos</SelectItem>
            {Object.entries(modulosLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterAcao} onValueChange={v => { setFilterAcao(v); setPage(0); }}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Ação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as ações</SelectItem>
            {Object.entries(acoesConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-0 divide-y divide-border/50">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-32" /></div>
              </div>
            ))
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Activity className="w-12 h-12 mb-4 opacity-50" />
              <p>Nenhum log encontrado</p>
            </div>
          ) : (
            logs.map((log) => {
              const info = acoesConfig[log.acao] || { label: log.acao, icon: ScrollText, color: 'text-gray-500 bg-gray-500/10' };
              const Icon = info.icon;
              return (
                <div key={log.id} className="flex items-start gap-4 p-4 hover:bg-muted/50 transition-colors">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {getInitials(log.usuario_nome || '')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground truncate">{log.usuario_nome || 'Sistema'}</span>
                      <Badge variant="outline" className={`gap-1 ${info.color}`}>
                        <Icon className="w-3 h-3" />{info.label}
                      </Badge>
                      {log.modulo && (
                        <Badge variant="secondary" className="text-[10px]">
                          {modulosLabels[log.modulo] || log.modulo}
                        </Badge>
                      )}
                    </div>
                    {log.descricao && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{log.descricao}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>{log.created_at ? format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '-'}</span>
                      {log.tabela && <span className="text-muted-foreground/70">Tabela: {log.tabela}</span>}
                      {log.ip_address && <span className="text-muted-foreground/70">IP: {String(log.ip_address)}</span>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{data?.total} registros · Página {page + 1} de {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Próxima</Button>
          </div>
        </div>
      )}
    </div>
  );
}
