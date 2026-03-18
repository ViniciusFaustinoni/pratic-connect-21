import { useNavigate } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';

interface AcessoRapidoItem {
  icon: LucideIcon;
  label: string;
  rota: string;
  cor: string;
  bgCor: string;
  badge?: number;
}

interface CardAcessoRapidoProps {
  itens: AcessoRapidoItem[];
  colunas?: 3 | 4 | 5;
}

export function CardAcessoRapido({ 
  itens,
  colunas = 4 
}: CardAcessoRapidoProps) {
  const navigate = useNavigate();

  const gridCols = {
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
  };

  return (
    <div className={`grid ${gridCols[colunas]} gap-3`}>
      {itens.map((item, index) => {
        const Icon = item.icon;
        return (
          <button
            key={index}
            onClick={() => navigate(item.rota)}
            className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card border border-border hover:bg-muted/50 hover:shadow-sm transition-all active:scale-95"
          >
            <div className={`relative rounded-full p-2.5 ${item.bgCor}`}>
              <Icon className={`h-5 w-5 ${item.cor}`} />
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </div>
            <span className="text-xs font-medium text-foreground text-center">
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Botão individual (caso queira usar separado)
interface BotaoAcessoRapidoProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  cor: string;
  bgCor: string;
  badge?: number;
  disabled?: boolean;
}

export function BotaoAcessoRapido({
  icon: Icon,
  label,
  onClick,
  cor,
  bgCor,
  badge,
  disabled = false
}: BotaoAcessoRapidoProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card border border-border hover:bg-muted/50 hover:shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
    >
      <div className={`relative rounded-full p-2.5 ${bgCor}`}>
        <Icon className={`h-5 w-5 ${cor}`} />
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      <span className="text-xs font-medium text-foreground text-center">
        {label}
      </span>
    </button>
  );
}

export default CardAcessoRapido;
