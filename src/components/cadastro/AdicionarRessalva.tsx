import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface AdicionarRessalvaProps {
  associadoId: string;
}

export function AdicionarRessalva({ associadoId }: AdicionarRessalvaProps) {
  const [texto, setTexto] = useState('');
  const [veiculoId, setVeiculoId] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: veiculos } = useQuery({
    queryKey: ['veiculos-associado-ressalva', associadoId],
    queryFn: async () => {
      const { data } = await supabase
        .from('veiculos')
        .select('id, placa, modelo, marca')
        .eq('associado_id', associadoId)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: isExpanded,
  });

  const handleSubmit = async () => {
    if (!texto.trim()) {
      toast.error('Digite a descrição da ressalva');
      return;
    }

    setIsSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.user?.id || '')
        .single();

      const veiculoSelecionado = veiculos?.find(v => v.id === veiculoId);

      const { error } = await supabase
        .from('associados_historico')
        .insert({
          associado_id: associadoId,
          tipo: 'ressalva_registrada',
          descricao: texto.trim(),
          usuario_id: profile?.id,
          veiculo_id: veiculoId || null,
          dados_novos: veiculoSelecionado
            ? { veiculo_id: veiculoSelecionado.id, placa: veiculoSelecionado.placa }
            : null,
        });

      if (error) throw error;

      setTexto('');
      setVeiculoId('');
      setIsExpanded(false);
      toast.success('Ressalva registrada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['associado-historico-completo', associadoId] });
    } catch (error) {
      toast.error('Erro ao registrar ressalva');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isExpanded) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsExpanded(true)}
        className="mb-4 border-amber-300 text-amber-700 hover:bg-amber-50"
      >
        <AlertTriangle className="mr-2 h-4 w-4" />
        Registrar Ressalva
      </Button>
    );
  }

  return (
    <div className="mb-4 p-4 border border-amber-200 rounded-lg bg-amber-50/50 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
        <AlertTriangle className="h-4 w-4" />
        Nova Ressalva
      </div>
      <Textarea
        placeholder="Descreva a inconsistência ou situação atípica..."
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={3}
        className="resize-none"
      />
      {veiculos && veiculos.length > 0 && (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Veículo relacionado (opcional)</label>
          <Select value={veiculoId} onValueChange={setVeiculoId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione um veículo..." />
            </SelectTrigger>
            <SelectContent>
              {veiculos.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.placa} - {v.marca} {v.modelo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex items-center gap-2 justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setTexto('');
            setVeiculoId('');
            setIsExpanded(false);
          }}
        >
          Cancelar
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!texto.trim() || isSaving}
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar Ressalva
        </Button>
      </div>
    </div>
  );
}
