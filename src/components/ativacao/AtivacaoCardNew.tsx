import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/alert-dialog";
import { 
  CheckCircle2, 
  Phone,
  Car,
  User,
  Send,
  FileText,
  ClipboardCheck,
  Trash2,
  ShieldAlert
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AtivacaoContrato } from "@/hooks/useAtivacoes";
import { AtivacaoStatusBadge, StatusMiniCard } from "./AtivacaoStatusBadge";
import { BotaoEnviarSGA } from "./BotaoEnviarSGA";
import { toast } from "sonner";

interface AtivacaoCardNewProps {
  contrato: AtivacaoContrato;
  onAtivar: () => void;
  onClickRequisito: (tipo: 'proposta' | 'vistoria') => void;
  onExcluir?: () => void;
  canDelete?: boolean;
  isAtivando?: boolean;
  isExcluindo?: boolean;
}

export function AtivacaoCardNew({ 
  contrato, 
  onAtivar, 
  onClickRequisito,
  onExcluir,
  canDelete,
  isAtivando,
  isExcluindo
}: AtivacaoCardNewProps) {
  const isAtivado = contrato.status === 'ativo';
  const propostaAssinada = !!contrato.data_assinatura || isAtivado; // Se ativado, considera assinado
  const isAutovistoria = contrato.vistoria?.modalidade === 'autovistoria';
  
  // Se contrato está ativo, vistoria foi aprovada (implicitamente)
  // Caso contrário, verificar status da vistoria
  // Para autovistoria E presencial: em_analise ou aprovada são considerados OK
  const vistoriaOk = isAtivado 
    ? true 
    : ['em_analise', 'aprovada'].includes(contrato.vistoria?.status || '');
  
  const requisitos = (propostaAssinada ? 1 : 0) + (vistoriaOk ? 1 : 0);
  const progressValue = (requisitos / 2) * 100;

  // Priorizar dados do contrato, fallback para lead
  const nomeCliente = contrato.cliente_nome || contrato.lead?.nome || 'Cliente não informado';
  const telefoneCliente = contrato.cliente_telefone || contrato.lead?.telefone;
  const veiculoMarca = contrato.veiculo_marca || contrato.lead?.veiculo_marca;
  const veiculoModelo = contrato.veiculo_modelo || contrato.lead?.veiculo_modelo;
  const veiculoPlaca = contrato.veiculo_placa || contrato.lead?.veiculo_placa;

  // Lógica para exibir botão SGA
  const podeEnviarSGA = isAtivado && 
    contrato.veiculo && 
    contrato.associado_id &&
    !contrato.veiculo.sincronizado_hinova;

  // Detectar se é plano apenas roubo/furto (sem colisão)
  const isRouboFurtoApenas = contrato.plano?.coberturas?.some(
    c => c.toLowerCase().includes('roubo')
  ) && !contrato.plano?.coberturas?.some(
    c => c.toLowerCase().includes('colisão') || c.toLowerCase().includes('colisao')
  );

  // Determinar cor do status
  const getStatusColor = () => {
    if (isAtivado) return 'border-l-blue-500';
    if (requisitos === 2) return 'border-l-emerald-500';
    if (requisitos === 1) return 'border-l-amber-500';
    return 'border-l-red-500';
  };

  const getStatusBg = () => {
    if (isAtivado) return 'bg-blue-500/5';
    if (requisitos === 2) return 'bg-emerald-500/5';
    if (requisitos === 1) return 'bg-amber-500/5';
    return 'bg-red-500/5';
  };

  const handleEnviarLembrete = () => {
    toast.success('Lembrete de assinatura enviado!', {
      description: `Lembrete enviado para ${nomeCliente}`
    });
  };

  const handleVerProposta = () => {
    onClickRequisito('proposta');
  };

  const handleVerVistoria = () => {
    onClickRequisito('vistoria');
  };

  return (
    <Card className={cn(
      "border-l-4 transition-all hover:shadow-md",
      getStatusColor(),
      getStatusBg()
    )}>
      <CardContent className="p-5 space-y-4">
        {/* Header com nome e badge de status */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <h3 className="font-semibold text-base">
                {nomeCliente}
              </h3>
            </div>
            
            <div className="flex items-center gap-1.5">
              {/* Badge de status */}
              {!isAtivado && (
              <AtivacaoStatusBadge
                  vistoriaRealizada={vistoriaOk}
                  assinaturaRealizada={propostaAssinada}
                  dataVistoria={contrato.vistoria?.data_aprovacao}
                  dataAssinatura={contrato.data_assinatura}
                  variant="compact"
                  modalidadeVistoria={contrato.vistoria?.modalidade}
                  vistoriaStatus={contrato.vistoria?.status}
                  onEnviarLembrete={handleEnviarLembrete}
                  onVerProposta={handleVerProposta}
                />
              )}
              {isAtivado && (
                <div className="inline-flex items-center gap-1.5 rounded-md border-2 px-2.5 py-1 text-xs font-medium shadow-sm bg-blue-50 border-blue-500 text-blue-800">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Ativado</span>
                </div>
              )}
              
              {/* Botão de excluir - apenas para diretores e admin master */}
              {canDelete && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      disabled={isExcluindo}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir Ativação Completa</AlertDialogTitle>
                      <AlertDialogDescription asChild>
                        <div className="space-y-3">
                          <p>Tem certeza que deseja excluir esta ativação? <strong>Esta ação não pode ser desfeita.</strong></p>
                          
                          <div className="bg-muted rounded-md p-3 text-sm">
                            <p><strong>Contrato:</strong> {contrato.numero}</p>
                            <p><strong>Cliente:</strong> {nomeCliente}</p>
                          </div>
                          
                          <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
                            <p className="font-medium mb-1">⚠️ Serão excluídos também:</p>
                            <ul className="list-disc list-inside space-y-0.5 text-xs">
                              <li>Documento no Autentique (se houver)</li>
                              <li>Cotação vinculada</li>
                              <li>Cobranças e histórico</li>
                              <li>Vistorias relacionadas</li>
                              <li>Associado (se não tiver outros contratos)</li>
                            </ul>
                          </div>
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onExcluir?.()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isExcluindo ? 'Excluindo...' : 'Excluir'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            {telefoneCliente && (
              <div className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                <span>{telefoneCliente}</span>
              </div>
            )}
            {(veiculoMarca || veiculoModelo) && (
              <div className="flex items-center gap-1">
                <Car className="h-3.5 w-3.5" />
                <span>
                  {[veiculoMarca, veiculoModelo, veiculoPlaca]
                    .filter(Boolean)
                    .join(' - ')}
                </span>
              </div>
            )}
          </div>

          {contrato.created_at && (
            <p className="text-xs text-muted-foreground">
              Proposta: {format(new Date(contrato.created_at), "dd/MM/yyyy", { locale: ptBR })}
            </p>
          )}
        </div>

        {/* Mini-cards de status (Vistoria e Assinatura) */}
        <div className="flex gap-2">
          <StatusMiniCard
            tipo="vistoria"
            realizado={vistoriaOk}
            data={contrato.vistoria?.data_aprovacao}
            modalidade={contrato.vistoria?.modalidade}
            vistoriaStatus={contrato.vistoria?.status}
          />
          <StatusMiniCard
            tipo="assinatura"
            realizado={propostaAssinada}
            data={contrato.data_assinatura}
          />
        </div>

        {/* Barra de Progresso */}
        <div className="space-y-1.5">
          <Progress value={progressValue} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">
            {requisitos}/2 requisitos
          </p>
        </div>

        {/* Botões de Ação */}
        {!isAtivado && (
          <div className="flex flex-wrap gap-2">
            {!propostaAssinada && vistoriaOk && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleEnviarLembrete}
                className="flex-1 min-w-[120px]"
              >
                <Send className="h-3.5 w-3.5 mr-1.5" />
                Enviar Lembrete
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleVerProposta}
              className="flex-1 min-w-[100px]"
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Ver Proposta
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleVerVistoria}
              className="flex-1 min-w-[100px]"
            >
              <ClipboardCheck className="h-3.5 w-3.5 mr-1.5" />
              Ver Vistoria
            </Button>
          </div>
        )}

        {/* Footer com botão de ativar ou status */}
        <div className="pt-2 border-t space-y-2">
          {isAtivado ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Ativado em:</span>
                <span className="font-medium text-primary">
                  {contrato.data_ativacao 
                    ? format(new Date(contrato.data_ativacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                    : '-'}
                </span>
              </div>
              
              {/* Badge de plano Roubo/Furto e botão SGA */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                {isRouboFurtoApenas && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                    <ShieldAlert className="h-3 w-3 mr-1" />
                    Roubo/Furto
                  </Badge>
                )}
                
                {/* Botão Enviar para SGA */}
                {contrato.veiculo && contrato.associado_id && (
                  <BotaoEnviarSGA
                    contratoId={contrato.id}
                    veiculoId={contrato.veiculo.id}
                    associadoId={contrato.associado_id}
                    sincronizado={contrato.veiculo.sincronizado_hinova}
                    statusSGA={contrato.veiculo.status_sga}
                    codigoHinova={contrato.veiculo.codigo_hinova}
                    isRouboFurto={isRouboFurtoApenas}
                    clienteNome={nomeCliente}
                    veiculoPlaca={veiculoPlaca || undefined}
                  />
                )}
              </div>
            </div>
          ) : requisitos === 2 ? (
            <Button
              onClick={onAtivar}
              disabled={isAtivando}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white animate-pulse"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {isAtivando ? 'Ativando...' : 'Ativar Contrato'}
            </Button>
          ) : (
            <Button
              disabled
              variant="secondary"
              className="w-full"
            >
              Aguardando Requisitos
            </Button>
          )}

          {contrato.vendedor?.nome && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Consultor: {contrato.vendedor.nome}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}