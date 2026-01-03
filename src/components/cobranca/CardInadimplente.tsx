import { Phone, MessageSquare, Handshake, Clock, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Inadimplente {
  id: string;
  nome: string;
  cpf: string;
  telefone: string;
  whatsapp?: string;
  valorTotal: number;
  qtdBoletos: number;
  diasAtraso: number;
  ultimoContato?: string;
}

interface CardInadimplenteProps {
  inadimplente: Inadimplente;
  onLigar?: () => void;
  onWhatsApp?: () => void;
  onAcordo?: () => void;
  onClick?: () => void;
}

function getDiasAtrasoCor(dias: number): string {
  if (dias <= 30) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
  if (dias <= 60) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
  if (dias <= 90) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
  return 'bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-200';
}

function formatCPF(cpf: string): string {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length < 4) return cpf;
  return `***.***.***.${clean.slice(-2)}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function CardInadimplente({
  inadimplente,
  onLigar,
  onWhatsApp,
  onAcordo,
  onClick,
}: CardInadimplenteProps) {
  const handleButtonClick = (e: React.MouseEvent, action?: () => void) => {
    e.stopPropagation();
    action?.();
  };

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="font-medium truncate">{inadimplente.nome}</span>
          </div>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {formatCPF(inadimplente.cpf)}
          </span>
        </div>

        {/* Valor total em destaque */}
        <div className="text-2xl font-bold text-destructive">
          {formatCurrency(inadimplente.valorTotal)}
        </div>

        {/* Grid de informações */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-muted-foreground">
            {inadimplente.qtdBoletos} {inadimplente.qtdBoletos === 1 ? 'boleto vencido' : 'boletos vencidos'}
          </div>
          <div className="text-right">
            <Badge className={getDiasAtrasoCor(inadimplente.diasAtraso)}>
              {inadimplente.diasAtraso} dias
            </Badge>
          </div>
        </div>

        {/* Último contato */}
        {inadimplente.ultimoContato && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              Último contato{' '}
              {formatDistanceToNow(new Date(inadimplente.ultimoContato), {
                addSuffix: true,
                locale: ptBR,
              })}
            </span>
          </div>
        )}

        {/* Botões de ação */}
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => handleButtonClick(e, onLigar)}
            className="flex-1"
          >
            <Phone className="h-4 w-4 mr-1" />
            Ligar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => handleButtonClick(e, onWhatsApp)}
            className="flex-1 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
          >
            <MessageSquare className="h-4 w-4 mr-1" />
            WhatsApp
          </Button>
          <Button
            size="sm"
            variant="default"
            onClick={(e) => handleButtonClick(e, onAcordo)}
            className="flex-1"
          >
            <Handshake className="h-4 w-4 mr-1" />
            Acordo
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
