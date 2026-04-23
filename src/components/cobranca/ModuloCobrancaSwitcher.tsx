import { Link, useLocation } from 'react-router-dom';
import { Receipt, Headset, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Atalho exibido no topo dos módulos de cobrança para reduzir
 * a confusão entre `/financeiro/cobrancas` (faturas/boletos)
 * e `/cobranca` (gestão de inadimplência / relacionamento).
 */
export function ModuloCobrancaSwitcher() {
  const location = useLocation();
  const isFinanceiro = location.pathname.startsWith('/financeiro/cobrancas');
  const isRelacionamento = location.pathname === '/cobranca' || location.pathname.startsWith('/cobranca/');

  const cards = [
    {
      key: 'financeiro',
      to: '/financeiro/cobrancas',
      icon: Receipt,
      title: 'Faturas & Boletos',
      desc: 'Emissão e gestão de cobranças individuais',
      active: isFinanceiro,
    },
    {
      key: 'relacionamento',
      to: '/cobranca',
      icon: Headset,
      title: 'Recuperação & Relacionamento',
      desc: 'Inadimplentes, régua, acordos e negativação',
      active: isRelacionamento,
    },
  ] as const;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Link
            key={c.key}
            to={c.to}
            className={cn(
              'group flex items-center gap-3 rounded-lg border p-3 transition-colors',
              c.active
                ? 'border-primary/40 bg-primary/5'
                : 'border-border hover:border-primary/30 hover:bg-muted/50'
            )}
          >
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-md',
                c.active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold truncate">{c.title}</span>
                {c.active && (
                  <span className="text-[10px] uppercase tracking-wide font-medium text-primary">
                    Você está aqui
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">{c.desc}</p>
            </div>
            {!c.active && (
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </Link>
        );
      })}
    </div>
  );
}
