import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RotaAgrupada } from "@/hooks/useVistoriasMapa";
import { getRotaColor, SEM_ROTA_COLOR } from "@/lib/rota-colors";

interface MapaRotasLegendaProps {
  rotas: RotaAgrupada[];
  rotasIds: string[];
  rotaSelecionada: string | null;
  onRotaClick: (rotaId: string | null) => void;
  dataSelecionada?: Date;
}

export function MapaRotasLegenda({
  rotas,
  rotasIds,
  rotaSelecionada,
  onRotaClick,
  dataSelecionada,
}: MapaRotasLegendaProps) {
  if (rotas.length === 0) return null;

  return (
    <div className="absolute top-4 right-4 z-40 bg-background/95 backdrop-blur-sm rounded-lg shadow-lg border max-w-[220px]">
      <div className="p-3 border-b">
        <h4 className="font-semibold text-sm flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Rotas {dataSelecionada && format(dataSelecionada, "dd/MM", { locale: ptBR })}
        </h4>
      </div>
      
      <ScrollArea className="max-h-[300px]">
        <div className="p-2 space-y-1">
          {/* Opção para mostrar todas */}
          <button
            onClick={() => onRotaClick(null)}
            className={`w-full flex items-center gap-2 p-2 rounded-md text-left text-sm transition-colors hover:bg-muted ${
              rotaSelecionada === null ? 'bg-primary/10 border border-primary/30' : ''
            }`}
          >
            <span className="flex gap-0.5">
              {rotasIds.slice(0, 4).map((id) => (
                <span
                  key={id}
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getRotaColor(id, rotasIds) }}
                />
              ))}
            </span>
            <span className="font-medium">Todas as rotas</span>
          </button>

          {rotas.map((rota) => {
            const color = rota.rota_id 
              ? getRotaColor(rota.rota_id, rotasIds)
              : SEM_ROTA_COLOR;
            const isSelected = rotaSelecionada === (rota.rota_id || 'sem_rota');
            
            return (
              <button
                key={rota.rota_id || 'sem_rota'}
                onClick={() => onRotaClick(rota.rota_id || 'sem_rota')}
                className={`w-full flex items-center gap-2 p-2 rounded-md text-left text-sm transition-colors hover:bg-muted ${
                  isSelected ? 'bg-primary/10 border border-primary/30' : ''
                }`}
              >
                <span
                  className="w-4 h-4 rounded-full flex-shrink-0 border-2 border-white shadow-sm"
                  style={{ backgroundColor: color }}
                />
                <div className="flex-1 min-w-0">
                  {rota.rota_id ? (
                    <>
                      <p className="font-medium truncate text-xs">
                        {rota.rota_codigo || 'Rota'}
                      </p>
                      {rota.vistoriador_nome && (
                        <p className="text-muted-foreground truncate text-xs">
                          {rota.vistoriador_nome}
                        </p>
                      )}
                      {rota.rota_regiao && (
                        <p className="text-muted-foreground truncate text-xs">
                          {rota.rota_regiao}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground text-xs">Sem rota atribuída</p>
                  )}
                </div>
                <Badge variant="secondary" className="text-xs px-1.5">
                  {rota.vistorias.filter(v => v.latitude && v.longitude).length}
                </Badge>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
