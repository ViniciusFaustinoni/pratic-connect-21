import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { useRastreadoresDisponiveis, type RastreadorWithRelations } from '@/hooks/useRastreadores';
import { useSubstituirEquipamento } from '@/hooks/useSubstituirEquipamento';

interface SubstituirEquipamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rastreadorAtual: RastreadorWithRelations | null;
}

const MOTIVOS_SUBSTITUICAO = [
  { value: 'defeito_hardware', label: 'Defeito de hardware' },
  { value: 'defeito_gps', label: 'Defeito no GPS' },
  { value: 'defeito_comunicacao', label: 'Defeito na comunicação' },
  { value: 'upgrade_equipamento', label: 'Upgrade de equipamento' },
  { value: 'solicitacao_cliente', label: 'Solicitação do cliente' },
  { value: 'outro', label: 'Outro motivo' },
];

export function SubstituirEquipamentoDialog({
  open,
  onOpenChange,
  rastreadorAtual,
}: SubstituirEquipamentoDialogProps) {
  const [novoRastreadorId, setNovoRastreadorId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const { data: rastreadoresDisponiveis, isLoading: loadingRastreadores } = useRastreadoresDisponiveis();
  const substituirEquipamento = useSubstituirEquipamento();

  // Filtrar rastreadores da mesma plataforma
  const rastreadoresCompativeis = rastreadoresDisponiveis?.filter(
    (r) => r.plataforma === rastreadorAtual?.plataforma
  ) || [];

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setNovoRastreadorId('');
      setMotivo('');
      setObservacoes('');
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!rastreadorAtual || !novoRastreadorId || !motivo) return;

    const motivoCompleto = observacoes
      ? `${MOTIVOS_SUBSTITUICAO.find((m) => m.value === motivo)?.label}: ${observacoes}`
      : MOTIVOS_SUBSTITUICAO.find((m) => m.value === motivo)?.label || motivo;

    await substituirEquipamento.mutateAsync({
      rastreadorAntigoId: rastreadorAtual.id,
      rastreadorNovoId: novoRastreadorId,
      motivoSubstituicao: motivoCompleto,
    });

    onOpenChange(false);
  };

  if (!rastreadorAtual) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Substituir Equipamento
          </DialogTitle>
          <DialogDescription>
            Substituir o rastreador {rastreadorAtual.codigo} por outro do estoque.
            O equipamento antigo será movido para manutenção.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Info do rastreador atual */}
          <div className="p-3 bg-muted rounded-lg space-y-1">
            <p className="text-sm font-medium">Equipamento atual:</p>
            <p className="text-sm text-muted-foreground">
              {rastreadorAtual.codigo} • IMEI: {rastreadorAtual.imei || 'N/A'}
            </p>
            {rastreadorAtual.veiculos && (
              <p className="text-sm text-muted-foreground">
                Instalado em: {rastreadorAtual.veiculos.placa}
              </p>
            )}
          </div>

          {/* Alerta de compatibilidade */}
          {rastreadoresCompativeis.length === 0 && !loadingRastreadores && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <p className="text-sm">
                Não há rastreadores da plataforma {rastreadorAtual.plataforma} disponíveis em estoque.
              </p>
            </div>
          )}

          {/* Seleção do novo rastreador */}
          <div className="space-y-2">
            <Label htmlFor="novo-rastreador">Novo rastreador *</Label>
            <Select value={novoRastreadorId} onValueChange={setNovoRastreadorId}>
              <SelectTrigger id="novo-rastreador">
                <SelectValue placeholder={
                  loadingRastreadores 
                    ? 'Carregando...' 
                    : 'Selecione o novo rastreador'
                } />
              </SelectTrigger>
              <SelectContent>
                {rastreadoresCompativeis.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.codigo} • IMEI: {r.imei || 'N/A'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Motivo da substituição */}
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo da substituição *</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger id="motivo">
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS_SUBSTITUICAO.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações adicionais</Label>
            <Textarea
              id="observacoes"
              placeholder="Descreva detalhes adicionais se necessário..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={substituirEquipamento.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !novoRastreadorId || 
              !motivo || 
              substituirEquipamento.isPending ||
              rastreadoresCompativeis.length === 0
            }
          >
            {substituirEquipamento.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Substituindo...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Confirmar Substituição
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
