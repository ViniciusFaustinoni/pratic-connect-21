import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollText, Search, LogIn, LogOut, Plus, Edit, Trash, Key, User, Shield, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

const acoesConfig: Record<string, { label: string; icon: any; color: string }> = {
  login: { label: 'Login', icon: LogIn, color: 'text-green-500 bg-green-500/10' },
  logout: { label: 'Logout', icon: LogOut, color: 'text-gray-500 bg-gray-500/10' },
  login_sucesso: { label: 'Login', icon: LogIn, color: 'text-green-500 bg-green-500/10' },
  login_falha: { label: 'Login Falhou', icon: AlertTriangle, color: 'text-red-500 bg-red-500/10' },
  criar: { label: 'Criação', icon: Plus, color: 'text-blue-500 bg-blue-500/10' },
  editar: { label: 'Edição', icon: Edit, color: 'text-yellow-500 bg-yellow-500/10' },
  excluir: { label: 'Exclusão', icon: Trash, color: 'text-red-500 bg-red-500/10' },
  alterar_senha: { label: 'Senha', icon: Key, color: 'text-purple-500 bg-purple-500/10' },
  alterar_perfil: { label: 'Perfil', icon: Shield, color: 'text-cyan-500 bg-cyan-500/10' },
  ativar: { label: 'Ativação', icon: User, color: 'text-green-500 bg-green-500/10' },
  desativar: { label: 'Desativação', icon: User, color: 'text-orange-500 bg-orange-500/10' },
};

export default function Logs() {
  const [search, setSearch] = useState('');
  const [filterAcao, setFilterAcao] = useState<string>('todas');

  const { data: logs, isLoading } = useQuery({
    queryKey: ['logs-auditoria', search, filterAcao],
    queryFn: async () => {
      let query = supabase
        .from('auth_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (search) {
        query = query.or(`email.ilike.%${search}%`);
      }
      if (filterAcao !== 'todas') {
        query = query.eq('acao', filterAcao);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const getInitials = (email: string) => {
    if (!email) return '??';
    const name = email.split('@')[0];
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Logs de Auditoria</h1>
        <p className="text-sm text-muted-foreground">Histórico de ações no sistema</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-background"
          />
        </div>
        <Select value={filterAcao} onValueChange={setFilterAcao}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Tipo de ação" />
          </SelectTrigger>
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

      {/* Lista de Logs */}
      <Card className="border-border/50">
        <CardContent className="p-0 divide-y divide-border/50">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))
          ) : logs?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ScrollText className="w-12 h-12 mb-4 opacity-50" />
              <p>Nenhum log encontrado</p>
            </div>
          ) : (
            logs?.map((log) => {
              const info = acoesConfig[log.acao] || { label: log.acao, icon: ScrollText, color: 'text-gray-500 bg-gray-500/10' };
              const Icon = info.icon;
              
              return (
                <div key={log.id} className="flex items-start gap-4 p-4 hover:bg-muted/50 transition-colors">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {getInitials(log.email || '')}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground truncate">
                        {log.email || 'Sistema'}
                      </span>
                      <Badge variant="outline" className={`gap-1 ${info.color}`}>
                        <Icon className="w-3 h-3" />
                        {info.label}
                      </Badge>
                    </div>
                    
                    {log.metadata && typeof log.metadata === 'object' && (
                      <p className="text-sm text-muted-foreground mt-1 truncate">
                        {(log.metadata as any).msg || (log.metadata as any).motivo_falha || ''}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>
                        {format(new Date(log.created_at!), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                      {log.ip_address && (
                        <span className="text-muted-foreground/70">
                          IP: {String(log.ip_address)}
                        </span>
                      )}
                      {log.navegador && (
                        <span className="text-muted-foreground/70">
                          {log.navegador}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
