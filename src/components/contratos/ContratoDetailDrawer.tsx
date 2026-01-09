import { 
  FileText, CheckCircle, XCircle, Clock, Send, Pause, 
  ExternalLink, Phone, Mail, MapPin, Car, User, Link,
  RefreshCw, Loader2, Eye, Copy, MessageCircle, History
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useContrato, useUpdateContrato } from '@/hooks/useContratos';
import { useUpdateLead } from '@/hooks/useLeads';
import { useCreateLeadHistorico } from '@/hooks/useLeadHistorico';
import { 
  useSendToAutentique, 
  useAutentiqueStatus, 
  useResendAutentique,
  useCancelAutentique,
  getAutentiqueStatusLabel,
  getWhatsAppLink 
} from '@/hooks/useAutentique';
import { ContratoTimeline } from './ContratoTimeline';
import { toast } from 'sonner';
import type { StatusContrato } from '@/types/database';

const statusConfig: Record<string, { label: string; color: string; icon: typeof FileText }> = {
  rascunho: { label: 'Rascunho', color: 'bg-gray-100 text-gray-800', icon: FileText },
  pendente: { label: 'Pendente', color: 'bg-gray-100 text-gray-800', icon: Clock },
  pendente_assinatura: { label: 'Aguardando Assinatura', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  enviado: { label: 'Enviado', color: 'bg-yellow-100 text-yellow-800', icon: Send },
  visualizado: { label: 'Visualizado', color: 'bg-indigo-100 text-indigo-800', icon: Eye },
  assinado: { label: 'Assinado', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  ativo: { label: 'Ativo', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  suspenso: { label: 'Suspenso', color: 'bg-orange-100 text-orange-800', icon: Pause },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-800', icon: XCircle },
  expirado: { label: 'Expirado', color: 'bg-red-100 text-red-800', icon: XCircle },
};

interface ContratoDetailDrawerProps {
  contratoId: string | null;
  open: boolean;
  onClose: () => void;
}

export function ContratoDetailDrawer({ contratoId, open, onClose }: ContratoDetailDrawerProps) {
  const { data: contrato, isLoading } = useContrato(contratoId || undefined);
  const updateContrato = useUpdateContrato();
  const updateLead = useUpdateLead();
  const createHistorico = useCreateLeadHistorico();
  const sendToAutentique = useSendToAutentique();
  const resendAutentique = useResendAutentique();
  const cancelAutentique = useCancelAutentique();
  
  // Buscar status do Autentique se houver documento
  const { data: autentiqueStatus, isLoading: isLoadingStatus } = useAutentiqueStatus(
    contrato?.autentique_documento_id || undefined
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR');
  };

  const handleEnviar = async () => {
    if (!contrato) return;
    
    const client = contrato.associados || contrato.leads;
    if (!client?.email) {
      toast.error('Email do cliente não informado');
      return;
    }

    await sendToAutentique.mutateAsync({
      contratoId: contrato.id,
      clienteNome: client.nome || 'Cliente',
      clienteEmail: client.email,
      clienteCpf: 'cpf' in client ? client.cpf || undefined : undefined,
      clienteTelefone: client.telefone || undefined,
    });
  };

  const handleAtivar = async () => {
    if (!contrato) return;
    try {
      await updateContrato.mutateAsync({
        id: contrato.id,
        status: 'ativo',
      });

      if (contrato.lead_id) {
        await updateLead.mutateAsync({
          id: contrato.lead_id,
          etapa: 'ganho',
          data_conversao: new Date().toISOString(),
        });
        
        await createHistorico.mutateAsync({
          lead_id: contrato.lead_id,
          acao: 'ganho',
          descricao: `Contrato ${contrato.numero} ativado`,
          etapa_nova: 'ganho',
        });
      }

      toast.success('Contrato ativado!');
    } catch (error) {
      toast.error('Erro ao ativar contrato');
    }
  };

  const handleCopiarLink = () => {
    if (contrato?.autentique_url) {
      navigator.clipboard.writeText(contrato.autentique_url);
      toast.success('Link copiado!');
    }
  };

  const handleReenviarEmail = async () => {
    if (!contrato?.autentique_documento_id) return;
    await resendAutentique.mutateAsync(contrato.autentique_documento_id);
  };

  const handleCancelarDocumento = async () => {
    if (!contrato?.autentique_documento_id) return;
    await cancelAutentique.mutateAsync({
      documentId: contrato.autentique_documento_id,
      contratoId: contrato.id,
    });
    onClose();
  };

  const handleEnviarWhatsApp = () => {
    const client = contrato?.associados || contrato?.leads;
    const phone = client?.telefone || ('whatsapp' in (client || {}) ? (client as any)?.whatsapp : undefined);
    if (!phone || !contrato?.autentique_url) {
      toast.error('Telefone ou link não disponível');
      return;
    }
    const url = getWhatsAppLink(phone, contrato.autentique_url, client?.nome);
    window.open(url, '_blank');
  };

  if (!contratoId) return null;

  const status = contrato ? (statusConfig[contrato.status] || statusConfig.pendente) : null;
  const client = contrato?.associados || contrato?.leads;
  const lead = contrato?.leads;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[500px] sm:w-[600px] overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="font-mono">{contrato?.numero}</SheetTitle>
            {status && (
              <Badge className={status.color}>
                <status.icon className="mr-1 h-3 w-3" />
                {status.label}
              </Badge>
            )}
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : contrato ? (
          <Tabs defaultValue="detalhes" className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="detalhes">
                <FileText className="h-4 w-4 mr-2" />
                Detalhes
              </TabsTrigger>
              <TabsTrigger value="historico">
                <History className="h-4 w-4 mr-2" />
                Histórico
              </TabsTrigger>
            </TabsList>

            <TabsContent value="detalhes" className="space-y-6 mt-4">
              {/* Dados do Contrato */}
              <section>
                <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-3">
                  Dados do Contrato
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Plano:</span>
                    <p className="font-medium">{contrato.planos?.nome}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Valor Mensal:</span>
                    <p className="font-medium text-primary">{formatCurrency(contrato.valor_mensal)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Valor Adesão:</span>
                    <p>{formatCurrency(contrato.valor_adesao)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Dia Vencimento:</span>
                    <p>{contrato.dia_vencimento || '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Data Início:</span>
                    <p>{formatDate(contrato.data_inicio)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Criado em:</span>
                    <p>{formatDate(contrato.created_at)}</p>
                  </div>
                </div>
              </section>

              <Separator />

              {/* Cliente */}
              <section>
                <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Cliente
                </h3>
                {client ? (
                  <div className="space-y-2 text-sm">
                    <p className="font-medium text-base">{client.nome}</p>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{client.telefone}</span>
                    </div>
                    {client.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        <span>{client.email}</span>
                      </div>
                    )}
                    {'cpf' in client && client.cpf && (
                      <p className="text-muted-foreground">CPF: {client.cpf}</p>
                    )}
                    {'cidade' in client && client.cidade && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{client.cidade}{client.uf && `, ${client.uf}`}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Sem informações do cliente</p>
                )}
              </section>

              <Separator />

              {/* Veículo */}
              <section>
                <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                  <Car className="h-4 w-4" />
                  Veículo
                </h3>
                {lead?.veiculo_marca ? (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Marca/Modelo:</span>
                      <p>{lead.veiculo_marca} {lead.veiculo_modelo}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Ano:</span>
                      <p>{lead.veiculo_ano || '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Placa:</span>
                      <p className="font-mono">{lead.veiculo_placa || '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Valor FIPE:</span>
                      <p>{lead.veiculo_fipe ? formatCurrency(lead.veiculo_fipe) : '-'}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Sem informações do veículo</p>
                )}
              </section>

              {/* Status da Assinatura Autentique */}
              {contrato.autentique_documento_id && (
                <>
                  <Separator />
                  <section>
                    <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Assinatura Eletrônica
                    </h3>
                    
                    {isLoadingStatus ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Verificando status...
                      </div>
                    ) : autentiqueStatus?.success ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Status:</span>
                          <Badge className={getAutentiqueStatusLabel(autentiqueStatus.document?.status || 'pending').color}>
                            {getAutentiqueStatusLabel(autentiqueStatus.document?.status || 'pending').label}
                          </Badge>
                        </div>

                        {/* Signatários */}
                        {autentiqueStatus.signatures && autentiqueStatus.signatures.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-sm text-muted-foreground">Signatários:</span>
                            {autentiqueStatus.signatures.map((sig, idx) => (
                              <div key={idx} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                                <div>
                                  <p className="font-medium">{sig.name}</p>
                                  <p className="text-xs text-muted-foreground">{sig.email}</p>
                                </div>
                                <div className="text-right">
                                  <Badge variant="outline" className={
                                    sig.status === 'signed' ? 'border-green-500 text-green-700' :
                                    sig.status === 'rejected' ? 'border-red-500 text-red-700' :
                                    sig.status === 'viewed' ? 'border-blue-500 text-blue-700' :
                                    'border-gray-400 text-gray-600'
                                  }>
                                    {sig.status === 'signed' && <CheckCircle className="mr-1 h-3 w-3" />}
                                    {sig.status === 'rejected' && <XCircle className="mr-1 h-3 w-3" />}
                                    {sig.status === 'viewed' && <Eye className="mr-1 h-3 w-3" />}
                                    {sig.status === 'pending' && <Clock className="mr-1 h-3 w-3" />}
                                    {sig.status === 'signed' ? 'Assinado' :
                                     sig.status === 'rejected' ? 'Rejeitado' :
                                     sig.status === 'viewed' ? 'Visualizado' : 'Pendente'}
                                  </Badge>
                                  {sig.signed && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {formatDateTime(sig.signed)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Link do documento */}
                        <div className="flex gap-2">
                          {contrato.autentique_url && (
                            <>
                              <Button variant="outline" size="sm" className="flex-1" asChild>
                                <a href={contrato.autentique_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="mr-2 h-3.5 w-3.5" />
                                  Abrir Documento
                                </a>
                              </Button>
                              <Button variant="outline" size="sm" onClick={handleCopiarLink}>
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>

                        {/* Ações para documentos pendentes */}
                        {(autentiqueStatus.document?.status === 'pending' || autentiqueStatus.document?.status === 'in_progress') && (
                          <div className="flex flex-col gap-2">
                            <div className="flex gap-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="flex-1"
                                onClick={handleReenviarEmail}
                                disabled={resendAutentique.isPending}
                              >
                                {resendAutentique.isPending ? (
                                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Mail className="mr-2 h-3.5 w-3.5" />
                                )}
                                Reenviar Email
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="flex-1"
                                onClick={handleEnviarWhatsApp}
                              >
                                <MessageCircle className="mr-2 h-3.5 w-3.5" />
                                WhatsApp
                              </Button>
                            </div>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm" className="w-full">
                                  <XCircle className="mr-2 h-3.5 w-3.5" />
                                  Cancelar Documento
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Cancelar Documento?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação cancelará o documento no Autentique. O cliente não poderá mais assinar este contrato.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={handleCancelarDocumento}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    {cancelAutentique.isPending ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : null}
                                    Confirmar Cancelamento
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}

                        {/* Documento assinado */}
                        {autentiqueStatus.document?.signedFileUrl && (
                          <Button variant="default" size="sm" className="w-full" asChild>
                            <a href={autentiqueStatus.document.signedFileUrl} target="_blank" rel="noopener noreferrer">
                              <FileText className="mr-2 h-3.5 w-3.5" />
                              Baixar Documento Assinado
                            </a>
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        <p>Não foi possível obter o status da assinatura.</p>
                        {contrato.autentique_url && (
                          <Button variant="outline" size="sm" className="mt-2" asChild>
                            <a href={contrato.autentique_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-2 h-3.5 w-3.5" />
                              Abrir no Autentique
                            </a>
                          </Button>
                        )}
                      </div>
                    )}
                  </section>
                </>
              )}

              <Separator />

              {/* Ações */}
              <section className="space-y-2">
                <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-3">
                  Ações
                </h3>
                
                {(contrato.status === 'rascunho' || contrato.status === 'pendente') && (
                  <Button 
                    onClick={handleEnviar} 
                    className="w-full"
                    disabled={sendToAutentique.isPending}
                  >
                    {sendToAutentique.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Enviar para Assinatura
                  </Button>
                )}

                {contrato.status === 'enviado' && (
                  <Button 
                    onClick={handleEnviar} 
                    variant="outline"
                    className="w-full"
                    disabled={sendToAutentique.isPending}
                  >
                    {sendToAutentique.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Reenviar Contrato
                  </Button>
                )}

                {contrato.status === 'assinado' && (
                  <Button onClick={handleAtivar} className="w-full">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Ativar Contrato
                  </Button>
                )}
              </section>
            </TabsContent>

            <TabsContent value="historico" className="mt-4">
              <ContratoTimeline contratoId={contrato.id} />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            Contrato não encontrado
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
