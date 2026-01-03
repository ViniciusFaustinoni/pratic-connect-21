import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const colorVariants = {
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-green-100 text-green-600',
  red: 'bg-red-100 text-red-600',
  orange: 'bg-orange-100 text-orange-600',
  purple: 'bg-purple-100 text-purple-600',
};

interface QuickActionCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  value?: string;
  color?: 'blue' | 'green' | 'red' | 'orange' | 'purple';
  onClick?: () => void;
  badge?: string;
}

export function QuickActionCard({
  icon: Icon,
  title,
  subtitle,
  value,
  color = 'blue',
  onClick,
  badge,
}: QuickActionCardProps) {
  return (
    <Card
      className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer relative"
      onClick={onClick}
    >
      {badge && (
        <Badge 
          variant="destructive" 
          className="absolute -top-2 -right-2"
        >
          {badge}
        </Badge>
      )}

      <div className="flex flex-col items-center text-center">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${colorVariants[color]}`}>
          <Icon className="w-6 h-6" />
        </div>

        <span className="font-medium mt-3">{title}</span>

        {value && (
          <span className="text-lg font-semibold">{value}</span>
        )}

        {subtitle && (
          <span className="text-xs text-gray-500 mt-1">{subtitle}</span>
        )}
      </div>
    </Card>
  );
}
