import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  GripVertical,
  Edit,
  Copy,
  Trash2,
  ChevronDown,
  ChevronUp,
  Star,
  Check,
  X,
} from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import type { PlanWithDetails } from '@/types/plans';

interface PlanCardProps {
  plan: PlanWithDetails;
  lineColor?: string;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const BADGE_COLORS: Record<string, string> = {
  yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  green: 'bg-green-100 text-green-800 border-green-300',
  blue: 'bg-blue-100 text-blue-800 border-blue-300',
  purple: 'bg-purple-100 text-purple-800 border-purple-300',
  red: 'bg-red-100 text-red-800 border-red-300',
  orange: 'bg-orange-100 text-orange-800 border-orange-300',
};

const LINE_BORDER_COLORS: Record<string, string> = {
  green: 'border-t-green-500',
  orange: 'border-t-orange-500',
  purple: 'border-t-purple-500',
  red: 'border-t-red-500',
  blue: 'border-t-blue-500',
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function PlanCard({ plan, lineColor, onEdit, onDuplicate, onDelete }: PlanCardProps) {
  const [expanded, setExpanded] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: plan.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const sortedBenefits = [...(plan.plan_benefits || [])].sort((a, b) => {
    if (a.is_highlighted && !b.is_highlighted) return -1;
    if (!a.is_highlighted && b.is_highlighted) return 1;
    return (a.display_order || 0) - (b.display_order || 0);
  });

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'border-t-4',
        LINE_BORDER_COLORS[lineColor || 'blue'],
        !plan.is_active && 'opacity-60'
      )}
    >
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                {...attributes}
                {...listeners}
                className="cursor-grab hover:text-primary"
              >
                <GripVertical className="h-5 w-5 text-muted-foreground" />
              </button>

              <div className="flex items-center gap-2">
                <span className="font-semibold">{plan.name}</span>
                {!plan.is_active && (
                  <Badge variant="secondary" className="text-xs">
                    Inativo
                  </Badge>
                )}
                {(plan as any).tipo_uso === 'aplicativo' && (
                  <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/50 text-xs font-bold">
                    APP
                  </Badge>
                )}
                {plan.badge_text && (
                  <Badge
                    className={BADGE_COLORS[plan.badge_color || 'blue']}
                  >
                    {plan.badge_text}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Tags */}
              <div className="hidden md:flex items-center gap-1">
                {plan.coverage_type && (
                  <Badge variant="outline" className="text-xs">
                    {plan.coverage_type}
                  </Badge>
                )}
                {plan.min_vehicle_year && (
                  <Badge variant="outline" className="text-xs">
                    {plan.min_vehicle_year}
                  </Badge>
                )}
                {plan.additional_price && plan.additional_price > 0 && (
                  <Badge className="bg-green-100 text-green-800 border-green-300 text-xs">
                    +{formatCurrency(plan.additional_price)}/mês
                  </Badge>
                )}
              </div>

              {/* Actions */}
              <Button size="icon" variant="ghost" onClick={onEdit}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={onDuplicate}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={onDelete}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
              <CollapsibleTrigger asChild>
                <Button size="icon" variant="ghost">
                  {expanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>

          {/* Mobile Tags */}
          <div className="flex md:hidden flex-wrap gap-1 mt-2">
            {plan.coverage_type && (
              <Badge variant="outline" className="text-xs">
                {plan.coverage_type}
              </Badge>
            )}
            {plan.min_vehicle_year && (
              <Badge variant="outline" className="text-xs">
                {plan.min_vehicle_year}
              </Badge>
            )}
            {plan.additional_price && plan.additional_price > 0 && (
              <Badge className="bg-green-100 text-green-800 border-green-300 text-xs">
                +{formatCurrency(plan.additional_price)}/mês
              </Badge>
            )}
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 space-y-4">
            {/* Cotas */}
            <div className="grid grid-cols-3 gap-4 text-sm">
              {plan.cota_passeio_percent && (
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-muted-foreground text-xs">Passeio</p>
                  <p className="font-semibold">
                    {plan.cota_passeio_percent}%
                    {plan.cota_passeio_min && (
                      <span className="text-xs text-muted-foreground ml-1">
                        (mín {formatCurrency(plan.cota_passeio_min)})
                      </span>
                    )}
                  </p>
                </div>
              )}
              {plan.cota_desagio_percent && (
                <div className="bg-cyan-500/10 border border-cyan-500/20 p-3 rounded-lg">
                  <p className="text-cyan-400 text-xs">Deságio</p>
                  <p className="font-semibold text-cyan-300">
                    {plan.cota_desagio_percent}%
                    {plan.cota_desagio_min && (
                      <span className="text-xs text-cyan-400/70 ml-1">
                        (mín {formatCurrency(plan.cota_desagio_min)})
                      </span>
                    )}
                  </p>
                </div>
              )}
              {plan.cota_app_percent && (
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-muted-foreground text-xs">APP</p>
                  <p className="font-semibold">
                    {plan.cota_app_percent}%
                    {plan.cota_app_min && (
                      <span className="text-xs text-muted-foreground ml-1">
                        (mín {formatCurrency(plan.cota_app_min)})
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Benefits */}
            {sortedBenefits.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">
                  Benefícios ({sortedBenefits.length})
                </p>
                <ul className="space-y-1">
                  {sortedBenefits.map((pb) => (
                    <li
                      key={pb.id}
                      className="flex items-start gap-2 text-sm"
                    >
                      {pb.is_highlighted ? (
                        <Star className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                      )}
                      <span>
                        {pb.benefits?.icon} {pb.benefits?.name}
                        {pb.custom_text && (
                          <span className="text-muted-foreground ml-1">
                            - {pb.custom_text}
                          </span>
                        )}
                        {pb.custom_value && (
                          <span className="font-medium ml-1">
                            ({pb.custom_value})
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Alerts */}
            {plan.restriction_alert && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                ⚠️ {plan.restriction_alert}
              </div>
            )}

            {plan.footer_note && (
              <p className="text-xs text-muted-foreground italic">
                {plan.footer_note}
              </p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
