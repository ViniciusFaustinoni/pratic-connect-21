import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Globe, Clock, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

type Plataforma = 'todas' | 'whatsapp' | 'asaas' | 'softruck' | 'rede' | 'sga' | 'auth' | 'api_leads';

interface LogUnificado {
  id: string;
  created_at: string;
  plataforma: Plataforma;
  operacao: string;
  status: 'sucesso' | 'erro' | 'info';
  erro: string | null;
  tempo_ms: number | null;
  detalhes: string;
}

const plataformaConfig: Record<string, { label: string; sigla: string; color: string; bg: string }> = {
  whatsapp: { label: 'WhatsApp / Evolution', sigla: 'EV', color: 'text-green-600', bg: 'bg-green-500/10 border-green-500/20' },
  asaas: { label: 'Asaas', sigla: 'AS', color: 'text-blue-600', bg: 'bg-blue-500/10 border-blue-500/20' },
  softruck: { label: 'Softruck', sigla: 'ST', color: 'text-orange-600', bg: 'bg-orange-500/10 border-orange-500/20' },
  rede: { label: 'Rede Veículos', sigla: 'RV', color: 'text-red-600', bg: 'bg-red-500/10 border-red-500/20' },
  sga: { label: 'SGA (Hinova)', sigla: 'SG', color: 'text-purple-600', bg: 'bg-purple-500/10 border-purple-500/20' },
  auth: { label: 'Autenticação', sigla: 'AU', color: 'text-gray-600', bg: 'bg-gray-500/10 border-gray-500/20' },
  api_leads: { label: 'API Leads', sigla: 'LD', color: 'text-cyan-600', bg: 'bg-cyan-500/10 border-cyan-500/20' },
};

const statusConfig: Record<string, { icon: any; color: string }> = {
  sucesso: { icon: CheckCircle2, color: 'text-green-500' },
  erro: { icon: AlertCircle, color: 'text-red-500' },
  info: { icon: Info, color: 'text-yellow-500' },
};

const PAGE_SIZE = 50;

function normalizeWhatsapp(row: any): LogUnificado {
  return {
    id: row.id,
    created_at: row.created_at,
    plataforma: 'whatsapp',
    operacao: row.evento || row.tipo || '-',
    status: row.erro ? 'erro' : 'sucesso',
    erro: row.erro,
    tempo_ms: null,
    detalhes: row.tipo,
  };
}

function normalizeAsaas(row: any): LogUnificado {
  return {
    id: row.id,
    created_at: row.created_at,
    plataforma: 'asaas',
    operacao: row.evento,
    status: row.erro ? 'erro' : row.processado ? 'sucesso' : 'info',
    erro: row.erro,
    tempo_ms: null,
    detalhes: row.processado ? 'Processado' : 'Pendente',
  };
}

function normalizeRastreador(row: any): LogUnificado {
  const plat = (row.plataforma || '').toLowerCase();
  return {
    id: row.id,
    created_at: row.created_at,
    plataforma: plat.includes('softruck') ? 'softruck' : 'rede',
    operacao: row.operacao,
    status: row.status === 'sucesso' ? 'sucesso' : row.status === 'erro' ? 'erro' : 'info',
    erro: row.erro_mensagem,
    tempo_ms: row.tempo_resposta_ms,
    detalhes: row.plataforma,
  };
}

function normalizeSga(row: any): LogUnificado {
  return {
    id: row.id,
    created_at: row.created_at,
    plataforma: 'sga',
    operacao: row.action,
    status: row.status === 'success' ? 'sucesso' : row.status === 'error' ? 'erro' : 'info',
    erro: row.error_message,
    tempo_ms: row.duracao_ms,
    detalhes: row.action,
  };
}

function normalizeAuth(row: any): LogUnificado {
  return {
    id: row.id,
    created_at: row.created_at,
    plataforma: 'auth',
    operacao: row.acao,
    status: row.acao?.includes('falha') ? 'erro' : 'sucesso',
    erro: (row.metadata as any)?.motivo_falha || null,
    tempo_ms: null,
    detalhes: row.email || 'Sistema',
  };
}

function normalizeApiLeads(row: any): LogUnificado {
  return {
    id: row.id,
    created_at: row.created_at,
    plataforma: 'api_leads',
    operacao: row.origem || '-',
    status: row.status === 'SUCESSO' ? 'sucesso' : 'erro',
    erro: row.erro,
    tempo_ms: row.tempo_resposta_ms,
    detalhes: row.origem || '-',
  };
}

export function LogRequisicoesTab() {
  const [search, setSearch] = useState('');
  const [filterPlataforma, setFilterPlataforma] = useState<Plataforma>('todas');
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['logs-requisicoes-unificado', search, filterPlataforma, page],
    queryFn: async () => {
      const plataformas: Plataforma[] = filterPlataforma === 'todas'
        ? ['whatsapp', 'asaas', 'softruck', 'rede', 'sga', 'auth', 'api_leads']
        : [filterPlataforma];

      const fetchers: Promise<LogUnificado[]>[] = [];

      for (const p of plataformas) {
        switch (p) {
          case 'whatsapp':
            fetchers.push(
              supabase.from('whatsapp_logs').select('*').order('created_at', { ascending: false }).limit(PAGE_SIZE)
                .then(r => (r.data || []).map(normalizeWhatsapp))
            );
            break;
          case 'asaas':
            fetchers.push(
              supabase.from('asaas_webhooks_log').select('*').order('created_at', { ascending: false }).limit(PAGE_SIZE)
                .then(r => (r.data || []).map(normalizeAsaas))
            );
            break;
          case 'softruck':
            fetchers.push(
              supabase.from('rastreadores_logs').select('*').ilike('plataforma', '%softruck%').order('created_at', { ascending: false }).limit(PAGE_SIZE)
                .then(r => (r.data || []).map(normalizeRastreador))
            );
            break;
          case 'rede':
            fetchers.push(
              supabase.from('rastreadores_logs').select('*').not('plataforma', 'ilike', '%softruck%').order('created_at', { ascending: false }).limit(PAGE_SIZE)
                .then(r => (r.data || []).map(normalizeRastreador))
            );
            break;
          case 'sga':
            fetchers.push(
              supabase.from('sga_sync_logs').select('*').order('created_at', { ascending: false }).limit(PAGE_SIZE)
                .then(r => (r.data || []).map(normalizeSga))
            );
            break;
          case 'auth':
            fetchers.push(
              supabase.from('auth_logs').select('*').order('created_at', { ascending: false }).limit(PAGE_SIZE)
                .then(r => (r.data || []).map(normalizeAuth))
            );
            break;
          case 'api_leads':
            fetchers.push(
              supabase.from('api_leads_logs').select('*').order('created_at', { ascending: false }).limit(PAGE_SIZE)
                .then(r => (r.data || []).map(normalizeApiLeads))
            );
            break;
        }
      }

      const results = await Promise.all(fetchers);
      let all = results.flat().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      if (search) {
        const s = search.toLowerCase();
        all = all.filter(l =>
          l.operacao?.toLowerCase().includes(s) ||
          l.erro?.toLowerCase().includes(s) ||
          l.detalhes?.toLowerCase().includes(s)
        );
      }

      const start = page * PAGE_SIZE;
      return { items: all.slice(start, start + PAGE_SIZE), total: all.length };
    }
  });

  const logs = data?.items || [];
  const totalPages = Math.ceil((data?.total || 0) / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por operação, erro ou detalhe..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-10 bg-background" />
        </div>
        <Select value={filterPlataforma} onValueChange={(v: Plataforma) => { setFilterPlataforma(v); setPage(0); }}>
          <SelectTrigger className="w-full sm:w-[220px]"><SelectValue placeholder="Plataforma / API" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as APIs</SelectItem>
            <SelectItem value="whatsapp">WhatsApp / Evolution</SelectItem>
            <SelectItem value="asaas">Asaas</SelectItem>
            <SelectItem value="softruck">Softruck</SelectItem>
            <SelectItem value="rede">Rede Veículos</SelectItem>
            <SelectItem value="sga">SGA (Hinova)</SelectItem>
            <SelectItem value="auth">Autenticação</SelectItem>
            <SelectItem value="api_leads">API Leads</SelectItem>
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
              const platConf = plataformaConfig[log.plataforma] || plataformaConfig.auth;
              const statConf = statusConfig[log.status] || statusConfig.info;
              const StatusIcon = statConf.icon;

              return (
                <div key={`${log.plataforma}-${log.id}`} className="flex items-start gap-4 p-4 hover:bg-muted/50 transition-colors">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className={`${platConf.bg} ${platConf.color} text-xs font-bold border`}>
                      {platConf.sigla}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{platConf.label}</span>
                      <Badge variant="outline" className="text-xs">{log.operacao}</Badge>
                      <StatusIcon className={`w-4 h-4 ${statConf.color}`} />
                    </div>
                    {log.erro && (
                      <p className="text-sm text-red-500/80 mt-1 truncate">{log.erro}</p>
                    )}
                    {log.detalhes && log.detalhes !== log.operacao && (
                      <p className="text-sm text-muted-foreground mt-0.5 truncate">{log.detalhes}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                      <span>{log.created_at ? format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR }) : '-'}</span>
                      {log.tempo_ms !== null && log.tempo_ms !== undefined && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />{log.tempo_ms}ms
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
