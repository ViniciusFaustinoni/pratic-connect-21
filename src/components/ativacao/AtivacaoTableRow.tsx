import { TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AtivacaoProgressIcons } from "./AtivacaoProgressIcons";
import { AtivacaoContrato } from "@/hooks/useAtivacoes";
import { 
  Trash2, MoreHorizontal, Phone, Car,
  Loader2, Send
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import { cn } from "@/lib/utils";

interface AtivacaoTableRowProps {
  contrato: AtivacaoContrato;
  onEnviarSGA?: () => void;
  onExcluir: () => void;
  canDelete: boolean;
  isExcluindo: boolean;
  isEnviandoSGA?: boolean;
}

export function AtivacaoTableRow({
  contrato,
  onEnviarSGA,
  onExcluir,
  canDelete,
  isExcluindo,
  isEnviandoSGA,
}: AtivacaoTableRowProps) {
  // Dados do cliente
  const clienteNome = contrato.cliente_nome || contrato.lead?.nome || "Cliente";
  const clienteTelefone = contrato.cliente_telefone || contrato.lead?.telefone || "";
  const initials = clienteNome.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  // Dados do veículo
  const veiculoMarca = contrato.veiculo_marca || contrato.lead?.veiculo_marca || "";
  const veiculoModelo = contrato.veiculo_modelo || contrato.lead?.veiculo_modelo || "";
  const veiculoPlaca = contrato.veiculo_placa || contrato.lead?.veiculo_placa || "";
  const veiculoDescricao = [veiculoMarca, veiculoModelo].filter(Boolean).join(" ") || "Não informado";

  // Dados do vendedor
  const vendedorNome = contrato.vendedor?.nome || "-";

  // Progresso
  const assinaturaOk = !!contrato.data_assinatura;
  const pagamentoOk = (contrato as any).adesao_paga === true;
  const vistoriaOk = contrato.vistoria 
    ? ["em_analise", "aprovada"].includes(contrato.vistoria.status) 
    : false;
  const sgaOk = contrato.veiculo?.sincronizado_hinova === true;

  // Status - cruzar com associado
  const isCancelado = contrato.status === 'cancelado' || (contrato as any).associado_status === 'cancelado';
  const isAtivo = contrato.status === 'ativo' && !isCancelado;
  const isProntoParaAtivar = assinaturaOk && vistoriaOk && !isAtivo && !isCancelado;
  const todosRequisitos = assinaturaOk && pagamentoOk && vistoriaOk && sgaOk;

  const getStatusBadge = () => {
    if (isCancelado) {
      return <Badge className="bg-red-500/15 text-red-600 border-red-500/30">Cancelado</Badge>;
    }
    if (isAtivo) {
      return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Ativo</Badge>;
    }
    if (isProntoParaAtivar) {
      return <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30">Pronto</Badge>;
    }
    return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">Pendente</Badge>;
  };

  return (
    <TableRow className={cn(
      "hover:bg-muted/30",
      isAtivo && "bg-emerald-500/5",
      isCancelado && "bg-red-500/5 opacity-60"
    )}>
      {/* Cliente */}
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 border">
            <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate max-w-[180px]">{clienteNome}</p>
            {clienteTelefone && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {clienteTelefone}
              </p>
            )}
          </div>
        </div>
      </TableCell>

      {/* Veículo */}
      <TableCell>
        <div className="min-w-0">
          <p className="text-sm truncate max-w-[150px]">{veiculoDescricao}</p>
          {veiculoPlaca && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Car className="h-3 w-3" />
              {veiculoPlaca.toUpperCase()}
            </p>
          )}
        </div>
      </TableCell>

      {/* Vendedor */}
      <TableCell>
        <p className="text-sm text-muted-foreground">{vendedorNome}</p>
      </TableCell>

      {/* Progresso */}
      <TableCell>
        <AtivacaoProgressIcons
          assinaturaOk={assinaturaOk}
          assinaturaData={contrato.data_assinatura}
          pagamentoOk={pagamentoOk}
          vistoriaOk={vistoriaOk}
          vistoriaStatus={contrato.vistoria?.status}
          sgaOk={sgaOk}
          sgaCodigo={contrato.veiculo?.codigo_hinova}
        />
      </TableCell>

      {/* Ações */}
      <TableCell>
        <div className="flex items-center gap-2">
          {getStatusBadge()}
          
          {!isAtivo && !isCancelado && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!sgaOk && onEnviarSGA && (
                  <DropdownMenuItem 
                    onClick={onEnviarSGA}
                    disabled={isEnviandoSGA}
                  >
                    {isEnviandoSGA ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Enviar para SGA
                  </DropdownMenuItem>
                )}

                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem 
                          onSelect={(e) => e.preventDefault()}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir ativação?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação irá excluir o contrato, associado, veículo e todos os registros relacionados.
                            Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={onExcluir}
                            disabled={isExcluindo}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {isExcluindo ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : null}
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
