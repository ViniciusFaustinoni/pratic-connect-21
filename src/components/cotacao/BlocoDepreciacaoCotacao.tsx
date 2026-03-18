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

const CATEGORIA_FLAG_MAP: Record<string, string> = {
  placa_vermelha: 'flag_placa_vermelha',
  ex_taxi: 'flag_ex_taxi',
  taxi: 'flag_taxi_ativo',
  chassi_remarcado: 'flag_chassi_remarcado',
  leilao: 'flag_leilao',
  ressarcimento_integral: 'flag_ex_ressarcido',
};

interface Props {
  categoria: string;
  valorFipe: number;
  temAvarias?: boolean;
}

export function BlocoDepreciacaoCotacao({ categoria, valorFipe, temAvarias = false }: Props) {
  const { data: regrasDepreciacao } = useConfiguracaoJson<RegraDepreciacao[]>('regras_depreciacao', DEPRECIACOES_FALLBACK);
  const regras = regrasDepreciacao ?? DEPRECIACOES_FALLBACK;

  const flag = CATEGORIA_FLAG_MAP[categoria];
  if (!flag) return null;

  // Find matching rule (non-additional)
  const regraConcorrente = regras.find(r => r.flag === flag && !r.adicional);
  if (!regraConcorrente) return null;

  const percentual = regraConcorrente.percentual;
  let valorEstimado = valorFipe * (1 - percentual / 100);

  // Apply additional (avarias) if applicable
  const regraAvarias = temAvarias ? regras.find(r => r.flag === 'flag_avarias_vistoria' && r.adicional) : null;
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
        <div className="flex justify-between">
          <span className="text-muted-foreground">Valor FIPE:</span>
          <span className="font-medium">{formatarMoeda(valorFipe)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Depreciação ({regraConcorrente.label}):</span>
          <span className="font-medium text-destructive">-{percentual}%</span>
        </div>
        {regraAvarias && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Avarias pré-existentes:</span>
            <span className="font-medium text-destructive">-{regraAvarias.percentual}% adicional</span>
          </div>
        )}
        <div className="flex justify-between border-t border-border pt-1.5">
          <span className="text-muted-foreground">Valor estimado de ressarcimento:</span>
          <span className="font-semibold">{formatarMoeda(valorEstimado)}</span>
        </div>
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>Em caso de perda total, o ressarcimento será calculado com base no valor acima.</span>
      </div>
    </div>
  );
}
