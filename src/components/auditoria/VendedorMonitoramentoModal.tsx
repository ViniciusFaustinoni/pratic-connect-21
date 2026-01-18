import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Eye, ShieldAlert, ShieldCheck, Save, Loader2 } from "lucide-react";
import { useAtualizarMonitoramento, VendedorMonitoramento } from "@/hooks/useAuditoriaVendedores";
import { toast } from "sonner";
import { RiskScoreIndicator } from "./VendedorRiskBadge";

interface VendedorInfo {
  id: string;
  nome: string;
  avatar_url?: string | null;
}

interface VendedorMonitoramentoModalProps {
  vendedor: VendedorInfo | null;
  monitoramento: VendedorMonitoramento | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VendedorMonitoramentoModal({
  vendedor,
  monitoramento,
  open,
  onOpenChange,
}: VendedorMonitoramentoModalProps) {
  const [status, setStatus] = useState<"normal" | "sob_observacao" | "suspenso">("normal");
  const [motivo, setMotivo] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const atualizarMonitoramento = useAtualizarMonitoramento();

  useEffect(() => {
    if (monitoramento) {
      setStatus(monitoramento.status_monitoramento);
      setMotivo(monitoramento.motivo || "");
      setObservacoes(monitoramento.observacoes || "");
    } else {
      setStatus("normal");
      setMotivo("");
      setObservacoes("");
    }
  }, [monitoramento, open]);

  if (!vendedor) return null;

  const handleSave = async () => {
    try {
      await atualizarMonitoramento.mutateAsync({
        vendedorId: vendedor.id,
        status,
        motivo: motivo || undefined,
        observacoes: observacoes || undefined,
      });

      toast.success("Status de monitoramento atualizado");
      onOpenChange(false);
    } catch (error) {
      toast.error("Erro ao atualizar monitoramento");
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Gerenciar Monitoramento
          </DialogTitle>
          <DialogDescription>
            Altere o status de monitoramento deste vendedor
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Vendedor */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Avatar className="h-12 w-12">
              <AvatarImage src={vendedor.avatar_url || undefined} />
              <AvatarFallback>{getInitials(vendedor.nome)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-medium">{vendedor.nome}</p>
              {monitoramento && (
                <p className="text-sm text-muted-foreground">
                  {monitoramento.total_alertas} alertas • {monitoramento.alertas_confirmados} confirmados
                </p>
              )}
            </div>
            {monitoramento && <RiskScoreIndicator score={monitoramento.score_risco_acumulado} />}
          </div>

          {/* Status */}
          <div className="space-y-3">
            <Label>Status de Monitoramento</Label>
            <RadioGroup value={status} onValueChange={(v) => setStatus(v as any)} className="space-y-2">
              <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="normal" id="normal" />
                <Label htmlFor="normal" className="flex items-center gap-2 cursor-pointer flex-1">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  <div>
                    <p className="font-medium">Normal</p>
                    <p className="text-xs text-muted-foreground">
                      Sem restrições, vendedor liberado
                    </p>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="sob_observacao" id="sob_observacao" />
                <Label htmlFor="sob_observacao" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Eye className="h-4 w-4 text-amber-500" />
                  <div>
                    <p className="font-medium">Sob Observação</p>
                    <p className="text-xs text-muted-foreground">
                      Monitoramento ativo, pode trabalhar normalmente
                    </p>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="suspenso" id="suspenso" />
                <Label htmlFor="suspenso" className="flex items-center gap-2 cursor-pointer flex-1">
                  <ShieldAlert className="h-4 w-4 text-destructive" />
                  <div>
                    <p className="font-medium">Suspenso</p>
                    <p className="text-xs text-muted-foreground">
                      Atividade suspeita confirmada, aguardando investigação
                    </p>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Motivo (obrigatório para suspenso) */}
          {(status === "suspenso" || status === "sob_observacao") && (
            <div className="space-y-2">
              <Label htmlFor="motivo">
                Motivo {status === "suspenso" && <span className="text-destructive">*</span>}
              </Label>
              <Textarea
                id="motivo"
                placeholder="Descreva o motivo da alteração de status..."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
              />
            </div>
          )}

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações Adicionais</Label>
            <Textarea
              id="observacoes"
              placeholder="Observações internas sobre o vendedor..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={atualizarMonitoramento.isPending || (status === "suspenso" && !motivo)}
            className="gap-1"
          >
            {atualizarMonitoramento.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
