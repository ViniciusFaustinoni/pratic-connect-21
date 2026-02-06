import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Search, Wifi, WifiOff, Car, User } from 'lucide-react';
import { useRastreadoresInstalados, useAbrirVistoriaManutencao } from '@/hooks/useVistoriaManutencao';
import { 
  MOTIVOS_MANUTENCAO_OPTIONS,
  type MotivoManutencao,
} from '@/types/vistoriaManutencao';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AbrirManutencaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rastreadorPreSelecionado?: {
    id: string;
    codigo: string;
  };
}

export function AbrirManutencaoModal({ 
  open, 
  onOpenChange,
  rastreadorPreSelecionado,
}: AbrirManutencaoModalProps) {
  const [busca, setBusca] = useState('');
  const [rastreadorId, setRastreadorId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState<MotivoManutencao | ''>('');
  const [motivoDetalhe, setMotivoDetalhe] = useState('');

  const { data: rastreadores, isLoading: buscando } = useRastreadoresInstalados(busca);
  const abrirMutation = useAbrirVistoriaManutencao();

  // Pré-selecionar rastreador se passado
  useEffect(() => {
    if (rastreadorPreSelecionado) {
      setRastreadorId(rastreadorPreSelecionado.id);
      setBusca(rastreadorPreSelecionado.codigo);
    }
  }, [rastreadorPreSelecionado]);

  // Limpar ao fechar
  useEffect(() => {
    if (!open) {
      setBusca('');
      setRastreadorId(null);
      setMotivo('');
      setMotivoDetalhe('');
    }
  }, [open]);

  const rastreadorSelecionado = rastreadores?.find(r => r.id === rastreadorId);

  const handleSubmit = async () => {
    if (!rastreadorId || !motivo) return;

    await abrirMutation.mutateAsync({
      rastreadorId,
      motivo,
      motivoDetalhe: motivoDetalhe || undefined,
    });

    onOpenChange(false);
  };

  const isValid = rastreadorId && motivo;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Abrir Vistoria de Manutenção</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Busca de rastreador */}
          <div className="space-y-2">
            <Label>Rastreador *</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código, IMEI, placa ou associado..."
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  if (!e.target.value) setRastreadorId(null);
                }}
                className="pl-9"
              />
            </div>

            {/* Lista de resultados */}
            {busca && !rastreadorId && (
              <div className="border rounded-md max-h-48 overflow-auto">
                {buscando ? (
                  <div className="p-4 text-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  </div>
                ) : rastreadores && rastreadores.length > 0 ? (
                  rastreadores.slice(0, 10).map((r: any) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setRastreadorId(r.id);
                        setBusca(r.codigo);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-muted flex items-center justify-between"
                    >
                      <div>
                        <span className="font-mono font-medium">{r.codigo}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {r.veiculo?.placa} • {r.veiculo?.associado?.nome}
                        </span>
                      </div>
                      {r.ultima_comunicacao ? (
                        <Wifi className="h-4 w-4 text-green-600" />
                      ) : (
                        <WifiOff className="h-4 w-4 text-red-600" />
                      )}
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    Nenhum rastreador encontrado
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Dados do rastreador selecionado */}
          {rastreadorSelecionado && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Car className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {rastreadorSelecionado.veiculo?.marca} {rastreadorSelecionado.veiculo?.modelo}
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="font-mono">{rastreadorSelecionado.veiculo?.placa}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{rastreadorSelecionado.veiculo?.associado?.nome}</span>
                <span className="text-xs text-muted-foreground">
                  {rastreadorSelecionado.veiculo?.associado?.telefone}
                </span>
              </div>
              {rastreadorSelecionado.ultima_comunicacao && (
                <div className="text-xs text-muted-foreground">
                  Última comunicação: {formatDistanceToNow(new Date(rastreadorSelecionado.ultima_comunicacao), { locale: ptBR, addSuffix: true })}
                </div>
              )}
            </div>
          )}

          {/* Motivo */}
          <div className="space-y-2">
            <Label>Motivo da Manutenção *</Label>
            <Select
              value={motivo}
              onValueChange={(value) => setMotivo(value as MotivoManutencao)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo..." />
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS_MANUTENCAO_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex flex-col">
                      <span>{opt.label}</span>
                      <span className="text-xs text-muted-foreground">{opt.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Detalhes */}
          <div className="space-y-2">
            <Label>Detalhes (opcional)</Label>
            <Textarea
              placeholder="Descreva detalhes adicionais sobre o problema..."
              value={motivoDetalhe}
              onChange={(e) => setMotivoDetalhe(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!isValid || abrirMutation.isPending}
          >
            {abrirMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Abrir Manutenção
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
