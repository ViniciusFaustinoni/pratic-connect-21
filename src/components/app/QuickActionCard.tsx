import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface QuickActionCardProps {
  icon: React.ElementType;
  iconColor?: string;
  title: string;
  subtitle?: string;
  value?: string;
  badge?: string;
  badgeVariant?: 'default' | 'destructive' | 'outline' | 'secondary';
  highlight?: boolean;
  onClick?: () => void;
}

export function QuickActionCard({
  icon: Icon,
  iconColor = 'text-blue-600',
  title,
  subtitle,
  value,
  badge,
  badgeVariant = 'default',
  highlight = false,
  onClick,
}: QuickActionCardProps) {
  return (
    <Card
      className={`
        rounded-xl p-4 shadow-sm border cursor-pointer
        hover:shadow-md transition-all duration-200
        active:scale-[0.98]
        ${highlight ? 'bg-red-50' : 'bg-white'}
      `}
      onClick={onClick}
    >
      <div className="flex flex-col items-center text-center gap-2">
        <Icon className={`w-8 h-8 ${iconColor}`} />
        <span className="text-sm font-medium text-gray-900">{title}</span>
        {subtitle && (
          <span className="text-xs text-gray-500">{subtitle}</span>
        )}
        {value && (
          <span className="text-lg font-bold text-gray-900">{value}</span>
        )}
        {badge && (
          <Badge variant={badgeVariant}>{badge}</Badge>
        )}
      </div>
    </Card>
  );
}
