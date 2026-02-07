import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  User, Car, MapPin, Phone, Clock, CalendarIcon,
  Building2, Smartphone, Loader2, Info
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

// ============================================
// TIPOS
// ============================================

export type TipoVistoriaAgendamento = 'presencial' | 'ponto_fixo' | 'auto_vistoria';
export type PeriodoVistoria = 'manha' | 'tarde';
export type PrazoAutoVistoria = '24h' | '48h' | '72h';

export interface VistoriaParaAgendar {
  id: string;
  protocolo: string;
  cliente: string;
  clienteTelefone?: string;
  veiculo: string;
  placa: string;
  endereco?: string;
  cidade?: string;
  uf?: string;
  regiao?: string;
}

export interface AgendarVistoriaFormData {
  tipo: TipoVistoriaAgendamento;
  data?: Date;
  periodo?: PeriodoVistoria;
  horarioEspecifico?: string;
  vistoriadorId?: string;
  atribuirDepois: boolean;
  pontoFixoId?: string;
  prazo: PrazoAutoVistoria;
  enviarWhatsapp: boolean;
  enviarEmail: boolean;
}

export interface AgendarVistoriaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vistoria: VistoriaParaAgendar | null;
  onSave: (data: AgendarVistoriaFormData) => void;
}

// ============================================
// CONSTANTES
// ============================================

const PERIODOS = [
  { value: 'manha', label: 'Manhã (08h-12h)' },
  { value: 'tarde', label: 'Tarde (13h-18h)' },
];

const HORARIOS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
];

const PRAZOS_AUTO_VISTORIA = [
  { value: '24h', label: '24 horas' },
  { value: '48h', label: '48 horas' },
  { value: '72h', label: '72 horas' },
];

const PONTOS_FIXOS = [
  { id: '1', nome: 'Loja Centro', endereco: 'Av. Paulista, 500 - São Paulo/SP' },
  { id: '2', nome: 'Loja Zona Sul', endereco: 'Av. Santo Amaro, 1000 - São Paulo/SP' },
  { id: '3', nome: 'Loja ABC', endereco: 'R. XV de Novembro, 250 - Santo André/SP' },
];

const DEFAULT_FORM_DATA: AgendarVistoriaFormData = {
  tipo: 'presencial',
  data: undefined,
  periodo: undefined,
  horarioEspecifico: undefined,
  vistoriadorId: undefined,
  atribuirDepois: false,
  pontoFixoId: undefined,
  prazo: '48h',
  enviarWhatsapp: true,
  enviarEmail: true,
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export function AgendarVistoriaModal({
  open,
  onOpenChange,
  vistoria,
  onSave,
}: AgendarVistoriaModalProps) {
  const [formData, setFormData] = useState<AgendarVistoriaFormData>(DEFAULT_FORM_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setFormData(DEFAULT_FORM_DATA);
    }
  }, [open]);

  // Buscar vistoriadores
  type VistoriadorOption = { id: string; nome: string };
  
  const { data: vistoriadores = [], isLoading: isLoadingVistoriadores } = useQuery<VistoriadorOption[]>({
    queryKey: ['vistoriadores-disponiveis'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (supabase.from('profiles').select('id, nome') as any)
        .eq('role', 'instalador_vistoriador')
        .eq('ativo', true);

      if (result.error) throw result.error;
      return (result.data || []) as VistoriadorOption[];
    },
    enabled: open && formData.tipo !== 'auto_vistoria',
  });

  // Validação
  const isValid = useMemo(() => {
    if (formData.tipo === 'auto_vistoria') {
      return !!formData.prazo;
    }

    // Para presencial e ponto_fixo
    if (!formData.data || !formData.periodo) return false;
    if (formData.tipo === 'ponto_fixo' && !formData.pontoFixoId) return false;
    if (!formData.atribuirDepois && !formData.vistoriadorId) return false;

    return true;
  }, [formData]);

  // Handlers
  const updateForm = <K extends keyof AgendarVistoriaFormData>(
    key: K,
    value: AgendarVistoriaFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!isValid) return;
    
    setIsSubmitting(true);
    try {
      await onSave(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!vistoria) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agendar Vistoria</DialogTitle>
          <DialogDescription>
            Protocolo {vistoria.protocolo}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Card Resumo */}
          <Card className="bg-muted/50">
            <CardContent className="pt-4 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <span className="text-muted-foreground">Cliente:</span>
                    <p className="font-medium">{vistoria.cliente}</p>
                  </div>
                </div>

                {vistoria.clienteTelefone && (
                  <div className="flex items-start gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <span className="text-muted-foreground">Telefone:</span>
                      <p className="font-medium">{vistoria.clienteTelefone}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2">
                  <Car className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <span className="text-muted-foreground">Veículo:</span>
                    <p className="font-medium">{vistoria.veiculo} - {vistoria.placa}</p>
                  </div>
                </div>

                {(vistoria.endereco || vistoria.cidade) && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <span className="text-muted-foreground">Endereço:</span>
                      <p className="font-medium">
                        {vistoria.endereco && `${vistoria.endereco} - `}
                        {vistoria.cidade}{vistoria.uf && `/${vistoria.uf}`}
                      </p>
                    </div>
                  </div>
                )}

                {vistoria.regiao && (
                  <div className="flex items-start gap-2 sm:col-span-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <span className="text-muted-foreground">Região:</span>
                      <p className="font-medium">{vistoria.regiao}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Tipo de Vistoria */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Tipo de Vistoria</Label>
            <RadioGroup
              value={formData.tipo}
              onValueChange={(value: TipoVistoriaAgendamento) => updateForm('tipo', value)}
              className="grid grid-cols-1 sm:grid-cols-3 gap-3"
            >
              <label
                htmlFor="tipo-presencial"
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-colors",
                  formData.tipo === 'presencial'
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <RadioGroupItem value="presencial" id="tipo-presencial" className="sr-only" />
                <User className="h-6 w-6 text-primary" />
                <span className="font-medium text-sm">Presencial</span>
                <span className="text-xs text-muted-foreground text-center">
                  Vistoriador vai até o cliente
                </span>
              </label>

              <label
                htmlFor="tipo-ponto-fixo"
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-colors",
                  formData.tipo === 'ponto_fixo'
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <RadioGroupItem value="ponto_fixo" id="tipo-ponto-fixo" className="sr-only" />
                <Building2 className="h-6 w-6 text-primary" />
                <span className="font-medium text-sm">Ponto Fixo</span>
                <span className="text-xs text-muted-foreground text-center">
                  Cliente vai até um local parceiro
                </span>
              </label>

              <label
                htmlFor="tipo-auto"
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-colors",
                  formData.tipo === 'auto_vistoria'
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <RadioGroupItem value="auto_vistoria" id="tipo-auto" className="sr-only" />
                <Smartphone className="h-6 w-6 text-primary" />
                <span className="font-medium text-sm">Auto Vistoria</span>
                <span className="text-xs text-muted-foreground text-center">
                  Cliente faz sozinho pelo app
                </span>
              </label>
            </RadioGroup>
          </div>

          {/* Formulário Presencial/Ponto Fixo */}
          {(formData.tipo === 'presencial' || formData.tipo === 'ponto_fixo') && (
            <div className="space-y-4">
              <Separator />
              
              {/* Data e Período */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data da Vistoria *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.data && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.data
                          ? format(formData.data, "dd/MM/yyyy", { locale: ptBR })
                          : "Selecione a data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.data}
                        onSelect={(date) => updateForm('data', date)}
                        disabled={(date) => date < startOfDay(new Date())}
                        locale={ptBR}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Período *</Label>
                  <Select
                    value={formData.periodo}
                    onValueChange={(value: PeriodoVistoria) => updateForm('periodo', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o período" />
                    </SelectTrigger>
                    <SelectContent>
                      {PERIODOS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Horário Específico e Vistoriador */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Horário Específico (opcional)</Label>
                  <Select
                    value={formData.horarioEspecifico || 'any'}
                    onValueChange={(value) => updateForm('horarioEspecifico', value === 'any' ? undefined : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Qualquer horário" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Qualquer horário</SelectItem>
                      {HORARIOS.filter(h => {
                        if (!formData.periodo) return true;
                        const hour = parseInt(h.split(':')[0]);
                        if (formData.periodo === 'manha') return hour < 12;
                        return hour >= 13;
                      }).map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Vistoriador</Label>
                  <Select
                    value={formData.vistoriadorId || ''}
                    onValueChange={(value) => updateForm('vistoriadorId', value || undefined)}
                    disabled={formData.atribuirDepois || isLoadingVistoriadores}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingVistoriadores ? "Carregando..." : "Selecione"} />
                    </SelectTrigger>
                    <SelectContent>
                      {vistoriadores?.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="atribuir-depois"
                      checked={formData.atribuirDepois}
                      onCheckedChange={(checked) => {
                        updateForm('atribuirDepois', checked === true);
                        if (checked) updateForm('vistoriadorId', undefined);
                      }}
                    />
                    <label
                      htmlFor="atribuir-depois"
                      className="text-sm text-muted-foreground cursor-pointer"
                    >
                      Atribuir depois
                    </label>
                  </div>
                </div>
              </div>

              {/* Ponto Fixo - Local */}
              {formData.tipo === 'ponto_fixo' && (
                <div className="space-y-2">
                  <Label>Local *</Label>
                  <Select
                    value={formData.pontoFixoId}
                    onValueChange={(value) => updateForm('pontoFixoId', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o local" />
                    </SelectTrigger>
                    <SelectContent>
                      {PONTOS_FIXOS.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome} - {p.endereco}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Formulário Auto Vistoria */}
          {formData.tipo === 'auto_vistoria' && (
            <div className="space-y-4">
              <Separator />

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  O cliente receberá um link por WhatsApp para realizar a vistoria pelo celular.
                  Ele terá até <strong>{formData.prazo}</strong> para concluir.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Prazo para conclusão *</Label>
                <Select
                  value={formData.prazo}
                  onValueChange={(value: PrazoAutoVistoria) => updateForm('prazo', value)}
                >
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRAZOS_AUTO_VISTORIA.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Notificações</Label>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="enviar-whatsapp"
                      checked={formData.enviarWhatsapp}
                      onCheckedChange={(checked) => updateForm('enviarWhatsapp', checked === true)}
                    />
                    <label htmlFor="enviar-whatsapp" className="text-sm cursor-pointer">
                      Enviar instruções por WhatsApp
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="enviar-email"
                      checked={formData.enviarEmail}
                      onCheckedChange={(checked) => updateForm('enviarEmail', checked === true)}
                    />
                    <label htmlFor="enviar-email" className="text-sm cursor-pointer">
                      Enviar instruções por Email
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-6 gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Agendar Vistoria
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
