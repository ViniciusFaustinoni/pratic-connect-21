import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Copy,
  Share2,
  FileText,
  Search,
  AlertCircle,
  CheckCircle,
  XCircle,
  BadgeCheck,
  Car,
  MapPin,
  Calendar,
  MessageSquare,
  Upload,
  FileWarning,
  ChevronDown,
  ChevronUp,
  User,
  Phone,
  Mail,
  Star,
  History,
  Flame,
  Clock,
  DollarSign,
  Building,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

// Types
type StatusSinistro = 'comunicado' | 'em_analise' | 'documentacao_pendente' | 'aprovado' | 'negado' | 'pago' | 'encerrado';

interface Sinistro {
  id: string;
  protocolo: string;
  status: StatusSinistro;
  tipo: string;
  tipoNome: string;
  veiculo: {
    modelo: string;
    placa: string;
  };
  dataOcorrencia: string;
  localOcorrencia: string;
  descricao: string;
  fotos: string[];
  analista: {
    nome: string;
    telefone: string;
    email: string;
  };
  valores: {
    fipe: number;
    participacao: number;
    aReceber: number;
  };
  motivoNegacao?: string;
  dataCriacao: string;
  dataAtualizacao: string;
  dataPagamento?: string;
}

interface DocumentoPendente {
  id: string;
  nome: string;
  descricao: string;
}

interface TimelineEvento {
  id: string;
  data: string;
  titulo: string;
  descricao: string;
  atual: boolean;
}

// Mock data
const sinistroMock: Sinistro = {
  id: "1",
  protocolo: "SIN-2024-0001",
  status: "em_analise",
  tipo: "colisao",
  tipoNome: "Colisão",
  veiculo: {
    modelo: "Gol G5 1.0",
    placa: "ABC-1234"
  },
  dataOcorrencia: "2024-01-15T14:30:00",
  localOcorrencia: "Av. Brasil, 1000 - Centro, Uberlândia/MG",
  descricao: "Colisão traseira no semáforo da Av. Brasil com Rua das Flores. O veículo de trás não freou a tempo e colidiu na traseira do meu veículo, causando danos no para-choque traseiro, lanterna e tampa do porta-malas.",
  fotos: ["/foto1.jpg", "/foto2.jpg", "/foto3.jpg", "/foto4.jpg"],
  analista: {
    nome: "Maria Silva",
    telefone: "3432221111",
    email: "sinistros@pratic.com.br"
  },
  valores: {
    fipe: 45000,
    participacao: 4500,
    aReceber: 40500
  },
  motivoNegacao: "Evento não coberto pelo plano contratado. O sinistro ocorreu durante uso comercial do veículo, o que não está previsto na apólice.",
  dataCriacao: "2024-01-15T14:35:00",
  dataAtualizacao: "2024-01-16T09:00:00",
  dataPagamento: "2024-01-25T10:00:00"
};

const documentosPendentesMock: DocumentoPendente[] = [
  { id: "1", nome: "Boletim de Ocorrência", descricao: "B.O. registrado na delegacia" },
  { id: "2", nome: "CNH do condutor", descricao: "Documento do motorista no momento" }
];

const timelineMock: TimelineEvento[] = [
  {
    id: "2",
    data: "2024-01-16T09:00:00",
    titulo: "Em análise",
    descricao: "Sinistro encaminhado para análise da equipe técnica.",
    atual: true
  },
  {
    id: "1",
    data: "2024-01-15T14:35:00",
    titulo: "Sinistro comunicado",
    descricao: "Protocolo SIN-2024-0001 gerado com sucesso.",
    atual: false
  }
];

const statusConfig: Record<StatusSinistro, { 
  bg: string; 
  bgLight: string;
  border: string;
  icon: typeof FileText; 
  titulo: string;
  subtitulo: string;
  iconBg: string;
}> = {
  comunicado: { 
    bg: "from-amber-400 to-amber-500", 
    bgLight: "from-amber-50 to-amber-100",
    border: "border-amber-200",
    icon: FileText, 
    titulo: "Sinistro Comunicado",
    subtitulo: "Aguardando início da análise",
    iconBg: "bg-amber-100"
  },
  em_analise: { 
    bg: "from-blue-500 to-blue-600", 
    bgLight: "from-blue-50 to-blue-100",
    border: "border-blue-200",
    icon: Search, 
    titulo: "Em Análise",
    subtitulo: "Nossa equipe está avaliando seu caso",
    iconBg: "bg-blue-100"
  },
  documentacao_pendente: { 
    bg: "from-orange-400 to-orange-500", 
    bgLight: "from-orange-50 to-orange-100",
    border: "border-orange-300",
    icon: AlertCircle, 
    titulo: "Documentação Pendente",
    subtitulo: "Precisamos de documentos adicionais",
    iconBg: "bg-orange-100"
  },
  aprovado: { 
    bg: "from-green-500 to-emerald-600", 
    bgLight: "from-green-50 to-emerald-100",
    border: "border-green-300",
    icon: CheckCircle, 
    titulo: "Sinistro Aprovado!",
    subtitulo: "Seu sinistro foi aprovado para indenização",
    iconBg: "bg-green-100"
  },
  negado: { 
    bg: "from-red-500 to-red-600", 
    bgLight: "from-red-50 to-red-100",
    border: "border-red-200",
    icon: XCircle, 
    titulo: "Sinistro Negado",
    subtitulo: "Infelizmente não foi possível aprovar",
    iconBg: "bg-red-100"
  },
  pago: { 
    bg: "from-emerald-500 to-emerald-600", 
    bgLight: "from-emerald-50 to-emerald-100",
    border: "border-emerald-200",
    icon: DollarSign, 
    titulo: "Pagamento Realizado",
    subtitulo: "Indenização creditada com sucesso",
    iconBg: "bg-emerald-100"
  },
  encerrado: { 
    bg: "from-gray-500 to-gray-600", 
    bgLight: "from-gray-50 to-gray-100",
    border: "border-gray-200",
    icon: BadgeCheck, 
    titulo: "Sinistro Encerrado",
    subtitulo: "Processo finalizado com sucesso",
    iconBg: "bg-gray-100"
  }
};

const tipoIcons: Record<string, typeof Car> = {
  colisao: Car,
  roubo: AlertCircle,
  furto: AlertCircle,
  incendio: Flame,
  fenomeno_natural: AlertCircle,
  outro: AlertCircle
};

export default function AppSinistroDetalhe() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  
  const [sinistro, setSinistro] = useState<Sinistro>(sinistroMock);
  const [documentosPendentes] = useState<DocumentoPendente[]>(documentosPendentesMock);
  const [timeline] = useState<TimelineEvento[]>(timelineMock);
  const [detalhesAberto, setDetalhesAberto] = useState(false);
  const [avaliacao, setAvaliacao] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviandoAvaliacao, setEnviandoAvaliacao] = useState(false);
  
  // Debug mode
  const [debugClicks, setDebugClicks] = useState(0);
  const [showDebug, setShowDebug] = useState(false);

  const config = statusConfig[sinistro.status];
  const StatusIcon = config.icon;
  const TipoIcon = tipoIcons[sinistro.tipo] || AlertCircle;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleCopyProtocolo = () => {
    navigator.clipboard.writeText(sinistro.protocolo);
    toast.success("Protocolo copiado!");
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Sinistro ${sinistro.protocolo}`,
          text: `Acompanhe meu sinistro: ${sinistro.protocolo}`,
          url: window.location.href,
        });
      } catch (err) {
        handleCopyProtocolo();
      }
    } else {
      handleCopyProtocolo();
    }
  };

  const handleUploadDocumento = (docId: string) => {
    toast.success("Documento enviado com sucesso!", {
      description: "Será analisado em breve."
    });
  };

  const handleEnviarAvaliacao = async () => {
    setEnviandoAvaliacao(true);
    await new Promise(r => setTimeout(r, 1500));
    setEnviandoAvaliacao(false);
    toast.success("Avaliação enviada!", {
      description: "Obrigado pelo seu feedback."
    });
    setAvaliacao(0);
    setComentario("");
  };

  const handleDebugClick = () => {
    const newClicks = debugClicks + 1;
    setDebugClicks(newClicks);
    if (newClicks >= 5) {
      setShowDebug(true);
      setDebugClicks(0);
    }
  };

  const handleStatusChange = (newStatus: StatusSinistro) => {
    setSinistro(prev => ({ ...prev, status: newStatus }));
    setShowDebug(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="text-center" onClick={handleDebugClick}>
            <p className="font-semibold text-gray-900">Sinistro</p>
            <p className="text-xs text-gray-500">{sinistro.protocolo}</p>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={handleCopyProtocolo}>
              <Copy className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleShare}>
              <Share2 className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Debug Selector */}
      {showDebug && (
        <div className="p-4 bg-gray-800">
          <Label className="text-white text-xs">Debug: Alterar Status</Label>
          <Select value={sinistro.status} onValueChange={(v) => handleStatusChange(v as StatusSinistro)}>
            <SelectTrigger className="mt-1 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="comunicado">Comunicado</SelectItem>
              <SelectItem value="em_analise">Em Análise</SelectItem>
              <SelectItem value="documentacao_pendente">Doc. Pendente</SelectItem>
              <SelectItem value="aprovado">Aprovado</SelectItem>
              <SelectItem value="negado">Negado</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="encerrado">Encerrado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Status Hero */}
        <Card className={`border-0 overflow-hidden shadow-lg bg-gradient-to-br ${config.bgLight} ${config.border}`}>
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              <div className={`w-16 h-16 rounded-full ${config.iconBg} flex items-center justify-center mb-4`}>
                <StatusIcon className={`h-8 w-8 ${
                  sinistro.status === 'comunicado' ? 'text-amber-600' :
                  sinistro.status === 'em_analise' ? 'text-blue-600 animate-pulse' :
                  sinistro.status === 'documentacao_pendente' ? 'text-orange-600' :
                  sinistro.status === 'aprovado' ? 'text-green-600' :
                  sinistro.status === 'negado' ? 'text-red-600' :
                  sinistro.status === 'pago' ? 'text-emerald-600' :
                  'text-gray-600'
                }`} />
              </div>
              
              <h2 className="text-xl font-bold text-gray-900">{config.titulo}</h2>
              <p className="text-gray-600 mt-1">{config.subtitulo}</p>
              
              {/* Status-specific content */}
              {sinistro.status === 'comunicado' && (
                <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
                  <Clock className="h-4 w-4" />
                  Recebido em {formatDate(sinistro.dataCriacao)}
                </div>
              )}
              
              {sinistro.status === 'em_analise' && (
                <div className="flex items-center gap-2 mt-3 text-sm text-blue-700">
                  <User className="h-4 w-4" />
                  Analista: {sinistro.analista.nome}
                </div>
              )}
              
              {sinistro.status === 'documentacao_pendente' && (
                <Button 
                  variant="outline" 
                  className="mt-4 border-orange-300 text-orange-700 hover:bg-orange-50"
                  onClick={() => document.getElementById('docs-section')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  Ver documentos pendentes
                </Button>
              )}
              
              {sinistro.status === 'aprovado' && (
                <div className="w-full mt-4 bg-white/80 rounded-lg p-4 border border-green-200">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Valor FIPE</span>
                      <span className="font-medium">{formatCurrency(sinistro.valores.fipe)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Participação</span>
                      <span className="font-medium text-red-600">- {formatCurrency(sinistro.valores.participacao)}</span>
                    </div>
                    <div className="border-t border-green-200 pt-2 mt-2">
                      <div className="flex justify-between">
                        <span className="font-semibold text-green-800">Valor a Receber</span>
                        <span className="font-bold text-green-700 text-lg">{formatCurrency(sinistro.valores.aReceber)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {sinistro.status === 'negado' && (
                <>
                  <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200 text-left">
                    <p className="text-sm text-red-800">
                      <strong>Motivo:</strong> {sinistro.motivoNegacao}
                    </p>
                  </div>
                  <Button variant="outline" className="mt-4 border-red-300 text-red-700 hover:bg-red-50">
                    Solicitar Revisão
                  </Button>
                </>
              )}
              
              {(sinistro.status === 'pago' || sinistro.status === 'encerrado') && (
                <div className="flex items-center gap-2 mt-3 text-sm text-gray-600">
                  <BadgeCheck className="h-4 w-4" />
                  {sinistro.status === 'pago' 
                    ? `Pago em ${formatDate(sinistro.dataPagamento || '')} • ${formatCurrency(sinistro.valores.aReceber)}`
                    : `Encerrado em ${formatDate(sinistro.dataAtualizacao)}`
                  }
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Documentos Pendentes */}
        {sinistro.status === 'documentacao_pendente' && documentosPendentes.length > 0 && (
          <Card id="docs-section" className="border-0 shadow-md border-l-4 border-l-orange-400">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileWarning className="h-5 w-5 text-orange-500" />
                Documentos Pendentes ({documentosPendentes.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {documentosPendentes.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 text-orange-500" />
                      <div>
                        <p className="font-medium text-gray-900">{doc.nome}</p>
                        <p className="text-xs text-gray-500">{doc.descricao}</p>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="gap-1 border-orange-300 text-orange-700 hover:bg-orange-100"
                      onClick={() => handleUploadDocumento(doc.id)}
                    >
                      <Upload className="h-4 w-4" />
                      Enviar
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Detalhes do Sinistro */}
        <Collapsible open={detalhesAberto} onOpenChange={setDetalhesAberto}>
          <Card className="border-0 shadow-md">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Detalhes do Sinistro
                  </div>
                  {detalhesAberto ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                {/* Tipo */}
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <TipoIcon className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Tipo</p>
                    <p className="font-medium text-gray-900">{sinistro.tipoNome}</p>
                  </div>
                </div>
                
                {/* Veículo */}
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Car className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Veículo</p>
                    <p className="font-medium text-gray-900">{sinistro.veiculo.modelo} • {sinistro.veiculo.placa}</p>
                  </div>
                </div>
                
                {/* Data e Local */}
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <MapPin className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Data e Local</p>
                    <p className="font-medium text-gray-900">{formatDateTime(sinistro.dataOcorrencia)}</p>
                    <p className="text-sm text-gray-600">{sinistro.localOcorrencia}</p>
                  </div>
                </div>
                
                {/* Descrição */}
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <FileText className="h-5 w-5 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500">Descrição</p>
                    <p className="text-sm text-gray-700 mt-1">{sinistro.descricao}</p>
                  </div>
                </div>
                
                {/* Fotos */}
                {sinistro.fotos.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Fotos anexadas ({sinistro.fotos.length})</p>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {sinistro.fotos.map((foto, i) => (
                        <div key={i} className="w-16 h-16 rounded-lg bg-gray-200 flex-shrink-0 flex items-center justify-center">
                          <FileText className="h-6 w-6 text-gray-400" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Timeline */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-5 w-5 text-primary" />
              Histórico
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {/* Linha vertical */}
              <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-200" />
              
              <div className="space-y-4">
                {timeline.map((evento, index) => (
                  <div key={evento.id} className="flex gap-4 relative">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10 ${
                      evento.atual 
                        ? 'bg-primary ring-4 ring-primary/20' 
                        : 'bg-gray-200'
                    }`}>
                      {evento.atual ? (
                        <div className="w-2 h-2 bg-white rounded-full" />
                      ) : (
                        <div className="w-2 h-2 bg-gray-400 rounded-full" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center justify-between">
                        <p className={`font-medium ${evento.atual ? 'text-primary' : 'text-gray-600'}`}>
                          {evento.titulo}
                        </p>
                        <span className="text-xs text-gray-400">{formatDateTime(evento.data)}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{evento.descricao}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Analista Responsável */}
        {sinistro.status !== 'comunicado' && (
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="font-bold text-primary">
                    {sinistro.analista.nome.split(' ').map(n => n[0]).join('').substring(0, 2)}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500">Analista responsável</p>
                  <p className="font-semibold text-gray-900">{sinistro.analista.nome}</p>
                  <p className="text-sm text-gray-500">Equipe de Sinistros</p>
                </div>
              </div>
              
              <div className="flex gap-3 mt-4">
                <Button 
                  variant="outline" 
                  className="flex-1 gap-2"
                  asChild
                >
                  <a href={`tel:${sinistro.analista.telefone}`}>
                    <Phone className="h-4 w-4" />
                    Ligar
                  </a>
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1 gap-2"
                  asChild
                >
                  <a href={`mailto:${sinistro.analista.email}`}>
                    <Mail className="h-4 w-4" />
                    E-mail
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Avaliação (quando encerrado) */}
        {(sinistro.status === 'encerrado' || sinistro.status === 'pago') && (
          <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="font-medium text-gray-900 mb-3">Como foi sua experiência?</p>
                
                <div className="flex justify-center gap-2 mb-4">
                  {[1, 2, 3, 4, 5].map(i => (
                    <button 
                      key={i} 
                      onClick={() => setAvaliacao(i)}
                      className="p-1 transition-transform hover:scale-110"
                    >
                      <Star 
                        className={`h-8 w-8 ${
                          i <= avaliacao 
                            ? 'fill-amber-400 text-amber-400' 
                            : 'text-gray-300'
                        }`} 
                      />
                    </button>
                  ))}
                </div>
                
                {avaliacao > 0 && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                    <div>
                      <Label htmlFor="comentario" className="text-sm text-gray-600">
                        Comentário opcional
                      </Label>
                      <Textarea
                        id="comentario"
                        value={comentario}
                        onChange={(e) => setComentario(e.target.value)}
                        placeholder="Conte-nos mais sobre sua experiência..."
                        className="mt-1 bg-white resize-none"
                        rows={3}
                      />
                    </div>
                    <Button 
                      className="w-full"
                      onClick={handleEnviarAvaliacao}
                      disabled={enviandoAvaliacao}
                    >
                      {enviandoAvaliacao ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        'Enviar Avaliação'
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ação Principal Contextual */}
        {sinistro.status === 'aprovado' && (
          <Button className="w-full h-14 gap-2 bg-green-600 hover:bg-green-700 text-lg">
            <Building className="h-5 w-5" />
            Informar Dados Bancários
          </Button>
        )}
      </div>
    </div>
  );
}
