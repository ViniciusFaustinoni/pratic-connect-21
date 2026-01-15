import { useNavigate } from 'react-router-dom';
import { FileText, Send, Check, X, MessageCircle, FileDown, Mail, FileSignature, Eye, Link2, Copy, Trash2, MoreHorizontal, Car, User, Phone, RefreshCw, ClipboardCopy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { StatusCotacao } from '@/types/database';
import type { CotacaoWithRelations } from '@/hooks/useCotacoes';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/UserAvatar';

type StatusCotacaoExtended = StatusCotacao | 'visualizada';

const statusConfig: Record<StatusCotacaoExtended, { 
  label: string; 
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof FileText 
}> = {
  rascunho: { 
    label: 'Rascunho', 
    color: 'text-yellow-600 dark:text-yellow-400', 
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-l-yellow-500',
    icon: FileText 
  },
  enviada: { 
    label: 'Enviada', 
    color: 'text-blue-600 dark:text-blue-400', 
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-l-blue-500',
    icon: Send 
  },
  visualizada: { 
    label: 'Visualizada', 
    color: 'text-cyan-600 dark:text-cyan-400', 
    bgColor: 'bg-cyan-500/20',
    borderColor: 'border-l-cyan-500',
    icon: Eye 
  },
  aceita: { 
    label: 'Aceita', 
    color: 'text-green-600 dark:text-green-400', 
    bgColor: 'bg-green-500/20',
    borderColor: 'border-l-green-500',
    icon: Check 
  },
  recusada: { 
    label: 'Recusada', 
    color: 'text-red-600 dark:text-red-400', 
    bgColor: 'bg-red-500/20',
    borderColor: 'border-l-red-500',
    icon: X 
  },
  expirada: { 
    label: 'Expirada', 
    color: 'text-muted-foreground', 
    bgColor: 'bg-muted',
    borderColor: 'border-l-muted-foreground',
    icon: FileText 
  },
};

interface CotacaoCardProps {
  cotacao: CotacaoWithRelations;
  tipo: 'andamento' | 'fechada';
  navigate: ReturnType<typeof useNavigate>;
  formatRelativeTime: (dateStr: string) => string;
  formatPhone: (phone?: string | null) => string | null;
  formatCurrency: (value: number) => string;
  onVincular: (cotacao: CotacaoWithRelations) => void;
  onWhatsApp: (cotacao: CotacaoWithRelations) => void;
  onEmail: (cotacao: CotacaoWithRelations) => void;
  onAceitar: (cotacaoId: string) => void;
  onPdf: (cotacao: CotacaoWithRelations) => void;
  onDuplicar: (cotacao: CotacaoWithRelations) => void;
  onExcluir: (id: string) => void;
  onGerarContrato?: (id: string) => void;
  isGerandoContrato?: boolean;
  onCopiarWhatsApp?: (cotacao: CotacaoWithRelations) => void;
}

export function CotacaoCard({
  cotacao,
  tipo,
  navigate,
  formatRelativeTime,
  formatPhone,
  formatCurrency,
  onVincular,
  onWhatsApp,
  onEmail,
  onAceitar,
  onPdf,
  onDuplicar,
  onExcluir,
  onGerarContrato,
  isGerandoContrato = false,
  onCopiarWhatsApp,
}: CotacaoCardProps) {
  const status = statusConfig[cotacao.status as StatusCotacaoExtended] || statusConfig.rascunho;
  const hasLead = !!cotacao.lead_id;
  const isWithoutLead = !hasLead && cotacao.status === 'rascunho';
  const vendedorNome = cotacao.vendedor?.nome;
  
  // Cores de fundo baseadas no tipo
  const getBgClass = () => {
    if (tipo === 'andamento') {
      if (isWithoutLead) return 'border-l-orange-500 bg-orange-500/5';
      return 'border-l-yellow-500 bg-yellow-500/5';
    }
    if (cotacao.status === 'aceita') return 'border-l-green-500 bg-green-500/5';
    if (cotacao.status === 'recusada') return 'border-l-red-500 bg-red-500/5';
    return status.borderColor;
  };

  return (
    <Card 
      className={cn(
        "overflow-hidden border-l-4 transition-all hover:shadow-md cursor-pointer",
        getBgClass()
      )}
      onClick={() => navigate(`/vendas/cotacoes/${cotacao.id}`)}
    >
      {/* Header do Card: Status + Vendedor + Tempo */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/30">
        <div className="flex items-center gap-3">
          <Badge className={cn(status.bgColor, status.color, "font-medium border-0")}>
            <status.icon className="h-3 w-3 mr-1" />
            {isWithoutLead ? 'SEM LEAD' : status.label.toUpperCase()}
          </Badge>
          {vendedorNome && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <UserAvatar name={vendedorNome} size="sm" />
              <span className="hidden sm:inline">{vendedorNome}</span>
            </div>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {formatRelativeTime(cotacao.created_at)}
        </span>
      </div>
      
      <CardContent className="p-4">
        {/* Conteúdo Principal: Lead + Veículo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {/* Coluna Lead */}
          <div className="flex items-start gap-3">
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-medium",
              hasLead ? "bg-primary/10 text-primary" : "bg-orange-500/10 text-orange-500"
            )}>
              {hasLead ? cotacao.leads?.nome?.charAt(0).toUpperCase() : <User className="h-5 w-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn(
                "font-semibold text-lg truncate",
                !hasLead && "text-orange-600 dark:text-orange-400"
              )}>
                {cotacao.leads?.nome || 'Sem lead vinculado'}
              </p>
              {hasLead && cotacao.leads?.telefone ? (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {formatPhone(cotacao.leads.telefone)}
                </p>
              ) : !hasLead && (
                <Button
                  size="sm"
                  variant="link"
                  className="p-0 h-auto text-orange-600 dark:text-orange-400"
                  onClick={(e) => {
                    e.stopPropagation();
                    onVincular(cotacao);
                  }}
                >
                  <Link2 className="h-3 w-3 mr-1" />
                  Vincular Lead
                </Button>
              )}
            </div>
          </div>
          
          {/* Coluna Veículo */}
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Car className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {cotacao.veiculo_marca} {cotacao.veiculo_modelo} {cotacao.veiculo_ano}
              </p>
              <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
                {cotacao.veiculo_placa && (
                  <Badge variant="outline" className="font-mono text-xs">
                    {cotacao.veiculo_placa}
                  </Badge>
                )}
                {cotacao.leads?.nome && (
                  <span className="text-xs text-primary font-medium truncate max-w-[150px]">
                    {cotacao.leads.nome}
                  </span>
                )}
                {!cotacao.veiculo_placa && !cotacao.leads?.nome && (
                  <span>Placa não informada</span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Valores */}
        <div className="flex flex-wrap gap-4 sm:gap-8 text-sm mb-4">
          <div>
            <span className="text-muted-foreground">FIPE: </span>
            <span className="font-medium">{formatCurrency(cotacao.valor_fipe)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Mensal: </span>
            <span className="font-semibold text-primary text-base">
              {formatCurrency(cotacao.valor_total_mensal)}
            </span>
          </div>
        </div>
        
        <Separator className="my-3" />
        
        {/* Ações */}
        <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => navigate(`/vendas/cotacoes/${cotacao.id}`)}
          >
            <FileText className="h-4 w-4 mr-1" />
            Ver Detalhes
          </Button>
          
          {/* Ações por Status */}
          {cotacao.status === 'rascunho' && hasLead && (
            <>
              <Button size="sm" variant="outline" onClick={() => onWhatsApp(cotacao)}>
                <MessageCircle className="h-4 w-4 mr-1 text-green-600" />
                WhatsApp
              </Button>
              <Button size="sm" variant="outline" onClick={() => onEmail(cotacao)}>
                <Mail className="h-4 w-4 mr-1 text-blue-600" />
                Email
              </Button>
            </>
          )}
          
          {cotacao.status === 'rascunho' && !hasLead && onCopiarWhatsApp && (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => onCopiarWhatsApp(cotacao)}
            >
              <ClipboardCopy className="h-4 w-4 mr-1" />
              Copiar para WhatsApp
            </Button>
          )}
          
          {cotacao.status === 'rascunho' && !hasLead && onGerarContrato && (
            <Button 
              size="sm"
              variant="outline"
              onClick={() => onGerarContrato(cotacao.id)}
              disabled={isGerandoContrato}
            >
              <FileSignature className="h-4 w-4 mr-1" />
              {isGerandoContrato ? 'Gerando...' : 'Gerar Proposta'}
            </Button>
          )}
          
          {cotacao.status === 'enviada' && (
            <>
              <Button size="sm" variant="outline" onClick={() => onWhatsApp(cotacao)}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Reenviar
              </Button>
              <Button size="sm" onClick={() => onAceitar(cotacao.id)}>
                <Check className="h-4 w-4 mr-1" />
                Aceitar
              </Button>
            </>
          )}
          
          {cotacao.status === 'aceita' && onGerarContrato && !cotacao.contrato && (
            <Button 
              size="sm"
              onClick={() => onGerarContrato(cotacao.id)}
              disabled={isGerandoContrato}
            >
              <FileSignature className="h-4 w-4 mr-1" />
              {isGerandoContrato ? 'Gerando...' : 'Gerar Proposta'}
            </Button>
          )}
          
          {cotacao.status === 'aceita' && cotacao.contrato && (
            <Button 
              size="sm"
              variant="outline"
              onClick={() => navigate('/vendas/contratos', { 
                state: { openContrato: cotacao.contrato!.id } 
              })}
            >
              <FileSignature className="h-4 w-4 mr-1" />
              Ver Contrato
            </Button>
          )}
          
          {/* Menu de ações extras */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="px-2">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onPdf(cotacao)}>
                <FileDown className="h-4 w-4 mr-2" />
                Baixar PDF
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-destructive focus:text-destructive"
                onClick={() => onExcluir(cotacao.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}