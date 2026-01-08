import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface EncaminharModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manifestacaoId: string;
  onSuccess?: () => void;
}

const analistas = [
  { id: '1', nome: 'Ana Paula' },
  { id: '2', nome: 'Carlos Lima' },
  { id: '3', nome: 'Maria Oliveira' },
];

const departamentos = [
  { id: 'atendimento', nome: 'Atendimento' },
  { id: 'sinistros', nome: 'Sinistros' },
  { id: 'financeiro', nome: 'Financeiro' },
  { id: 'assistencia', nome: 'Assistência 24h' },
];

export function EncaminharModal({ 
  open, 
  onOpenChange, 
  manifestacaoId,
  onSuccess 
}: EncaminharModalProps) {
  const [destino, setDestino] = useState<'analista' | 'departamento' | 'juridico'>('analista');
  const [selectedId, setSelectedId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!motivo.trim()) {
      toast.error('Informe o motivo do encaminhamento');
      return;
    }

    if (destino !== 'juridico' && !selectedId) {
      toast.error(`Selecione ${destino === 'analista' ? 'o analista' : 'o departamento'}`);
      return;
    }

    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast.success('Manifestação encaminhada com sucesso!');
    setIsSubmitting(false);
    onOpenChange(false);
    onSuccess?.();

    // Reset form
    setDestino('analista');
    setSelectedId('');
    setMotivo('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Encaminhar Manifestação</DialogTitle>
          <DialogDescription>
            Escolha o destino do encaminhamento e informe o motivo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tipo de destino */}
          <div className="space-y-2">
            <Label>Encaminhar para</Label>
            <RadioGroup
              value={destino}
              onValueChange={(v) => {
                setDestino(v as typeof destino);
                setSelectedId('');
              }}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="analista" id="analista" />
                <Label htmlFor="analista" className="cursor-pointer">Para analista</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="departamento" id="departamento" />
                <Label htmlFor="departamento" className="cursor-pointer">Para departamento</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="juridico" id="juridico" />
                <Label htmlFor="juridico" className="cursor-pointer">Para Jurídico</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Select dinâmico */}
          {destino === 'analista' && (
            <div className="space-y-2">
              <Label>Analista</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o analista" />
                </SelectTrigger>
                <SelectContent>
                  {analistas.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {destino === 'departamento' && (
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o departamento" />
                </SelectTrigger>
                <SelectContent>
                  {departamentos.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {destino === 'juridico' && (
            <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
              Isso criará um processo jurídico vinculado a esta manifestação.
            </p>
          )}

          {/* Motivo */}
          <div className="space-y-2">
            <Label>Motivo do encaminhamento *</Label>
            <Textarea
              placeholder="Descreva o motivo do encaminhamento..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Encaminhando...' : 'Encaminhar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
