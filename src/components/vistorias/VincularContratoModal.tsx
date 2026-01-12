import { useState } from 'react';
import { CheckCircle, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useContratosPendentesVinculo } from '@/hooks/useVistorias';

interface VincularContratoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmar: (contratoId: string | null) => void;
  isPending?: boolean;
}

export function VincularContratoModal({
  open,
  onOpenChange,
  onConfirmar,
  isPending = false,
}: VincularContratoModalProps) {
  const [search, setSearch] = useState('');
  const [selectedContrato, setSelectedContrato] = useState<string | null>(null);
  const [naoVincular, setNaoVincular] = useState(false);

  const { data: contratos = [], isLoading } = useContratosPendentesVinculo();

  const contratosFiltrados = contratos.filter((c) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      c.numero.toLowerCase().includes(searchLower) ||
      c.lead_nome?.toLowerCase().includes(searchLower) ||
      c.veiculo_placa?.toLowerCase().includes(searchLower)
    );
  });

  const handleConfirmar = () => {
    onConfirmar(naoVincular ? null : selectedContrato);
  };

  const handleNaoVincularChange = (checked: boolean) => {
    setNaoVincular(checked);
    if (checked) {
      setSelectedContrato(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-600">
            <CheckCircle className="h-5 w-5" />
            Vincular Vistoria a um Contrato
          </DialogTitle>
          <DialogDescription>
            Selecione o contrato para vincular esta vistoria aprovada. Isso permitirá que o contrato apareça na aba de Ativações.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número, nome ou placa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              disabled={naoVincular}
            />
          </div>

          {/* Lista de contratos */}
          <div className={cn(
            "border rounded-lg divide-y max-h-64 overflow-y-auto",
            naoVincular && "opacity-50 pointer-events-none"
          )}>
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p>Carregando contratos...</p>
              </div>
            ) : contratosFiltrados.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <p>Nenhum contrato pendente encontrado</p>
              </div>
            ) : (
              contratosFiltrados.map((contrato) => (
                <div
                  key={contrato.id}
                  className={cn(
                    "flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors",
                    selectedContrato === contrato.id && "bg-primary/10 border-l-4 border-l-primary"
                  )}
                  onClick={() => setSelectedContrato(contrato.id)}
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-semibold text-sm">{contrato.numero}</span>
                      {contrato.veiculo_placa && (
                        <span className="text-xs px-2 py-0.5 bg-muted rounded-full font-mono">
                          {contrato.veiculo_placa}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {contrato.lead_nome || 'Cliente não identificado'}
                      {contrato.veiculo_marca && contrato.veiculo_modelo && (
                        <span className="ml-2">
                          • {contrato.veiculo_marca} {contrato.veiculo_modelo}
                        </span>
                      )}
                    </div>
                  </div>
                  {selectedContrato === contrato.id && (
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Checkbox não vincular */}
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="nao-vincular"
              checked={naoVincular}
              onCheckedChange={handleNaoVincularChange}
            />
            <Label 
              htmlFor="nao-vincular" 
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Não vincular agora (criar vistoria avulsa)
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmar}
            disabled={(!selectedContrato && !naoVincular) || isPending}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Finalizando...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirmar e Finalizar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
