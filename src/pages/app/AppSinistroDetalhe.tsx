import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
import { useSinistro } from '@/hooks/useSinistros';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Types
type StatusSinistro = 'comunicado' | 'em_analise' | 'documentacao_pendente' | 'aprovado' | 'negado' | 'pago' | 'encerrado';

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
  roubo_furto: AlertCircle,
  roubo: AlertCircle,
  furto: AlertCircle,
  incendio: Flame,
  fenomeno_natural: AlertCircle,
  fenomenos_naturais: AlertCircle,
  terceiros: User,
  outro: AlertCircle
};

const tipoLabels: Record<string, string> = {
  colisao: 'Colisão',
  roubo_furto: 'Roubo/Furto',
  roubo: 'Roubo',
  furto: 'Furto',
  incendio: 'Incêndio',
  fenomeno_natural: 'Fenômenos Naturais',
  fenomenos_naturais: 'Fenômenos Naturais',
  terceiros: 'Terceiros',
  outro: 'Outro'
};

export default function AppSinistroDetalhe() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  
  // Buscar sinistro REAL do banco de dados
  const { data: sinistro, isLoading, error } = useSinistro(id);
  
  // Buscar documentos pendentes
  const { data: documentosPendentes = [] } = useQuery({
    queryKey: ['sinistro-documentos', id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('sinistro_documentos')
        .select('*')
        .eq('sinistro_id', id)
        .eq('status', 'pendente');
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });
  
  // Buscar histórico
  const { data: timeline = [] } = useQuery({
    queryKey: ['sinistro-historico', id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('sinistro_historico')
        .select('*')
        .eq('sinistro_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const [detalhesAberto, setDetalhesAberto] = useState(false);
  const [avaliacao, setAvaliacao] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviandoAvaliacao, setEnviandoAvaliacao] = useState(false);

  // Mapear status do banco para UI
  const getStatus = (): StatusSinistro => {
    if (!sinistro) return 'comunicado';
    const statusMap: Record<string, StatusSinistro> = {
      'comunicado': 'comunicado',
      'em_analise': 'em_analise',
      'documentacao_pendente': 'documentacao_pendente',
      'aprovado': 'aprovado',
      'negado': 'negado',
      'pago': 'pago',
      'indenizado': 'pago',
      'encerrado': 'encerrado',
    };
    return statusMap[sinistro.status as string] || 'comunicado';
  };

  const status = getStatus();
  const config = statusConfig[status];
  const StatusIcon = config.icon;
  const TipoIcon = tipoIcons[sinistro?.tipo as string] || AlertCircle;

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return 'R$ 0,00';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleCopyProtocolo = () => {
    if (!sinistro?.protocolo) return;
    navigator.clipboard.writeText(sinistro.protocolo);
    toast.success("Protocolo copiado!");
  };

  const handleShare = async () => {
    if (!sinistro?.protocolo) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Sinistro ${sinistro.protocolo}`,
          text: `Acompanhe meu sinistro: ${sinistro.protocolo}`,
          url: window.location.href,
        });
      } catch {
        handleCopyProtocolo();
      }
    } else {
      handleCopyProtocolo();
    }
  };

  const handleUploadDocumento = (docId: string) => {
    // TODO: Implementar upload real
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

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
          <div className="flex items-center justify-between px-4 py-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="text-center">
              <Skeleton className="h-5 w-24 mx-auto" />
              <Skeleton className="h-3 w-32 mx-auto mt-1" />
            </div>
            <div className="w-10" />
          </div>
        </header>
        <div className="p-4 space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // Error or not found state
  if (error || !sinistro) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Sinistro não encontrado</h2>
        <p className="text-gray-500 text-center mb-6">
          Não foi possível carregar os detalhes deste sinistro.
        </p>
        <Button onClick={() => navigate('/app/sinistros')}>
          Voltar para Sinistros
        </Button>
      </div>
    );
  }

  // Dados derivados
  const veiculo = sinistro.veiculo;
  const tipoNome = tipoLabels[sinistro.tipo as string] || 'Sinistro';

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
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

      <div className="p-4 space-y-4">
        {/* Status Hero */}
        <Card className={`border-0 overflow-hidden shadow-lg bg-gradient-to-br ${config.bgLight} ${config.border}`}>
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              <div className={`w-16 h-16 rounded-full ${config.iconBg} flex items-center justify-center mb-4`}>
                <StatusIcon className={`h-8 w-8 ${
                  status === 'comunicado' ? 'text-amber-600' :
                  status === 'em_analise' ? 'text-blue-600 animate-pulse' :
                  status === 'documentacao_pendente' ? 'text-orange-600' :
                  status === 'aprovado' ? 'text-green-600' :
                  status === 'negado' ? 'text-red-600' :
                  status === 'pago' ? 'text-emerald-600' :
                  'text-gray-600'
                }`} />
              </div>
              
              <h2 className="text-xl font-bold text-gray-900">{config.titulo}</h2>
              <p className="text-gray-600 mt-1">{config.subtitulo}</p>
              
              {/* Status-specific content */}
              {status === 'comunicado' && (
                <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
                  <Clock className="h-4 w-4" />
                  Recebido em {formatDate(sinistro.created_at)}
                </div>
              )}
              
              {status === 'em_analise' && sinistro.analista_id && (
                <div className="flex items-center gap-2 mt-3 text-sm text-blue-700">
                  <User className="h-4 w-4" />
                  Em análise pela equipe
                </div>
              )}
              
              {status === 'documentacao_pendente' && (
                <Button 
                  variant="outline" 
                  className="mt-4 border-orange-300 text-orange-700 hover:bg-orange-50"
                  onClick={() => document.getElementById('docs-section')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  Ver documentos pendentes
                </Button>
              )}
              
              {status === 'aprovado' && (
                <div className="w-full mt-4 bg-white/80 rounded-lg p-4 border border-green-200">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Valor Aprovado</span>
                      <span className="font-medium">{formatCurrency(sinistro.valor_indenizacao)}</span>
                    </div>
                    <div className="border-t border-green-200 pt-2 mt-2">
                      <div className="flex justify-between">
                        <span className="font-semibold text-green-800">Valor a Receber</span>
                        <span className="font-bold text-green-700 text-lg">{formatCurrency(sinistro.valor_indenizacao)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {status === 'negado' && sinistro.parecer && (
                <>
                  <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200 text-left">
                    <p className="text-sm text-red-800">
                      <strong>Motivo:</strong> {sinistro.parecer}
                    </p>
                  </div>
                  <Button variant="outline" className="mt-4 border-red-300 text-red-700 hover:bg-red-50">
                    Solicitar Revisão
                  </Button>
                </>
              )}
              
              {(status === 'pago' || status === 'encerrado') && (
                <div className="flex items-center gap-2 mt-3 text-sm text-gray-600">
                  <BadgeCheck className="h-4 w-4" />
                  {status === 'pago' 
                    ? `Pago em ${formatDate(sinistro.data_parecer)} • ${formatCurrency(sinistro.valor_indenizacao)}`
                    : `Encerrado em ${formatDate(sinistro.updated_at)}`
                  }
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Documentos Pendentes */}
        {status === 'documentacao_pendente' && documentosPendentes.length > 0 && (
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
                        <p className="font-medium text-gray-900">{doc.tipo}</p>
                        <p className="text-xs text-gray-500">Documento obrigatório</p>
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
                    <p className="font-medium text-gray-900">{tipoNome}</p>
                  </div>
                </div>
                
                {/* Veículo */}
                {veiculo && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Car className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Veículo</p>
                      <p className="font-medium text-gray-900">
                        {veiculo.marca} {veiculo.modelo} • {veiculo.placa}
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Data e Local */}
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <MapPin className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Data e Local</p>
                    <p className="font-medium text-gray-900">{formatDateTime(sinistro.data_ocorrencia)}</p>
                    {sinistro.cidade_ocorrencia && (
                      <p className="text-sm text-gray-600">
                        {sinistro.cidade_ocorrencia}
                        {sinistro.estado_ocorrencia && `/${sinistro.estado_ocorrencia}`}
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Descrição */}
                {sinistro.descricao && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <FileText className="h-5 w-5 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500">Descrição</p>
                      <p className="text-sm text-gray-700 mt-1">{sinistro.descricao}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Timeline / Histórico */}
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
                {timeline.length === 0 ? (
                  <div className="flex gap-4 relative">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center z-10 bg-primary ring-4 ring-primary/20">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-primary">Sinistro Comunicado</p>
                        <span className="text-xs text-gray-400">{formatDateTime(sinistro.created_at)}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        Protocolo {sinistro.protocolo} gerado com sucesso.
                      </p>
                    </div>
                  </div>
                ) : (
                  timeline.map((evento, index) => (
                    <div key={evento.id} className="flex gap-4 relative">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10 ${
                        index === 0 
                          ? 'bg-primary ring-4 ring-primary/20' 
                          : 'bg-gray-200'
                      }`}>
                        {index === 0 ? (
                          <div className="w-2 h-2 bg-white rounded-full" />
                        ) : (
                          <div className="w-2 h-2 bg-gray-400 rounded-full" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center justify-between">
                          <p className={`font-medium ${index === 0 ? 'text-primary' : 'text-gray-600'}`}>
                            {evento.status_novo ? 
                              (statusConfig[evento.status_novo as StatusSinistro]?.titulo || evento.status_novo) : 
                              'Atualização'}
                          </p>
                          <span className="text-xs text-gray-400">{formatDateTime(evento.created_at)}</span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {evento.observacao || `Status alterado para ${evento.status_novo}`}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contato */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="font-bold text-primary">PR</span>
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500">Equipe de Sinistros</p>
                <p className="font-semibold text-gray-900">PRATIC Proteção Veicular</p>
                <p className="text-sm text-gray-500">Setor de Análise</p>
              </div>
            </div>
            
            <div className="flex gap-3 mt-4">
              <Button 
                variant="outline" 
                className="flex-1 gap-2"
                asChild
              >
                <a href="tel:3432221111">
                  <Phone className="h-4 w-4" />
                  Ligar
                </a>
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 gap-2"
                asChild
              >
                <a href="mailto:sinistros@pratic.com.br">
                  <Mail className="h-4 w-4" />
                  E-mail
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Avaliação (quando encerrado) */}
        {(status === 'encerrado' || status === 'pago') && (
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
        {status === 'aprovado' && (
          <Button className="w-full h-14 gap-2 bg-green-600 hover:bg-green-700 text-lg">
            <Building className="h-5 w-5" />
            Informar Dados Bancários
          </Button>
        )}
      </div>
    </div>
  );
}
