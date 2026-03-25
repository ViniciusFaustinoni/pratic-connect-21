import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  Zap,
  FileText,
  MessageSquare,
  Mail,
  Copy,
  ExternalLink,
  Trash2,
  Loader2,
  FileSignature,
  Pencil,
} from 'lucide-react';
import { STATUS_COTACAO_LABELS } from '@/types/vendas';
import type { StatusCotacao } from '@/types/vendas';

interface CotacaoAcoesProps {
  cotacao: {
    id: string;
    numero?: string | null;
    status: string;
    lead_id?: string | null;
    token_publico?: string | null;
  };
  onBaixarPDF: () => void;
  onEnviarWhatsApp: () => void;
  onEnviarEmail: () => void;
  onDuplicar?: () => void;
  onEditar?: () => void;
  onMudarStatus: (status: StatusCotacao) => void;
  onExcluir: () => void;
  onAceitarEContrato?: () => void;
  onCopiarLink?: () => void;
  isAtualizando?: boolean;
  isExcluindo?: boolean;
  isGerando?: boolean;
  isDuplicando?: boolean;
  canDelete?: boolean;
  deleteReason?: string;
  contratoAssinado?: boolean;
}

export function CotacaoAcoes({
  cotacao,
  onBaixarPDF,
  onEnviarWhatsApp,
  onEnviarEmail,
  onDuplicar,
  onEditar,
  onMudarStatus,
  onExcluir,
  onAceitarEContrato,
  onCopiarLink,
  isAtualizando,
  isExcluindo,
  isGerando,
  isDuplicando,
  canDelete = true,
  deleteReason,
  contratoAssinado = false,
}: CotacaoAcoesProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  const temLead = !!cotacao.lead_id;
  const podeEditar = !contratoAssinado;

  const handleAcessarLink = () => {
    if (!cotacao.token_publico) {
      toast.error('Link público não disponível');
      return;
    }
    const url = `${window.location.origin}/cotacao/${cotacao.token_publico}`;
    window.open(url, '_blank');
    
    // Callback opcional para registrar no histórico
    onCopiarLink?.();
  };

  const canAceitarContrato = 
    (cotacao.status === 'rascunho' || cotacao.status === 'enviada') && 
    temLead;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="h-4 w-4" />
          Ações
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Botão Aceitar e Gerar Contrato */}
        {canAceitarContrato && onAceitarEContrato && (
          <>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={onAceitarEContrato}
              disabled={isAtualizando}
            >
              {isAtualizando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileSignature className="mr-2 h-4 w-4" />
              )}
              Aceitar e Gerar Contrato
            </Button>
            <Separator className="my-3" />
          </>
        )}

        {/* Baixar PDF */}
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={onBaixarPDF}
          disabled={isGerando}
        >
          {isGerando ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileText className="mr-2 h-4 w-4" />
          )}
          Baixar PDF
        </Button>

        {/* Enviar WhatsApp */}
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={onEnviarWhatsApp}
        >
          <MessageSquare className="mr-2 h-4 w-4" />
          Enviar WhatsApp
        </Button>

        {/* Enviar Email */}
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={onEnviarEmail}
        >
          <Mail className="mr-2 h-4 w-4" />
          Enviar Email
        </Button>

        <Separator className="my-3" />

        {/* Duplicar e Editar na mesma linha */}
        <div className="grid grid-cols-2 gap-2">
          {/* Duplicar */}
          <Button
            variant="outline"
            className="justify-start"
            onClick={onDuplicar}
            disabled={isDuplicando}
          >
            {isDuplicando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            Duplicar
          </Button>

          {/* Editar */}
          <Button
            variant="outline"
            className="justify-start"
            onClick={onEditar}
            disabled={!podeEditar}
            title={!podeEditar ? 'Não é possível editar após a assinatura do contrato' : undefined}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Button>
        </div>

        {/* Acessar Link Público */}
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={handleAcessarLink}
          disabled={!cotacao.token_publico}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Acessar Link Público
        </Button>

        {/* Alterar Status */}
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Status</label>
          <Select
            value={cotacao.status}
            onValueChange={(value) => onMudarStatus(value as StatusCotacao)}
            disabled={isAtualizando}
          >
            <SelectTrigger>
              <SelectValue placeholder="Alterar status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rascunho">
                {STATUS_COTACAO_LABELS.rascunho}
              </SelectItem>
              <SelectItem value="enviada">
                {STATUS_COTACAO_LABELS.enviada}
              </SelectItem>
              <SelectItem value="aceita">
                {STATUS_COTACAO_LABELS.aceita}
              </SelectItem>
              <SelectItem value="recusada">
                {STATUS_COTACAO_LABELS.recusada}
              </SelectItem>
              <SelectItem value="expirada">
                {STATUS_COTACAO_LABELS.expirada}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Excluir */}
        <Separator className="my-3" />
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="w-full">
                {canDelete ? (
                  <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        className="w-full"
                        disabled={isExcluindo}
                      >
                        {isExcluindo ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="mr-2 h-4 w-4" />
                        )}
                        Excluir Cotação
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir cotação?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita. A cotação e todos os registros vinculados (contratos, agendamentos, serviços) serão permanentemente removidos.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            onExcluir();
                            setShowDeleteDialog(false);
                          }}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <Button
                    variant="destructive"
                    className="w-full"
                    disabled
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir Cotação
                  </Button>
                )}
              </span>
            </TooltipTrigger>
            {!canDelete && deleteReason && (
              <TooltipContent>
                {deleteReason}
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
