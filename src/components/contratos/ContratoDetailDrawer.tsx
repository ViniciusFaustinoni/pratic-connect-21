import { 
  FileText, CheckCircle, XCircle, Clock, Send, Pause, 
  ExternalLink, Phone, Mail, MapPin, Car, User
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useContrato, useUpdateContrato } from '@/hooks/useContratos';
import { useUpdateLead } from '@/hooks/useLeads';
import { useCreateLeadHistorico } from '@/hooks/useLeadHistorico';
import { toast } from 'sonner';
import type { StatusContrato } from '@/types/database';

const statusConfig: Record<StatusContrato, { label: string; color: string; icon: typeof FileText }> = {
  rascunho: { label: 'Rascunho', color: 'bg-gray-100 text-gray-800', icon: FileText },
  pendente: { label: 'Pendente', color: 'bg-gray-100 text-gray-800', icon: Clock },
  enviado: { label: 'Enviado', color: 'bg-yellow-100 text-yellow-800', icon: Send },
  assinado: { label: 'Assinado', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  ativo: { label: 'Ativo', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  suspenso: { label: 'Suspenso', color: 'bg-orange-100 text-orange-800', icon: Pause },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-800', icon: XCircle },
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const handleEnviar = async () => {
    if (!contrato) return;
    try {
      await updateContrato.mutateAsync({
        id: contrato.id,
        status: 'enviado',
      });

      if (contrato.lead_id) {
        await updateLead.mutateAsync({
          id: contrato.lead_id,
          etapa: 'contrato_enviado',
        });
        
        await createHistorico.mutateAsync({
          lead_id: contrato.lead_id,
          acao: 'contrato_enviado',
          descricao: `Contrato ${contrato.numero} enviado para assinatura`,
          etapa_nova: 'contrato_enviado',
        });
      }

      toast.success('Contrato enviado!');
    } catch (error) {
      toast.error('Erro ao enviar contrato');
    }
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

  if (!contratoId) return null;

  const status = contrato ? statusConfig[contrato.status] : null;
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
          <div className="mt-6 space-y-6">
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

            {/* Documento Autentique */}
            {contrato.autentique_url && (
              <>
                <Separator />
                <section>
                  <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-3">
                    Documento
                  </h3>
                  <Button asChild variant="outline" className="w-full">
                    <a href={contrato.autentique_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Abrir no Autentique
                    </a>
                  </Button>
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
                <Button onClick={handleEnviar} className="w-full">
                  <Send className="mr-2 h-4 w-4" />
                  Enviar para Assinatura
                </Button>
              )}

              {contrato.status === 'assinado' && (
                <Button onClick={handleAtivar} className="w-full">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Ativar Contrato
                </Button>
              )}

              {contrato.status === 'enviado' && contrato.autentique_url && (
                <Button asChild variant="outline" className="w-full">
                  <a href={contrato.autentique_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Ver Documento
                  </a>
                </Button>
              )}
            </section>
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            Contrato não encontrado
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}