import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PermissionGate } from '@/components/PermissionGate';
import { NovoPrestadorModal } from '@/components/assistencia/NovoPrestadorModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  Users, Plus, Search, ChevronDown, ChevronUp, Phone, Pencil, 
  TrendingUp, CheckCircle2, Clock 
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface PrestadorMetricas {
  total: number;
  concluidas: number;
  taxa: number;
}

export default function PrestadoresParceiros() {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPrestador, setEditingPrestador] = useState<any>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Buscar prestadores
  const { data: prestadores = [], isLoading } = useQuery({
    queryKey: ['prestadores-parceiros'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('prestadores_assistencia')
        .select('*')
        .order('razao_social', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar métricas agregadas de todos os prestadores
  const { data: metricas = {} } = useQuery({
    queryKey: ['prestadores-metricas'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('instalacao_prestador_links')
        .select('prestador_id, status');
      if (error) throw error;
      
      const map: Record<string, PrestadorMetricas> = {};
      (data || []).forEach((link: any) => {
        if (!map[link.prestador_id]) {
          map[link.prestador_id] = { total: 0, concluidas: 0, taxa: 0 };
        }
        map[link.prestador_id].total++;
        if (link.status === 'concluida') {
          map[link.prestador_id].concluidas++;
        }
      });
      
      Object.values(map).forEach((m: PrestadorMetricas) => {
        m.taxa = m.total > 0 ? Math.round((m.concluidas / m.total) * 100) : 0;
      });
      
      return map as Record<string, PrestadorMetricas>;
    },
  });

  // Buscar municípios tipo prestador
  const { data: municipiosPrestador = [] } = useQuery({
    queryKey: ['municipios-prestador'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('municipios_atendimento')
        .select('nome, uf')
        .eq('tipo_atendimento', 'prestador');
      if (error) throw error;
      return data || [];
    },
  });

  // Histórico expandido
  const { data: historico = [] } = useQuery({
    queryKey: ['prestador-historico', expandedId],
    enabled: !!expandedId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('instalacao_prestador_links')
        .select('*, instalacoes:instalacao_id(associado_nome, cidade, bairro)')
        .eq('prestador_id', expandedId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  // Toggle status do prestador
  const toggleStatus = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await (supabase as any)
        .from('prestadores_assistencia')
        .update({ ativo })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prestadores-parceiros'] });
      toast.success('Status atualizado');
    },
  });

  // Filtrar prestadores
  const filtrados = prestadores.filter((p: any) => {
    const nome = (p.nome_fantasia || p.razao_social || '').toLowerCase();
    if (busca && !nome.includes(busca.toLowerCase())) return false;
    if (filtroStatus === 'ativo' && !p.ativo) return false;
    if (filtroStatus === 'inativo' && p.ativo) return false;
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'concluida':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Concluída</Badge>;
      case 'em_execucao':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Em execução</Badge>;
      case 'aguardando':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Aguardando</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <PermissionGate
      permission={['isDiretor', 'isAdminMaster', 'isCoordenadorMonitoramento']}
      mode="any"
      fallback={
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Acesso restrito.</p>
        </div>
      }
    >
      <div className="space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link to="/">Home</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link to="/monitoramento/dashboard">Monitoramento</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Prestadores Parceiros</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Prestadores Parceiros</h1>
            <p className="text-muted-foreground">Gerencie prestadores e acompanhe métricas de atendimento</p>
          </div>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Prestador
          </Button>
        </div>

        {/* Filtros */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="inativo">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-border bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{prestadores.filter((p: any) => p.ativo).length}</p>
                <p className="text-xs text-muted-foreground">Prestadores ativos</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {Object.values(metricas).reduce((sum, m) => sum + (m as PrestadorMetricas).concluidas, 0)}
                </p>
                <p className="text-xs text-muted-foreground">Instalações concluídas</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <TrendingUp className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {(() => {
                    const vals = Object.values(metricas) as PrestadorMetricas[];
                    if (vals.length === 0) return '0%';
                    const totalR = vals.reduce((s, m) => s + m.total, 0);
                    const totalC = vals.reduce((s, m) => s + m.concluidas, 0);
                    return totalR > 0 ? `${Math.round((totalC / totalR) * 100)}%` : '0%';
                  })()}
                </p>
                <p className="text-xs text-muted-foreground">Taxa de conclusão geral</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela */}
        <Card className="border-border bg-card">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : filtrados.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Nenhum prestador encontrado.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prestador</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Municípios</TableHead>
                    <TableHead className="text-center">Recebidas</TableHead>
                    <TableHead className="text-center">Concluídas</TableHead>
                    <TableHead className="text-center">Taxa</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((p: any) => {
                    const m = (metricas as Record<string, PrestadorMetricas>)[p.id] || { total: 0, concluidas: 0, taxa: 0 };
                    const isExpanded = expandedId === p.id;
                    return (
                      <Collapsible key={p.id} open={isExpanded} onOpenChange={() => setExpandedId(isExpanded ? null : p.id)} asChild>
                        <>
                          <TableRow className="group">
                            <TableCell className="font-medium">
                              {p.nome_fantasia || p.razao_social}
                            </TableCell>
                            <TableCell>
                              {p.whatsapp || p.telefone ? (
                                <a href={`tel:${p.whatsapp || p.telefone}`} className="flex items-center gap-1 text-primary hover:underline">
                                  <Phone className="h-3 w-3" />
                                  {p.whatsapp || p.telefone}
                                </a>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {municipiosPrestador.slice(0, 3).map((mun: any) => (
                                  <Badge key={mun.nome} variant="outline" className="text-xs">
                                    {mun.nome}
                                  </Badge>
                                ))}
                                {municipiosPrestador.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{municipiosPrestador.length - 3}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">{m.total}</TableCell>
                            <TableCell className="text-center">{m.concluidas}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className={
                                m.taxa >= 80 ? 'bg-green-500/10 text-green-600 border-green-500/30' :
                                m.taxa >= 50 ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' :
                                m.total === 0 ? '' : 'bg-red-500/10 text-red-600 border-red-500/30'
                              }>
                                {m.taxa}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Switch
                                checked={!!p.ativo}
                                onCheckedChange={(checked) => toggleStatus.mutate({ id: p.id, ativo: checked })}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => setEditingPrestador(p)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <CollapsibleTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                  </Button>
                                </CollapsibleTrigger>
                              </div>
                            </TableCell>
                          </TableRow>
                          <CollapsibleContent asChild>
                            <tr>
                              <td colSpan={8} className="p-0">
                                <div className="bg-muted/30 p-4 border-t border-border">
                                  <h4 className="text-sm font-semibold text-foreground mb-3">Últimos atendimentos</h4>
                                  {historico.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Nenhum histórico encontrado.</p>
                                  ) : (
                                    <div className="space-y-2">
                                      {historico.map((h: any) => (
                                        <div key={h.id} className="flex items-center justify-between text-sm bg-card rounded-md p-3 border border-border">
                                          <div>
                                            <span className="font-medium text-foreground">
                                              {h.instalacoes?.associado_nome || 'Associado'}
                                            </span>
                                            <span className="text-muted-foreground ml-2">
                                              {h.instalacoes?.cidade || ''} {h.instalacoes?.bairro ? `- ${h.instalacoes.bairro}` : ''}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-3">
                                            {getStatusBadge(h.status)}
                                            <span className="text-xs text-muted-foreground">
                                              {h.created_at ? formatDistanceToNow(new Date(h.created_at), { addSuffix: true, locale: ptBR }) : ''}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <NovoPrestadorModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['prestadores-parceiros'] });
            setModalOpen(false);
          }}
        />

        {editingPrestador && (
          <NovoPrestadorModal
            open={!!editingPrestador}
            onClose={() => setEditingPrestador(null)}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['prestadores-parceiros'] });
              setEditingPrestador(null);
            }}
            prestador={editingPrestador}
          />
        )}
      </div>
    </PermissionGate>
  );
}
