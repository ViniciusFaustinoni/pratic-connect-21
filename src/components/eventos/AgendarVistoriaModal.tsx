import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Sinistro {
  id: string;
  protocolo: string;
  status: string;
  associado_id: string;
  veiculo_id: string;
}

interface AgendarVistoriaModalProps {
  open: boolean;
  onClose: () => void;
  sinistro: Sinistro | null;
}

const UF_OPTIONS = [
  { value: 'AC', label: 'Acre' },
  { value: 'AL', label: 'Alagoas' },
  { value: 'AP', label: 'Amapá' },
  { value: 'AM', label: 'Amazonas' },
  { value: 'BA', label: 'Bahia' },
  { value: 'CE', label: 'Ceará' },
  { value: 'DF', label: 'Distrito Federal' },
  { value: 'ES', label: 'Espírito Santo' },
  { value: 'GO', label: 'Goiás' },
  { value: 'MA', label: 'Maranhão' },
  { value: 'MT', label: 'Mato Grosso' },
  { value: 'MS', label: 'Mato Grosso do Sul' },
  { value: 'MG', label: 'Minas Gerais' },
  { value: 'PA', label: 'Pará' },
  { value: 'PB', label: 'Paraíba' },
  { value: 'PR', label: 'Paraná' },
  { value: 'PE', label: 'Pernambuco' },
  { value: 'PI', label: 'Piauí' },
  { value: 'RJ', label: 'Rio de Janeiro' },
  { value: 'RN', label: 'Rio Grande do Norte' },
  { value: 'RS', label: 'Rio Grande do Sul' },
  { value: 'RO', label: 'Rondônia' },
  { value: 'RR', label: 'Roraima' },
  { value: 'SC', label: 'Santa Catarina' },
  { value: 'SP', label: 'São Paulo' },
  { value: 'SE', label: 'Sergipe' },
  { value: 'TO', label: 'Tocantins' }
];

export function AgendarVistoriaModal({ open, onClose, sinistro }: AgendarVistoriaModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    vistoriador_id: '',
    data: '',
    horario: '',
    endereco: '',
    cidade: '',
    estado: '',
    observacoes: ''
  });

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setFormData({
        vistoriador_id: '',
        data: '',
        horario: '',
        endereco: '',
        cidade: '',
        estado: '',
        observacoes: ''
      });
    }
  }, [open]);

  // Buscar vistoriadores (profiles com role instalador_vistoriador)
  const { data: vistoriadores = [] } = useQuery({
    queryKey: ['vistoriadores'],
    queryFn: async () => {
      // 1. Buscar user_ids com role instalador_vistoriador
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'instalador_vistoriador');
      
      if (!roles || roles.length === 0) return [];
      
      const userIds = roles.map(r => r.user_id);
      
      // 2. Buscar profiles desses usuarios
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, user_id, nome')
        .in('user_id', userIds)
        .eq('ativo', true)
        .order('nome');
      
      return profiles || [];
    },
    enabled: open
  });

  const agendarMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!sinistro) throw new Error('Sinistro não encontrado');
      
      // Combinar data + horario
      const dataAgendada = `${data.data}T${data.horario}:00`;
      
      // Encontrar o profile do vistoriador selecionado
      const vistoriador = vistoriadores.find(v => v.id === data.vistoriador_id);
      
      // 1. Criar vistoria
      const { data: vistoria, error } = await supabase
        .from('vistorias')
        .insert({
          associado_id: sinistro.associado_id,
          veiculo_id: sinistro.veiculo_id,
          sinistro_id: sinistro.id,
          vistoriador_id: vistoriador?.user_id || null,
          tipo: 'sinistro',
          data_agendada: dataAgendada,
          endereco_logradouro: data.endereco,
          endereco_cidade: data.cidade,
          endereco_estado: data.estado,
          observacoes: data.observacoes || null,
          status: 'agendada'
        } as any)
        .select()
        .single();
      
      if (error) throw error;
      
      // 2. Atualizar status do sinistro para 'aguardando_vistoria'
      const { error: updateError } = await supabase
        .from('sinistros')
        .update({ 
          status: 'aguardando_vistoria',
          updated_at: new Date().toISOString()
        })
        .eq('id', sinistro.id);
      
      if (updateError) throw updateError;
      
      // 3. Registrar no historico do sinistro
      const { error: histError } = await supabase.from('sinistro_historico').insert({
        sinistro_id: sinistro.id,
        status_anterior: sinistro.status,
        status_novo: 'aguardando_vistoria',
        usuario_id: user?.id,
        observacao: `Vistoria agendada para ${format(new Date(dataAgendada), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
      });
      
      if (histError) throw histError;
      
      return vistoria;
    },
    onSuccess: () => {
      toast.success('Vistoria agendada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['sinistro', sinistro?.id] });
      queryClient.invalidateQueries({ queryKey: ['sinistro-historico', sinistro?.id] });
      queryClient.invalidateQueries({ queryKey: ['sinistros'] });
      onClose();
    },
    onError: (error) => {
      console.error('Erro ao agendar vistoria:', error);
      toast.error('Erro ao agendar vistoria');
    }
  });

  const isFormValid = () => {
    return (
      formData.vistoriador_id &&
      formData.data &&
      formData.horario &&
      formData.endereco &&
      formData.cidade &&
      formData.estado
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormValid()) {
      agendarMutation.mutate(formData);
    }
  };

  if (!sinistro) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agendar Vistoria</DialogTitle>
          <DialogDescription>
            Sinistro {sinistro.protocolo}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vistoriador">Vistoriador *</Label>
            <Select
              value={formData.vistoriador_id}
              onValueChange={(value) => setFormData(prev => ({ ...prev, vistoriador_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o vistoriador" />
              </SelectTrigger>
              <SelectContent>
                {vistoriadores.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data">Data *</Label>
              <Input
                id="data"
                type="date"
                value={formData.data}
                onChange={(e) => setFormData(prev => ({ ...prev, data: e.target.value }))}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="horario">Horário *</Label>
              <Input
                id="horario"
                type="time"
                value={formData.horario}
                onChange={(e) => setFormData(prev => ({ ...prev, horario: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="endereco">Endereço *</Label>
            <Input
              id="endereco"
              placeholder="Rua, número, bairro"
              value={formData.endereco}
              onChange={(e) => setFormData(prev => ({ ...prev, endereco: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade *</Label>
              <Input
                id="cidade"
                placeholder="Cidade"
                value={formData.cidade}
                onChange={(e) => setFormData(prev => ({ ...prev, cidade: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estado">Estado *</Label>
              <Select
                value={formData.estado}
                onValueChange={(value) => setFormData(prev => ({ ...prev, estado: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent>
                  {UF_OPTIONS.map((uf) => (
                    <SelectItem key={uf.value} value={uf.value}>
                      {uf.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              placeholder="Observações sobre a vistoria..."
              value={formData.observacoes}
              onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={!isFormValid() || agendarMutation.isPending}
            >
              {agendarMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Agendar Vistoria
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
