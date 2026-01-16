import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PlanWithDetails } from '@/types/plans';

interface PlanoCardDynamicProps {
  plan: PlanWithDetails;
}

// Mapeamento de cores da linha para classes Tailwind
const LINE_COLORS: Record<string, string> = {
  green: 'from-green-500 to-emerald-600',
  orange: 'from-orange-500 to-amber-600',
  purple: 'from-violet-500 to-purple-600',
  red: 'from-red-500 to-rose-600',
  blue: 'from-blue-500 to-blue-600',
};

// Mapeamento de cores do badge
const BADGE_COLORS: Record<string, string> = {
  yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
  green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
  purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
  red: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export function PlanoCardDynamic({ plan }: PlanoCardDynamicProps) {
  const [expanded, setExpanded] = useState(false);
  const BENEFICIOS_VISIVEIS = 4;

  // Ordenar benefícios: highlighted primeiro, depois por display_order
  const sortedBenefits = [...(plan.plan_benefits || [])].sort((a, b) => {
    if (a.is_highlighted && !b.is_highlighted) return -1;
    if (!a.is_highlighted && b.is_highlighted) return 1;
    return (a.display_order || 0) - (b.display_order || 0);
  });

  const temMaisBeneficios = sortedBenefits.length > BENEFICIOS_VISIVEIS;
  const beneficiosExibidos = expanded 
    ? sortedBenefits 
    : sortedBenefits.slice(0, BENEFICIOS_VISIVEIS);

  // Cor da linha de produto
  const lineColor = plan.product_lines?.color || 'blue';
  const gradientClass = LINE_COLORS[lineColor] || LINE_COLORS.blue;

  // Badge color
  const badgeColorClass = plan.badge_color 
    ? BADGE_COLORS[plan.badge_color] || BADGE_COLORS.yellow
    : BADGE_COLORS.yellow;

  // Coverage type badge color
  const getCoverageTypeClass = () => {
    if (plan.coverage_type?.includes('100%')) {
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
    }
    if (plan.coverage_type?.includes('80%')) {
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100';
    }
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100';
  };

  // Helper para obter o nome do benefício
  const getBenefitDisplayName = (planBenefit: typeof sortedBenefits[0]) => {
    // Se tiver custom_text, usa ele
    if (planBenefit.custom_text) {
      return planBenefit.custom_text;
    }
    // Senão usa o nome do benefício + additional_info
    const baseName = planBenefit.benefits?.name || 'Benefício';
    const additionalInfo = planBenefit.additional_info;
    return additionalInfo ? `${baseName} ${additionalInfo}` : baseName;
  };

  return (
    <Card className={cn(
      'relative overflow-hidden transition-all hover:shadow-lg h-full flex flex-col',
      plan.badge_text && 'ring-2 ring-primary'
    )}>
      {/* Borda colorida superior */}
      <div className={cn('h-2 bg-gradient-to-r', gradientClass)} />
      
      {/* Badge do plano */}
      {plan.badge_text && (
        <Badge className={cn('absolute top-4 right-4 text-xs', badgeColorClass)}>
          ⭐ {plan.badge_text}
        </Badge>
      )}

      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg">{plan.name}</CardTitle>
          {/* Badge de preço adicional */}
          {plan.additional_price && plan.additional_price > 0 && (
            <Badge variant="secondary" className="text-xs">
              +{formatCurrency(plan.additional_price)}/mês
            </Badge>
          )}
        </div>
        
        {/* Tags de cobertura e ano */}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {plan.coverage_type && (
            <Badge className={cn('text-xs', getCoverageTypeClass())}>
              {plan.coverage_type}
            </Badge>
          )}
          {plan.min_vehicle_year && (
            <Badge variant="outline" className="text-xs">
              {plan.min_vehicle_year}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 text-sm flex-1 flex flex-col">
        {/* Cota Passeio */}
        {plan.cota_passeio_percent && (
          <div>
            <p className="text-xs text-muted-foreground">Cota Passeio:</p>
            <p className="font-medium">
              {plan.cota_passeio_percent}% (mín {formatCurrency(plan.cota_passeio_min || 0)})
            </p>
            {/* Cota com Deságio */}
            {plan.cota_desagio_percent && (
              <p className="text-xs text-green-600 dark:text-green-400">
                Com Deságio: {plan.cota_desagio_percent}% (mín {formatCurrency(plan.cota_desagio_min || 0)})
              </p>
            )}
          </div>
        )}

        {/* Cota APP */}
        {plan.cota_app_percent && (
          <div>
            <p className="text-xs text-muted-foreground">Cota APP:</p>
            <p className="font-medium">
              {plan.cota_app_percent}% (mín {formatCurrency(plan.cota_app_min || 0)})
            </p>
          </div>
        )}

        {/* Benefícios */}
        <div className="flex-1">
          <p className="text-xs text-muted-foreground mb-2">Benefícios inclusos:</p>
          <div className="space-y-1">
            {beneficiosExibidos.map((planBenefit) => (
              <div key={planBenefit.id} className="flex items-start gap-2">
                <Check className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                <span className="text-xs">{getBenefitDisplayName(planBenefit)}</span>
              </div>
            ))}
          </div>
          
          {/* Botão Ver mais/menos */}
          {temMaisBeneficios && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 text-xs h-7"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Ver menos
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  +{sortedBenefits.length - BENEFICIOS_VISIVEIS} benefícios
                </>
              )}
            </Button>
          )}
        </div>

        {/* Alerta de restrição */}
        {plan.restriction_alert && (
          <div className="flex items-start gap-1.5 p-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 mt-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <span className="text-xs text-amber-700 dark:text-amber-300">{plan.restriction_alert}</span>
          </div>
        )}

        {/* Footer note */}
        {plan.footer_note && (
          <p className="text-xs text-muted-foreground italic border-t pt-2">
            {plan.footer_note}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
