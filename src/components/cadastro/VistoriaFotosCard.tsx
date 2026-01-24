import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Camera,
  Eye,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Car,
  Gauge,
  Fingerprint,
  LayoutGrid,
  PenTool,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface VistoriaFotoInfo {
  id: string;
  tipo: string;
  arquivo_url: string;
  created_at: string;
}

// Labels e ícones para tipos de foto da vistoria - MAPA COMPLETO
const TIPO_FOTO_CONFIG: Record<string, { label: string; categoria: string; icon: React.ComponentType<{ className?: string }>; highlight?: boolean }> = {
  // Identificação (destaque especial)
  assinatura_cliente: { label: 'Assinatura do Cliente', categoria: 'Identificação', icon: PenTool, highlight: true },
  selfie_veiculo: { label: 'Selfie com Veículo', categoria: 'Identificação', icon: Camera, highlight: true },
  selfie: { label: 'Selfie com Veículo', categoria: 'Identificação', icon: Camera, highlight: true },
  vistoriador: { label: 'Vistoriador', categoria: 'Identificação', icon: Camera },
  chave: { label: 'Chave', categoria: 'Identificação', icon: Fingerprint },
  chassi: { label: 'Chassi', categoria: 'Identificação', icon: Fingerprint },
  placa: { label: 'Placa', categoria: 'Identificação', icon: Car },
  
  // Motor
  capo_aberto: { label: 'Capô Aberto', categoria: 'Motor', icon: Car },
  motor: { label: 'Motor', categoria: 'Motor', icon: Gauge },
  bateria: { label: 'Bateria', categoria: 'Motor', icon: Gauge },
  
  // Exterior - Ângulos básicos
  frente: { label: 'Frente', categoria: 'Exterior', icon: Car },
  traseira: { label: 'Traseira', categoria: 'Exterior', icon: Car },
  lateral_esquerda: { label: 'Lateral Esquerda', categoria: 'Exterior', icon: Car },
  lateral_direita: { label: 'Lateral Direita', categoria: 'Exterior', icon: Car },
  
  // Exterior - Diagonais
  diagonal_frontal_esquerda: { label: 'Diagonal Frontal Esquerda', categoria: 'Exterior', icon: Car },
  diagonal_frontal_direita: { label: 'Diagonal Frontal Direita', categoria: 'Exterior', icon: Car },
  diagonal_traseira_esquerda: { label: 'Diagonal Traseira Esquerda', categoria: 'Exterior', icon: Car },
  diagonal_traseira_direita: { label: 'Diagonal Traseira Direita', categoria: 'Exterior', icon: Car },
  frente_lateral_esquerda: { label: 'Frente Lateral Esquerda', categoria: 'Exterior', icon: Car },
  frente_lateral_direita: { label: 'Frente Lateral Direita', categoria: 'Exterior', icon: Car },
  traseira_lateral_esquerda: { label: 'Traseira Lateral Esquerda', categoria: 'Exterior', icon: Car },
  traseira_lateral_direita: { label: 'Traseira Lateral Direita', categoria: 'Exterior', icon: Car },
  
  // Exterior - Detalhes
  teto: { label: 'Teto', categoria: 'Exterior', icon: Car },
  parabrisa: { label: 'Para-brisa', categoria: 'Exterior', icon: Car },
  
  // Pneus
  pneu_dianteiro_esquerdo: { label: 'Pneu Dianteiro Esquerdo', categoria: 'Pneus', icon: Gauge },
  pneu_dianteiro_direito: { label: 'Pneu Dianteiro Direito', categoria: 'Pneus', icon: Gauge },
  pneu_traseiro_esquerdo: { label: 'Pneu Traseiro Esquerdo', categoria: 'Pneus', icon: Gauge },
  pneu_traseiro_direito: { label: 'Pneu Traseiro Direito', categoria: 'Pneus', icon: Gauge },
  estepe: { label: 'Estepe', categoria: 'Pneus', icon: Gauge },
  
  // Interior
  painel: { label: 'Painel', categoria: 'Interior', icon: LayoutGrid },
  hodometro: { label: 'Hodômetro', categoria: 'Interior', icon: Gauge },
  odometro: { label: 'Hodômetro', categoria: 'Interior', icon: Gauge },
  banco_dianteiro: { label: 'Banco Dianteiro', categoria: 'Interior', icon: LayoutGrid },
  banco_traseiro: { label: 'Banco Traseiro', categoria: 'Interior', icon: LayoutGrid },
  porta_malas: { label: 'Porta-malas', categoria: 'Interior', icon: Car },
  volante: { label: 'Volante', categoria: 'Interior', icon: LayoutGrid },
  console_central: { label: 'Console Central', categoria: 'Interior', icon: LayoutGrid },
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; className: string }> = {
  aprovada: { label: 'Aprovada', icon: CheckCircle, className: 'bg-success/20 text-success border-success' },
  pendente: { label: 'Pendente', icon: Clock, className: 'bg-warning/20 text-warning border-warning' },
  em_analise: { label: 'Em Análise', icon: AlertCircle, className: 'bg-info/20 text-info border-info' },
  reprovada: { label: 'Reprovada', icon: XCircle, className: 'bg-destructive/20 text-destructive border-destructive' },
};

interface VistoriaFotosCardProps {
  fotos: VistoriaFotoInfo[];
  vistoriaStatus?: string;
  modalidade?: string; // 'autovistoria' | 'presencial' | 'ponto_fixo'
}

export function VistoriaFotosCard({ fotos, vistoriaStatus, modalidade }: VistoriaFotosCardProps) {
  const [selectedFoto, setSelectedFoto] = useState<VistoriaFotoInfo | null>(null);

  // Determinar se é auto-vistoria baseado na modalidade
  const isAutovistoria = modalidade === 'autovistoria' || modalidade === 'auto_vistoria';
  const tituloCard = isAutovistoria ? 'Auto Vistoria' : 'Fotos da Vistoria';
  const descricaoCard = isAutovistoria 
    ? 'Fotos enviadas pelo associado' 
    : 'Fotos registradas pelo vistoriador';

  if (!fotos || fotos.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Camera className="h-5 w-5 text-primary" />
            {tituloCard}
          </CardTitle>
          <CardDescription>{descricaoCard}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Camera className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma foto da vistoria encontrada</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getFotoConfig = (tipo: string) => {
    return TIPO_FOTO_CONFIG[tipo] || { label: tipo, categoria: 'Outros', icon: Camera };
  };

  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status] || STATUS_CONFIG.pendente;
  };

  const statusConfig = getStatusConfig(vistoriaStatus || 'pendente');
  const StatusIcon = statusConfig.icon;

  // Agrupar fotos por categoria
  const fotosPorCategoria = fotos.reduce((acc, foto) => {
    const config = getFotoConfig(foto.tipo);
    if (!acc[config.categoria]) {
      acc[config.categoria] = [];
    }
    acc[config.categoria].push(foto);
    return acc;
  }, {} as Record<string, VistoriaFotoInfo[]>);

  const categoriaOrder = ['Identificação', 'Motor', 'Exterior', 'Pneus', 'Interior', 'Outros'];

  return (
    <>
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Camera className="h-5 w-5 text-primary" />
            {tituloCard}
            <Badge variant="secondary" className="ml-2">
              {fotos.length} foto{fotos.length !== 1 ? 's' : ''}
            </Badge>
            <Badge className={cn('text-xs ml-auto', statusConfig.className)}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConfig.label}
            </Badge>
          </CardTitle>
          <CardDescription>{descricaoCard}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {categoriaOrder.map((categoria) => {
            const fotosCategoria = fotosPorCategoria[categoria];
            if (!fotosCategoria || fotosCategoria.length === 0) return null;

            return (
              <div key={categoria}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {categoria}
                </p>
                <div className="space-y-2">
                  {fotosCategoria.map((foto) => {
                    const fotoConfig = getFotoConfig(foto.tipo);
                    const FotoIcon = fotoConfig.icon;

                    return (
                      <div
                        key={foto.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group"
                        onClick={() => setSelectedFoto(foto)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-background border border-border">
                              <img
                                src={foto.arquivo_url}
                                alt={fotoConfig.label}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            </div>
                          </div>
                          <div>
                            <p className="font-medium text-foreground text-sm">{fotoConfig.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(foto.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Dialog de Visualização */}
      <Dialog open={!!selectedFoto} onOpenChange={(open) => !open && setSelectedFoto(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <DialogTitle>
                {selectedFoto && getFotoConfig(selectedFoto.tipo).label}
              </DialogTitle>
              <Badge variant="secondary">
                {selectedFoto && getFotoConfig(selectedFoto.tipo).categoria}
              </Badge>
            </div>
          </DialogHeader>

          {selectedFoto && (
            <div className="flex flex-col items-center py-4">
              <img
                src={selectedFoto.arquivo_url}
                alt={getFotoConfig(selectedFoto.tipo).label}
                className="max-h-[60vh] max-w-full object-contain rounded-lg"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Enviado em {format(new Date(selectedFoto.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
