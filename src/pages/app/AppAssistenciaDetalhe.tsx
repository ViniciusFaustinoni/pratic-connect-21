import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Copy, RefreshCw, Loader2,
  Search, Truck, Clock, Navigation, Gauge,
  CheckCircle, XCircle, Wrench, X,
  Star, Phone, MessageCircle,
  Car, MapPin, ExternalLink,
  FileText, Calendar, ChevronDown, ChevronUp,
  History, User, AlertTriangle, Radio,
  Key, Fuel, CircleDot, Battery
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { AppBottomNav } from '@/components/app/AppBottomNav';

// ========== TIPOS ==========
type StatusChamado = 'aberto' | 'prestador_designado' | 'prestador_a_caminho' | 'em_atendimento' | 'concluido' | 'cancelado';

interface TipoServico {
  id: string;
  nome: string;
  descricao: string;
  icone: string;
}

interface Chamado {
  id: string;
  protocolo: string;
  status: StatusChamado;
  tipoServico: TipoServico;
  veiculo: {
    modelo: string;
    placa: string;
    cor: string;
  };
  endereco: {
    logradouro: string;
    numero: string;
    bairro: string;
    cidade: string;
    estado: string;
    referencia: string;
  };
  prestador: {
    nome: string;
    empresa: string;
    telefone: string;
    veiculo: string;
    placa: string;
    avaliacao: number;
    totalAtendimentos: number;
  } | null;
  tempoEstimado: number;
  distanciaKm: number;
  criadoEm: string;
  motivoCancelamento?: string;
}

interface TimelineEvento {
  id: string;
  timestamp: string;
  titulo: string;
  descricao: string;
  tipo: 'atual' | 'acao' | 'info';
}

// ========== DADOS MOCK ==========
const chamadoMock: Chamado = {
  id: "1",
  protocolo: "AST-2024-0001",
  status: "prestador_a_caminho",
  tipoServico: {
    id: "reboque",
    nome: "Reboque",
    descricao: "Guincho para seu veículo",
    icone: "Truck"
  },
  veiculo: {
    modelo: "Gol G5 1.0",
    placa: "ABC-1234",
    cor: "Prata"
  },
  endereco: {
    logradouro: "Rua das Flores",
    numero: "123",
    bairro: "Centro",
    cidade: "Uberlândia",
    estado: "MG",
    referencia: "Próximo ao posto Shell"
  },
  prestador: {
    nome: "José da Silva",
    empresa: "Guincho Express",
    telefone: "34999998888",
    veiculo: "Guincho Branco",
    placa: "XYZ-9999",
    avaliacao: 4.8,
    totalAtendimentos: 127
  },
  tempoEstimado: 12,
  distanciaKm: 3.2,
  criadoEm: "2024-01-15T14:25:00"
};

const timelineMock: TimelineEvento[] = [
  { id: "4", timestamp: "14:35", titulo: "Prestador a caminho", descricao: "José está se deslocando. ETA: 12 min.", tipo: "atual" },
  { id: "3", timestamp: "14:30", titulo: "Prestador designado", descricao: "Guincho Express aceitou seu chamado", tipo: "acao" },
  { id: "2", timestamp: "14:26", titulo: "Buscando prestador", descricao: "Localizando guincho mais próximo", tipo: "info" },
  { id: "1", timestamp: "14:25", titulo: "Chamado aberto", descricao: "Protocolo AST-2024-0001 gerado", tipo: "info" }
];

// ========== ÍCONE DO SERVIÇO ==========
function getServicoIcon(icone: string, className?: string) {
  const props = { className: className || "h-6 w-6" };
  switch (icone) {
    case 'Truck': return <Truck {...props} />;
    case 'Key': return <Key {...props} />;
    case 'Fuel': return <Fuel {...props} />;
    case 'Circle': return <CircleDot {...props} />;
    case 'Battery': return <Battery {...props} />;
    default: return <Truck {...props} />;
  }
}

// ========== COMPONENTE: STATUS HERO ==========
function StatusHero({ chamado, tempoAtendimento }: { chamado: Chamado; tempoAtendimento: number }) {
  const formatarTempo = (segundos: number) => {
    const min = Math.floor(segundos / 60);
    const sec = segundos % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // ESTADO: ABERTO
  if (chamado.status === 'aberto') {
    return (
      <div className="mx-4 mt-4">
        <div className="rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 p-6 text-white shadow-lg">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-4">
              <div className="absolute inset-0 animate-ping rounded-full bg-white/30" />
              <div className="relative rounded-full bg-white/20 p-4">
                <Search className="h-8 w-8 animate-pulse" />
              </div>
            </div>
            
            <h2 className="text-xl font-bold">Buscando Prestador</h2>
            <p className="mt-1 text-white/90">Estamos localizando o guincho mais próximo</p>
            
            <div className="mt-4 flex items-center gap-2 text-white/90">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Tempo médio: 5-10 minutos</span>
            </div>
            
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/30">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-white" 
                   style={{ animation: 'progressIndeterminate 1.5s ease-in-out infinite' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ESTADO: PRESTADOR A CAMINHO
  if (chamado.status === 'prestador_designado' || chamado.status === 'prestador_a_caminho') {
    return (
      <div className="mx-4 mt-4">
        <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-500 p-6 text-white shadow-lg">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-4">
              <div className="absolute inset-0 animate-pulse rounded-full bg-white/20" />
              <div className="relative rounded-full bg-white/20 p-4">
                <Truck className="h-8 w-8" />
              </div>
            </div>
            
            {/* Badge Ao Vivo */}
            <Badge className="mb-3 bg-white/20 text-white border-0 gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              Ao Vivo
            </Badge>
            
            <h2 className="text-xl font-bold">Prestador a Caminho!</h2>
            
            {/* ETA em destaque */}
            <div className="mt-4 rounded-xl bg-white/20 px-6 py-3">
              <span className="text-4xl font-bold">{chamado.tempoEstimado} min</span>
              <p className="text-sm text-white/80">tempo estimado</p>
            </div>
            
            {/* Distância e velocidade */}
            <div className="mt-4 flex items-center gap-6 text-white/90">
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                <span>{chamado.distanciaKm} km</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Gauge className="h-4 w-4" />
                <span>~40 km/h</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ESTADO: EM ATENDIMENTO
  if (chamado.status === 'em_atendimento') {
    return (
      <div className="mx-4 mt-4">
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-white shadow-lg">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-4">
              <div className="relative rounded-full bg-white/20 p-4">
                <Wrench className="h-8 w-8 animate-spin" style={{ animationDuration: '3s' }} />
              </div>
            </div>
            
            <h2 className="text-xl font-bold">Em Atendimento</h2>
            <p className="mt-1 text-white/90">O prestador está trabalhando no seu veículo</p>
            
            <div className="mt-4 rounded-xl bg-white/20 px-6 py-3">
              <p className="text-sm text-white/80">Tempo de atendimento</p>
              <span className="text-3xl font-mono font-bold">{formatarTempo(tempoAtendimento)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ESTADO: CONCLUÍDO
  if (chamado.status === 'concluido') {
    return (
      <div className="mx-4 mt-4">
        <div className="rounded-2xl bg-gradient-to-br from-green-500 to-green-600 p-6 text-white shadow-lg">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-4">
              <div className="rounded-full bg-white/20 p-4">
                <CheckCircle className="h-10 w-10" />
              </div>
            </div>
            
            <h2 className="text-xl font-bold">Atendimento Concluído</h2>
            <p className="mt-1 text-white/90">Seu chamado foi finalizado com sucesso</p>
            
            <div className="mt-4 flex gap-6 text-white/90">
              <div className="text-center">
                <p className="text-sm text-white/70">Tempo total</p>
                <p className="text-lg font-semibold">47 min</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-white/70">Distância</p>
                <p className="text-lg font-semibold">12 km</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ESTADO: CANCELADO
  if (chamado.status === 'cancelado') {
    return (
      <div className="mx-4 mt-4">
        <div className="rounded-2xl bg-gradient-to-br from-gray-400 to-gray-500 p-6 text-white shadow-lg">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-4">
              <div className="rounded-full bg-white/20 p-4">
                <X className="h-8 w-8" />
              </div>
            </div>
            
            <h2 className="text-xl font-bold">Chamado Cancelado</h2>
            <p className="mt-1 text-white/90">Motivo: {chamado.motivoCancelamento || 'Problema resolvido'}</p>
            <p className="mt-2 text-sm text-white/70">Cancelado em 15/01/2024 às 14:45</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ========== COMPONENTE: CARD PRESTADOR ==========
function CardPrestador({ prestador }: { prestador: Chamado['prestador'] }) {
  if (!prestador) return null;

  const handleLigar = () => {
    window.location.href = `tel:+55${prestador.telefone}`;
  };

  const handleWhatsApp = () => {
    window.open(`https://wa.me/55${prestador.telefone}`, '_blank');
  };

  return (
    <Card className="mx-4 mt-4 overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 py-3">
        <CardTitle className="flex items-center gap-2 text-white text-sm font-medium">
          <Star className="h-4 w-4" />
          Seu Prestador
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="flex gap-4">
          {/* Avatar */}
          <div className="relative">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold text-lg">
              {prestador.nome.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white bg-green-500">
              <span className="absolute inset-0 animate-ping rounded-full bg-green-400 opacity-75" />
            </div>
          </div>
          
          {/* Info */}
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">{prestador.nome}</h3>
            <p className="text-sm text-muted-foreground">{prestador.empresa}</p>
            
            {/* Rating */}
            <div className="mt-1 flex items-center gap-1">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className={`h-3.5 w-3.5 ${i <= Math.floor(prestador.avaliacao) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                  />
                ))}
              </div>
              <span className="text-sm font-medium">{prestador.avaliacao}</span>
              <span className="text-xs text-muted-foreground">({prestador.totalAtendimentos} atendimentos)</span>
            </div>
            
            {/* Veículo */}
            <div className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Truck className="h-3.5 w-3.5" />
              <span>{prestador.veiculo} • {prestador.placa}</span>
            </div>
          </div>
        </div>
        
        {/* Botões de contato */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button variant="outline" className="gap-2" onClick={handleLigar}>
            <Phone className="h-4 w-4" />
            Ligar
          </Button>
          <Button className="gap-2 bg-green-500 hover:bg-green-600" onClick={handleWhatsApp}>
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ========== COMPONENTE: MAPA PLACEHOLDER ==========
function MapaAcompanhamento({ chamado }: { chamado: Chamado }) {
  const handleAbrirMaps = () => {
    const endereco = `${chamado.endereco.logradouro}, ${chamado.endereco.numero} - ${chamado.endereco.bairro}, ${chamado.endereco.cidade} - ${chamado.endereco.estado}`;
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`, '_blank');
  };

  return (
    <Card className="mx-4 mt-4 overflow-hidden">
      <CardContent className="p-0">
        {/* Área do mapa */}
        <div className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200">
          {/* Grid pattern */}
          <svg className="absolute inset-0 h-full w-full opacity-20">
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
          
          {/* Linha de rota animada */}
          <svg className="absolute inset-0 h-full w-full">
            <path
              d="M 80 140 Q 150 100 220 80 Q 280 60 300 50"
              fill="none"
              stroke="#3B82F6"
              strokeWidth="3"
              strokeDasharray="8 8"
              className="animate-[dash_1s_linear_infinite]"
              style={{ strokeDashoffset: 0 }}
            />
          </svg>
          
          {/* Marcador do Prestador */}
          <div className="absolute right-8 top-8 flex flex-col items-center">
            <div className="relative">
              <div className="absolute -inset-2 animate-ping rounded-full bg-blue-400/30" />
              <div className="relative rounded-full bg-blue-500 p-2 shadow-lg">
                <Truck className="h-5 w-5 text-white" />
              </div>
            </div>
            <span className="mt-1 rounded bg-white/90 px-1.5 py-0.5 text-xs font-medium shadow">Prestador</span>
          </div>
          
          {/* Marcador do Associado */}
          <div className="absolute bottom-8 left-12 flex flex-col items-center">
            <div className="rounded-full bg-red-500 p-2 shadow-lg">
              <MapPin className="h-5 w-5 text-white" />
            </div>
            <span className="mt-1 rounded bg-white/90 px-1.5 py-0.5 text-xs font-medium shadow">Você</span>
          </div>
        </div>
        
        {/* Info bar */}
        <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span className="font-medium">{chamado.distanciaKm} km</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="font-medium">~{chamado.tempoEstimado} min</span>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleAbrirMaps}>
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir Maps
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ========== COMPONENTE: DETALHES COLAPSÁVEL ==========
function DetalhesColapsavel({ chamado }: { chamado: Chamado }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mx-4 mt-4">
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Detalhes do Chamado
              </span>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground transition-transform" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
              )}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 space-y-4">
            {/* Serviço */}
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-blue-50 p-2 text-blue-500">
                {getServicoIcon(chamado.tipoServico.icone, "h-5 w-5")}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Serviço</p>
                <p className="font-medium">{chamado.tipoServico.nome}</p>
              </div>
            </div>
            
            {/* Veículo */}
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-gray-100 p-2 text-gray-600">
                <Car className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Veículo</p>
                <p className="font-medium">{chamado.veiculo.modelo} • {chamado.veiculo.placa}</p>
              </div>
            </div>
            
            {/* Local */}
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-red-50 p-2 text-red-500">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Local</p>
                <p className="font-medium">{chamado.endereco.logradouro}, {chamado.endereco.numero}</p>
                <p className="text-sm text-muted-foreground">{chamado.endereco.bairro} - {chamado.endereco.cidade}/{chamado.endereco.estado}</p>
                {chamado.endereco.referencia && (
                  <p className="text-sm text-muted-foreground">Ref: {chamado.endereco.referencia}</p>
                )}
              </div>
            </div>
            
            {/* Data/Hora */}
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-purple-50 p-2 text-purple-500">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Aberto em</p>
                <p className="font-medium">15/01/2024 às 14:25</p>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ========== COMPONENTE: TIMELINE ==========
function TimelinePremium({ eventos }: { eventos: TimelineEvento[] }) {
  return (
    <Card className="mx-4 mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4 text-muted-foreground" />
          Histórico
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="relative">
          {/* Linha vertical */}
          <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gray-200" />
          
          {/* Eventos */}
          <div className="space-y-4">
            {eventos.map((evento) => (
              <div key={evento.id} className="relative flex gap-4">
                {/* Círculo */}
                <div className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                  evento.tipo === 'atual' 
                    ? 'bg-green-500 text-white' 
                    : evento.tipo === 'acao' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  {evento.tipo === 'atual' ? (
                    <Radio className="h-3 w-3" />
                  ) : evento.tipo === 'acao' ? (
                    <User className="h-3 w-3" />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-current" />
                  )}
                </div>
                
                {/* Conteúdo */}
                <div className="flex-1 pb-2">
                  <div className="flex items-center justify-between">
                    <p className={`font-medium ${evento.tipo === 'atual' ? 'text-green-600' : ''}`}>
                      {evento.titulo}
                    </p>
                    <span className="text-xs text-muted-foreground">{evento.timestamp}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{evento.descricao}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ========== COMPONENTE: CARD AVALIAÇÃO ==========
function CardAvaliacao({ onAvaliar }: { onAvaliar: (nota: number, comentario: string) => void }) {
  const [avaliacao, setAvaliacao] = useState(0);
  const [hover, setHover] = useState(0);
  const [comentario, setComentario] = useState('');

  const handleEnviar = () => {
    onAvaliar(avaliacao, comentario);
  };

  return (
    <Card className="mx-4 mt-4 border-yellow-200 bg-yellow-50/50">
      <CardContent className="pt-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold">Como foi o atendimento?</h3>
          <p className="mt-1 text-sm text-muted-foreground">Sua avaliação ajuda a melhorar nosso serviço</p>
          
          {/* Estrelas interativas */}
          <div className="mt-4 flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                onClick={() => setAvaliacao(i)}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(0)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`h-8 w-8 ${
                    i <= (hover || avaliacao)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300'
                  }`}
                />
              </button>
            ))}
          </div>
          
          {/* Comentário */}
          {avaliacao > 0 && (
            <div className="mt-4 text-left">
              <Label htmlFor="comentario" className="text-sm">Comentário (opcional)</Label>
              <Textarea
                id="comentario"
                placeholder="Conte-nos mais sobre sua experiência..."
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                className="mt-2 bg-white"
                rows={3}
              />
              <Button 
                className="mt-3 w-full bg-yellow-500 hover:bg-yellow-600"
                onClick={handleEnviar}
              >
                Enviar Avaliação
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ========== COMPONENTE PRINCIPAL ==========
export default function AppAssistenciaDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [chamado, setChamado] = useState<Chamado>(chamadoMock);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tempoAtendimento, setTempoAtendimento] = useState(0);
  const [jaAvaliou, setJaAvaliou] = useState(false);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  
  // Debug toggle
  const [debugClicks, setDebugClicks] = useState(0);
  const [showDebug, setShowDebug] = useState(false);

  // Timer para status "em_atendimento"
  useEffect(() => {
    if (chamado.status === 'em_atendimento') {
      const interval = setInterval(() => {
        setTempoAtendimento(prev => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [chamado.status]);

  const handleCopyProtocolo = () => {
    navigator.clipboard.writeText(chamado.protocolo);
    toast.success('Protocolo copiado!');
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success('Dados atualizados');
    }, 1500);
  };

  const handleProtocoloClick = () => {
    const newClicks = debugClicks + 1;
    setDebugClicks(newClicks);
    if (newClicks >= 5) {
      setShowDebug(true);
      setDebugClicks(0);
      toast.info('Modo debug ativado');
    }
  };

  const handleCancelar = () => {
    setChamado(prev => ({ 
      ...prev, 
      status: 'cancelado',
      motivoCancelamento: motivoCancelamento || 'Problema resolvido'
    }));
    setCancelDialogOpen(false);
    toast.success('Chamado cancelado');
  };

  const handleAvaliar = (nota: number, comentario: string) => {
    setJaAvaliou(true);
    toast.success('Avaliação enviada! Obrigado pelo feedback.');
  };

  const debugMudarStatus = (novoStatus: StatusChamado) => {
    setChamado(prev => ({ ...prev, status: novoStatus }));
    if (novoStatus === 'aberto') {
      setChamado(prev => ({ ...prev, prestador: null }));
    } else if (!chamado.prestador) {
      setChamado(prev => ({ ...prev, prestador: chamadoMock.prestador }));
    }
  };

  const showPrestador = chamado.status !== 'aberto' && chamado.prestador;
  const showMapa = ['prestador_designado', 'prestador_a_caminho'].includes(chamado.status);
  const showAvaliacao = chamado.status === 'concluido' && !jaAvaliou;
  const showCancelar = !['concluido', 'cancelado'].includes(chamado.status);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header Sticky */}
      <header className="sticky top-0 z-50 flex items-center justify-between bg-white/80 backdrop-blur-md border-b px-4 py-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        <button 
          onClick={handleProtocoloClick}
          className="flex items-center gap-2"
        >
          <span className="font-mono text-sm font-medium">{chamado.protocolo}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleCopyProtocolo(); }}>
            <Copy className="h-4 w-4" />
          </Button>
        </button>
        
        <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </header>

      {/* Debug Panel */}
      {showDebug && (
        <div className="mx-4 mt-2 rounded-lg bg-gray-900 p-3 text-white">
          <p className="text-xs font-medium mb-2">Debug: Mudar Status</p>
          <div className="flex flex-wrap gap-1">
            {(['aberto', 'prestador_designado', 'prestador_a_caminho', 'em_atendimento', 'concluido', 'cancelado'] as StatusChamado[]).map(status => (
              <Button
                key={status}
                size="sm"
                variant={chamado.status === status ? 'default' : 'secondary'}
                className="text-xs h-7"
                onClick={() => debugMudarStatus(status)}
              >
                {status}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Status Hero */}
      <StatusHero chamado={chamado} tempoAtendimento={tempoAtendimento} />

      {/* Card Prestador */}
      {showPrestador && <CardPrestador prestador={chamado.prestador} />}

      {/* Mapa de Acompanhamento */}
      {showMapa && <MapaAcompanhamento chamado={chamado} />}

      {/* Detalhes Colapsável */}
      <DetalhesColapsavel chamado={chamado} />

      {/* Timeline */}
      <TimelinePremium eventos={timelineMock} />

      {/* Card Avaliação */}
      {showAvaliacao && <CardAvaliacao onAvaliar={handleAvaliar} />}

      {/* Botão Cancelar */}
      {showCancelar && (
        <div className="mx-4 mt-6">
          <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancelar Chamado
              </Button>
            </DialogTrigger>
            
            <DialogContent className="mx-4 rounded-2xl max-w-[calc(100vw-2rem)]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Cancelar Chamado
                </DialogTitle>
              </DialogHeader>
              
              <div className="py-4">
                <p className="text-muted-foreground text-sm mb-4">
                  Tem certeza que deseja cancelar? Se o prestador já estiver a caminho, 
                  pode haver cobrança de taxa.
                </p>
                
                <Label className="text-sm font-medium">Motivo do cancelamento</Label>
                <Select value={motivoCancelamento} onValueChange={setMotivoCancelamento}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Selecione um motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resolvido">Problema resolvido</SelectItem>
                    <SelectItem value="demora">Demora excessiva</SelectItem>
                    <SelectItem value="outra_solucao">Encontrei outra solução</SelectItem>
                    <SelectItem value="engano">Solicitei por engano</SelectItem>
                    <SelectItem value="outro">Outro motivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <DialogFooter className="flex gap-2 sm:gap-2">
                <DialogClose asChild>
                  <Button variant="outline" className="flex-1">Voltar</Button>
                </DialogClose>
                <Button 
                  variant="destructive" 
                  className="flex-1"
                  onClick={handleCancelar}
                  disabled={!motivoCancelamento}
                >
                  Confirmar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Bottom Nav */}
      <AppBottomNav />
      
      {/* CSS para animação da rota */}
      <style>{`
        @keyframes dash {
          to { stroke-dashoffset: -16; }
        }
        .animate-\\[dash_1s_linear_infinite\\] {
          animation: dash 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
