import { AlertTriangle, Info } from 'lucide-react';
import { useConfiguracaoJson } from '@/hooks/useConteudosSistema';
import { formatarMoeda } from '@/utils/format';

interface RegraDepreciacao {
  flag: string;
  label: string;
  percentual: number;
  adicional?: boolean;
}

const DEPRECIACOES_FALLBACK: RegraDepreciacao[] = [
  { flag: 'flag_placa_vermelha', label: 'Placa vermelha', percentual: 25 },
  { flag: 'flag_ex_taxi', label: 'Ex-táxi', percentual: 25 },
  { flag: 'flag_taxi_ativo', label: 'Táxi ativo', percentual: 25 },
  { flag: 'flag_chassi_remarcado', label: 'Chassi remarcado', percentual: 30 },
  { flag: 'flag_leilao', label: 'Veículo de leilão', percentual: 30 },
  { flag: 'flag_ex_ressarcido', label: 'Já indenizado anteriormente', percentual: 30 },
  { flag: 'flag_avarias_vistoria', label: 'Avarias pré-existentes (vistoria)', percentual: 20, adicional: true },
];

const FLAG_KEYS = [
  'flag_placa_vermelha',
  'flag_ex_taxi',
  'flag_taxi_ativo',
  'flag_chassi_remarcado',
  'flag_leilao',
  'flag_ex_ressarcido',
  'flag_avarias_vistoria',
] as const;

interface Props {
  veiculo: Record<string, any>;
  valorFipe?: number | null;
}

export function BlocoDepreciacaoVeiculo({ veiculo, valorFipe }: Props) {
  const { data: regrasDepreciacao } = useConfiguracaoJson<RegraDepreciacao[]>('regras_depreciacao', DEPRECIACOES_FALLBACK);
  const regras = regrasDepreciacao ?? DEPRECIACOES_FALLBACK;

  // Find active non-additional flags
  const flagsAtivas = FLAG_KEYS.filter(f => f !== 'flag_avarias_vistoria' && veiculo[f] === true);
  if (flagsAtivas.length === 0) return null;

  // Match rules for active flags
  const regrasConcorrentes = flagsAtivas
    .map(f => regras.find(r => r.flag === f && !r.adicional))
    .filter(Boolean) as RegraDepreciacao[];

  if (regrasConcorrentes.length === 0) return null;

  const regraMaior = regrasConcorrentes.reduce((a, b) => (a.percentual >= b.percentual ? a : b));
  const temAvarias = veiculo.flag_avarias_vistoria === true;
  const regraAvarias = temAvarias ? regras.find(r => r.flag === 'flag_avarias_vistoria' && r.adicional) : null;

  const fipe = valorFipe ?? veiculo.valor_fipe ?? 0;
  let valorEstimado = fipe * (1 - regraMaior.percentual / 100);
  if (regraAvarias) {
    valorEstimado = valorEstimado * (1 - regraAvarias.percentual / 100);
  }

  return (
    <div className="rounded-lg border border-amber-500/50 bg-amber-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="text-sm font-semibold">Impacto no Ressarcimento Integral</span>
      </div>

      <div className="space-y-1.5 text-sm">
        {fipe > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Valor FIPE:</span>
            <span className="font-medium">{formatarMoeda(fipe)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Depreciação ({regraMaior.label}):</span>
          <span className="font-medium text-destructive">-{regraMaior.percentual}%</span>
        </div>
        {regrasConcorrentes.length > 1 && (
          <div className="text-xs text-muted-foreground italic">
            Outras categorias ativas: {regrasConcorrentes.filter(r => r.flag !== regraMaior.flag).map(r => r.label).join(', ')}
          </div>
        )}
        {regraAvarias && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Avarias pré-existentes:</span>
            <span className="font-medium text-destructive">-{regraAvarias.percentual}% adicional</span>
          </div>
        )}
        {fipe > 0 && (
          <div className="flex justify-between border-t border-border pt-1.5">
            <span className="text-muted-foreground">Valor estimado de ressarcimento:</span>
            <span className="font-semibold">{formatarMoeda(valorEstimado)}</span>
          </div>
        )}
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>Em caso de perda total, o ressarcimento será calculado com base no valor acima.</span>
      </div>
    </div>
  );
}
