import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Search, FileText, CheckCircle, XCircle, Clock, Loader2, 
  Send, MoreHorizontal, Edit, Trash, RefreshCw, Link, 
  ExternalLink, Pause, Eye, PlayCircle, Plus 
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { StatusContrato } from '@/types/database';
import { useContratos, useUpdateContrato, useAtivarContrato } from '@/hooks/useContratos';
import { useSendToAutentique, useResendAutentique, useCancelAutentique, getWhatsAppLink } from '@/hooks/useAutentique';
import { ContratoFormDialog, type PrefilledCotacaoData } from '@/components/contratos/ContratoFormDialog';
import { ContratoDetailDrawer } from '@/components/contratos/ContratoDetailDrawer';
import { toast } from 'sonner';

const statusConfig: Record<StatusContrato, { label: string; color: string; icon: typeof FileText }> = {
  rascunho: { label: 'Rascunho', color: 'bg-gray-100 text-gray-800', icon: FileText },
  pendente: { label: 'Pendente', color: 'bg-gray-100 text-gray-800', icon: Clock },
  enviado: { label: 'Enviado', color: 'bg-yellow-100 text-yellow-800', icon: Send },
  assinado: { label: 'Assinado', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  ativo: { label: 'Ativo', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  suspenso: { label: 'Suspenso', color: 'bg-orange-100 text-orange-800', icon: Pause },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-800', icon: XCircle },
};

type TabValue = 'all' | StatusContrato;

export default function Contratos() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [drawerContratoId, setDrawerContratoId] = useState<string | null>(null);
  const [prefilledData, setPrefilledData] = useState<PrefilledCotacaoData | null>(null);

  const { isDiretor, isDesenvolvedor, isAdminMaster } = usePermissions();
  const canDeleteContratos = isDiretor || isDesenvolvedor || isAdminMaster;

  const { data: contratos, isLoading } = useContratos();
  const updateContrato = useUpdateContrato();
  const ativarContrato = useAtivarContrato();
  const sendToAutentique = useSendToAutentique();
  const resendAutentique = useResendAutentique();
  const cancelAutentique = useCancelAutentique();

  // Abrir modal/drawer automaticamente se vier da cotação
  useEffect(() => {
    const state = location.state as { 
      fromCotacao?: boolean; 
      dadosCotacao?: PrefilledCotacaoData;
      openContrato?: string;
    } | null;
    
    if (state?.fromCotacao && state?.dadosCotacao) {
      setPrefilledData(state.dadosCotacao);
      setFormDialogOpen(true);
      window.history.replaceState({}, document.title);
    }
    
    // Abrir drawer do contrato recém-criado (vindo do wizard de cotação)
    if (state?.openContrato) {
      setDrawerContratoId(state.openContrato);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const filteredContratos = (contratos || []).filter((contrato) => {
    const matchesSearch =
      contrato.numero.toLowerCase().includes(search.toLowerCase()) ||
      (contrato.associados?.nome?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (contrato.leads?.nome?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (contrato.associados?.cpf?.includes(search) ?? false);
    const matchesTab = activeTab === 'all' || contrato.status === activeTab;
    return matchesSearch && matchesTab;
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Stats por status
  const stats = {
    total: contratos?.length || 0,
    rascunho: contratos?.filter((c) => c.status === 'rascunho').length || 0,
    enviado: contratos?.filter((c) => c.status === 'enviado').length || 0,
    assinado: contratos?.filter((c) => c.status === 'assinado').length || 0,
    ativo: contratos?.filter((c) => c.status === 'ativo').length || 0,
    valorTotal: contratos
      ?.filter((c) => c.status === 'ativo')
      .reduce((acc, c) => acc + c.valor_mensal, 0) || 0,
  };

  const tabs: { value: TabValue; label: string; count: number }[] = [
    { value: 'all', label: 'Todos', count: stats.total },
    { value: 'rascunho', label: 'Rascunho', count: stats.rascunho },
    { value: 'enviado', label: 'Enviados', count: stats.enviado },
    { value: 'assinado', label: 'Assinados', count: stats.assinado },
    { value: 'ativo', label: 'Ativos', count: stats.ativo },
  ];

  // Ação de enviar para Autentique
  const handleEnviar = async (contratoId: string) => {
    const contrato = contratos?.find(c => c.id === contratoId);
    if (!contrato) return;

    const client = contrato.associados || contrato.leads;
    if (!client?.email) {
      toast.error('Email do cliente não informado');
      return;
    }

    await sendToAutentique.mutateAsync({
      contratoId,
      clienteNome: client.nome || 'Cliente',
      clienteEmail: client.email,
      clienteCpf: 'cpf' in client ? client.cpf || undefined : undefined,
      clienteTelefone: client.telefone || undefined,
    });
  };

  const handleAtivar = async (contratoId: string) => {
    try {
      const contrato = contratos?.find(c => c.id === contratoId);
      const hadAssociado = !!contrato?.associado_id;
      
      await ativarContrato.mutateAsync(contratoId);
      
      if (!hadAssociado) {
        toast.success('Contrato ativado! Associado e veículo criados automaticamente.');
      } else {
        toast.success('Contrato ativado com sucesso!');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao ativar contrato');
    }
  };

  const handleSuspender = async (contratoId: string) => {
    try {
      await updateContrato.mutateAsync({
        id: contratoId,
        status: 'suspenso',
      });
      toast.success('Contrato suspenso');
    } catch (error) {
      toast.error('Erro ao suspender contrato');
    }
  };

  const handleCancelar = async (contratoId: string) => {
    try {
      await updateContrato.mutateAsync({
        id: contratoId,
        status: 'cancelado',
      });
      toast.success('Contrato cancelado');
    } catch (error) {
      toast.error('Erro ao cancelar contrato');
    }
  };

  const handleCopiarLink = (contrato: typeof contratos[0]) => {
    if (contrato.autentique_url) {
      navigator.clipboard.writeText(contrato.autentique_url);
      toast.success('Link copiado!');
    } else {
      toast.error('Nenhum link disponível');
    }
  };

  const handleReenviarEmail = async (contrato: typeof contratos[0]) => {
    if (!contrato.autentique_documento_id) {
      toast.error('Documento não encontrado');
      return;
    }
    await resendAutentique.mutateAsync(contrato.autentique_documento_id);
  };

  const handleCancelarDocumento = async (contrato: typeof contratos[0]) => {
    if (!contrato.autentique_documento_id) {
      toast.error('Documento não encontrado');
      return;
    }
    await cancelAutentique.mutateAsync({
      documentId: contrato.autentique_documento_id,
      contratoId: contrato.id,
    });
  };

  const handleEnviarWhatsApp = (contrato: typeof contratos[0]) => {
    const client = contrato.associados || contrato.leads;
    const phone = client?.telefone;
    if (!phone || !contrato.autentique_url) {
      toast.error('Telefone ou link não disponível');
      return;
    }
    const url = getWhatsAppLink(phone, contrato.autentique_url, client?.nome);
    window.open(url, '_blank');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contratos</h1>
          <p className="text-muted-foreground">
            Visualize e gerencie contratos de adesão
          </p>
        </div>
        <Button onClick={() => setFormDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Contrato
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-500/10 p-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.ativo}</p>
                <p className="text-xs text-muted-foreground">Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-yellow-500/10 p-2">
                <Send className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.enviado}</p>
                <p className="text-xs text-muted-foreground">Aguardando Assinatura</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accent/10 p-2">
                <FileText className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(stats.valorTotal)}</p>
                <p className="text-xs text-muted-foreground">Receita Mensal</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label} ({tab.count})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por número, nome ou CPF..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº Contrato</TableHead>
                <TableHead>Lead/Associado</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Adesão</TableHead>
                <TableHead>Mensal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContratos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhum contrato encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredContratos.map((contrato) => {
                  const status = statusConfig[contrato.status];
                  const clientName = contrato.associados?.nome || contrato.leads?.nome || '-';
                  const clientPhone = contrato.associados?.telefone || contrato.leads?.telefone;
                  const veiculoMarca = contrato.veiculo_marca || contrato.leads?.veiculo_marca || contrato.cotacoes?.veiculo_marca;
                  const veiculoModelo = contrato.veiculo_modelo || contrato.leads?.veiculo_modelo || contrato.cotacoes?.veiculo_modelo;
                  const veiculoAno = contrato.veiculo_ano || contrato.leads?.veiculo_ano || contrato.cotacoes?.veiculo_ano;
                  const veiculoPlaca = contrato.veiculo_placa || contrato.leads?.veiculo_placa;
                  
                  const veiculo = veiculoMarca 
                    ? `${veiculoMarca} ${veiculoModelo || ''} ${veiculoAno || ''}`.trim()
                    : veiculoPlaca 
                      ? veiculoPlaca 
                      : '-';
                  
                  return (
                    <TableRow 
                      key={contrato.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setDrawerContratoId(contrato.id)}
                    >
                      <TableCell className="font-mono text-sm">{contrato.numero}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{clientName}</p>
                          <p className="text-xs text-muted-foreground">{clientPhone}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{veiculo}</TableCell>
                      <TableCell>{contrato.planos?.nome || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatCurrency(contrato.valor_adesao)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(contrato.valor_mensal)}
                      </TableCell>
                      <TableCell>
                        <Badge className={status.color}>
                          <status.icon className="mr-1 h-3 w-3" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(contrato.created_at)}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={sendToAutentique.isPending}>
                              {sendToAutentique.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
{/* Rascunho/Pendente - apenas excluir na listagem */}
                            {(contrato.status === 'rascunho' || contrato.status === 'pendente') && (
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => handleCancelar(contrato.id)}
                              >
                                <Trash className="mr-2 h-4 w-4" /> Excluir
                              </DropdownMenuItem>
                            )}
                            {/* Enviado */}
                            {contrato.status === 'enviado' && (
                              <>
                                <DropdownMenuItem onClick={() => handleEnviar(contrato.id)}>
                                  <RefreshCw className="mr-2 h-4 w-4" /> Reenviar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleCopiarLink(contrato)}>
                                  <Link className="mr-2 h-4 w-4" /> Copiar Link
                                </DropdownMenuItem>
                                {contrato.autentique_url && (
                                  <DropdownMenuItem asChild>
                                    <a href={contrato.autentique_url} target="_blank" rel="noopener noreferrer">
                                      <ExternalLink className="mr-2 h-4 w-4" /> Ver Documento
                                    </a>
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => handleCancelar(contrato.id)}
                                >
                                  <XCircle className="mr-2 h-4 w-4" /> Cancelar
                                </DropdownMenuItem>
                              </>
                            )}
                            {/* Assinado */}
                            {contrato.status === 'assinado' && (
                              <>
                                <DropdownMenuItem onClick={() => handleAtivar(contrato.id)}>
                                  <CheckCircle className="mr-2 h-4 w-4" /> Ativar
                                </DropdownMenuItem>
                                {contrato.autentique_url && (
                                  <DropdownMenuItem asChild>
                                    <a href={contrato.autentique_url} target="_blank" rel="noopener noreferrer">
                                      <ExternalLink className="mr-2 h-4 w-4" /> Ver Documento
                                    </a>
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}
                            {/* Ativo */}
                            {contrato.status === 'ativo' && (
                              <>
                                <DropdownMenuItem onClick={() => setDrawerContratoId(contrato.id)}>
                                  <Eye className="mr-2 h-4 w-4" /> Ver
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleSuspender(contrato.id)}>
                                  <Pause className="mr-2 h-4 w-4" /> Suspender
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => handleCancelar(contrato.id)}
                                >
                                  <XCircle className="mr-2 h-4 w-4" /> Cancelar
                                </DropdownMenuItem>
                              </>
                            )}
                            {/* Suspenso */}
                            {contrato.status === 'suspenso' && (
                              <>
                                <DropdownMenuItem onClick={() => handleAtivar(contrato.id)}>
                                  <PlayCircle className="mr-2 h-4 w-4" /> Reativar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => handleCancelar(contrato.id)}
                                >
                                  <XCircle className="mr-2 h-4 w-4" /> Cancelar
                                </DropdownMenuItem>
                              </>
                            )}
                            {/* Cancelado */}
                            {contrato.status === 'cancelado' && (
                              <>
                                <DropdownMenuItem onClick={() => setDrawerContratoId(contrato.id)}>
                                  <Eye className="mr-2 h-4 w-4" /> Ver Detalhes
                                </DropdownMenuItem>
                                {canDeleteContratos && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      className="text-destructive"
                                      onClick={async () => {
                                        if (!confirm('Tem certeza que deseja excluir este contrato definitivamente? Esta ação não pode ser desfeita.')) {
                                          return;
                                        }
                                        try {
                                          // 1. Excluir cobranças Asaas vinculadas (já é CASCADE, mas garantindo)
                                          await supabase
                                            .from('asaas_cobrancas')
                                            .delete()
                                            .eq('contrato_id', contrato.id);
                                          
                                          // 2. Excluir cobranças antigas vinculadas
                                          await supabase
                                            .from('cobrancas')
                                            .delete()
                                            .eq('contrato_id', contrato.id);
                                          
                                          // 3. Excluir histórico do contrato
                                          await supabase
                                            .from('contratos_historico')
                                            .delete()
                                            .eq('contrato_id', contrato.id);
                                          
                                          // 4. Agora excluir o contrato
                                          const { error } = await supabase
                                            .from('contratos')
                                            .delete()
                                            .eq('id', contrato.id);
                                          if (error) throw error;
                                          
                                          toast.success('Contrato excluído com sucesso');
                                          queryClient.invalidateQueries({ queryKey: ['contratos'] });
                                        } catch (error) {
                                          console.error('Erro ao excluir contrato:', error);
                                          toast.error('Erro ao excluir contrato. Verifique se há registros dependentes.');
                                        }
                                      }}
                                    >
                                      <Trash className="mr-2 h-4 w-4" /> Excluir
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog e Drawer */}
      <ContratoFormDialog 
        open={formDialogOpen} 
        onOpenChange={(open) => {
          setFormDialogOpen(open);
          if (!open) setPrefilledData(null);
        }}
        prefilledData={prefilledData}
      />

      <ContratoDetailDrawer
        contratoId={drawerContratoId}
        open={!!drawerContratoId}
        onClose={() => setDrawerContratoId(null)}
      />
    </div>
  );
}
