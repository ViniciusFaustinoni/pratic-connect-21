import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Send, Check, X, Eye, Car, Phone, User, ClipboardCopy, ExternalLink, Link2, FileDown, Mail, FileSignature, Loader2, Calendar, DollarSign, Shield, MapPin, Copy } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/UserAvatar';
import { CotacaoTimeline } from '@/components/cotacoes/CotacaoTimeline';
import type { CotacaoWithRelations } from '@/hooks/useCotacoes';
import type { StatusCotacao } from '@/types/database';
import { toast } from 'sonner';
import { getEtapaVenda } from './CotacoesTable';

type StatusCotacaoExtended = StatusCotacao | 'visualizada';

const statusConfig: Record<StatusCotacaoExtended, { 
  label: string; 
  color: string;
  bgColor: string;
  icon: typeof FileText 
}> = {
  rascunho: { 
    label: 'Rascunho', 
    color: 'text-yellow-600 dark:text-yellow-400', 
    bgColor: 'bg-yellow-500/20',
    icon: FileText 
  },
  enviada: { 
    label: 'Enviada', 
    color: 'text-blue-600 dark:text-blue-400', 
    bgColor: 'bg-blue-500/20',
    icon: Send 
  },
  visualizada: { 
    label: 'Visualizada', 
    color: 'text-cyan-600 dark:text-cyan-400', 
    bgColor: 'bg-cyan-500/20',
    icon: Eye 
  },
  aceita: { 
    label: 'Aceita', 
    color: 'text-green-600 dark:text-green-400', 
    bgColor: 'bg-green-500/20',
    icon: Check 
  },
  recusada: { 
    label: 'Recusada', 
    color: 'text-red-600 dark:text-red-400', 
    bgColor: 'bg-red-500/20',
    icon: X 
  },
  expirada: { 
    label: 'Expirada', 
    color: 'text-muted-foreground', 
    bgColor: 'bg-muted',
    icon: FileText 
  },
};

const etapaVendaConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  cotacao_realizada: { label: 'Cotação Realizada', color: 'text-slate-600 dark:text-slate-400', bgColor: 'bg-slate-500/20' },
  escolhendo_plano: { label: 'Escolhendo Plano', color: 'text-sky-600 dark:text-sky-400', bgColor: 'bg-sky-500/20' },
  enviando_documentos: { label: 'Enviando Documentos', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-500/20' },
  escolha_vistoria: { label: 'Escolha de Vistoria', color: 'text-indigo-600 dark:text-indigo-400', bgColor: 'bg-indigo-500/20' },
  realizando_pagamento: { label: 'Realizando Pagamento', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-500/20' },
  assinando_contrato: { label: 'Assinando Contrato', color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-500/20' },
  vistoria_agendada: { label: 'Vistoria Agendada', color: 'text-violet-600 dark:text-violet-400', bgColor: 'bg-violet-500/20' },
  instalacao_agendada: { label: 'Instalação Agendada', color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-500/20' },
  realizando_vistoria: { label: 'Realizando Vistoria', color: 'text-cyan-600 dark:text-cyan-400', bgColor: 'bg-cyan-500/20' },
  vistoria_realizada: { label: 'Vistoria Realizada', color: 'text-teal-600 dark:text-teal-400', bgColor: 'bg-teal-500/20' },
  em_analise: { label: 'Em Análise', color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-500/20' },
  associado_ativo: { label: 'Associado Ativo', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-500/20' },
};

interface CotacaoDetalhesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cotacao: CotacaoWithRelations | null;
  onCopiarWhatsApp: (cotacao: CotacaoWithRelations) => void;
  onPdf: (cotacao: CotacaoWithRelations) => void;
  onEmail: (cotacao: CotacaoWithRelations) => void;
  onGerarContrato: (id: string) => void;
  onAceitar: (id: string) => void;
  onDuplicar?: (cotacao: CotacaoWithRelations) => void;
  isCopiandoWhatsApp: boolean;
  isGerandoContrato: boolean;
  canGenerateContract: boolean;
  canSend: boolean;
}

export function CotacaoDetalhesModal({
  open,
  onOpenChange,
  cotacao,
  onCopiarWhatsApp,
  onPdf,
  onEmail,
  onGerarContrato,
  onAceitar,
  onDuplicar,
  isCopiandoWhatsApp,
  isGerandoContrato,
  canGenerateContract,
  canSend,
}: CotacaoDetalhesModalProps) {
  if (!cotacao) return null;

  const status = statusConfig[cotacao.status as StatusCotacaoExtended] || statusConfig.rascunho;
  const etapaVenda = getEtapaVenda(cotacao);
  const etapaInfo = etapaVenda ? etapaVendaConfig[etapaVenda] : null;

  const formatPhone = (phone?: string | null) => {
    if (!phone) return null;
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0,2)}) ${cleaned.slice(2,7)}-${cleaned.slice(7)}`;
    }
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0,2)}) ${cleaned.slice(2,6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const planosComparacao = cotacao.dados_extras?.planos_comparacao as Array<{
    id: string;
    nome: string;
    valorMensal: number;
    coberturas?: string[];
  }> | undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-xl">Cotação {cotacao.numero}</DialogTitle>
              <DialogDescription className="mt-1">
                Criada {formatDistanceToNow(new Date(cotacao.created_at), { addSuffix: true, locale: ptBR })}
              </DialogDescription>
            </div>
            <div className="flex flex-col gap-1 items-end">
              <Badge className={cn(status.bgColor, status.color, "font-medium border-0")}>
                <status.icon className="h-3 w-3 mr-1" />
                {status.label.toUpperCase()}
              </Badge>
              {etapaInfo && (
                <Badge className={cn(etapaInfo.bgColor, etapaInfo.color, "font-medium border-0 text-[10px]")}>
                  {etapaInfo.label}
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(90vh-200px)]">
          <div className="px-6 pb-6 space-y-6">
            {/* Ações principais */}
            <div className="flex flex-wrap gap-2">
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => onCopiarWhatsApp(cotacao)}
                disabled={isCopiandoWhatsApp || !canSend}
              >
                {isCopiandoWhatsApp ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <ClipboardCopy className="h-4 w-4 mr-2" />
                    Copiar para WhatsApp
                  </>
                )}
              </Button>
              
              <Button variant="outline" onClick={() => onPdf(cotacao)}>
                <FileDown className="h-4 w-4 mr-2" />
                PDF
              </Button>
              
              {cotacao.leads?.email && (
                <Button variant="outline" onClick={() => onEmail(cotacao)}>
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
              )}
              
              {cotacao.token_publico && (
                <>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      const link = `${window.location.origin}/cotacao/${cotacao.token_publico}`;
                      window.open(link, '_blank');
                    }}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Acessar Link
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      const link = `${window.location.origin}/cotacao/${cotacao.token_publico}`;
                      navigator.clipboard.writeText(link);
                      toast.success('Link copiado!');
                    }}
                  >
                    <Link2 className="h-4 w-4 mr-2" />
                    Copiar Link
                  </Button>
                </>
              )}
              
              {cotacao.status === 'aceita' && !cotacao.contrato && canGenerateContract && (
                <Button 
                  onClick={() => onGerarContrato(cotacao.id)}
                  disabled={isGerandoContrato}
                >
                  {isGerandoContrato ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <FileSignature className="h-4 w-4 mr-2" />
                      Gerar Contrato
                    </>
                  )}
                </Button>
              )}
              
              {cotacao.status === 'enviada' && (
                <Button variant="outline" onClick={() => onAceitar(cotacao.id)}>
                  <Check className="h-4 w-4 mr-2" />
                  Marcar Aceita
                </Button>
              )}
              
              {onDuplicar && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    onDuplicar(cotacao);
                    onOpenChange(false);
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicar
                </Button>
              )}
            </div>
            
            <Separator />
            
            {/* Informações do Cliente */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <User className="h-4 w-4" />
                Cliente
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-muted/30">
                <div>
                  <p className="text-sm text-muted-foreground">Nome</p>
                  <p className="font-medium">{cotacao.leads?.nome || cotacao.nome_solicitante || 'Não informado'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Telefone</p>
                  <p className="font-medium">{formatPhone(cotacao.leads?.telefone || cotacao.telefone1_solicitante) || 'Não informado'}</p>
                </div>
                {(cotacao.leads?.email || cotacao.email_solicitante) && (
                  <div className="sm:col-span-2">
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{cotacao.leads?.email || cotacao.email_solicitante}</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Informações do Veículo */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Car className="h-4 w-4" />
                Veículo
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-muted/30">
                <div>
                  <p className="text-sm text-muted-foreground">Marca</p>
                  <p className="font-medium">{cotacao.veiculo_marca}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Modelo</p>
                  <p className="font-medium">{cotacao.veiculo_modelo}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ano</p>
                  <p className="font-medium">{cotacao.veiculo_ano}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Placa</p>
                  <p className="font-medium">{cotacao.veiculo_placa || 'Não informada'}</p>
                </div>
              </div>
            </div>
            
            {/* Valores */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Valores
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-lg bg-muted/30">
                <div>
                  <p className="text-sm text-muted-foreground">Valor FIPE</p>
                  <p className="font-bold text-lg">{formatCurrency(cotacao.valor_fipe)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Mensalidade</p>
                  <p className="font-bold text-lg text-primary">{formatCurrency(cotacao.valor_total_mensal)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Taxa de Adesão</p>
                  <p className="font-bold text-lg">{formatCurrency(cotacao.valor_adesao || 0)}</p>
                </div>
              </div>
            </div>
            
            {/* Planos Comparados */}
            {planosComparacao && planosComparacao.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Planos Comparados
                </h3>
                <div className="grid gap-3">
                  {planosComparacao.map((plano) => (
                    <div key={plano.id} className="p-4 rounded-lg border bg-card">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium">{plano.nome}</p>
                        <p className="font-bold text-primary">{formatCurrency(plano.valorMensal)}/mês</p>
                      </div>
                      {plano.coberturas && plano.coberturas.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {plano.coberturas.slice(0, 5).map((cob, idx) => (
                            <Badge key={idx} variant="outline" className="text-[10px]">
                              {cob}
                            </Badge>
                          ))}
                          {plano.coberturas.length > 5 && (
                            <Badge variant="outline" className="text-[10px]">
                              +{plano.coberturas.length - 5}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Vistoria Agendada */}
            {cotacao.vistoria_data_agendada && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Vistoria Agendada
                </h3>
                <div className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/20">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Data</p>
                      <p className="font-medium">{format(new Date(cotacao.vistoria_data_agendada), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
                    </div>
                    {cotacao.vistoria_horario_agendado && (
                      <div>
                        <p className="text-sm text-muted-foreground">Horário</p>
                        <p className="font-medium">{cotacao.vistoria_horario_agendado}</p>
                      </div>
                    )}
                    {cotacao.tipo_vistoria && (
                      <div>
                        <p className="text-sm text-muted-foreground">Tipo</p>
                        <Badge variant="outline">
                          {cotacao.tipo_vistoria === 'autovistoria' ? 'Autovistoria' : 'Presencial'}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Consultor */}
            {cotacao.vendedor?.nome && (
              <div>
                <h3 className="font-semibold mb-3">Consultor</h3>
                <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30">
                  <UserAvatar name={cotacao.vendedor.nome} size="md" />
                  <span className="font-medium">{cotacao.vendedor.nome}</span>
                </div>
              </div>
            )}
            
            {/* Timeline */}
            <div>
              <h3 className="font-semibold mb-3">Histórico</h3>
              <CotacaoTimeline cotacao={cotacao} />
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
