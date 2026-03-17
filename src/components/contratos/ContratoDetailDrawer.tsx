import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  FileText, CheckCircle, XCircle, Clock, Send, Pause, 
  ExternalLink, Phone, Mail, MapPin, Car, User, Link,
  RefreshCw, Loader2, Eye, Copy, MessageCircle, History, LinkIcon, Info, Edit2
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
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
import { useAutentiqueSyncContrato } from '@/hooks/useAutentiqueSyncContrato';
import { ContratoTimeline } from './ContratoTimeline';
import { ContratoEditForm } from './ContratoEditForm';
import { useGerarLinkAssociado, getAssociadoLinkUrl } from '@/hooks/useContratoLink';
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
  const { data: contrato, isLoading, refetch } = useContrato(contratoId || undefined);
  const updateContrato = useUpdateContrato();
  const updateLead = useUpdateLead();
  const createHistorico = useCreateLeadHistorico();
  const sendToAutentique = useSendToAutentique();
  const resendAutentique = useResendAutentique();
  const cancelAutentique = useCancelAutentique();
  const syncContrato = useAutentiqueSyncContrato();
  
  const gerarLink = useGerarLinkAssociado();
  
  // Estado para modo de edição
  const [editMode, setEditMode] = useState(false);
  
  // Permissões para ativação de propostas e edição
  const { isDiretor, isAnalistaCadastro, isDesenvolvedor, isAdminMaster } = usePermissions();
  const podeAtivarProposta = isDiretor || isAnalistaCadastro || isDesenvolvedor || isAdminMaster;
  const podeEditar = isDiretor || isDesenvolvedor || isAdminMaster;
  
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
    
    // PROTEÇÃO CONTRA DUPLICIDADE: Verificar se já foi enviado
    if (contrato.autentique_documento_id) {
      toast.info('Este contrato já foi enviado para assinatura');
      return;
    }
    
    const client = contrato.associados || contrato.leads;
    if (!client?.email) {
      toast.error('Email do associado não informado');
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

  const handleSyncAssinatura = async () => {
    if (!contrato?.id) return;
    await syncContrato.mutateAsync({ contratoId: contrato.id });
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

  // Handlers para link do associado
  const handleGerarLink = async () => {
    if (!contrato) return;
    await gerarLink.mutateAsync(contrato.id);
  };

  const handleCopiarLinkAssociado = () => {
    if (contrato?.link_token) {
      const url = getAssociadoLinkUrl(contrato.link_token);
      navigator.clipboard.writeText(url);
      toast.success('Link do associado copiado!');
    }
  };

  const handleEnviarLinkWhatsApp = () => {
    const client = contrato?.associados || contrato?.leads;
    const phone = client?.telefone;
    if (!phone || !contrato?.link_token) {
      toast.error('Telefone ou link não disponível');
      return;
    }
    const url = getAssociadoLinkUrl(contrato.link_token);
    const message = encodeURIComponent(
      `Olá ${client?.nome?.split(' ')[0]}! 👋\n\nAcesse o link abaixo para completar sua filiação:\n\n${url}\n\n*Próximos passos:*\n1️⃣ Escolha o tipo de vistoria\n2️⃣ Realize a vistoria\n3️⃣ Pague a taxa de filiação\n\nQualquer dúvida, estamos à disposição!`
    );
    window.open(`https://wa.me/55${phone.replace(/\D/g, '')}?text=${message}`, '_blank');
  };

  const status = contrato ? (statusConfig[contrato.status] || statusConfig.pendente) : null;
  const client = contrato?.associados || contrato?.leads;
  const lead = contrato?.leads;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[500px] sm:w-[600px] overflow-y-auto">
        {contratoId && (
          <>
            <SheetHeader className="space-y-4">
              <div className="flex items-center justify-between">
                <SheetTitle className="font-mono">{contrato?.numero}</SheetTitle>
                <div className="flex items-center gap-2">
                  {podeEditar && !editMode && contrato && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setEditMode(true)}
                    >
                      <Edit2 className="h-3.5 w-3.5 mr-1" />
                      Editar
                    </Button>
                  )}
                  {status && (
                    <Badge className={status.color}>
                      <status.icon className="mr-1 h-3 w-3" />
                      {status.label}
                    </Badge>
                  )}
                </div>
              </div>
            </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : contrato ? (
          editMode ? (
            <div className="mt-6">
              <ContratoEditForm 
                contrato={contrato}
                onCancel={() => setEditMode(false)}
                onSuccess={() => {
                  setEditMode(false);
                  refetch();
                }}
              />
            </div>
          ) : (
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
                    <span className="text-muted-foreground">Taxa de Filiação:</span>
                    <p>{formatCurrency(contrato.valor_adesao)}</p>
                  </div>
                  {/* Só exibe dia de vencimento após contrato assinado/ativo */}
                  {(contrato.status === 'assinado' || contrato.status === 'ativo') && contrato.dia_vencimento && (
                    <div>
                      <span className="text-muted-foreground">Dia Vencimento:</span>
                      <p>Dia {contrato.dia_vencimento}</p>
                    </div>
                  )}
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

              {/* WhatsApp Status */}
              {((contrato as any).whatsapp_enviado || (contrato as any).whatsapp_erro) && (
                <>
                  <Separator />
                  <section>
                    <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp Assinatura
                    </h3>
                    <div className="flex items-center gap-2 text-sm">
                      {(contrato as any).whatsapp_enviado ? (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Enviado
                        </Badge>
                      ) : (contrato as any).whatsapp_erro ? (
                        <Badge className="bg-red-100 text-red-800">
                          <XCircle className="mr-1 h-3 w-3" />
                          Erro no envio
                        </Badge>
                      ) : null}
                      {(contrato as any).whatsapp_enviado_em && (
                        <span className="text-muted-foreground text-xs">
                          {formatDateTime((contrato as any).whatsapp_enviado_em)}
                        </span>
                      )}
                    </div>
                    {(contrato as any).whatsapp_erro && (
                      <p className="text-xs text-destructive mt-1">{(contrato as any).whatsapp_erro}</p>
                    )}
                  </section>
                </>
              )}

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
                {contrato.veiculo_marca || contrato.veiculo_placa ? (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Marca/Modelo:</span>
                      <p>{contrato.veiculo_marca} {contrato.veiculo_modelo}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Ano:</span>
                      <p>{contrato.veiculo_ano || '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Placa:</span>
                      <p className="font-mono">{contrato.veiculo_placa || '-'}</p>
                    </div>
                    {contrato.veiculo_cor && (
                      <div>
                        <span className="text-muted-foreground">Cor:</span>
                        <p>{contrato.veiculo_cor}</p>
                      </div>
                    )}
                    {contrato.veiculo_renavam && (
                      <div>
                        <span className="text-muted-foreground">Renavam:</span>
                        <p className="font-mono">{contrato.veiculo_renavam}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Valor FIPE:</span>
                      <p>{contrato.veiculo_valor_fipe ? formatCurrency(contrato.veiculo_valor_fipe) : '-'}</p>
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

                            {/* Botão de Sincronização Manual */}
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="w-full border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950"
                              onClick={handleSyncAssinatura}
                              disabled={syncContrato.isPending}
                            >
                              {syncContrato.isPending ? (
                                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                              )}
                              Sincronizar Assinatura
                            </Button>

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
                                    Esta ação cancelará o documento no Autentique. O associado não poderá mais assinar esta proposta.
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
                          <Button
                            variant="default"
                            size="sm"
                            className="w-full"
                            onClick={async () => {
                              try {
                                toast.info('Baixando documento...');
                                const { data, error } = await supabase.functions.invoke('autentique-download', {
                                  body: { documentId: contrato.autentique_documento_id },
                                });
                                if (error) throw error;
                                const blob = new Blob([data], { type: 'application/pdf' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `contrato-${contrato.id}.pdf`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                              } catch {
                                toast.error('Erro ao baixar documento');
                              }
                            }}
                          >
                            <FileText className="mr-2 h-3.5 w-3.5" />
                            Baixar Documento Assinado
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

              {/* Status do Link/Vistoria - Se link foi gerado */}
              {contrato.link_gerado_em && (
                <>
                  <Separator />
                  <section>
                    <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                      <LinkIcon className="h-4 w-4" />
                      Status do Associado
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Link gerado em:</span>
                        <span>{formatDateTime(contrato.link_gerado_em)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tipo de Vistoria:</span>
                        <Badge variant="outline">
                          {contrato.tipo_vistoria === 'agendada' ? 'Agendada' : 
                           contrato.tipo_vistoria === 'autovistoria' ? 'Autovistoria' : 
                           'Não selecionado'}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Adesão:</span>
                        <Badge variant={contrato.adesao_paga ? "default" : "secondary"} 
                               className={contrato.adesao_paga ? "bg-green-600" : ""}>
                          {contrato.adesao_paga ? 'Paga' : 'Pendente'}
                        </Badge>
                      </div>
                    </div>
                  </section>
                </>
              )}

              <Separator />

              {/* Ações */}
              <section className="space-y-2">
                <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-3">
                  Ações
                </h3>
                
                {/* Link NÃO gerado - Mostrar botão "Gerar Link do Associado" */}
                {(contrato.status === 'rascunho' || contrato.status === 'pendente') && !contrato.link_gerado_em && (
                  <Button 
                    onClick={handleGerarLink} 
                    className="w-full"
                    disabled={gerarLink.isPending}
                  >
                    {gerarLink.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <LinkIcon className="mr-2 h-4 w-4" />
                    )}
                    Gerar Link do Associado
                  </Button>
                )}

                {/* Link JÁ gerado - Mostrar opções de copiar/acessar */}
                {contrato.link_token && contrato.link_gerado_em && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={handleCopiarLinkAssociado}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Copiar Link
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={handleEnviarLinkWhatsApp}
                        title="Enviar link via WhatsApp"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button 
                      variant="outline"
                      className="w-full"
                      onClick={() => window.open(getAssociadoLinkUrl(contrato.link_token!), '_blank')}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Acessar Link do Associado
                    </Button>
                  </div>
                )}

                {/* Status da Assinatura - quando já foi enviado */}
                {(contrato.autentique_documento_id || ['pendente_assinatura', 'enviado', 'visualizado'].includes(contrato.status)) && (
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Status da Assinatura</span>
                      <Badge className={
                        contrato.status === 'assinado' ? 'bg-green-100 text-green-800' :
                        contrato.status === 'visualizado' ? 'bg-indigo-100 text-indigo-800' :
                        'bg-yellow-100 text-yellow-800'
                      }>
                        {contrato.status === 'visualizado' && <Eye className="mr-1 h-3 w-3" />}
                        {contrato.status === 'pendente_assinatura' && <Clock className="mr-1 h-3 w-3" />}
                        {contrato.status === 'enviado' && <Send className="mr-1 h-3 w-3" />}
                        {contrato.status === 'assinado' && <CheckCircle className="mr-1 h-3 w-3" />}
                        {contrato.status === 'visualizado' ? 'Visualizado' :
                         contrato.status === 'assinado' ? 'Assinado' :
                         'Aguardando Assinatura'}
                      </Badge>
                    </div>
                    {contrato.updated_at && (contrato.autentique_documento_id || ['pendente_assinatura', 'enviado'].includes(contrato.status)) && (
                      <p className="text-xs text-muted-foreground">
                        Atualizado em: {new Date(contrato.updated_at).toLocaleString('pt-BR')}
                      </p>
                    )}
                  </div>
                )}

                {/* Enviar para Assinatura - SOMENTE quando nunca foi enviado */}
                {contrato.adesao_paga && 
                 !contrato.autentique_documento_id && 
                 !['pendente_assinatura', 'enviado', 'visualizado', 'assinado', 'ativo'].includes(contrato.status) && (
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

                {/* Reenviar - quando já foi enviado mas não assinado */}
                {(contrato.autentique_documento_id || ['pendente_assinatura', 'enviado', 'visualizado'].includes(contrato.status)) &&
                 !['assinado', 'ativo', 'cancelado'].includes(contrato.status) && (
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

              </section>
            </TabsContent>

            <TabsContent value="historico" className="mt-4">
              <ContratoTimeline contratoId={contrato.id} />
            </TabsContent>
          </Tabs>
          )
        ) : (
          <div className="text-center text-muted-foreground py-8">
            Proposta não encontrada
          </div>
        )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
