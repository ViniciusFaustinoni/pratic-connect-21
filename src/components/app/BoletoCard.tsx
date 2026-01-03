import { Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Boleto {
  id: string;
  referencia: string;
  vencimento: string;
  valor: number;
  status: 'pendente' | 'pago' | 'vencido';
  dataPagamento?: string;
}

interface BoletoCardProps {
  boleto: Boleto;
  onClick?: () => void;
}

export function BoletoCard({ boleto, onClick }: BoletoCardProps) {
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getCardClasses = () => {
    const base = 'bg-white rounded-xl p-4 shadow-sm border-l-4 cursor-pointer hover:shadow-md transition-shadow';
    switch (boleto.status) {
      case 'pendente': return `${base} border-l-orange-500`;
      case 'vencido': return `${base} border-l-red-500`;
      case 'pago': return `${base} border-l-green-500 bg-gray-50/50`;
      default: return base;
    }
  };

  const getBadgeConfig = () => {
    switch (boleto.status) {
      case 'pendente': return { label: 'PENDENTE', className: 'bg-orange-100 text-orange-700' };
      case 'vencido': return { label: 'VENCIDO', className: 'bg-red-100 text-red-700' };
      case 'pago': return { label: 'PAGO', className: 'bg-green-100 text-green-700' };
    }
  };

  const badgeConfig = getBadgeConfig();

  return (
    <Card className={getCardClasses()} onClick={onClick}>
      {/* Header */}
      <div className="flex justify-between items-start">
        <span className="font-semibold text-gray-900">{boleto.referencia}</span>
        <Badge className={badgeConfig.className}>{badgeConfig.label}</Badge>
      </div>

      {/* Corpo - Pendente */}
      {boleto.status === 'pendente' && (
        <div className="mt-2">
          <div className="flex items-center gap-1.5 text-gray-600">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-sm">Vencimento: {formatDate(boleto.vencimento)}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {formatCurrency(boleto.valor)}
          </p>
          <Button 
            className="w-full mt-3 bg-blue-600 hover:bg-blue-700"
            onClick={(e) => { e.stopPropagation(); onClick?.(); }}
          >
            Ver boleto
          </Button>
        </div>
      )}

      {/* Corpo - Vencido */}
      {boleto.status === 'vencido' && (
        <div className="mt-2">
          <div className="flex items-center gap-1.5 text-red-600">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-sm">Venceu em: {formatDate(boleto.vencimento)}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {formatCurrency(boleto.valor)}
          </p>
          <p className="text-xs text-red-500 mt-1">Sujeito a juros e multa</p>
          <Button 
            variant="destructive"
            className="w-full mt-3"
            onClick={(e) => { e.stopPropagation(); onClick?.(); }}
          >
            Regularizar
          </Button>
        </div>
      )}

      {/* Corpo - Pago */}
      {boleto.status === 'pago' && (
        <div className="mt-2">
          <div className="flex items-center gap-1.5 text-green-600">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-sm">Pago em: {formatDate(boleto.dataPagamento!)}</span>
          </div>
          <p className="text-lg text-gray-500 line-through mt-1">
            {formatCurrency(boleto.valor)}
          </p>
        </div>
      )}
    </Card>
  );
}
