import { useState, useRef } from 'react';
import { AlertTriangle, Camera, X, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const MOTIVOS_RECUSA = [
  { value: 'condicoes_precarias', label: 'Condições precárias do veículo' },
  { value: 'danos_estruturais', label: 'Danos estruturais identificados' },
  { value: 'adulteracoes', label: 'Adulterações ou modificações não autorizadas' },
  { value: 'quilometragem_adulterada', label: 'Quilometragem possivelmente adulterada' },
  { value: 'documentacao_irregular', label: 'Documentação irregular' },
  { value: 'chassi_divergente', label: 'Chassi divergente do documento' },
  { value: 'sinais_sinistro', label: 'Sinais de sinistro anterior não declarado' },
  { value: 'sistema_eletrico', label: 'Sistema elétrico comprometido' },
  { value: 'outro', label: 'Outro motivo' },
];

const MAX_FOTOS = 5;

interface FotoRecusa {
  file: File;
  preview: string;
}

interface ModalRecusaVeiculoComFotosProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: {
    motivo: string;
    motivoCompleto: string;
    detalhes: string;
    fotos: File[];
  }) => void;
  isPending?: boolean;
  veiculoInfo?: {
    placa?: string;
    modelo?: string;
  };
}

export function ModalRecusaVeiculoComFotos({
  open,
  onClose,
  onConfirm,
  isPending = false,
  veiculoInfo,
}: ModalRecusaVeiculoComFotosProps) {
  const [motivoSelecionado, setMotivoSelecionado] = useState<string>('');
  const [detalhes, setDetalhes] = useState('');
  const [fotos, setFotos] = useState<FotoRecusa[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAddFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && fotos.length < MAX_FOTOS) {
      const preview = URL.createObjectURL(file);
      setFotos(prev => [...prev, { file, preview }]);
    }
    e.target.value = '';
  };

  const handleRemoveFoto = (index: number) => {
    setFotos(prev => {
      const foto = prev[index];
      URL.revokeObjectURL(foto.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleConfirm = () => {
    const motivo = MOTIVOS_RECUSA.find(m => m.value === motivoSelecionado)?.label || motivoSelecionado;
    const motivoCompleto = detalhes ? `${motivo}: ${detalhes}` : motivo;
    onConfirm({
      motivo: motivoSelecionado,
      motivoCompleto,
      detalhes,
      fotos: fotos.map(f => f.file),
    });
  };

  const handleClose = () => {
    // Limpar previews
    fotos.forEach(f => URL.revokeObjectURL(f.preview));
    setMotivoSelecionado('');
    setDetalhes('');
    setFotos([]);
    onClose();
  };

  const isValid = motivoSelecionado && 
    (motivoSelecionado !== 'outro' || detalhes.trim().length > 10) &&
    detalhes.trim().length > 0 &&
    fotos.length > 0; // Observações e fotos são obrigatórias

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Recusar Veículo
          </DialogTitle>
          <DialogDescription>
            {veiculoInfo && (
              <span className="font-medium">
                {veiculoInfo.modelo} - {veiculoInfo.placa}
              </span>
            )}
            <br />
            Esta ação irá recusar o veículo e notificar o associado. O veículo não será ativado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Motivo */}
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo da Recusa *</Label>
            <Select value={motivoSelecionado} onValueChange={setMotivoSelecionado}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS_RECUSA.map((motivo) => (
                  <SelectItem key={motivo.value} value={motivo.value}>
                    {motivo.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Detalhes */}
          <div className="space-y-2">
            <Label htmlFor="detalhes">
              Observações / Explicação *
            </Label>
            <Textarea
              id="detalhes"
              placeholder="Descreva detalhes sobre a recusa do veículo..."
              value={detalhes}
              onChange={(e) => setDetalhes(e.target.value)}
              rows={4}
            />
            {detalhes.trim().length === 0 && (
              <p className="text-xs text-amber-500">
                As observações são obrigatórias
              </p>
            )}
          </div>

          {/* Fotos de evidência */}
          <div className="space-y-2">
            <Label>Fotos de Evidência (obrigatório, até {MAX_FOTOS}) *</Label>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleAddFoto}
              className="hidden"
            />
            
            <div className="grid grid-cols-3 gap-2">
              {fotos.map((foto, index) => (
                <div key={index} className="relative aspect-square">
                  <img
                    src={foto.preview}
                    alt={`Evidência ${index + 1}`}
                    className="h-full w-full rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveFoto(index)}
                    className="absolute -right-1 -top-1 rounded-full bg-red-500 p-1 text-white shadow-lg"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              
              {fotos.length < MAX_FOTOS && (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex aspect-square flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 hover:border-slate-400"
                >
                  <Camera className="h-6 w-6 text-slate-400" />
                  <span className="mt-1 text-xs text-slate-500">Adicionar</span>
                </button>
              )}
            </div>
            {fotos.length === 0 && (
              <p className="text-xs text-amber-500">
                É obrigatório anexar pelo menos uma foto de evidência
              </p>
            )}
            <p className="text-xs text-slate-500">
              Anexe fotos dos problemas identificados no veículo
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isValid || isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              'Confirmar Recusa'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}