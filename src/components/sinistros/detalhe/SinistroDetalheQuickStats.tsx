import { User, Car, DollarSign, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { differenceInDays } from 'date-fns';
import { useConfiguracaoNumero } from '@/hooks/useConteudosSistema';

const formatCurrency = (value: number | null) => {
  if (!value) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

interface SinistroDetalheQuickStatsProps {
  sinistro: any;
}

export function SinistroDetalheQuickStats({ sinistro }: SinistroDetalheQuickStatsProps) {
  const { data: prazoSinistro } = useConfiguracaoNumero('operacional_prazo_sinistro', 60);
  const prazoInicio = sinistro.prazo_ressarcimento_inicio || sinistro.created_at;
  const diasDesdeAbertura = prazoInicio ? differenceInDays(new Date(), new Date(prazoInicio)) : null;
  const diasRestantes = diasDesdeAbertura !== null ? Math.max(0, (prazoSinistro ?? 60) - diasDesdeAbertura) : null;

  const stats = [
    {
      icon: <User className="h-5 w-5 text-blue-600" />,
      label: 'Associado',
      value: sinistro.associado?.nome || '-',
      sub: sinistro.associado?.cpf || '',
      bg: 'bg-blue-50 dark:bg-blue-950/30',
    },
    {
      icon: <Car className="h-5 w-5 text-purple-600" />,
      label: 'Veículo',
      value: sinistro.veiculo?.placa || '-',
      sub: `${sinistro.veiculo?.marca || ''} ${sinistro.veiculo?.modelo || ''} ${sinistro.veiculo?.ano_modelo || ''}`.trim(),
      bg: 'bg-purple-50 dark:bg-purple-950/30',
    },
    {
      icon: <DollarSign className="h-5 w-5 text-emerald-600" />,
      label: 'Valor FIPE',
      value: formatCurrency(sinistro.valor_fipe || sinistro.veiculo?.valor_fipe),
      sub: sinistro.veiculo?.codigo_fipe ? `Cód. ${sinistro.veiculo.codigo_fipe}` : '',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    },
    {
      icon: <Clock className={`h-5 w-5 ${diasRestantes !== null && diasRestantes <= 5 ? 'text-red-600' : 'text-amber-600'}`} />,
      label: 'Prazo Ressarcimento',
      value: sinistro.prazo_suspenso ? 'Suspenso' : diasRestantes !== null ? `${diasRestantes} dias` : '-',
      sub: sinistro.prazo_suspenso ? sinistro.prazo_motivo_suspensao || '' : diasDesdeAbertura !== null ? `${diasDesdeAbertura} dias desde abertura` : '',
      bg: diasRestantes !== null && diasRestantes <= 5 ? 'bg-red-50 dark:bg-red-950/30' : 'bg-amber-50 dark:bg-amber-950/30',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((s, i) => (
        <Card key={i} className={`${s.bg} border-0 shadow-sm hover:shadow-md transition-shadow`}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">{s.icon}</div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.label}</p>
                <p className="font-semibold text-sm truncate">{s.value}</p>
                {s.sub && <p className="text-xs text-muted-foreground truncate">{s.sub}</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
