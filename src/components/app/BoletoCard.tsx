import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const statusConfig = {
  pago: {
    label: 'Pago',
    border: 'border-l-green-500',
    badge: 'bg-green-100 text-green-700',
  },
  pendente: {
    label: 'Pendente',
    border: 'border-l-orange-500',
    badge: 'bg-orange-100 text-orange-700',
  },
  vencido: {
    label: 'Vencido',
    border: 'border-l-red-500',
    badge: 'bg-red-100 text-red-700',
  },
};

interface BoletoCardProps {
  boleto: {
    id: string;
    referencia: string;
    vencimento: string;
    valor: number;
    status: 'pendente' | 'pago' | 'vencido';
    dataPagamento?: string;
  };
  onClick?: () => void;
}

export function BoletoCard({ boleto, onClick }: BoletoCardProps) {
  const config = statusConfig[boleto.status];

  const valorFormatado = boleto.valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  const vencimentoFormatado = new Date(boleto.vencimento).toLocaleDateString('pt-BR');
  const pagamentoFormatado = boleto.dataPagamento
    ? new Date(boleto.dataPagamento).toLocaleDateString('pt-BR')
    : null;

  return (
    <Card
      className={`bg-white rounded-lg p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow border-l-4 ${config.border}`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <p className="font-medium text-gray-900">{boleto.referencia}</p>
          <p className="text-sm text-gray-500">Vencimento: {vencimentoFormatado}</p>
        </div>
        <Badge className={config.badge}>{config.label}</Badge>
      </div>

      {/* Valor */}
      <div className="mt-3">
        {boleto.status === 'pago' ? (
          <span className="text-lg text-gray-600">{valorFormatado}</span>
        ) : (
          <span className="text-xl font-bold text-gray-900">{valorFormatado}</span>
        )}
      </div>

      {/* Rodapé */}
      <div className="mt-3">
        {boleto.status === 'pago' && pagamentoFormatado && (
          <p className="text-sm text-green-600">Pago em {pagamentoFormatado}</p>
        )}

        {boleto.status === 'pendente' && (
          <Button
            variant="default"
            size="sm"
            className="w-full"
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
            }}
          >
            Ver boleto
          </Button>
        )}

        {boleto.status === 'vencido' && (
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
            }}
          >
            Regularizar
          </Button>
        )}
      </div>
    </Card>
  );
}
