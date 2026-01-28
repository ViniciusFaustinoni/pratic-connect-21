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
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEncaminharManifestacao, useEncaminharJuridico } from "@/hooks/useOuvidoria";

interface EncaminharModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manifestacaoId: string;
  onSuccess?: () => void;
}

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

  const encaminharMutation = useEncaminharManifestacao();
  const encaminharJuridicoMutation = useEncaminharJuridico();

  // Buscar analistas (funcionários ativos)
  const { data: analistas, isLoading: isLoadingAnalistas } = useQuery({
    queryKey: ["funcionarios-ouvidoria-encaminhar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome")
        .eq("tipo", "funcionario")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const handleSubmit = async () => {
    if (!motivo.trim()) {
      return;
    }

    if (destino !== 'juridico' && !selectedId) {
      return;
    }

    if (destino === 'juridico') {
      await encaminharJuridicoMutation.mutateAsync({
        manifestacao_id: manifestacaoId,
        observacao: motivo,
      });
    } else {
      await encaminharMutation.mutateAsync({
        manifestacaoId,
        destino,
        destinoId: selectedId,
        motivo,
      });
    }

    onOpenChange(false);
    onSuccess?.();

    // Reset form
    setDestino('analista');
    setSelectedId('');
    setMotivo('');
  };

  const isSubmitting = encaminharMutation.isPending || encaminharJuridicoMutation.isPending;

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
                  <SelectValue placeholder={isLoadingAnalistas ? "Carregando..." : "Selecione o analista"} />
                </SelectTrigger>
                <SelectContent>
                  {(analistas || []).map(a => (
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
