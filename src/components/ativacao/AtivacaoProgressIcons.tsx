import { FileSignature, CreditCard, ClipboardCheck, Radio } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AtivacaoProgressIconsProps {
  assinaturaOk: boolean;
  assinaturaData?: string | null;
  pagamentoOk: boolean;
  vistoriaOk: boolean;
  vistoriaStatus?: string | null;
  sgaOk: boolean;
  sgaCodigo?: number | null;
}

export function AtivacaoProgressIcons({
  assinaturaOk,
  assinaturaData,
  pagamentoOk,
  vistoriaOk,
  vistoriaStatus,
  sgaOk,
  sgaCodigo,
}: AtivacaoProgressIconsProps) {
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    try {
      return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return null;
    }
  };

  const getVistoriaTooltip = () => {
    if (!vistoriaOk) return "Vistoria não realizada";
    if (vistoriaStatus === "aprovada") return "Vistoria aprovada";
    if (vistoriaStatus === "em_analise") return "Vistoria em análise";
    return "Vistoria realizada";
  };

  const icons = [
    {
      icon: FileSignature,
      ok: assinaturaOk,
      tooltip: assinaturaOk 
        ? `Assinado em ${formatDate(assinaturaData) || 'data não disponível'}` 
        : "Assinatura pendente",
      label: "Assinatura",
    },
    {
      icon: CreditCard,
      ok: pagamentoOk,
      tooltip: pagamentoOk ? "Adesão paga" : "Pagamento de adesão pendente",
      label: "Pagamento",
    },
    {
      icon: ClipboardCheck,
      ok: vistoriaOk,
      tooltip: getVistoriaTooltip(),
      label: "Vistoria",
    },
    {
      icon: Radio,
      ok: sgaOk,
      tooltip: sgaOk 
        ? `Sincronizado${sgaCodigo ? ` - Código #${sgaCodigo}` : ''}` 
        : "Aguardando envio ao SGA",
      label: "SGA",
    },
  ];

  return (
    <div className="flex items-center justify-center gap-2">
      {icons.map(({ icon: Icon, ok, tooltip, label }) => (
        <Tooltip key={label}>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "p-1.5 rounded-md transition-colors cursor-default",
                ok 
                  ? "bg-emerald-500/10 text-emerald-500" 
                  : "bg-amber-500/10 text-amber-500"
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">
              <span className="font-medium">{label}:</span> {tooltip}
            </p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
