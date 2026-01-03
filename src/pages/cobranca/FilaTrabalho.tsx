import { useState, useMemo } from 'react';
import { Play, Users, User, Clock, CheckCircle, Phone, MessageSquare, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const formatTelefone = (tel: string) => {
  const clean = tel?.replace(/\D/g, '') || '';
  if (clean.length === 11) return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  if (clean.length === 10) return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  return tel;
};

const getPrioridadeBadge = (p: number) => {
  if (p >= 9) return 'bg-red-500 text-white';
  if (p >= 7) return 'bg-red-100 text-red-800';
  if (p >= 5) return 'bg-yellow-100 text-yellow-800';
  return 'bg-gray-100 text-gray-600';
};

const getStatusBadge = (status: string) => {
  const map: Record<string, { label: string; className: string }> = {
    'pendente': { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800' },
    'em_atendimento': { label: 'Em Atendimento', className: 'bg-blue-100 text-blue-800' },
    'concluido': { label: 'Concluído', className: 'bg-green-100 text-green-800' },
    'cancelado': { label: 'Cancelado', className: 'bg-gray-100 text-gray-600' },
  };
  return map[status] || { label: status, className: 'bg-gray-100 text-gray-600' };
};

const getMotivoLabel = (motivo: string) => {
  const map: Record<string, string> = {
    'vencido': 'Boleto Vencido',
    'promessa_quebrada': 'Promessa Quebrada',
    'acordo_quebrado': 'Acordo Quebrado',
    'retorno_agendado': 'Retorno Agendado',
  };
  return map[motivo] || motivo;
};

const openWhatsApp = (numero: string) => {
  const limpo = numero?.replace(/\D/g, '') || '';
  window.open(`https://wa.me/55${limpo}`, '_blank');
};

const FilaTrabalho = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [filters, setFilters] = useState({
    status: 'todos',
    atribuido: 'todos',
    motivo: 'todos'
  });
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // Fila de trabalho
  const { data: fila, isLoading } = useQuery({
    queryKey: ['fila-cobranca', filters],
    queryFn: async () => {
      const user = await supabase.auth.getUser();
      
      let query = supabase
        .from('cobranca_fila')
        .select(`
          *,
          associado:associados(id, nome, cpf, telefone, whatsapp),
          cobranca:cobrancas(valor_final, data_vencimento)
        `)
        .order('prioridade', { ascending: false })
        .order('data_agendamento');
      
      if (filters.status && filters.status !== 'todos') {
        query = query.eq('status', filters.status);
      }
      if (filters.atribuido && filters.atribuido !== 'todos') {
        if (filters.atribuido === 'meus') {
          query = query.eq('atribuido_para', user.data.user?.id);
        } else if (filters.atribuido === 'nao_atribuidos') {
          query = query.is('atribuido_para', null);
        }
      }
      if (filters.motivo && filters.motivo !== 'todos') {
        query = query.eq('motivo', filters.motivo);
      }
      
      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data || [];
    }
  });

  // Estatísticas
  const { data: stats } = useQuery({
    queryKey: ['fila-cobranca-stats'],
    queryFn: async () => {
      const user = await supabase.auth.getUser();
      const hoje = new Date().toISOString().split('T')[0];
      
      const [pendentes, meus, emAtendimento, concluidosHoje] = await Promise.all([
        supabase.from('cobranca_fila').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
        supabase.from('cobranca_fila').select('id', { count: 'exact', head: true }).eq('atribuido_para', user.data.user?.id).in('status', ['pendente', 'em_atendimento']),
        supabase.from('cobranca_fila').select('id', { count: 'exact', head: true }).eq('status', 'em_atendimento'),
        supabase.from('cobranca_fila').select('id', { count: 'exact', head: true }).eq('status', 'concluido').gte('concluido_em', hoje),
      ]);
      
      return {
        pendentes: pendentes.count || 0,
        meus: meus.count || 0,
        emAtendimento: emAtendimento.count || 0,
        concluidosHoje: concluidosHoje.count || 0,
      };
    }
  });

  // Pegar próximo
  const pegarProximo = useMutation({
    mutationFn: async () => {
      const user = await supabase.auth.getUser();
      
      // Buscar próximo pendente
      const { data: proximo, error: errBusca } = await supabase
        .from('cobranca_fila')
        .select('id, associado_id')
        .eq('status', 'pendente')
        .is('atribuido_para', null)
        .order('prioridade', { ascending: false })
        .order('data_agendamento')
        .limit(1)
        .single();
      
      if (errBusca || !proximo) {
        throw new Error('Nenhum item na fila');
      }
      
      // Atribuir para o usuário
      const { error: errUpdate } = await supabase
        .from('cobranca_fila')
        .update({
          atribuido_para: user.data.user?.id,
          status: 'em_atendimento'
        })
        .eq('id', proximo.id);
      
      if (errUpdate) throw errUpdate;
      
      return proximo;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fila-cobranca'] });
      queryClient.invalidateQueries({ queryKey: ['fila-cobranca-stats'] });
      navigate(`/cobranca/inadimplentes/${data.associado_id}`);
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao pegar próximo item');
    }
  });

  // Atender item específico
  const atenderItem = useMutation({
    mutationFn: async (item: { id: string; associado_id: string }) => {
      const user = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('cobranca_fila')
        .update({
          atribuido_para: user.data.user?.id,
          status: 'em_atendimento'
        })
        .eq('id', item.id);
      
      if (error) throw error;
      return item;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fila-cobranca'] });
      queryClient.invalidateQueries({ queryKey: ['fila-cobranca-stats'] });
      navigate(`/cobranca/inadimplentes/${data.associado_id}`);
    },
    onError: () => {
      toast.error('Erro ao atender item');
    }
  });

  // Seleção
  const toggleItem = (id: string) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (!fila) return;
    if (selectedItems.length === fila.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(fila.map(f => f.id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fila de Trabalho</h1>
        <Button 
          size="lg" 
          onClick={() => pegarProximo.mutate()}
          disabled={pegarProximo.isPending}
        >
          <Play className="h-5 w-5 mr-2" />
          {pegarProximo.isPending ? 'Buscando...' : 'Pegar Próximo'}
        </Button>
      </div>

      {/* Cards Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100">
                <Users className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.pendentes || 0}</p>
                <p className="text-sm text-muted-foreground">Na Fila</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.meus || 0}</p>
                <p className="text-sm text-muted-foreground">Meus</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.emAtendimento || 0}</p>
                <p className="text-sm text-muted-foreground">Em Atendimento</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.concluidosHoje || 0}</p>
                <p className="text-sm text-muted-foreground">Concluídos Hoje</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4">
        <div className="w-40">
          <Select value={filters.status} onValueChange={(v) => setFilters(f => ({ ...f, status: v }))}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="em_atendimento">Em Atendimento</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-44">
          <Select value={filters.atribuido} onValueChange={(v) => setFilters(f => ({ ...f, atribuido: v }))}>
            <SelectTrigger>
              <SelectValue placeholder="Atribuição" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas Atribuições</SelectItem>
              <SelectItem value="meus">Meus</SelectItem>
              <SelectItem value="nao_atribuidos">Não Atribuídos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-44">
          <Select value={filters.motivo} onValueChange={(v) => setFilters(f => ({ ...f, motivo: v }))}>
            <SelectTrigger>
              <SelectValue placeholder="Motivo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Motivos</SelectItem>
              <SelectItem value="vencido">Boleto Vencido</SelectItem>
              <SelectItem value="promessa_quebrada">Promessa Quebrada</SelectItem>
              <SelectItem value="acordo_quebrado">Acordo Quebrado</SelectItem>
              <SelectItem value="retorno_agendado">Retorno Agendado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button 
          variant="outline" 
          size="icon"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['fila-cobranca'] })}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Ações em lote */}
      {selectedItems.length > 0 && (
        <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
          <span className="text-sm font-medium">{selectedItems.length} selecionados</span>
          <Button variant="outline" size="sm">
            Atribuir Selecionados
          </Button>
        </div>
      )}

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={fila && fila.length > 0 && selectedItems.length === fila.length}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead className="w-20">Prior.</TableHead>
                  <TableHead>Associado</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Agendamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fila && fila.length > 0 ? (
                  fila.map((item) => {
                    const statusInfo = getStatusBadge(item.status || 'pendente');
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedItems.includes(item.id)}
                            onCheckedChange={() => toggleItem(item.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <Badge className={getPrioridadeBadge(item.prioridade || 5)}>
                            {item.prioridade || 5}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.associado?.nome || '-'}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="text-sm">{formatTelefone(item.associado?.telefone || '')}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openWhatsApp(item.associado?.whatsapp || item.associado?.telefone || '')}
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{getMotivoLabel(item.motivo)}</span>
                        </TableCell>
                        <TableCell>
                          {item.data_agendamento ? (
                            <span className="text-sm">
                              {format(new Date(item.data_agendamento), "dd/MM HH:mm", { locale: ptBR })}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusInfo.className}>
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => atenderItem.mutate({ id: item.id, associado_id: item.associado?.id || item.associado_id })}
                            disabled={item.status === 'concluido'}
                          >
                            <Phone className="h-4 w-4 mr-1" />
                            Atender
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      <p className="text-muted-foreground">Nenhum item na fila</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FilaTrabalho;
