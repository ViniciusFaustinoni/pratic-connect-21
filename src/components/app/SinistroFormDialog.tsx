import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMyAssociado, useMyVehicles } from '@/hooks/useMyData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2, MapPin, Car, Truck } from 'lucide-react';
import { format } from 'date-fns';

interface SinistroFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TIPOS_SINISTRO = [
  { value: 'colisao', label: 'Colisão' },
  { value: 'roubo', label: 'Roubo' },
  { value: 'furto', label: 'Furto' },
  { value: 'incendio', label: 'Incêndio' },
  { value: 'fenomeno_natural', label: 'Fenômeno Natural' },
  { value: 'vandalismo', label: 'Vandalismo' },
  { value: 'terceiros', label: 'Danos a Terceiros' },
  { value: 'vidros', label: 'Vidros' },
  { value: 'outro', label: 'Outro' },
];

export default function SinistroFormDialog({ open, onOpenChange }: SinistroFormDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: associado } = useMyAssociado();
  const { data: veiculos } = useMyVehicles();

  const [formData, setFormData] = useState({
    veiculo_id: '',
    tipo: '',
    data_ocorrencia: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    local: '',
    descricao: '',
  });
  const [precisaGuincho, setPrecisaGuincho] = useState(false);
  const [localizacao, setLocalizacao] = useState<{ lat: number; lng: number } | null>(null);
  const [obtendoLocalizacao, setObtendoLocalizacao] = useState(false);

  // Pre-selecionar veículo se só tiver um
  useEffect(() => {
    if (veiculos?.length === 1 && !formData.veiculo_id) {
      setFormData((prev) => ({ ...prev, veiculo_id: veiculos[0].id }));
    }
  }, [veiculos, formData.veiculo_id]);

  const obterLocalizacao = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocalização não suportada');
      return;
    }

    setObtendoLocalizacao(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLocalizacao({ lat: latitude, lng: longitude });

        // Reverse geocode
        try {
          const { data } = await supabase.functions.invoke('reverse-geocode', {
            body: { latitude, longitude },
          });
          if (data?.endereco_completo) {
            setFormData((prev) => ({ ...prev, local: data.endereco_completo }));
          }
        } catch (error) {
          setFormData((prev) => ({ ...prev, local: `${latitude}, ${longitude}` }));
        }
        setObtendoLocalizacao(false);
      },
      (error) => {
        console.error('Erro ao obter localização:', error);
        toast.error('Não foi possível obter sua localização');
        setObtendoLocalizacao(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const criarSinistroMutation = useMutation({
    mutationFn: async () => {
      if (!associado?.id) throw new Error('Associado não encontrado');

      const { data, error } = await supabase.functions.invoke('criar-sinistro', {
        body: {
          veiculo_id: formData.veiculo_id,
          tipo: formData.tipo,
          data_ocorrencia: formData.data_ocorrencia,
          local: formData.local,
          descricao: formData.descricao,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao criar sinistro');

      return data;
    },
    onSuccess: async (sinistroData) => {
      // Se precisa de guincho, criar assistência também
      if (precisaGuincho && localizacao) {
        try {
          await supabase.functions.invoke('criar-chamado-assistencia', {
            body: {
              veiculo_id: formData.veiculo_id,
              tipo_assistencia: 'guincho',
              descricao: `Guincho solicitado junto com sinistro ${sinistroData.protocolo}`,
              latitude: localizacao.lat,
              longitude: localizacao.lng,
              endereco: formData.local,
            },
          });
          toast.success('Sinistro e guincho solicitados com sucesso!');
        } catch (error) {
          console.error('Erro ao criar assistência:', error);
          toast.success('Sinistro criado! Erro ao solicitar guincho - tente novamente em Assistência 24h');
        }
      } else {
        toast.success(`Sinistro ${sinistroData.protocolo} criado com sucesso!`);
      }

      queryClient.invalidateQueries({ queryKey: ['my-sinistros-historico'] });
      onOpenChange(false);
      navigate(`/app/sinistros/${sinistroData.sinistro?.id || ''}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao criar sinistro');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.veiculo_id) {
      toast.error('Selecione um veículo');
      return;
    }
    if (!formData.tipo) {
      toast.error('Selecione o tipo de sinistro');
      return;
    }
    if (!formData.local) {
      toast.error('Informe o local do sinistro');
      return;
    }
    if (!formData.descricao) {
      toast.error('Descreva o que aconteceu');
      return;
    }

    criarSinistroMutation.mutate();
  };

  const veiculosAtivos = veiculos?.filter((v) => v.status === 'ativo') || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Abrir Sinistro
          </DialogTitle>
          <DialogDescription>
            Preencha os dados do sinistro. Documentos podem ser enviados depois.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Veículo */}
          <div className="space-y-2">
            <Label htmlFor="veiculo">Veículo *</Label>
            <Select value={formData.veiculo_id} onValueChange={(v) => setFormData({ ...formData, veiculo_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o veículo" />
              </SelectTrigger>
              <SelectContent>
                {veiculosAtivos.map((veiculo) => (
                  <SelectItem key={veiculo.id} value={veiculo.id}>
                    {veiculo.placa} - {veiculo.marca} {veiculo.modelo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tipo */}
          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo de Sinistro *</Label>
            <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_SINISTRO.map((tipo) => (
                  <SelectItem key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data/Hora */}
          <div className="space-y-2">
            <Label htmlFor="data">Data e Hora *</Label>
            <Input
              id="data"
              type="datetime-local"
              value={formData.data_ocorrencia}
              onChange={(e) => setFormData({ ...formData, data_ocorrencia: e.target.value })}
            />
          </div>

          {/* Local */}
          <div className="space-y-2">
            <Label htmlFor="local">Local *</Label>
            <div className="flex gap-2">
              <Input
                id="local"
                placeholder="Endereço do sinistro"
                value={formData.local}
                onChange={(e) => setFormData({ ...formData, local: e.target.value })}
                className="flex-1"
              />
              <Button type="button" variant="outline" size="icon" onClick={obterLocalizacao} disabled={obtendoLocalizacao}>
                {obtendoLocalizacao ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="descricao">O que aconteceu? *</Label>
            <Textarea
              id="descricao"
              placeholder="Descreva detalhadamente o ocorrido..."
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              rows={4}
            />
          </div>

          {/* Precisa de Guincho */}
          {['colisao', 'incendio', 'fenomeno_natural', 'vandalismo'].includes(formData.tipo) && (
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Truck className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Precisa de guincho?</p>
                  <p className="text-sm text-muted-foreground">Solicitar assistência 24h junto com o sinistro</p>
                </div>
              </div>
              <Switch checked={precisaGuincho} onCheckedChange={setPrecisaGuincho} />
            </div>
          )}

          {precisaGuincho && !localizacao && (
            <div className="p-3 bg-amber-50 text-amber-800 rounded-lg text-sm">
              <p>Para solicitar guincho, precisamos da sua localização atual. Clique no botão de localização acima.</p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={criarSinistroMutation.isPending}>
              {criarSinistroMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Abrir Sinistro
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
