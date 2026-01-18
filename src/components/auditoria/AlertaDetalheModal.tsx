import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, CheckCircle, Eye, XCircle, Calendar, Hash } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAnalisarAlerta, AlertaAuditoria } from "@/hooks/useAuditoriaVendedores";
import { toast } from "sonner";
import { RiskScoreIndicator } from "./VendedorRiskBadge";

interface AlertaDetalheModalProps {
  alerta: AlertaAuditoria | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TIPO_ALERTA_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  cpf_duplicado: {
    label: "CPF Duplicado",
    icon: <Hash className="h-4 w-4" />,
    color: "bg-purple-100 text-purple-700 border-purple-300",
  },
  taxa_conversao_baixa: {
    label: "Taxa Conversão Baixa",
    icon: <AlertTriangle className="h-4 w-4" />,
    color: "bg-amber-100 text-amber-700 border-amber-300",
  },
  cotacoes_abandonadas: {
    label: "Cotações Abandonadas",
    icon: <XCircle className="h-4 w-4" />,
    color: "bg-red-100 text-red-700 border-red-300",
  },
  leads_perdidos_massa: {
    label: "Leads Perdidos em Massa",
    icon: <AlertTriangle className="h-4 w-4" />,
    color: "bg-orange-100 text-orange-700 border-orange-300",
  },
  horario_atipico: {
    label: "Horário Atípico",
    icon: <Calendar className="h-4 w-4" />,
    color: "bg-blue-100 text-blue-700 border-blue-300",
  },
  marcacao_manual: {
    label: "Marcação Manual",
    icon: <Eye className="h-4 w-4" />,
    color: "bg-slate-100 text-slate-700 border-slate-300",
  },
};

export function AlertaDetalheModal({ alerta, open, onOpenChange }: AlertaDetalheModalProps) {
  const [observacoes, setObservacoes] = useState("");
  const analisarAlerta = useAnalisarAlerta();

  if (!alerta) return null;

  const tipoConfig = TIPO_ALERTA_CONFIG[alerta.tipo_alerta] || {
    label: alerta.tipo_alerta,
    icon: <AlertTriangle className="h-4 w-4" />,
    color: "bg-slate-100 text-slate-700 border-slate-300",
  };

  const handleAnalise = async (status: "analisado" | "ignorado" | "confirmado") => {
    try {
      await analisarAlerta.mutateAsync({
        alertaId: alerta.id,
        status,
        observacoes: observacoes || undefined,
      });

      toast.success(
        status === "confirmado"
          ? "Alerta confirmado como suspeito"
          : status === "ignorado"
          ? "Alerta ignorado"
          : "Alerta marcado como analisado"
      );
      onOpenChange(false);
      setObservacoes("");
    } catch (error) {
      toast.error("Erro ao processar alerta");
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
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Detalhes do Alerta
          </DialogTitle>
          <DialogDescription>
            Analise os dados e tome uma decisão sobre este alerta
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Vendedor */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Avatar className="h-12 w-12">
              <AvatarImage src={alerta.vendedor?.avatar_url || undefined} />
              <AvatarFallback>{getInitials(alerta.vendedor?.nome || "V")}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-medium">{alerta.vendedor?.nome || "Vendedor"}</p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(alerta.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
            <RiskScoreIndicator score={alerta.score_risco} />
          </div>

          {/* Tipo e Descrição */}
          <div className="space-y-2">
            <Badge variant="outline" className={`${tipoConfig.color} gap-1`}>
              {tipoConfig.icon}
              {tipoConfig.label}
            </Badge>
            <p className="text-sm">{alerta.descricao}</p>
          </div>

          <Separator />

          {/* Dados do Alerta */}
          {alerta.dados && Object.keys(alerta.dados).length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Dados Detalhados</Label>
              <div className="bg-muted p-3 rounded-lg text-sm font-mono overflow-x-auto">
                {Object.entries(alerta.dados).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <span className="text-muted-foreground">{formatKey(key)}:</span>
                    <span>{formatValue(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações da Análise</Label>
            <Textarea
              id="observacoes"
              placeholder="Adicione observações sobre sua análise..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => handleAnalise("ignorado")}
            disabled={analisarAlerta.isPending}
            className="gap-1"
          >
            <XCircle className="h-4 w-4" />
            Ignorar
          </Button>
          <Button
            variant="outline"
            onClick={() => handleAnalise("analisado")}
            disabled={analisarAlerta.isPending}
            className="gap-1"
          >
            <Eye className="h-4 w-4" />
            Marcar Analisado
          </Button>
          <Button
            variant="destructive"
            onClick={() => handleAnalise("confirmado")}
            disabled={analisarAlerta.isPending}
            className="gap-1"
          >
            <CheckCircle className="h-4 w-4" />
            Confirmar Suspeita
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatKey(key: string): string {
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatValue(value: any): string {
  if (Array.isArray(value)) {
    return value.slice(0, 5).join(", ") + (value.length > 5 ? ` (+${value.length - 5})` : "");
  }
  if (typeof value === "number") {
    return value.toLocaleString("pt-BR");
  }
  return String(value);
}
