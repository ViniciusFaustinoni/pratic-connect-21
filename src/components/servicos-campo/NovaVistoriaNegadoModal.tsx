import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useVistoriadoresAtivos } from '@/hooks/useAtribuicaoManual';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { VeiculoNegado } from '@/hooks/useVeiculosNegados';

interface Props {
  veiculo: VeiculoNegado | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function NovaVistoriaNegadoModal({ veiculo, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { data: profissionais, isLoading: loadingProfs } = useVistoriadoresAtivos();
  const [profissionalId, setProfissionalId] = useState('');
  const [dataAgendada, setDataAgendada] = useState('');
  const [periodo, setPeriodo] = useState<'manha' | 'tarde'>('manha');
  const [tipo, setTipo] = useState<'vistoria_entrada' | 'vistoria_manutencao'>('vistoria_entrada');
  const [observacoes, setObservacoes] = useState('');

  const mut = useMutation({
    mutationFn: async () => {
      if (!veiculo) throw new Error('veiculo_ausente');
      const { data, error } = await supabase.functions.invoke('monitoramento-revistoriar-negado', {
        body: {
          veiculo_id: veiculo.id,
          profissional_id: profissionalId,
          data_agendada: dataAgendada,
          periodo,
          tipo,
          observacoes: observacoes.trim() || undefined,
        },
      });
      if (error) {
        const ctx: any = (error as any).context;
        let code: string | undefined;
        try {
          const txt = ctx?.responseText || (await ctx?.response?.text?.());
          if (txt) code = JSON.parse(txt)?.error;
        } catch { /* */ }
        throw new Error(code || error.message);
      }
      return data;
    },
    onSuccess: () => {
      toast.success('Revistoria criada e atribuída ao profissional.');
      qc.invalidateQueries({ queryKey: ['veiculos-negados'] });
      qc.invalidateQueries({ queryKey: ['veiculos-suspensos-instalacao'] });
      qc.invalidateQueries({ queryKey: ['servicos-para-atribuir-manual'] });
      qc.invalidateQueries({ queryKey: ['servicos'] });
      onOpenChange(false);
      resetForm();
    },
    onError: (e: any) => {
      const map: Record<string, string> = {
        servico_ativo_existente: 'Já existe serviço ativo para este veículo.',
        veiculo_nao_esta_negado: 'Veículo não está mais no status "negado".',
        campos_obrigatorios: 'Preencha profissional, data e período.',
      };
      toast.error(map[e.message] || `Erro ao criar revistoria: ${e.message}`);
    },
  });

  const resetForm = () => {
    setProfissionalId(''); setDataAgendada(''); setPeriodo('manha');
    setTipo('vistoria_entrada'); setObservacoes('');
  };

  const podeSalvar = !!veiculo && !!profissionalId && !!dataAgendada && !mut.isPending;

  const hoje = new Date().toISOString().split('T')[0];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Criar Nova Vistoria</DialogTitle>
          <DialogDescription>
            {veiculo && (
              <>
                Veículo <strong>{veiculo.placa}</strong> — {veiculo.marca} {veiculo.modelo}.
                Atribuição direta pelo Monitoramento, sem envolver o associado.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <RadioGroup value={tipo} onValueChange={(v) => setTipo(v as any)} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="vistoria_entrada" id="t-ent" />
                <Label htmlFor="t-ent" className="font-normal cursor-pointer">Vistoria de entrada</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="vistoria_manutencao" id="t-man" />
                <Label htmlFor="t-man" className="font-normal cursor-pointer">Manutenção</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prof">Profissional</Label>
            <Select value={profissionalId} onValueChange={setProfissionalId}>
              <SelectTrigger id="prof">
                <SelectValue placeholder={loadingProfs ? 'Carregando…' : 'Selecione um profissional'} />
              </SelectTrigger>
              <SelectContent>
                {(profissionais ?? []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="data">Data</Label>
              <Input id="data" type="date" min={hoje}
                value={dataAgendada} onChange={(e) => setDataAgendada(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Período</Label>
              <Select value={periodo} onValueChange={(v) => setPeriodo(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manha">Manhã</SelectItem>
                  <SelectItem value="tarde">Tarde</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="obs">Observações (opcional)</Label>
            <Textarea id="obs" rows={3} value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Contexto da revistoria…" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mut.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={!podeSalvar}>
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Criar e atribuir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
