import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ChevronLeft, 
  ChevronRight,
  Car, 
  ShieldAlert, 
  Flame, 
  CloudRain, 
  Hammer,
  HelpCircle,
  MapPin,
  Navigation,
  Camera,
  Plus,
  X,
  FileText,
  Upload,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Pencil,
  ChevronDown,
  Clock,
  ImageIcon,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useCreateSinistro } from '@/hooks/useSinistros';
import { useMyVehicles } from '@/hooks/useMyData';
import { toast } from 'sonner';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// ============================================
// TYPES
// ============================================

type TipoSinistro = 'colisao' | 'roubo' | 'furto' | 'incendio' | 'fenomeno_natural' | 'vandalismo' | 'outro';

interface FotoUpload {
  id: string;
  file: File;
  preview: string;
  uploading?: boolean;
  uploaded?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const TIPOS_SINISTRO = [
  { 
    id: 'colisao' as TipoSinistro, 
    nome: 'Colisão', 
    descricao: 'Batida, abalroamento ou capotamento',
    icon: Car,
    bgColor: 'bg-blue-100',
    iconColor: 'text-blue-600'
  },
  { 
    id: 'roubo' as TipoSinistro, 
    nome: 'Roubo/Furto', 
    descricao: 'Veículo levado mediante ameaça ou não',
    icon: ShieldAlert,
    bgColor: 'bg-red-100',
    iconColor: 'text-red-600'
  },
  { 
    id: 'incendio' as TipoSinistro, 
    nome: 'Incêndio', 
    descricao: 'Fogo no veículo por qualquer causa',
    icon: Flame,
    bgColor: 'bg-orange-100',
    iconColor: 'text-orange-600'
  },
  { 
    id: 'fenomeno_natural' as TipoSinistro, 
    nome: 'Fenômeno Natural', 
    descricao: 'Enchente, granizo, queda de árvore, etc.',
    icon: CloudRain,
    bgColor: 'bg-cyan-100',
    iconColor: 'text-cyan-600'
  },
  { 
    id: 'vandalismo' as TipoSinistro, 
    nome: 'Vandalismo', 
    descricao: 'Danos causados por terceiros',
    icon: Hammer,
    bgColor: 'bg-purple-100',
    iconColor: 'text-purple-600'
  },
  { 
    id: 'outro' as TipoSinistro, 
    nome: 'Outro', 
    descricao: 'Outros tipos de sinistro',
    icon: HelpCircle,
    bgColor: 'bg-gray-100',
    iconColor: 'text-gray-600'
  },
];

const DICAS_DESCRICAO: Record<TipoSinistro, string> = {
  colisao: 'Descreva: velocidade aproximada, condições da pista, sinalização, se havia testemunhas...',
  roubo: 'Descreva: quantas pessoas, se estavam armadas, características físicas, direção da fuga...',
  furto: 'Descreva: onde o veículo estava estacionado, horário aproximado, se há câmeras no local...',
  incendio: 'Descreva: onde começou o fogo, se houve explosão, se tentou apagar...',
  fenomeno_natural: 'Descreva: tipo de fenômeno, intensidade, duração, danos visíveis...',
  vandalismo: 'Descreva: quais partes foram danificadas, se viu os responsáveis...',
  outro: 'Seja o mais detalhado possível sobre o que aconteceu...',
};

// ============================================
// DRAGGABLE MARKER COMPONENT
// ============================================

function DraggableMarker({ 
  position, 
  onPositionChange 
}: { 
  position: [number, number]; 
  onPositionChange: (pos: [number, number]) => void;
}) {
  const markerRef = useRef<L.Marker>(null);
  
  const eventHandlers = {
    dragend() {
      const marker = markerRef.current;
      if (marker) {
        const latlng = marker.getLatLng();
        onPositionChange([latlng.lat, latlng.lng]);
      }
    },
  };

  return (
    <Marker
      draggable
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
    />
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function NovoSinistro() {
  const navigate = useNavigate();
  const createSinistro = useCreateSinistro();
  const { data: veiculos, isLoading: loadingVeiculos } = useMyVehicles();
  
  // Wizard state
  const [etapa, setEtapa] = useState(1);
  const [enviando, setEnviando] = useState(false);
  const [protocoloGerado, setProtocoloGerado] = useState<string | null>(null);
  
  // Step 1 - Tipo
  const [tipoSelecionado, setTipoSelecionado] = useState<TipoSinistro | null>(null);
  
  // Step 2 - Data/Local
  const [dataOcorrencia, setDataOcorrencia] = useState<Date | undefined>(undefined);
  const [horaOcorrencia, setHoraOcorrencia] = useState('');
  const [naoLembraHora, setNaoLembraHora] = useState(false);
  const [endereco, setEndereco] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [coordenadas, setCoordenadas] = useState<[number, number] | null>(null);
  const [obtendoLocalizacao, setObtendoLocalizacao] = useState(false);
  
  // Step 3 - Descrição
  const [descricao, setDescricao] = useState('');
  const [envolveTerceiros, setEnvolveTerceiros] = useState<boolean | null>(null);
  
  // Step 4 - Fotos
  const [fotos, setFotos] = useState<FotoUpload[]>([]);
  const fotoInputRef = useRef<HTMLInputElement>(null);
  
  // Step 5 - B.O.
  const [naoFezBO, setNaoFezBO] = useState(false);
  const [numeroBO, setNumeroBO] = useState('');
  const [delegacia, setDelegacia] = useState('');
  const [arquivoBO, setArquivoBO] = useState<File | null>(null);
  const boInputRef = useRef<HTMLInputElement>(null);
  
  // Step 6 - Confirmação
  const [aceitaTermos, setAceitaTermos] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    tipo: true,
    local: true,
    descricao: true,
    fotos: true,
    bo: true,
  });
  
  // Verificar se B.O. é obrigatório
  const boObrigatorio = tipoSelecionado === 'roubo' || tipoSelecionado === 'furto';
  
  // Progresso
  const progressoPercentual = (etapa / 6) * 100;
  
  // ============================================
  // HANDLERS
  // ============================================
  
  const obterLocalizacao = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocalização não suportada');
      return;
    }
    
    setObtendoLocalizacao(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setCoordenadas([latitude, longitude]);
        
        // Reverse geocoding usando Nominatim
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await response.json();
          
          if (data.address) {
            const addr = data.address;
            setEndereco(
              [addr.road, addr.house_number].filter(Boolean).join(', ') || 
              data.display_name?.split(',')[0] || ''
            );
            setCidade(addr.city || addr.town || addr.village || '');
            setEstado(addr.state || '');
          }
        } catch (error) {
          console.error('Erro ao obter endereço:', error);
        }
        
        setObtendoLocalizacao(false);
        toast.success('Localização obtida!');
      },
      (error) => {
        console.error('Erro de geolocalização:', error);
        toast.error('Não foi possível obter sua localização');
        setObtendoLocalizacao(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };
  
  const handleFotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    const novasFotos: FotoUpload[] = Array.from(files).slice(0, 10 - fotos.length).map(file => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
    }));
    
    setFotos(prev => [...prev, ...novasFotos]);
    e.target.value = '';
  };
  
  const removerFoto = (id: string) => {
    setFotos(prev => {
      const foto = prev.find(f => f.id === id);
      if (foto) URL.revokeObjectURL(foto.preview);
      return prev.filter(f => f.id !== id);
    });
  };
  
  const handleBOUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setArquivoBO(file);
  };
  
  const validarEtapa = (): boolean => {
    switch (etapa) {
      case 1:
        return !!tipoSelecionado;
      case 2:
        return !!dataOcorrencia && !!endereco && !!cidade;
      case 3:
        return descricao.length >= 20;
      case 4:
        return true; // Fotos são recomendadas, não obrigatórias
      case 5:
        if (boObrigatorio && !naoFezBO) {
          return !!numeroBO;
        }
        return true;
      case 6:
        return aceitaTermos;
      default:
        return false;
    }
  };
  
  const handleEnviar = async () => {
    if (!veiculos?.length) {
      toast.error('Nenhum veículo encontrado');
      return;
    }
    
    setEnviando(true);
    
    try {
      const veiculo = veiculos[0];
      const horaFormatada = naoLembraHora ? undefined : (horaOcorrencia || undefined);
      
      // Criar sinistro via edge function
      const resultado = await createSinistro.mutateAsync({
        veiculo_id: veiculo.id,
        tipo_sinistro: tipoSelecionado as string,
        data_evento: format(dataOcorrencia!, 'yyyy-MM-dd'),
        hora_evento: horaFormatada,
        endereco_evento: endereco,
        cidade_evento: cidade,
        estado_evento: estado,
        descricao: descricao,
        numero_bo: numeroBO || undefined,
        latitude: coordenadas?.[0],
        longitude: coordenadas?.[1],
      });
      
      // Upload fotos após criar sinistro
      if (fotos.length > 0 && resultado.sinistro_id) {
        for (const foto of fotos) {
          const ext = foto.file.name.split('.').pop() || 'jpg';
          const path = `${resultado.sinistro_id}/fotos/${foto.id}.${ext}`;
          await supabase.storage.from('sinistros').upload(path, foto.file);
        }
      }
      
      // Upload B.O. se houver
      if (arquivoBO && resultado.sinistro_id) {
        const ext = arquivoBO.type.includes('pdf') ? 'pdf' : 'jpg';
        const path = `${resultado.sinistro_id}/bo.${ext}`;
        const { error: uploadError } = await supabase.storage.from('sinistros').upload(path, arquivoBO);
        
        if (!uploadError) {
          await supabase
            .from('sinistros')
            .update({ bo_arquivo_url: path })
            .eq('id', resultado.sinistro_id);
        }
      }
      
      setProtocoloGerado(resultado.numero_sinistro || null);
      
    } catch (error) {
      console.error('Erro ao criar sinistro:', error);
      toast.error('Erro ao enviar sinistro. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };
  
  const avancarEtapa = () => {
    if (etapa === 6) {
      handleEnviar();
    } else {
      setEtapa(e => e + 1);
    }
  };
  
  const voltarEtapa = () => {
    if (etapa === 1) {
      navigate('/app/sinistros');
    } else {
      setEtapa(e => e - 1);
    }
  };
  
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };
  
  // Cleanup
  useEffect(() => {
    return () => {
      fotos.forEach(f => URL.revokeObjectURL(f.preview));
    };
  }, []);
  
  // ============================================
  // RENDER - SUCCESS
  // ============================================
  
  if (protocoloGerado) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
          <CheckCircle className="h-10 w-10 text-green-600" />
        </div>
        
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Sinistro Registrado!
        </h1>
        
        <p className="text-muted-foreground mb-6">
          Seu protocolo foi gerado com sucesso
        </p>
        
        <div className="bg-muted rounded-xl p-4 mb-6">
          <p className="text-sm text-muted-foreground mb-1">Protocolo</p>
          <p className="text-2xl font-mono font-bold">{protocoloGerado}</p>
        </div>
        
        <p className="text-sm text-muted-foreground mb-8 max-w-xs">
          Acompanhe o andamento do seu sinistro na área de sinistros do aplicativo.
        </p>
        
        <div className="space-y-3 w-full max-w-xs">
          <Button className="w-full" onClick={() => navigate('/app/sinistros')}>
            Ver Meus Sinistros
          </Button>
          <Button variant="outline" className="w-full" onClick={() => navigate('/app')}>
            Voltar ao Início
          </Button>
        </div>
      </div>
    );
  }
  
  // ============================================
  // RENDER - WIZARD
  // ============================================
  
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header Fixo */}
      <header className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" size="icon" onClick={voltarEtapa}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold">Comunicar Sinistro</h1>
          <Button variant="ghost" size="icon" onClick={() => navigate('/app/sinistros')}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Etapa {etapa} de 6</span>
          <Progress value={progressoPercentual} className="flex-1 h-2" />
        </div>
      </header>
      
      {/* Conteúdo Scrollável */}
      <main className="flex-1 overflow-y-auto p-4 pb-28">
        {/* STEP 1 - Tipo */}
        {etapa === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold">O que aconteceu?</h2>
              <p className="text-sm text-muted-foreground">Selecione o tipo de ocorrência</p>
            </div>
            
            <RadioGroup 
              value={tipoSelecionado || ''} 
              onValueChange={(v) => setTipoSelecionado(v as TipoSinistro)}
              className="space-y-3"
            >
              {TIPOS_SINISTRO.map((tipo) => (
                <label
                  key={tipo.id}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all",
                    tipoSelecionado === tipo.id 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div className={cn("p-3 rounded-lg", tipo.bgColor)}>
                    <tipo.icon className={cn("h-6 w-6", tipo.iconColor)} />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{tipo.nome}</div>
                    <div className="text-sm text-muted-foreground">{tipo.descricao}</div>
                  </div>
                  <RadioGroupItem value={tipo.id} className="h-5 w-5" />
                </label>
              ))}
            </RadioGroup>
          </div>
        )}
        
        {/* STEP 2 - Data/Local */}
        {etapa === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">Quando e onde aconteceu?</h2>
              <p className="text-sm text-muted-foreground">Informe data, hora e local</p>
            </div>
            
            {/* Data */}
            <div className="space-y-2">
              <Label>Data da Ocorrência *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dataOcorrencia && "text-muted-foreground"
                    )}
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    {dataOcorrencia ? format(dataOcorrencia, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataOcorrencia}
                    onSelect={setDataOcorrencia}
                    disabled={(date) => date > new Date()}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            {/* Hora */}
            <div className="space-y-2">
              <Label>Hora Aproximada</Label>
              <Input
                type="time"
                value={horaOcorrencia}
                onChange={(e) => setHoraOcorrencia(e.target.value)}
                disabled={naoLembraHora}
                className={cn(naoLembraHora && "opacity-50")}
              />
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="naoLembraHora"
                  checked={naoLembraHora} 
                  onCheckedChange={(checked) => {
                    setNaoLembraHora(!!checked);
                    if (checked) setHoraOcorrencia('');
                  }} 
                />
                <Label htmlFor="naoLembraHora" className="text-sm font-normal cursor-pointer">
                  Não lembro a hora exata
                </Label>
              </div>
            </div>
            
            {/* Localização */}
            <div className="space-y-3">
              <Label>Local da Ocorrência *</Label>
              
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={obterLocalizacao}
                disabled={obtendoLocalizacao}
              >
                {obtendoLocalizacao ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Navigation className="mr-2 h-4 w-4" />
                )}
                {obtendoLocalizacao ? 'Obtendo localização...' : 'Usar minha localização atual'}
              </Button>
              
              <Input
                placeholder="Endereço / Rua"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
              />
              
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Cidade *"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                />
                <Input
                  placeholder="Estado"
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                />
              </div>
            </div>
            
            {/* Mini Mapa */}
            {coordenadas && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Arraste o pin para ajustar
                </Label>
                <div className="h-48 rounded-xl overflow-hidden border">
                  <MapContainer
                    center={coordenadas}
                    zoom={16}
                    className="h-full w-full"
                    scrollWheelZoom={false}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; OpenStreetMap'
                    />
                    <DraggableMarker 
                      position={coordenadas} 
                      onPositionChange={setCoordenadas} 
                    />
                  </MapContainer>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* STEP 3 - Descrição */}
        {etapa === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">Conte o que aconteceu</h2>
              <p className="text-sm text-muted-foreground">Descreva os detalhes da ocorrência</p>
            </div>
            
            {/* Dica contextual */}
            {tipoSelecionado && (
              <div className="bg-blue-50 p-3 rounded-lg flex gap-2">
                <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-700">
                  {DICAS_DESCRICAO[tipoSelecionado]}
                </p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Descrição Detalhada *</Label>
              <Textarea
                placeholder="Descreva o que aconteceu com o máximo de detalhes possível..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="min-h-[150px]"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{descricao.length < 20 && 'Mínimo 20 caracteres'}</span>
                <span>{descricao.length} caracteres</span>
              </div>
            </div>
            
            {/* Pergunta adicional para colisão */}
            {tipoSelecionado === 'colisao' && (
              <div className="space-y-3">
                <Label>Houve envolvimento de terceiros?</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant={envolveTerceiros === true ? 'default' : 'outline'}
                    onClick={() => setEnvolveTerceiros(true)}
                  >
                    Sim
                  </Button>
                  <Button
                    type="button"
                    variant={envolveTerceiros === false ? 'default' : 'outline'}
                    onClick={() => setEnvolveTerceiros(false)}
                  >
                    Não
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* STEP 4 - Fotos */}
        {etapa === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">Envie fotos</h2>
              <p className="text-sm text-muted-foreground">
                Fotografe os danos e o local da ocorrência
              </p>
            </div>
            
            {/* Sugestões */}
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm font-medium mb-1">Sugestões de fotos:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Vista frontal do veículo</li>
                <li>• Vista traseira do veículo</li>
                <li>• Detalhes dos danos</li>
                <li>• Local da ocorrência</li>
              </ul>
            </div>
            
            {/* Aviso mínimo */}
            {fotos.length < 3 && fotos.length > 0 && (
              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">Recomendamos pelo menos 3 fotos</span>
              </div>
            )}
            
            {/* Grid de fotos */}
            <div className="grid grid-cols-3 gap-3">
              {fotos.map((foto) => (
                <div key={foto.id} className="relative aspect-square">
                  <img
                    src={foto.preview}
                    alt="Foto do sinistro"
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <button
                    onClick={() => removerFoto(foto.id)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              
              {/* Botão adicionar */}
              {fotos.length < 10 && (
                <button
                  onClick={() => fotoInputRef.current?.click()}
                  className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-2 hover:border-primary transition-colors"
                >
                  <Camera className="h-6 w-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Adicionar</span>
                </button>
              )}
            </div>
            
            <input
              ref={fotoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handleFotoCapture}
              className="hidden"
            />
            
            <p className="text-xs text-center text-muted-foreground">
              {fotos.length}/10 fotos adicionadas
            </p>
          </div>
        )}
        
        {/* STEP 5 - B.O. */}
        {etapa === 5 && (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold">Boletim de Ocorrência</h2>
                <p className="text-sm text-muted-foreground">
                  {boObrigatorio ? 'Obrigatório para este tipo de sinistro' : 'Opcional, mas recomendado'}
                </p>
              </div>
              {boObrigatorio && (
                <Badge variant="destructive">Obrigatório</Badge>
              )}
            </div>
            
            {/* Checkbox não fez */}
            <div className="flex items-center gap-2">
              <Checkbox 
                id="naoFezBO"
                checked={naoFezBO} 
                onCheckedChange={(checked) => setNaoFezBO(!!checked)} 
              />
              <Label htmlFor="naoFezBO" className="text-sm font-normal cursor-pointer">
                Ainda não registrei o B.O.
              </Label>
            </div>
            
            {/* Formulário B.O. */}
            {!naoFezBO && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Número do B.O. {boObrigatorio && '*'}</Label>
                  <Input
                    placeholder="Ex: 123456/2024"
                    value={numeroBO}
                    onChange={(e) => setNumeroBO(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Delegacia</Label>
                  <Input
                    placeholder="Ex: 1ª DP - Centro"
                    value={delegacia}
                    onChange={(e) => setDelegacia(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Anexar B.O. (PDF ou foto)</Label>
                  <button
                    onClick={() => boInputRef.current?.click()}
                    className="w-full border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors"
                  >
                    {arquivoBO ? (
                      <div className="flex items-center justify-center gap-2">
                        <FileText className="h-6 w-6 text-primary" />
                        <span className="text-sm font-medium">{arquivoBO.name}</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            setArquivoBO(null);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Clique para anexar arquivo
                        </p>
                      </>
                    )}
                  </button>
                  <input
                    ref={boInputRef}
                    type="file"
                    accept=".pdf,image/*"
                    onChange={handleBOUpload}
                    className="hidden"
                  />
                </div>
              </div>
            )}
            
            {/* Instruções se não fez B.O. */}
            {naoFezBO && (
              <Card className="bg-amber-50 border-amber-200">
                <CardContent className="p-4">
                  <h4 className="font-medium text-amber-800 mb-2">
                    Como registrar o B.O.:
                  </h4>
                  <ol className="text-sm text-amber-700 space-y-2">
                    <li>1. Acesse a Delegacia Virtual do seu estado</li>
                    <li>2. Ou vá presencialmente à delegacia mais próxima</li>
                    <li>3. Guarde o número do B.O. para informar depois</li>
                  </ol>
                  <Button variant="outline" className="mt-4 w-full" asChild>
                    <a 
                      href="https://www.delegaciavirtual.sinesp.gov.br/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      Delegacia Virtual (Federal)
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                  
                  {boObrigatorio && (
                    <p className="text-xs text-amber-600 mt-3">
                      ⚠️ Você precisará enviar o B.O. posteriormente para dar continuidade à análise.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
        
        {/* STEP 6 - Revisão */}
        {etapa === 6 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold">Confirme as informações</h2>
              <p className="text-sm text-muted-foreground">Revise antes de enviar</p>
            </div>
            
            {/* Seção Tipo */}
            <Collapsible open={expandedSections.tipo} onOpenChange={() => toggleSection('tipo')}>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4" />
                    <span className="font-medium">Tipo de Sinistro</span>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setEtapa(1); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", expandedSections.tipo && "rotate-180")} />
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="p-3 pt-2">
                <p className="text-sm">{TIPOS_SINISTRO.find(t => t.id === tipoSelecionado)?.nome}</p>
              </CollapsibleContent>
            </Collapsible>
            
            {/* Seção Local */}
            <Collapsible open={expandedSections.local} onOpenChange={() => toggleSection('local')}>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span className="font-medium">Data e Local</span>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setEtapa(2); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", expandedSections.local && "rotate-180")} />
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="p-3 pt-2 space-y-1">
                <p className="text-sm">
                  {dataOcorrencia && format(dataOcorrencia, "dd/MM/yyyy", { locale: ptBR })}
                  {horaOcorrencia && ` às ${horaOcorrencia}`}
                </p>
                <p className="text-sm text-muted-foreground">{endereco}, {cidade} - {estado}</p>
              </CollapsibleContent>
            </Collapsible>
            
            {/* Seção Descrição */}
            <Collapsible open={expandedSections.descricao} onOpenChange={() => toggleSection('descricao')}>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">Descrição</span>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setEtapa(3); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", expandedSections.descricao && "rotate-180")} />
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="p-3 pt-2">
                <p className="text-sm line-clamp-3">{descricao}</p>
              </CollapsibleContent>
            </Collapsible>
            
            {/* Seção Fotos */}
            <Collapsible open={expandedSections.fotos} onOpenChange={() => toggleSection('fotos')}>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    <span className="font-medium">Fotos ({fotos.length})</span>
                    {fotos.length > 0 ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setEtapa(4); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", expandedSections.fotos && "rotate-180")} />
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="p-3 pt-2">
                {fotos.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2">
                    {fotos.slice(0, 4).map((foto) => (
                      <img
                        key={foto.id}
                        src={foto.preview}
                        alt="Foto"
                        className="w-full aspect-square object-cover rounded"
                      />
                    ))}
                    {fotos.length > 4 && (
                      <div className="w-full aspect-square rounded bg-muted flex items-center justify-center text-sm">
                        +{fotos.length - 4}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma foto anexada</p>
                )}
              </CollapsibleContent>
            </Collapsible>
            
            {/* Seção B.O. */}
            <Collapsible open={expandedSections.bo} onOpenChange={() => toggleSection('bo')}>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">Boletim de Ocorrência</span>
                    {numeroBO || naoFezBO ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : boObrigatorio ? (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setEtapa(5); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", expandedSections.bo && "rotate-180")} />
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="p-3 pt-2">
                {naoFezBO ? (
                  <p className="text-sm text-amber-600">B.O. será enviado posteriormente</p>
                ) : numeroBO ? (
                  <div className="space-y-1">
                    <p className="text-sm">Nº {numeroBO}</p>
                    {delegacia && <p className="text-sm text-muted-foreground">{delegacia}</p>}
                    {arquivoBO && <p className="text-sm text-muted-foreground">Arquivo: {arquivoBO.name}</p>}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Não informado</p>
                )}
              </CollapsibleContent>
            </Collapsible>
            
            {/* Declaração */}
            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-start gap-3">
                <Checkbox 
                  id="termos"
                  checked={aceitaTermos} 
                  onCheckedChange={(checked) => setAceitaTermos(!!checked)} 
                />
                <Label htmlFor="termos" className="text-sm font-normal cursor-pointer leading-relaxed">
                  Declaro que as informações prestadas são verdadeiras e estou ciente de que declarações falsas podem configurar crime.
                </Label>
              </div>
            </div>
          </div>
        )}
      </main>
      
      {/* Footer Fixo */}
      <footer className="fixed bottom-16 left-0 right-0 bg-background border-t p-4 safe-area-bottom">
        <div className="max-w-md mx-auto flex gap-3">
          {etapa > 1 && (
            <Button variant="outline" className="flex-1" onClick={voltarEtapa}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
          )}
          <Button 
            className="flex-1" 
            onClick={avancarEtapa}
            disabled={!validarEtapa() || enviando}
          >
            {enviando ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : etapa === 6 ? (
              'Enviar Sinistro'
            ) : (
              <>
                Continuar
                <ChevronRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </footer>
    </div>
  );
}
