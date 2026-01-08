import { Card, CardContent } from "@/components/ui/card";
import { setoresElogio } from "@/constants/ouvidoria";
import { cn } from "@/lib/utils";

interface SetorElogioSelectorProps {
  selectedSetor: string | null;
  onSelect: (setorId: string) => void;
  compact?: boolean;
}

export function SetorElogioSelector({ 
  selectedSetor, 
  onSelect, 
  compact = false 
}: SetorElogioSelectorProps) {
  return (
    <div className={cn(
      "grid gap-3",
      compact ? "grid-cols-2" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
    )}>
      {setoresElogio.map((setor) => {
        const Icon = setor.icon;
        const isSelected = selectedSetor === setor.id;
        
        return (
          <Card 
            key={setor.id}
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              "bg-green-50 border-green-200 hover:border-green-500",
              isSelected && "border-2 border-green-500 bg-green-100 shadow-md"
            )}
            onClick={() => onSelect(setor.id)}
          >
            <CardContent className={cn(
              "text-center space-y-2",
              compact ? "p-3" : "p-4"
            )}>
              <Icon className={cn(
                "mx-auto text-green-600",
                compact ? "h-6 w-6" : "h-8 w-8"
              )} />
              <p className={cn(
                "font-medium text-green-800",
                compact ? "text-xs" : "text-sm"
              )}>
                {setor.label}
              </p>
              {!compact && (
                <p className="text-xs text-green-600">{setor.desc}</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
