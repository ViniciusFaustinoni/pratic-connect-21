import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollText, Search, LogIn, LogOut, Plus, Edit, Trash, AlertTriangle, Globe, Monitor, Smartphone } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

const acoesConfig: Record<string, { label: string; icon: any; color: string }> = {
  login_sucesso: { label: 'Login', icon: LogIn, color: 'text-green-500 bg-green-500/10' },
  login_falha: { label: 'Login Falhou', icon: AlertTriangle, color: 'text-red-500 bg-red-500/10' },
  logout: { label: 'Logout', icon: LogOut, color: 'text-gray-500 bg-gray-500/10' },
  login: { label: 'Login', icon: LogIn, color: 'text-green-500 bg-green-500/10' },
  criar: { label: 'Criação', icon: Plus, color: 'text-blue-500 bg-blue-500/10' },
  editar: { label: 'Edição', icon: Edit, color: 'text-yellow-500 bg-yellow-500/10' },
  excluir: { label: 'Exclusão', icon: Trash, color: 'text-red-500 bg-red-500/10' },
};

export function LogRequisicoesTab() {
  const [search, setSearch] = useState('');
  const [filterAcao, setFilterAcao] = useState('todas');
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const { data, isLoading } = useQuery({
    queryKey: ['logs-requisicoes', search, filterAcao, page],
    queryFn: async () => {
      let query = supabase
        .from('auth_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (search) {
        query = query.or(`email.ilike.%${search}%`);
      }
      if (filterAcao !== 'todas') query = query.eq('acao', filterAcao);

      const { data, error, count } = await query;
      if (error) throw error;
      return { items: data || [], total: count || 0 };
    }
  });

  const logs = data?.items || [];
  const totalPages = Math.ceil((data?.total || 0) / pageSize);

  const getInitials = (email: string) => {
    if (!email) return '??';
    return email.split('@')[0].slice(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por email..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-10 bg-background" />
        </div>
        <Select value={filterAcao} onValueChange={v => { setFilterAcao(v); setPage(0); }}>
          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Tipo de ação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as ações</SelectItem>
            <SelectItem value="login_sucesso">Login</SelectItem>
            <SelectItem value="login_falha">Login Falhou</SelectItem>
            <SelectItem value="logout">Logout</SelectItem>
            <SelectItem value="criar">Criação</SelectItem>
            <SelectItem value="editar">Edição</SelectItem>
            <SelectItem value="excluir">Exclusão</SelectItem>
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
              <Globe className="w-12 h-12 mb-4 opacity-50" />
              <p>Nenhum log de requisição encontrado</p>
            </div>
          ) : (
            logs.map((log) => {
              const info = acoesConfig[log.acao] || { label: log.acao, icon: ScrollText, color: 'text-gray-500 bg-gray-500/10' };
              const Icon = info.icon;
              const DeviceIcon = log.dispositivo === 'mobile' ? Smartphone : Monitor;

              return (
                <div key={log.id} className="flex items-start gap-4 p-4 hover:bg-muted/50 transition-colors">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {getInitials(log.email || '')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground truncate">{log.email || 'Sistema'}</span>
                      <Badge variant="outline" className={`gap-1 ${info.color}`}>
                        <Icon className="w-3 h-3" />{info.label}
                      </Badge>
                    </div>
                    {log.metadata && typeof log.metadata === 'object' && (
                      <p className="text-sm text-muted-foreground mt-1 truncate">
                        {(log.metadata as any).msg || (log.metadata as any).motivo_falha || ''}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                      <span>{log.created_at ? format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '-'}</span>
                      {log.ip_address && <span className="text-muted-foreground/70">IP: {String(log.ip_address)}</span>}
                      {log.navegador && <span className="text-muted-foreground/70">{log.navegador}</span>}
                      {log.sistema_operacional && <span className="text-muted-foreground/70">{log.sistema_operacional}</span>}
                      {log.dispositivo && (
                        <span className="flex items-center gap-1 text-muted-foreground/70">
                          <DeviceIcon className="w-3 h-3" />{log.dispositivo}
                        </span>
                      )}
                      {log.cidade && log.pais && (
                        <span className="text-muted-foreground/70">{log.cidade}, {log.pais}</span>
                      )}
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
