import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, Check, Loader2, MapPin, Phone, Clock, Car, 
  Truck, Key, Fuel, CircleDot, Battery, Edit2, MessageSquare,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CepInput, TelefoneInput } from '@/components/inputs/MaskedInputs';
import { buscarCep } from '@/lib/cep';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useMyAssociado, useMyVehicles } from '@/hooks/useMyData';
import { useSolicitarAssistencia } from '@/hooks/useAppAssociado';
import { useAuth } from '@/contexts/AuthContext';

// Types
interface TipoServico {
  id: string;
  nome: string;
  descricao: string;
  icone: React.ElementType;
  cor: string;
  bg: string;
}

interface FormState {
  tipoServico: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  referencia: string;
  telefoneContato: string;
  observacoes: string;
}

// Data
const tiposServico: TipoServico[] = [
  { id: 'reboque', nome: 'Reboque', descricao: 'Guincho para seu veículo', icone: Truck, cor: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 'chaveiro', nome: 'Chaveiro', descricao: 'Abertura de portas e ignição', icone: Key, cor: 'text-yellow-500', bg: 'bg-yellow-50' },
  { id: 'pane_seca', nome: 'Pane Seca', descricao: 'Entrega de combustível', icone: Fuel, cor: 'text-red-500', bg: 'bg-red-50' },
  { id: 'troca_pneu', nome: 'Troca de Pneu', descricao: 'Substituição pelo estepe', icone: CircleDot, cor: 'text-gray-700', bg: 'bg-gray-100' },
  { id: 'bateria', nome: 'Bateria', descricao: 'Carga ou troca de bateria', icone: Battery, cor: 'text-green-500', bg: 'bg-green-50' },
];

const UFs = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

// Progress Steps Component
function ProgressSteps({ etapaAtual, onEtapaClick }: { etapaAtual: number; onEtapaClick: (etapa: number) => void }) {
  const etapas = [
    { numero: 1, label: 'Serviço' },
    { numero: 2, label: 'Local' },
    { numero: 3, label: 'Confirmar' },
  ];

  return (
    <div className="flex items-center justify-center gap-2 py-4">
      {etapas.map((etapa, index) => (
        <div key={etapa.numero} className="flex items-center">
          <button
            onClick={() => etapa.numero < etapaAtual && onEtapaClick(etapa.numero)}
            disabled={etapa.numero > etapaAtual}
            className="flex flex-col items-center"
          >
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 text-sm font-medium',
                etapa.numero < etapaAtual && 'bg-primary text-primary-foreground cursor-pointer',
                etapa.numero === etapaAtual && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
                etapa.numero > etapaAtual && 'bg-muted text-muted-foreground'
              )}
            >
              {etapa.numero < etapaAtual ? <Check className="h-4 w-4" /> : etapa.numero}
            </div>
            <span
              className={cn(
                'text-xs mt-1 transition-all',
                etapa.numero === etapaAtual ? 'font-semibold text-foreground' : 'text-muted-foreground'
              )}
            >
              {etapa.label}
            </span>
          </button>
          {index < etapas.length - 1 && (
            <div
              className={cn(
                'w-8 h-0.5 mx-1 transition-all duration-500',
                etapa.numero < etapaAtual ? 'bg-primary' : 'bg-muted'
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// Service Card Component
function ServicoCard({ 
  servico, 
  selecionado, 
  onClick 
}: { 
  servico: TipoServico; 
  selecionado: boolean; 
  onClick: () => void;
}) {
  const Icone = servico.icone;
  
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full p-4 rounded-xl border-2 transition-all duration-200 flex items-center gap-4 text-left',
        'hover:scale-[1.02] active:scale-[0.98]',
        selecionado 
          ? 'border-primary bg-primary/5 shadow-md' 
          : 'border-border bg-card hover:border-primary/50'
      )}
    >
      <div className={cn('p-3 rounded-xl', servico.bg)}>
        <Icone className={cn('h-6 w-6', servico.cor)} />
      </div>
      <div className="flex-1">
        <p className="font-semibold text-foreground">{servico.nome}</p>
        <p className="text-sm text-muted-foreground">{servico.descricao}</p>
      </div>
      {selecionado && (
        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
          <Check className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
    </button>
  );
}

export default function AppAssistenciaNova() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const tipoServicoInicial = location.state?.tipoServico || '';

  // Buscar dados REAIS do associado e veículos
  const { data: associado, isLoading: loadingAssociado } = useMyAssociado();
  const { data: veiculos, isLoading: loadingVeiculos } = useMyVehicles();
  const solicitarAssistencia = useSolicitarAssistencia();
  
  // Selecionar primeiro veículo automaticamente
  const veiculo = veiculos?.[0];

  const [etapaAtual, setEtapaAtual] = useState(tipoServicoInicial ? 2 : 1);
  const [formState, setFormState] = useState<FormState>({
    tipoServico: tipoServicoInicial,
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    referencia: '',
    telefoneContato: '',
    observacoes: '',
  });

  const [isGettingGPS, setIsGettingGPS] = useState(false);
  const [gpsObtido, setGpsObtido] = useState(false);
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number } | null>(null);
  const [isBuscandoCep, setIsBuscandoCep] = useState(false);
  const [isEnviando, setIsEnviando] = useState(false);
  const [editandoTelefone, setEditandoTelefone] = useState(false);

  // Atualizar telefone quando associado carregar
  useEffect(() => {
    if (associado?.telefone && !formState.telefoneContato) {
      setFormState(prev => ({ ...prev, telefoneContato: associado.telefone }));
    }
  }, [associado]);

  // Redirecionar se não autenticado
  useEffect(() => {
    if (!user && !loadingAssociado) {
      navigate('/app/login');
    }
  }, [user, loadingAssociado, navigate]);

  const updateForm = (field: keyof FormState, value: string) => {
    setFormState(prev => ({ ...prev, [field]: value }));
  };

  // Auto-advance after selecting service
  useEffect(() => {
    if (formState.tipoServico && etapaAtual === 1) {
      const timer = setTimeout(() => setEtapaAtual(2), 500);
      return () => clearTimeout(timer);
    }
  }, [formState.tipoServico, etapaAtual]);

  const handleGetGPS = async () => {
    setIsGettingGPS(true);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const { latitude, longitude } = position.coords;
      setCoordenadas({ lat: latitude, lng: longitude });

      // Tentar buscar endereço via reverse geocoding (Nominatim)
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`
        );
        const data = await response.json();
        
        if (data.address) {
          setFormState(prev => ({
            ...prev,
            logradouro: data.address.road || data.address.pedestrian || '',
            numero: data.address.house_number || '',
            bairro: data.address.suburb || data.address.neighbourhood || '',
            cidade: data.address.city || data.address.town || data.address.village || '',
            estado: data.address.state?.slice(0, 2).toUpperCase() || '',
            cep: data.address.postcode?.replace('-', '') || '',
          }));
        }
      } catch {
        // Se falhar reverse geocoding, só mantém coordenadas
      }

      setGpsObtido(true);
      toast.success('Localização obtida com sucesso!');
    } catch (error) {
      toast.error('Não foi possível obter sua localização');
    } finally {
      setIsGettingGPS(false);
    }
  };

  const handleCepComplete = async (cep: string) => {
    if (cep.length < 8) return;
    setIsBuscandoCep(true);
    try {
      const endereco = await buscarCep(cep);
      if (endereco) {
        setFormState(prev => ({
          ...prev,
          logradouro: endereco.logradouro,
          bairro: endereco.bairro,
          cidade: endereco.cidade,
          estado: endereco.uf,
        }));
      }
    } finally {
      setIsBuscandoCep(false);
    }
  };

  const canContinueEtapa2 = 
    formState.cep.length >= 8 &&
    formState.logradouro.trim() !== '' &&
    formState.numero.trim() !== '' &&
    formState.bairro.trim() !== '' &&
    formState.cidade.trim() !== '' &&
    formState.estado !== '';

  // Handler REAL que chama a Edge Function
  const handleConfirmar = async () => {
    if (!veiculo) {
      toast.error('Nenhum veículo encontrado');
      return;
    }

    setIsEnviando(true);
    
    try {
      const enderecoCompleto = `${formState.logradouro}, ${formState.numero}${formState.complemento ? ` - ${formState.complemento}` : ''} - ${formState.bairro}, ${formState.cidade}/${formState.estado}`;
      
      const resultado = await solicitarAssistencia.mutateAsync({
        tipo: formState.tipoServico as any,
        veiculo_id: veiculo.id,
        endereco: enderecoCompleto,
        latitude: coordenadas?.lat || 0,
        longitude: coordenadas?.lng || 0,
        descricao: formState.observacoes || undefined,
      });

      toast.success(`Solicitação enviada! Protocolo: ${resultado.protocolo}`, {
        description: 'Você receberá uma ligação em breve.'
      });
      
      navigate('/app/assistencia');
    } catch (error) {
      console.error('Erro ao solicitar assistência:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar solicitação');
    } finally {
      setIsEnviando(false);
    }
  };

  const servicoSelecionado = tiposServico.find(s => s.id === formState.tipoServico);

  // Loading state
  if (loadingAssociado || loadingVeiculos) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="sticky top-0 z-10 bg-background border-b">
          <div className="flex items-center gap-3 p-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Skeleton className="h-6 w-40" />
          </div>
        </div>
        <div className="p-4 space-y-4">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // Sem veículo
  if (!veiculo) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Car className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Nenhum veículo encontrado</h2>
        <p className="text-muted-foreground text-center mb-6">
          Você precisa ter um veículo cadastrado para solicitar assistência.
        </p>
        <Button onClick={() => navigate('/app/home')}>Voltar para Home</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center gap-3 p-4">
          <Button
            variant="ghost"
            size="icon"
            className="min-h-[44px] min-w-[44px]"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Solicitar Assistência</h1>
        </div>
        
        <ProgressSteps 
          etapaAtual={etapaAtual} 
          onEtapaClick={(etapa) => setEtapaAtual(etapa)} 
        />
      </div>

      <div className="p-4">
        {/* Alerta de Segurança */}
        <Card className="border-0 shadow-sm bg-amber-50 mb-4">
          <CardContent className="p-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                <strong>Em caso de acidente com vítimas</strong>, ligue primeiro para o SAMU (192) ou Bombeiros (193).
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ETAPA 1: Tipo de Serviço */}
        {etapaAtual === 1 && (
          <div className="space-y-3 animate-fade-in">
            <h2 className="text-base font-medium text-foreground mb-4">Qual serviço você precisa?</h2>
            {tiposServico.map(servico => (
              <ServicoCard
                key={servico.id}
                servico={servico}
                selecionado={formState.tipoServico === servico.id}
                onClick={() => updateForm('tipoServico', servico.id)}
              />
            ))}
          </div>
        )}

        {/* ETAPA 2: Localização */}
        {etapaAtual === 2 && (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-base font-medium text-foreground">Onde você está?</h2>

            {/* GPS Button */}
            <Button
              variant={gpsObtido ? 'default' : 'outline'}
              className={cn(
                'w-full min-h-[52px] justify-start gap-3',
                isGettingGPS && 'animate-pulse',
                gpsObtido && 'bg-green-600 hover:bg-green-700'
              )}
              onClick={handleGetGPS}
              disabled={isGettingGPS || gpsObtido}
            >
              {isGettingGPS ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : gpsObtido ? (
                <Check className="h-5 w-5" />
              ) : (
                <MapPin className="h-5 w-5" />
              )}
              {isGettingGPS ? 'Obtendo localização...' : gpsObtido ? 'Localização obtida!' : 'Usar minha localização atual'}
            </Button>

            {/* Divider */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-3 text-sm text-muted-foreground">
                  ou digite o endereço
                </span>
              </div>
            </div>

            {/* Address Form */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="cep">CEP *</Label>
                <div className="relative">
                  <CepInput
                    id="cep"
                    value={formState.cep}
                    onChange={(value) => updateForm('cep', value)}
                    onCepComplete={handleCepComplete}
                    placeholder="00000-000"
                  />
                  {isBuscandoCep && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="logradouro">Endereço *</Label>
                <Input
                  id="logradouro"
                  value={formState.logradouro}
                  onChange={(e) => updateForm('logradouro', e.target.value)}
                  placeholder="Rua, Avenida..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="numero">Número *</Label>
                  <Input
                    id="numero"
                    value={formState.numero}
                    onChange={(e) => updateForm('numero', e.target.value)}
                    placeholder="123"
                  />
                </div>
                <div>
                  <Label htmlFor="complemento">Complemento</Label>
                  <Input
                    id="complemento"
                    value={formState.complemento}
                    onChange={(e) => updateForm('complemento', e.target.value)}
                    placeholder="Apto, Bloco..."
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="bairro">Bairro *</Label>
                <Input
                  id="bairro"
                  value={formState.bairro}
                  onChange={(e) => updateForm('bairro', e.target.value)}
                  placeholder="Centro"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label htmlFor="cidade">Cidade *</Label>
                  <Input
                    id="cidade"
                    value={formState.cidade}
                    onChange={(e) => updateForm('cidade', e.target.value)}
                    placeholder="Uberlândia"
                  />
                </div>
                <div>
                  <Label htmlFor="estado">UF *</Label>
                  <Select value={formState.estado} onValueChange={(v) => updateForm('estado', v)}>
                    <SelectTrigger id="estado">
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      {UFs.map(uf => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="referencia">Ponto de referência</Label>
                <Input
                  id="referencia"
                  value={formState.referencia}
                  onChange={(e) => updateForm('referencia', e.target.value)}
                  placeholder="Próximo ao posto Shell..."
                />
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="space-y-3 pt-4">
              <Button
                variant="outline"
                className="w-full min-h-[44px]"
                onClick={() => setEtapaAtual(1)}
              >
                ← Voltar
              </Button>
              <Button
                className="w-full min-h-[44px]"
                onClick={() => setEtapaAtual(3)}
                disabled={!canContinueEtapa2}
              >
                Continuar →
              </Button>
            </div>
          </div>
        )}

        {/* ETAPA 3: Confirmação */}
        {etapaAtual === 3 && (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-base font-medium text-foreground">Confirme sua solicitação</h2>

            {/* Card Veículo - DADOS REAIS */}
            <Card className="border-0 shadow-sm bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-background">
                    <Car className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground uppercase font-medium">Veículo</p>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{veiculo.marca} {veiculo.modelo}</p>
                      <Badge variant="secondary" className="text-xs">{veiculo.placa}</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card Serviço */}
            {servicoSelecionado && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={cn('p-2 rounded-lg', servicoSelecionado.bg)}>
                      <servicoSelecionado.icone className={cn('h-5 w-5', servicoSelecionado.cor)} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground uppercase font-medium">Serviço</p>
                      <p className="font-semibold">{servicoSelecionado.nome}</p>
                      <p className="text-sm text-muted-foreground">{servicoSelecionado.descricao}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Card Local */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-50">
                    <MapPin className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground uppercase font-medium">Local</p>
                    <p className="font-semibold">{formState.logradouro}, {formState.numero}</p>
                    <p className="text-sm text-muted-foreground">
                      {formState.bairro} - {formState.cidade}/{formState.estado}
                    </p>
                    {formState.referencia && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Ref: {formState.referencia}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card Contato - DADOS REAIS */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-50">
                    <Phone className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground uppercase font-medium">Contato</p>
                    {editandoTelefone ? (
                      <TelefoneInput
                        value={formState.telefoneContato}
                        onChange={(value) => updateForm('telefoneContato', value)}
                        onBlur={() => setEditandoTelefone(false)}
                        autoFocus
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-semibold">{formState.telefoneContato || associado?.telefone || '-'}</p>
                    )}
                  </div>
                  {!editandoTelefone && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setEditandoTelefone(true)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Observações */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-purple-50">
                    <MessageSquare className="h-5 w-5 text-purple-500" />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="observacoes" className="text-xs text-muted-foreground uppercase font-medium">
                      Observações (opcional)
                    </Label>
                    <Textarea
                      id="observacoes"
                      value={formState.observacoes}
                      onChange={(e) => updateForm('observacoes', e.target.value.slice(0, 500))}
                      placeholder="Descreva o problema ou informações adicionais..."
                      className="mt-2 resize-none"
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground text-right mt-1">
                      {formState.observacoes.length}/500
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tempo Estimado */}
            <div className="flex items-center justify-center gap-2 py-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-muted-foreground">Tempo estimado:</span>
              <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                30-45 minutos
              </Badge>
            </div>

            {/* Navigation Buttons */}
            <div className="space-y-3 pt-2">
              <Button
                variant="outline"
                className="w-full min-h-[44px]"
                onClick={() => setEtapaAtual(2)}
                disabled={isEnviando}
              >
                ← Voltar
              </Button>
              <Button
                className="w-full min-h-[52px] bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold text-lg"
                onClick={handleConfirmar}
                disabled={isEnviando}
              >
                {isEnviando ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Enviando solicitação...
                  </>
                ) : (
                  'Solicitar Agora'
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Você receberá uma ligação em até 5 minutos
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
