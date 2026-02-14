import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, Check, ChevronsUpDown, Car, Truck } from 'lucide-react';
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';

interface NovoSinistroModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (sinistro: any) => void;
}

const TIPO_SINISTRO_OPTIONS = [
  { value: 'colisao', label: 'Colisão' },
  { value: 'roubo', label: 'Roubo' },
  { value: 'furto', label: 'Furto' },
  { value: 'incendio', label: 'Incêndio' },
  { value: 'fenomeno_natural', label: 'Fenômeno Natural' },
  { value: 'vidros', label: 'Vidros' },
  { value: 'outro', label: 'Outro' },
];

const UF_OPTIONS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO'
];

const formatCPF = (cpf: string) => {
  const cleaned = cpf.replace(/\D/g, '');
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

const formatCurrency = (value: number | null) => {
  if (!value) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const generateProtocolo = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `SIN-${year}${month}${day}-${random}`;
};

export function NovoSinistroModal({ open, onClose, onSuccess }: NovoSinistroModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [selectedAssociado, setSelectedAssociado] = useState<string | null>(null);
  const [selectedVeiculo, setSelectedVeiculo] = useState<string | null>(null);
  const [searchAssociado, setSearchAssociado] = useState('');
  const [openAssociadoPopover, setOpenAssociadoPopover] = useState(false);
  
  const [formData, setFormData] = useState({
    tipo: '',
    data_ocorrencia: '',
    local_ocorrencia: '',
    cidade_ocorrencia: '',
    estado_ocorrencia: '',
    bo_numero: '',
    descricao: ''
  });
  const [necessitaReboque, setNecessitaReboque] = useState(false);

  // Buscar associados
  const { data: associados = [] } = useQuery({
    queryKey: ['associados-search', searchAssociado],
    queryFn: async () => {
      if (searchAssociado.length < 3) return [];
      const { data } = await supabase
        .from('associados')
        .select('id, nome, cpf')
        .or(`nome.ilike.%${searchAssociado}%,cpf.ilike.%${searchAssociado}%`)
        .eq('status', 'ativo')
        .limit(10);
      return data || [];
    },
    enabled: searchAssociado.length >= 3
  });

  // Buscar veículos do associado
  const { data: veiculos = [] } = useQuery({
    queryKey: ['veiculos-associado', selectedAssociado],
    queryFn: async () => {
      const { data } = await supabase
        .from('veiculos')
        .select('id, placa, marca, modelo, ano_modelo, valor_fipe')
        .eq('associado_id', selectedAssociado!)
        .eq('ativo', true);
      return data || [];
    },
    enabled: !!selectedAssociado
  });

  const selectedAssociadoData = associados.find(a => a.id === selectedAssociado);
  const selectedVeiculoData = veiculos.find(v => v.id === selectedVeiculo);

  // Mutation para criar sinistro
  const createMutation = useMutation({
    mutationFn: async () => {
      const veiculoSelecionado = veiculos.find(v => v.id === selectedVeiculo);
      const protocolo = generateProtocolo();
      
      const { data: sinistro, error } = await supabase
        .from('sinistros')
        .insert([{
          protocolo,
          associado_id: selectedAssociado!,
          veiculo_id: selectedVeiculo!,
          tipo: formData.tipo as any,
          data_ocorrencia: formData.data_ocorrencia,
          local_ocorrencia: formData.local_ocorrencia,
          cidade_ocorrencia: formData.cidade_ocorrencia,
          estado_ocorrencia: formData.estado_ocorrencia,
          descricao: formData.descricao,
          bo_numero: formData.bo_numero || null,
          valor_fipe: veiculoSelecionado?.valor_fipe || null,
          canal: 'presencial',
          status: 'comunicado' as any,
          necessita_reboque: necessitaReboque,
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      // Registrar no histórico
      await supabase.from('sinistro_historico').insert({
        sinistro_id: sinistro.id,
        status_novo: 'comunicado',
        usuario_id: user?.id,
        observacao: 'Sinistro registrado via sistema'
      });

      // Criar chamado de reboque se necessário
      if (necessitaReboque) {
        try {
          const nowAss = new Date();
          const dateStrAss = `${nowAss.getFullYear()}${String(nowAss.getMonth() + 1).padStart(2, '0')}${String(nowAss.getDate()).padStart(2, '0')}`;
          const rndAss = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
          const protocoloAss = `ASS-${dateStrAss}-${rndAss}`;

          const { data: chamadoReboque, error: chamadoError } = await supabase
            .from('chamados_assistencia')
            .insert({
              protocolo: protocoloAss,
              associado_id: selectedAssociado!,
              veiculo_id: selectedVeiculo!,
              tipo_servico: 'guincho',
              descricao: `Reboque solicitado junto ao sinistro ${protocolo}`,
              origem_endereco: formData.local_ocorrencia || null,
              canal: 'presencial',
              status: 'aberto',
              data_abertura: new Date().toISOString(),
            })
            .select('id, protocolo')
            .single();

          if (!chamadoError && chamadoReboque) {
            await supabase
              .from('sinistros')
              .update({ chamado_assistencia_id: chamadoReboque.id })
              .eq('id', sinistro.id);
            console.log('[NovoSinistroModal] Chamado de reboque criado:', chamadoReboque.protocolo);
          }
        } catch (rebError) {
          console.error('[NovoSinistroModal] Erro ao criar reboque:', rebError);
        }
      }
      
      // Notificar associado via WhatsApp/Email/Sistema
      try {
        await supabase.functions.invoke('notificar-sinistro', {
          body: {
            sinistro_id: sinistro.id,
            status: 'comunicado',
          }
        });
        console.log('[NovoSinistroModal] Notificação enviada');
      } catch (notifError) {
        console.warn('[NovoSinistroModal] Erro ao notificar (não bloqueante):', notifError);
      }
      
      return sinistro;
    },
    onSuccess: (data) => {
      toast.success(`Sinistro ${data.protocolo} registrado com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['sinistros'] });
      queryClient.invalidateQueries({ queryKey: ['sinistros-contadores'] });
      onSuccess?.(data);
      handleClose();
    },
    onError: (error) => {
      toast.error('Erro ao registrar sinistro');
      console.error(error);
    }
  });

  const handleClose = () => {
    setSelectedAssociado(null);
    setSelectedVeiculo(null);
    setSearchAssociado('');
    setFormData({
      tipo: '',
      data_ocorrencia: '',
      local_ocorrencia: '',
      cidade_ocorrencia: '',
      estado_ocorrencia: '',
      bo_numero: '',
      descricao: ''
    });
    setNecessitaReboque(false);
    onClose();
  };

  const isFormValid = () => {
    return (
      selectedAssociado &&
      selectedVeiculo &&
      formData.tipo &&
      formData.data_ocorrencia &&
      formData.local_ocorrencia &&
      formData.cidade_ocorrencia &&
      formData.estado_ocorrencia &&
      formData.descricao.length >= 50
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid()) return;
    createMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Novo Sinistro</DialogTitle>
          <DialogDescription>
            Preencha os dados do sinistro para comunicação
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Seção 1 - Associado e Veículo */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Associado e Veículo</h3>
            
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Associado *</Label>
                <Popover open={openAssociadoPopover} onOpenChange={setOpenAssociadoPopover}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openAssociadoPopover}
                      className="w-full justify-between"
                    >
                      {selectedAssociadoData ? (
                        <span>
                          {selectedAssociadoData.nome} - {formatCPF(selectedAssociadoData.cpf)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Buscar por nome ou CPF...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Digite nome ou CPF (mín. 3 caracteres)..."
                        value={searchAssociado}
                        onValueChange={setSearchAssociado}
                      />
                      <CommandList>
                        <CommandEmpty>
                          {searchAssociado.length < 3 
                            ? 'Digite ao menos 3 caracteres...' 
                            : 'Nenhum associado encontrado.'
                          }
                        </CommandEmpty>
                        <CommandGroup>
                          {associados.map((associado) => (
                            <CommandItem
                              key={associado.id}
                              value={associado.id}
                              onSelect={() => {
                                setSelectedAssociado(associado.id);
                                setSelectedVeiculo(null);
                                setOpenAssociadoPopover(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedAssociado === associado.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span>{associado.nome}</span>
                                <span className="text-xs text-muted-foreground">
                                  {formatCPF(associado.cpf)}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Veículo *</Label>
                <Select
                  value={selectedVeiculo || ''}
                  onValueChange={setSelectedVeiculo}
                  disabled={!selectedAssociado}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      !selectedAssociado 
                        ? "Selecione um associado primeiro" 
                        : "Selecione o veículo"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {veiculos.map((veiculo) => (
                      <SelectItem key={veiculo.id} value={veiculo.id}>
                        <div className="flex items-center gap-2">
                          <Car className="h-4 w-4" />
                          <span>{veiculo.placa} - {veiculo.marca} {veiculo.modelo} {veiculo.ano_modelo}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedVeiculoData && (
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-sm text-muted-foreground">
                    Valor FIPE: <span className="font-medium text-foreground">
                      {formatCurrency(selectedVeiculoData.valor_fipe)}
                    </span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Seção 2 - Dados do Sinistro */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Dados do Sinistro</h3>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, tipo: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPO_SINISTRO_OPTIONS.map((tipo) => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data da Ocorrência *</Label>
                <Input
                  type="datetime-local"
                  value={formData.data_ocorrencia}
                  onChange={(e) => setFormData(prev => ({ ...prev, data_ocorrencia: e.target.value }))}
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Local (Endereço) *</Label>
                <Input
                  placeholder="Rua, número, bairro..."
                  value={formData.local_ocorrencia}
                  onChange={(e) => setFormData(prev => ({ ...prev, local_ocorrencia: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Cidade *</Label>
                <Input
                  placeholder="Cidade"
                  value={formData.cidade_ocorrencia}
                  onChange={(e) => setFormData(prev => ({ ...prev, cidade_ocorrencia: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Estado *</Label>
                <Select
                  value={formData.estado_ocorrencia}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, estado_ocorrencia: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {UF_OPTIONS.map((uf) => (
                      <SelectItem key={uf} value={uf}>
                        {uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Nº do Boletim de Ocorrência</Label>
                <Input
                  placeholder="Opcional"
                  value={formData.bo_numero}
                  onChange={(e) => setFormData(prev => ({ ...prev, bo_numero: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Seção 3 - Descrição */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Descrição</h3>
            
            <div className="space-y-2">
              <Textarea
                placeholder="Descreva detalhadamente as circunstâncias do sinistro..."
                value={formData.descricao}
                onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Mínimo 50 caracteres ({formData.descricao.length}/50)
              </p>
            </div>
          </div>

          {/* Precisa de reboque? */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Truck className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-sm">Precisa de reboque?</p>
                <p className="text-xs text-muted-foreground">Criar chamado de assistência 24h automaticamente</p>
              </div>
            </div>
            <Switch checked={necessitaReboque} onCheckedChange={setNecessitaReboque} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={!isFormValid() || createMutation.isPending}
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Registrar Sinistro
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
