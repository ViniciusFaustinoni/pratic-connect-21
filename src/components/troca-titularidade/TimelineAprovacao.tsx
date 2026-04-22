import { CheckCircle2, Circle, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StatusTroca } from '@/hooks/useSolicitacoesTroca';

interface TimelineAprovacaoProps {
  status: StatusTroca;
  termoAssinadoEm?: string | null;
  aprovadoCadastroEm?: string | null;
  aprovadoMonitoramentoEm?: string | null;
  efetivadaEm?: string | null;
}

const ETAPAS: { key: string; label: string }[] = [
  { key: 'cotacao', label: 'Cotação enviada' },
  { key: 'docs_novo', label: 'Documentos do novo titular' },
  { key: 'termo', label: 'Termo de cancelamento (titular antigo)' },
  { key: 'cadastro', label: 'Análise do Cadastro' },
  { key: 'monitoramento', label: 'Análise do Monitoramento' },
  { key: 'assinatura', label: 'Assinatura, vistoria e pagamento' },
  { key: 'efetivada', label: 'Troca efetivada' },
];

function statusToStep(status: StatusTroca): number {
  switch (status) {
    case 'cotacao_em_andamento': return 0;
    case 'aguardando_cadastro': return 3;
    case 'aguardando_monitoramento': return 4;
    case 'aguardando_vistoria': return 4;
    case 'liberada_para_assinatura': return 5;
    case 'efetivada': return 6;
    default: return -1;
  }
}

export function TimelineAprovacao({
  status, termoAssinadoEm, aprovadoCadastroEm, aprovadoMonitoramentoEm, efetivadaEm,
}: TimelineAprovacaoProps) {
  const isReprovada = status === 'reprovada_cadastro' || status === 'reprovada_monitoramento';
  const currentStep = statusToStep(status);

  return (
    <ol className="relative border-l border-border ml-2 space-y-4">
      {ETAPAS.map((etapa, idx) => {
        const completed = idx < currentStep || (idx === currentStep && currentStep === 6);
        const active = idx === currentStep;
        const failed = isReprovada && idx === currentStep + 1;

        let Icon = Circle;
        let color = 'text-muted-foreground';
        if (completed) { Icon = CheckCircle2; color = 'text-green-600'; }
        else if (active) { Icon = Clock; color = 'text-blue-600'; }
        else if (failed) { Icon = XCircle; color = 'text-destructive'; }

        let dataInfo: string | null = null;
        if (etapa.key === 'termo' && termoAssinadoEm) dataInfo = new Date(termoAssinadoEm).toLocaleString('pt-BR');
        if (etapa.key === 'cadastro' && aprovadoCadastroEm) dataInfo = new Date(aprovadoCadastroEm).toLocaleString('pt-BR');
        if (etapa.key === 'monitoramento' && aprovadoMonitoramentoEm) dataInfo = new Date(aprovadoMonitoramentoEm).toLocaleString('pt-BR');
        if (etapa.key === 'efetivada' && efetivadaEm) dataInfo = new Date(efetivadaEm).toLocaleString('pt-BR');

        return (
          <li key={etapa.key} className="ml-4">
            <span className={cn(
              'absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-background',
              color
            )}>
              <Icon className="h-5 w-5" />
            </span>
            <p className={cn('text-sm', active ? 'font-semibold' : 'font-normal', completed && 'text-foreground')}>
              {etapa.label}
            </p>
            {dataInfo && <p className="text-xs text-muted-foreground">{dataInfo}</p>}
          </li>
        );
      })}
    </ol>
  );
}
