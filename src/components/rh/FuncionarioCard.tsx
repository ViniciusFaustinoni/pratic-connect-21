import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FuncionarioCardProps {
  funcionario: {
    id: string;
    nome_completo: string;
    foto_url?: string | null;
    cargo?: { nome: string } | null;
    departamento?: { nome: string } | null;
    status: string;
    data_admissao?: string | null;
  };
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  ativo: { label: 'Ativo', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  ferias: { label: 'Férias', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  afastado: { label: 'Afastado', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  desligado: { label: 'Desligado', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
};

const sizeConfig = {
  sm: {
    card: 'w-40',
    avatar: 'h-8 w-8',
    nome: 'text-xs font-medium truncate',
    cargo: 'text-[10px] text-muted-foreground truncate',
    padding: 'p-2',
  },
  md: {
    card: 'w-52',
    avatar: 'h-12 w-12',
    nome: 'text-sm font-medium truncate',
    cargo: 'text-xs text-muted-foreground truncate',
    padding: 'p-4',
  },
  lg: {
    card: 'w-64',
    avatar: 'h-16 w-16',
    nome: 'text-base font-semibold',
    cargo: 'text-sm text-muted-foreground',
    padding: 'p-5',
  },
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

export function FuncionarioCard({ 
  funcionario, 
  onClick, 
  size = 'md',
  className 
}: FuncionarioCardProps) {
  const config = sizeConfig[size];
  const status = statusConfig[funcionario.status] || { label: funcionario.status, className: 'bg-gray-100 text-gray-800' };

  return (
    <Card
      className={cn(
        config.card,
        'cursor-pointer hover:shadow-lg transition-all hover:border-primary/50',
        className
      )}
      onClick={onClick}
    >
      <CardContent className={cn(config.padding, 'text-center')}>
        <Avatar className={cn(config.avatar, 'mx-auto mb-2')}>
          <AvatarImage src={funcionario.foto_url || ''} alt={funcionario.nome_completo} />
          <AvatarFallback className="bg-primary/10 text-primary">
            {getInitials(funcionario.nome_completo)}
          </AvatarFallback>
        </Avatar>

        <p className={config.nome}>{funcionario.nome_completo}</p>
        <p className={config.cargo}>{funcionario.cargo?.nome || 'Sem cargo'}</p>

        {size !== 'sm' && funcionario.departamento && (
          <Badge variant="outline" className="mt-2 text-xs">
            {funcionario.departamento.nome}
          </Badge>
        )}

        {size !== 'sm' && (
          <Badge className={cn('mt-2 ml-1', status.className)}>
            {status.label}
          </Badge>
        )}

        {size === 'lg' && funcionario.data_admissao && (
          <p className="text-xs text-muted-foreground mt-2">
            Desde {format(parseISO(funcionario.data_admissao), 'MMM yyyy', { locale: ptBR })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
