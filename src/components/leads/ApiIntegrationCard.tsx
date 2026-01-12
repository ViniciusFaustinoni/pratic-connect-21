import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Facebook,
  Instagram,
  Globe,
  MessageCircle,
  Zap,
  Link,
  Settings,
  FileText,
  Clock,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { ApiLeadsConfig } from '@/hooks/useApiLeadsConfig';

const ICON_MAP: Record<string, React.ElementType> = {
  'search': Search,
  'google': Search,
  'facebook': Facebook,
  'instagram': Instagram,
  'globe': Globe,
  'message-circle': MessageCircle,
  'zap': Zap,
  'link': Link,
};

interface ApiIntegrationCardProps {
  config: ApiLeadsConfig;
  onToggle: (id: string, ativo: boolean) => void;
  onOpenLogs: (config: ApiLeadsConfig) => void;
  onOpenTutorial: (config: ApiLeadsConfig) => void;
  isToggling?: boolean;
}

export function ApiIntegrationCard({
  config,
  onToggle,
  onOpenLogs,
  onOpenTutorial,
  isToggling,
}: ApiIntegrationCardProps) {
  const Icon = ICON_MAP[config.icone] || Link;

  const formatLastLead = (date: string | null) => {
    if (!date) return null;
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
    } catch {
      return null;
    }
  };

  return (
    <Card className={cn(
      "transition-all duration-200 hover:shadow-md",
      config.ativo ? "border-l-4" : "opacity-75",
    )} style={{ borderLeftColor: config.ativo ? config.cor : undefined }}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Icon and Info */}
          <div className="flex items-start gap-3 flex-1">
            <div 
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${config.cor}20` }}
            >
              <Icon className="h-5 w-5" style={{ color: config.cor }} />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-sm">{config.nome}</h3>
                <Badge 
                  variant={config.ativo ? "default" : "secondary"}
                  className="text-xs"
                >
                  {config.ativo ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
              
              <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                <span className="font-medium">
                  {config.leads_recebidos} leads
                </span>
                {config.ultimo_lead_em && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatLastLead(config.ultimo_lead_em)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Toggle */}
          <Switch
            checked={config.ativo}
            onCheckedChange={(checked) => onToggle(config.id, checked)}
            disabled={isToggling}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => onOpenTutorial(config)}
          >
            <Settings className="h-3.5 w-3.5 mr-1.5" />
            Configurar
          </Button>
          
          {config.leads_recebidos > 0 && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onOpenLogs(config)}
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Logs
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
