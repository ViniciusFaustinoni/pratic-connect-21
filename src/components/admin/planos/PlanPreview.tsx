import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Star } from 'lucide-react';

interface PlanPreviewProps {
  plan: any;
}

const BADGE_COLORS: Record<string, string> = {
  yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  green: 'bg-green-100 text-green-800 border-green-300',
  blue: 'bg-blue-100 text-blue-800 border-blue-300',
  purple: 'bg-purple-100 text-purple-800 border-purple-300',
  red: 'bg-red-100 text-red-800 border-red-300',
  orange: 'bg-orange-100 text-orange-800 border-orange-300',
};

const LINE_COLORS: Record<string, string> = {
  green: 'from-green-500 to-emerald-500',
  orange: 'from-orange-500 to-amber-500',
  purple: 'from-purple-500 to-violet-500',
  red: 'from-red-500 to-rose-500',
  blue: 'from-blue-500 to-cyan-500',
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function PlanPreview({ plan }: PlanPreviewProps) {
  const lineColor = plan.product_lines?.color || 'blue';
  const gradientClass = LINE_COLORS[lineColor] || LINE_COLORS.blue;

  const sortedBenefits = [...(plan.plan_benefits || [])]
    .filter((pb: any) => pb.benefits)
    .sort((a: any, b: any) => {
      if (a.is_highlighted && !b.is_highlighted) return -1;
      if (!a.is_highlighted && b.is_highlighted) return 1;
      return (a.display_order || 0) - (b.display_order || 0);
    })
    .slice(0, 5);

  return (
    <Card className="overflow-hidden">
      {/* Top gradient border */}
      <div className={`h-1 bg-gradient-to-r ${gradientClass}`} />

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm">{plan.name || 'Nome do Plano'}</h3>
          {plan.badge_text && (
            <Badge
              className={`text-[10px] ${BADGE_COLORS[plan.badge_color || 'blue']}`}
            >
              {plan.badge_text}
            </Badge>
          )}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mt-1">
          {plan.coverage_type && (
            <Badge variant="outline" className="text-[10px]">
              {plan.coverage_type}
            </Badge>
          )}
          {plan.min_vehicle_year && (
            <Badge variant="outline" className="text-[10px]">
              {plan.min_vehicle_year}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 text-xs">
        {/* Additional Price */}
        {plan.additional_price && plan.additional_price > 0 && (
          <div className="bg-amber-50 text-amber-800 px-2 py-1 rounded text-center">
            +{formatCurrency(plan.additional_price)}/mês
          </div>
        )}

        {/* Cotas */}
        {(plan.cota_passeio_percent || plan.cota_desagio_percent || plan.cota_app_percent) && (
          <div className="grid grid-cols-3 gap-1 text-center">
            {plan.cota_passeio_percent && (
              <div className="bg-muted/50 p-1.5 rounded">
                <p className="text-muted-foreground text-[10px]">Passeio</p>
                <p className="font-semibold">{plan.cota_passeio_percent}%</p>
              </div>
            )}
            {plan.cota_desagio_percent && (
              <div className="bg-muted/50 p-1.5 rounded">
                <p className="text-muted-foreground text-[10px]">Deságio</p>
                <p className="font-semibold">{plan.cota_desagio_percent}%</p>
              </div>
            )}
            {plan.cota_app_percent && (
              <div className="bg-muted/50 p-1.5 rounded">
                <p className="text-muted-foreground text-[10px]">APP</p>
                <p className="font-semibold">{plan.cota_app_percent}%</p>
              </div>
            )}
          </div>
        )}

        {/* Benefits */}
        {sortedBenefits.length > 0 && (
          <ul className="space-y-1">
            {sortedBenefits.map((pb: any, index: number) => (
              <li key={index} className="flex items-start gap-1">
                {pb.is_highlighted ? (
                  <Star className="h-3 w-3 text-yellow-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <Check className="h-3 w-3 text-green-500 flex-shrink-0 mt-0.5" />
                )}
                <span className="truncate">
                  {pb.benefits?.icon} {pb.benefits?.name}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Restriction Alert */}
        {plan.restriction_alert && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-yellow-800 text-[10px]">
            ⚠️ {plan.restriction_alert}
          </div>
        )}

        {/* Footer Note */}
        {plan.footer_note && (
          <p className="text-muted-foreground italic text-[10px]">
            {plan.footer_note}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
