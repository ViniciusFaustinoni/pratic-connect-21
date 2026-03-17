import { Car, Star, Shield, Zap, Bike } from 'lucide-react';
import { PlanoCardDynamic } from './PlanoCardDynamic';
import type { ProductLine } from '@/types/plans';
import type { PlanWithDetails } from '@/hooks/usePlans';

interface PlanoLineSectionProps {
  productLine: ProductLine;
  plans: PlanWithDetails[];
}

// Mapeamento de ícones das linhas
const LINE_ICONS: Record<string, React.ReactNode> = {
  green: <Car className="h-5 w-5 text-green-600" />,
  orange: <Shield className="h-5 w-5 text-orange-600" />,
  purple: <Zap className="h-5 w-5 text-violet-600" />,
  red: <Bike className="h-5 w-5 text-red-600" />,
};

// Fallback genérico — ícone real vem de productLine.icon
const DEFAULT_ICON = <Car className="h-5 w-5 text-primary" />;

export function PlanoLineSection({ productLine, plans }: PlanoLineSectionProps) {
  // Não renderizar se não houver planos
  if (!plans || plans.length === 0) {
    return null;
  }

  // Escolher ícone baseado na cor ou slug
  const icon = productLine.icon 
    ? <span className="text-xl">{productLine.icon}</span>
    : SLUG_ICONS[productLine.slug] || LINE_ICONS[productLine.color || 'blue'] || <Car className="h-5 w-5" />;

  // Determinar número de colunas baseado na quantidade de planos
  const getGridCols = () => {
    if (plans.length === 1) return 'md:grid-cols-1 max-w-xl';
    if (plans.length === 2) return 'md:grid-cols-2';
    return 'md:grid-cols-3';
  };

  return (
    <section>
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        {icon}
        {productLine.name}
      </h2>
      <div className={`grid gap-4 ${getGridCols()}`}>
        {plans.map((plan) => (
          <PlanoCardDynamic 
            key={plan.id} 
            plan={plan}
          />
        ))}
      </div>
    </section>
  );
}
