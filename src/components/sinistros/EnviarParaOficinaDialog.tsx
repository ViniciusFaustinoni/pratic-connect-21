import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOficinas } from '@/hooks/useOficinas';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { Wrench, Loader2 } from 'lucide-react';

interface EnviarParaOficinaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sinistro: any;
  marca?: string;
  onSuccess?: () => void;
}

export function EnviarParaOficinaDialog({
  open,
  onOpenChange,
  sinistro,
  marca,
  onSuccess,
}: EnviarParaOficinaDialogProps) {
  const [oficinaId, setOficinaId] = useState('');
  const [tipoReparo, setTipoReparo] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: oficinas, isLoading: loadingOficinas } = useOficinas({ status: 'ativo', marca: marca || undefined });

  const handleSubmit = async () => {
    if (!oficinaId) {
      toast.error('Selecione uma oficina');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Buscar profile.id (FK exige referencia a profiles, nao auth.users)
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .maybeSingle();

      const obs = [
        tipoReparo ? `Tipo de reparo: ${tipoReparo}` : '',
        observacoes || '',
      ].filter(Boolean).join('\n');

      // 1. Criar OS
      const { data: os, error: osError } = await supabase
        .from('ordens_servico')
        .insert({
          numero: '',
          sinistro_id: sinistro.id,
          oficina_id: oficinaId,
          veiculo_id: sinistro.veiculo_id,
          associado_id: sinistro.associado_id,
          data_entrada: format(new Date(), 'yyyy-MM-dd'),
          observacoes: obs || null,
          status: 'aguardando_orcamento' as any,
          criado_por: profile?.id,
        })
        .select()
        .single();

      if (osError) throw osError;

      // 2. Atualizar sinistro para em_reparo
      await supabase
        .from('sinistros')
        .update({ status: 'em_reparo' as any })
        .eq('id', sinistro.id);

      // 3. Registrar histórico do sinistro
      await supabase.from('sinistro_historico').insert({
        sinistro_id: sinistro.id,
        status_anterior: sinistro.status,
        status_novo: 'em_reparo',
        observacao: `Encaminhado para oficina. OS criada: ${os.numero || os.id}`,
        usuario_id: profile?.id,
      });

      // 4. Registrar histórico da OS
      await supabase.from('ordens_servico_historico').insert({
        ordem_servico_id: os.id,
        status_novo: 'aguardando_orcamento',
        observacao: `OS criada a partir do sinistro ${sinistro.protocolo}`,
        usuario_id: profile?.id,
      });

      toast.success('Ordem de serviço criada com sucesso!');
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Erro ao enviar para oficina:', error);
      toast.error('Erro ao criar OS: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Enviar para Oficina
          </DialogTitle>
          <DialogDescription>
            Selecione a oficina e crie uma ordem de serviço para o sinistro {sinistro?.protocolo}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Oficina *</Label>
            <Select value={oficinaId} onValueChange={setOficinaId}>
              <SelectTrigger>
                <SelectValue placeholder={loadingOficinas ? 'Carregando...' : 'Selecione a oficina'} />
              </SelectTrigger>
              <SelectContent>
                {oficinas?.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.nome_fantasia || o.razao_social} {o.cidade ? `- ${o.cidade}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tipo de Reparo</Label>
            <Select value={tipoReparo} onValueChange={setTipoReparo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="funilaria_pintura">Funilaria e Pintura</SelectItem>
                <SelectItem value="mecanica">Mecânica</SelectItem>
                <SelectItem value="eletrica">Elétrica</SelectItem>
                <SelectItem value="vidros">Vidros</SelectItem>
                <SelectItem value="completo">Reparo Completo</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Observações adicionais..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wrench className="h-4 w-4 mr-2" />}
            Criar OS e Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
