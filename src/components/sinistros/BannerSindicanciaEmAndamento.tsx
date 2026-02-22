import { differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface BannerSindicanciaEmAndamentoProps {
  sindicancia: {
    numero: string;
    data_limite: string;
    status: string;
  };
  empresaNome?: string | null;
}

export function BannerSindicanciaEmAndamento({ sindicancia, empresaNome }: BannerSindicanciaEmAndamentoProps) {
  const isAtiva = sindicancia.status === 'atribuido' || sindicancia.status === 'em_andamento';
  if (!isAtiva) return null;

  const diasRestantes = differenceInDays(new Date(sindicancia.data_limite), new Date());
  const prazoFormatado = format(new Date(sindicancia.data_limite), 'dd/MM/yyyy', { locale: ptBR });

  return (
    <Card className="border-blue-300 bg-blue-50">
      <CardContent className="flex items-start gap-3 py-4">
        <div className="p-2 rounded-lg bg-blue-100">
          <Search className="h-5 w-5 text-blue-700" />
        </div>
        <div>
          <p className="font-semibold text-blue-900">
            🔍 Sindicância em andamento — {sindicancia.numero}
          </p>
          <p className="text-sm text-blue-800 mt-1">
            {empresaNome ? `Sindicante: ${empresaNome}` : 'Sindicante não atribuído'}
            {' | '}
            Prazo: {prazoFormatado}
            {' '}
            <span className={diasRestantes < 0 ? 'text-red-600 font-semibold' : diasRestantes <= 7 ? 'text-orange-600 font-semibold' : ''}>
              ({diasRestantes < 0 ? `Vencido há ${Math.abs(diasRestantes)} dias` : `${diasRestantes} dias restantes`})
            </span>
          </p>
          <p className="text-sm text-blue-700 mt-1">
            Aguardando emissão do laudo pelo sindicante.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
