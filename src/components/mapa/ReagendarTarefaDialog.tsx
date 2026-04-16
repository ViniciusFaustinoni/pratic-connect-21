import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarClock, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useReagendarTarefa } from "@/hooks/useReagendarTarefa";
import { parseDataLocal } from "@/lib/date-utils";

interface ReagendarTarefaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servicoId: string | null;
  resumo: {
    placa?: string | null;
    associadoNome?: string | null;
    dataAtual?: string | null;
    horaAtual?: string | null;
  };
  onSuccess?: () => void;
}

export function ReagendarTarefaDialog({
  open,
  onOpenChange,
  servicoId,
  resumo,
  onSuccess,
}: ReagendarTarefaDialogProps) {
  const reagendar = useReagendarTarefa();
  const hojeStr = format(new Date(), "yyyy-MM-dd");

  const [novaData, setNovaData] = useState<string>("");
  const [novaHora, setNovaHora] = useState<string>("");
  const [motivo, setMotivo] = useState<string>("");
  const [enviarWhatsapp, setEnviarWhatsapp] = useState<boolean>(true);

  useEffect(() => {
    if (open) {
      setNovaData(resumo.dataAtual?.slice(0, 10) || hojeStr);
      setNovaHora(resumo.horaAtual?.slice(0, 5) || "09:00");
      setMotivo("");
      setEnviarWhatsapp(true);
    }
  }, [open, resumo.dataAtual, resumo.horaAtual, hojeStr]);

  const dataAtualLabel = resumo.dataAtual
    ? format(parseDataLocal(resumo.dataAtual.slice(0, 10)) || new Date(), "dd/MM/yyyy")
    : "—";
  const horaAtualLabel = resumo.horaAtual?.slice(0, 5) || "—";

  const dataValida = !!novaData && novaData >= hojeStr;
  const horaValida = !!novaHora && /^\d{2}:\d{2}$/.test(novaHora);
  const podeConfirmar = !!servicoId && dataValida && horaValida && !reagendar.isPending;

  const handleConfirmar = async () => {
    if (!servicoId) return;
    await reagendar.mutateAsync({
      servicoId,
      novaData,
      novaHora,
      motivo: motivo.trim() || undefined,
      enviarWhatsapp,
    });
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Reagendar tarefa
          </DialogTitle>
          <DialogDescription>
            Defina uma nova data e horário. O técnico atribuído (se houver) será
            mantido. O associado pode ser notificado por WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
            <p>
              <strong>Placa:</strong> {resumo.placa || "—"}
            </p>
            <p>
              <strong>Associado:</strong> {resumo.associadoNome || "—"}
            </p>
            <p>
              <strong>Atual:</strong> {dataAtualLabel} às {horaAtualLabel}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nova-data">Nova data</Label>
              <Input
                id="nova-data"
                type="date"
                value={novaData}
                min={hojeStr}
                onChange={(e) => setNovaData(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nova-hora">Novo horário</Label>
              <Input
                id="nova-hora"
                type="time"
                value={novaHora}
                onChange={(e) => setNovaHora(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="motivo-reag">Motivo (opcional)</Label>
            <Textarea
              id="motivo-reag"
              placeholder="Ex.: associado solicitou via telefone, técnico indisponível..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
            />
          </div>

          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={enviarWhatsapp}
              onCheckedChange={(v) => setEnviarWhatsapp(v === true)}
              id="wpp-reag"
            />
            <span>
              Enviar nova confirmação por WhatsApp ao associado
            </span>
          </label>

          {!dataValida && novaData && (
            <p className="text-xs text-destructive">
              A nova data não pode ser anterior a hoje.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={reagendar.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={!podeConfirmar}>
            {reagendar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar reagendamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ReagendarTarefaDialog;
