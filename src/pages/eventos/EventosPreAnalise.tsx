import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertTriangle, Bot, Smartphone, CheckCircle2, XCircle, Clock, Send, User, Phone, MapPin, Calendar, FileText, Car, Truck, ShieldAlert, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { toast } from 'sonner';

const STATUS_PRE_ANALISE = ['comunicado', 'documentacao_pendente', 'aguardando_vistoria'] as const;

const STATUS_LABELS: Record<string, string> = {
  comunicado: 'Comunicado',
  documentacao_pendente: 'Doc. Pendente',
  aguardando_vistoria: 'Aguardando Vistoria',
  pendente: 'Pendente IA',
};

const STATUS_COLORS: Record<string, string> = {
  comunicado: 'bg-amber-100 text-amber-800 border-amber-200',
  documentacao_pendente: 'bg-orange-100 text-orange-800 border-orange-200',
  aguardando_vistoria: 'bg-purple-100 text-purple-800 border-purple-200',
  pendente: 'bg-blue-100 text-blue-800 border-blue-200',
};

interface UnifiedItem {
  id: string;
  origem: 'app' | 'ia';
  tipo: string;
  associado_nome: string;
  veiculo_info: string;
  placa: string;
  status: string;
  created_at: string;
  // For IA items
  ia_dados?: any;
  ia_tipo?: string;
  ia_associado?: any;
  ia_dados_novo_titular?: any;
  // For App items
  sinistro_id?: string;
}

export default function EventosPreAnalise() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroOrigem, setFiltroOrigem] = useState<string>('todos');

  // Dialog state for IA approval
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<UnifiedItem | null>(null);
  const [acao, setAcao] = useState<'aprovar' | 'rejeitar'>('aprovar');
  const [motivo, setMotivo] = useState('');

  // Query 1: Sinistros em pré-análise
  const { data: sinistros, isLoading: loadingSinistros } = useQuery({
    queryKey: ['eventos-pre-analise-sinistros', filtroStatus, filtroTipo],
    queryFn: async () => {
      const statusFilter = filtroStatus === 'todos' || filtroStatus === 'pendente'
        ? [...STATUS_PRE_ANALISE]
        : [filtroStatus];

      let query = supabase
        .from('sinistros')
        .select(`
          id, tipo, data_ocorrencia, created_at, status,
          associado:associados!sinistros_associado_id_fkey(id, nome, cpf),
          veiculo:veiculos!sinistros_veiculo_id_fkey(id, placa, marca, modelo)
        `)
        .in('status', statusFilter as any)
        .order('created_at', { ascending: false });

      if (filtroTipo !== 'todos') {
        query = query.eq('tipo', filtroTipo as any);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Query 2: Solicitações IA pendentes
  const { data: solicitacoesIA, isLoading: loadingIA } = useQuery({
    queryKey: ['eventos-pre-analise-ia'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_solicitacoes_ia')
        .select(`
          id, tipo, dados, dados_novo_titular, status, created_at, associado_id,
          associado:associados!chat_solicitacoes_ia_associado_id_fkey(nome, telefone, whatsapp)
        `)
        .eq('status', 'pendente')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // Mutation para aprovar/rejeitar IA
  const processarMutation = useMutation({
    mutationFn: async ({ solicitacao_id, acao, motivo }: { solicitacao_id: string; acao: string; motivo?: string }) => {
      const { data, error } = await supabase.functions.invoke('aprovar-solicitacao-ia', {
        body: { solicitacao_id, acao, motivo },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao processar');
      return data;
    },
    onSuccess: (data) => {
      toast.success(acao === 'aprovar' ? `${data.protocolo} criado com sucesso!` : 'Solicitação rejeitada');
      queryClient.invalidateQueries({ queryKey: ['eventos-pre-analise-ia'] });
      queryClient.invalidateQueries({ queryKey: ['eventos-pre-analise-sinistros'] });
      setDialogOpen(false);
      setSelectedItem(null);
      setMotivo('');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao processar solicitação');
    },
  });

  // Merge both sources
  const isLoading = loadingSinistros || loadingIA;

  const unifiedItems: UnifiedItem[] = (() => {
    const items: UnifiedItem[] = [];

    // Add sinistros (App origin)
    if (filtroOrigem !== 'ia' && sinistros) {
      for (const s of sinistros as any[]) {
        items.push({
          id: s.id,
          origem: 'app',
          tipo: s.tipo?.replace(/_/g, ' ') || '—',
          associado_nome: s.associado?.nome || '—',
          veiculo_info: s.veiculo ? `${s.veiculo.marca} ${s.veiculo.modelo}` : '—',
          placa: s.veiculo?.placa || '—',
          status: s.status,
          created_at: s.created_at,
          sinistro_id: s.id,
        });
      }
    }

    // Add IA requests
    if (filtroOrigem !== 'app' && solicitacoesIA && (filtroStatus === 'todos' || filtroStatus === 'pendente')) {
      for (const sol of solicitacoesIA as any[]) {
        const associadoData = sol.associado as any;
        const dados = sol.dados as any;
        items.push({
          id: sol.id,
          origem: 'ia',
          tipo: getTipoLabel(sol.tipo),
          associado_nome: associadoData?.nome || '—',
          veiculo_info: '—',
          placa: '—',
          status: 'pendente',
          created_at: sol.created_at,
          ia_dados: dados,
          ia_tipo: sol.tipo,
          ia_associado: associadoData,
          ia_dados_novo_titular: sol.dados_novo_titular,
        });
      }
    }

    // Sort by created_at desc
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return items;
  })();

  function getTipoLabel(tipo: string) {
    if (tipo === 'sinistro') return 'Sinistro';
    if (tipo === 'cancelamento') return 'Cancelamento';
    if (tipo === 'troca_titularidade') return 'Troca Titularidade';
    if (tipo === 'assistencia') return 'Assistência 24h';
    return tipo;
  }

  const handleRowClick = (item: UnifiedItem) => {
    if (item.origem === 'app') {
      navigate(`/eventos/sinistros/${item.sinistro_id}`);
    } else {
      // Open detail dialog for IA item
      setSelectedItem(item);
      setAcao('aprovar');
      setMotivo('');
      setDialogOpen(true);
    }
  };

  const handleAcaoIA = (tipoAcao: 'aprovar' | 'rejeitar') => {
    setAcao(tipoAcao);
  };

  const confirmarAcao = () => {
    if (!selectedItem) return;
    processarMutation.mutate({
      solicitacao_id: selectedItem.id,
      acao,
      motivo: acao === 'rejeitar' ? motivo : undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-purple-600" />
          <h1 className="text-xl font-bold">Pré-Análise de Eventos</h1>
        </div>
        <span className="text-sm text-muted-foreground">
          {unifiedItems.length} evento(s)
        </span>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas Origens</SelectItem>
            <SelectItem value="ia">IA</SelectItem>
            <SelectItem value="app">App</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Status</SelectItem>
            <SelectItem value="pendente">Pendente IA</SelectItem>
            {STATUS_PRE_ANALISE.map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Tipos</SelectItem>
            <SelectItem value="colisao">Colisão</SelectItem>
            <SelectItem value="roubo_furto">Roubo/Furto</SelectItem>
            <SelectItem value="incendio">Incêndio</SelectItem>
            <SelectItem value="alagamento">Alagamento</SelectItem>
            <SelectItem value="perda_total">Perda Total</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !unifiedItems.length ? (
        <div className="text-center py-12 text-muted-foreground">
          Nenhum evento em pré-análise.
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Origem</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Associado</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unifiedItems.map((item) => (
                <TableRow
                  key={`${item.origem}-${item.id}`}
                  className="cursor-pointer"
                  onClick={() => handleRowClick(item)}
                >
                  <TableCell>
                    {item.origem === 'ia' ? (
                      <Badge className="bg-violet-100 text-violet-800 border-violet-200 gap-1">
                        <Bot className="h-3 w-3" />
                        IA
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1">
                        <Smartphone className="h-3 w-3" />
                        App
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="capitalize font-medium">
                    {item.tipo}
                  </TableCell>
                  <TableCell>{item.associado_nome}</TableCell>
                  <TableCell>{item.veiculo_info}</TableCell>
                  <TableCell className="font-mono">{item.placa}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[item.status] || ''}>
                      {STATUS_LABELS[item.status] || item.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.created_at ? format(new Date(item.created_at), 'dd/MM/yyyy') : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog for IA item details + approve/reject */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setSelectedItem(null); }}>
        <DialogContent className="max-w-lg">
          {selectedItem?.origem === 'ia' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-violet-600" />
                  Solicitação via IA — {selectedItem.tipo}
                </DialogTitle>
                <DialogDescription>
                  Criada em {selectedItem.created_at ? format(new Date(selectedItem.created_at), 'dd/MM/yyyy HH:mm') : '—'}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Associado */}
                {selectedItem.ia_associado && (
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{selectedItem.ia_associado.nome}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {selectedItem.ia_associado.whatsapp || selectedItem.ia_associado.telefone}
                      </p>
                    </div>
                  </div>
                )}

                {/* Dados */}
                <div className="grid gap-3 sm:grid-cols-2">
                  {selectedItem.ia_tipo === 'sinistro' && selectedItem.ia_dados && (
                    <>
                      <div className="flex items-start gap-2">
                        <Car className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Tipo do Sinistro</p>
                          <p className="text-sm font-medium capitalize">{selectedItem.ia_dados.tipo || 'Não informado'}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Data/Hora</p>
                          <p className="text-sm font-medium">{selectedItem.ia_dados.data_ocorrencia || 'Não informada'}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 sm:col-span-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Local</p>
                          <p className="text-sm font-medium">{selectedItem.ia_dados.local || 'Não informado'}</p>
                        </div>
                      </div>
                    </>
                  )}

                  {selectedItem.ia_tipo === 'assistencia' && selectedItem.ia_dados && (
                    <>
                      <div className="flex items-start gap-2">
                        <Truck className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Tipo de Serviço</p>
                          <p className="text-sm font-medium capitalize">{(selectedItem.ia_dados.tipo_servico || 'guincho').replace('_', ' ')}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Localização</p>
                          <p className="text-sm font-medium">{selectedItem.ia_dados.localizacao || 'Não informada'}</p>
                        </div>
                      </div>
                    </>
                  )}

                  {selectedItem.ia_dados?.descricao && (
                    <div className="flex items-start gap-2 sm:col-span-2">
                      <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Descrição</p>
                        <p className="text-sm">{selectedItem.ia_dados.descricao}</p>
                      </div>
                    </div>
                  )}

                  {selectedItem.ia_tipo === 'cancelamento' && selectedItem.ia_dados?.motivo && (
                    <div className="flex items-start gap-2 sm:col-span-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Motivo do Cancelamento</p>
                        <p className="text-sm font-medium">{selectedItem.ia_dados.motivo}</p>
                      </div>
                    </div>
                  )}

                  {selectedItem.ia_tipo === 'troca_titularidade' && selectedItem.ia_dados_novo_titular && (
                    <div className="sm:col-span-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2">Dados do Novo Titular</p>
                      <div className="grid gap-1 text-sm">
                        <p><strong>Nome:</strong> {selectedItem.ia_dados_novo_titular.nome}</p>
                        <p><strong>CPF:</strong> {selectedItem.ia_dados_novo_titular.cpf}</p>
                        <p><strong>Email:</strong> {selectedItem.ia_dados_novo_titular.email}</p>
                        <p><strong>Telefone:</strong> {selectedItem.ia_dados_novo_titular.telefone}</p>
                      </div>
                    </div>
                  )}
                </div>

                {selectedItem.ia_tipo === 'sinistro' && (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-400">
                    <Info className="h-4 w-4 shrink-0" />
                    A IA informará ao associado sobre a cota de coparticipação ao enviar o link.
                  </div>
                )}

                {/* Reject reason */}
                {acao === 'rejeitar' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Motivo da rejeição</label>
                    <Textarea
                      placeholder="Informe o motivo..."
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      rows={3}
                    />
                  </div>
                )}
              </div>

              <DialogFooter className="flex gap-2 sm:gap-0">
                {acao === 'rejeitar' ? (
                  <>
                    <Button variant="ghost" onClick={() => setAcao('aprovar')}>
                      Voltar
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={confirmarAcao}
                      disabled={processarMutation.isPending || !motivo.trim()}
                    >
                      {processarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Confirmar Rejeição
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => handleAcaoIA('rejeitar')}>
                      <XCircle className="h-4 w-4 mr-2" />
                      Rejeitar
                    </Button>
                    {selectedItem.ia_tipo === 'sinistro' ? (
                      <Button onClick={confirmarAcao} disabled={processarMutation.isPending}>
                        {processarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        <Send className="h-4 w-4 mr-2" />
                        Enviar Link Auto Vistoria
                      </Button>
                    ) : (
                      <Button onClick={confirmarAcao} disabled={processarMutation.isPending}>
                        {processarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Aprovar
                      </Button>
                    )}
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
