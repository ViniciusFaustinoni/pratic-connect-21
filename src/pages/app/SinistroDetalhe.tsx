import { useState, useRef, useEffect } from 'react';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Plus,
  Send,
  Eye,
  Wrench,
  CloudRain,
  ShieldAlert,
  HelpCircle,
  Image,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useSinistro } from '@/hooks/useSinistros';
import { 
  useSinistroHistorico, 
  useSinistroDocumentos, 
  useSinistroFotos, 
  useSinistroMensagens,
  useEnviarMensagemSinistro,
  useUploadFotoSinistro,
  useUploadDocumentoSinistro,
} from '@/hooks/useSinistroDetalhes';
import { TIPO_SINISTRO_LABELS, STATUS_SINISTRO_LABELS } from '@/types/sinistros';

// Status configuration
type StatusSinistro = 'comunicado' | 'em_analise' | 'documentacao_pendente' | 'aprovado' | 'negado' | 'em_regulacao' | 'em_reparo' | 'aguardando_pagamento' | 'pago' | 'encerrado' | 'cancelado';

const statusConfig: Record<StatusSinistro, { 
  bg: string; 
  bgLight: string;
  border: string;
  icon: typeof FileText; 
  titulo: string;
  subtitulo: string;
  iconBg: string;
  iconColor: string;
}> = {
  comunicado: { 
    bg: "from-amber-400 to-amber-500", 
    bgLight: "from-amber-50 to-amber-100",
    border: "border-amber-200",
    icon: FileText, 
    titulo: "Sinistro Comunicado",
    subtitulo: "Aguardando início da análise",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600"
  },
  em_analise: { 
    bg: "from-blue-500 to-blue-600", 
    bgLight: "from-blue-50 to-blue-100",
    border: "border-blue-200",
    icon: Search, 
    titulo: "Em Análise",
    subtitulo: "Nossa equipe está avaliando seu caso",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600"
  },
  documentacao_pendente: { 
    bg: "from-orange-400 to-orange-500", 
    bgLight: "from-orange-50 to-orange-100",
    border: "border-orange-300",
    icon: AlertCircle, 
    titulo: "Documentação Pendente",
    subtitulo: "Precisamos de documentos adicionais",
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600"
  },
  aprovado: { 
    bg: "from-green-500 to-emerald-600", 
    bgLight: "from-green-50 to-emerald-100",
    border: "border-green-300",
    icon: CheckCircle, 
    titulo: "Sinistro Aprovado!",
    subtitulo: "Seu sinistro foi aprovado para indenização",
    iconBg: "bg-green-100",
    iconColor: "text-green-600"
  },
  negado: { 
    bg: "from-red-500 to-red-600", 
    bgLight: "from-red-50 to-red-100",
    border: "border-red-200",
    icon: XCircle, 
    titulo: "Sinistro Negado",
    subtitulo: "Infelizmente não foi possível aprovar",
    iconBg: "bg-red-100",
    iconColor: "text-red-600"
  },
  em_regulacao: { 
    bg: "from-purple-500 to-purple-600", 
    bgLight: "from-purple-50 to-purple-100",
    border: "border-purple-200",
    icon: Eye, 
    titulo: "Em Regulação",
    subtitulo: "Vistoria e avaliação em andamento",
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600"
  },
  em_reparo: { 
    bg: "from-indigo-500 to-indigo-600", 
    bgLight: "from-indigo-50 to-indigo-100",
    border: "border-indigo-200",
    icon: Wrench, 
    titulo: "Em Reparo",
    subtitulo: "Veículo está sendo reparado",
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-600"
  },
  aguardando_pagamento: { 
    bg: "from-cyan-500 to-cyan-600", 
    bgLight: "from-cyan-50 to-cyan-100",
    border: "border-cyan-200",
    icon: DollarSign, 
    titulo: "Aguardando Pagamento",
    subtitulo: "Processando indenização",
    iconBg: "bg-cyan-100",
    iconColor: "text-cyan-600"
  },
  pago: { 
    bg: "from-emerald-500 to-emerald-600", 
    bgLight: "from-emerald-50 to-emerald-100",
    border: "border-emerald-200",
    icon: DollarSign, 
    titulo: "Pagamento Realizado",
    subtitulo: "Indenização creditada com sucesso",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600"
  },
  encerrado: { 
    bg: "from-gray-500 to-gray-600", 
    bgLight: "from-gray-50 to-gray-100",
    border: "border-gray-200",
    icon: BadgeCheck, 
    titulo: "Sinistro Encerrado",
    subtitulo: "Processo finalizado com sucesso",
    iconBg: "bg-gray-100",
    iconColor: "text-gray-600"
  },
  cancelado: { 
    bg: "from-gray-400 to-gray-500", 
    bgLight: "from-gray-50 to-gray-100",
    border: "border-gray-200",
    icon: XCircle, 
    titulo: "Sinistro Cancelado",
    subtitulo: "Processo foi cancelado",
    iconBg: "bg-gray-100",
    iconColor: "text-gray-500"
  }
};

const tipoIcons: Record<string, typeof Car> = {
  colisao: Car,
  roubo: ShieldAlert,
  furto: ShieldAlert,
  incendio: Flame,
  fenomeno_natural: CloudRain,
  terceiros: User,
  vidros: Eye,
  outro: HelpCircle
};

// Timeline etapas fixas
const ETAPAS_TIMELINE = [
  { id: 'comunicado', label: 'Sinistro aberto', icon: FileText },
  { id: 'em_analise', label: 'Em análise', icon: Search },
  { id: 'documentacao_pendente', label: 'Doc. pendente', icon: AlertCircle, opcional: true },
  { id: 'em_regulacao', label: 'Vistoria', icon: Eye, opcional: true },
  { id: 'aprovado', label: 'Aprovado', icon: CheckCircle },
  { id: 'em_reparo', label: 'Em reparo', icon: Wrench, opcional: true },
  { id: 'encerrado', label: 'Concluído', icon: BadgeCheck },
];

export default function SinistroDetalhe() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  
  // Queries
  const { data: sinistro, isLoading } = useSinistro(id);
  const { data: historico } = useSinistroHistorico(id);
  const { data: documentos } = useSinistroDocumentos(id);
  const { data: fotos } = useSinistroFotos(id);
  const { data: mensagens } = useSinistroMensagens(id);
  
  // Mutations
  const enviarMensagem = useEnviarMensagemSinistro();
  const uploadFoto = useUploadFotoSinistro();
  const uploadDocumento = useUploadDocumentoSinistro();
  
  // State
  const [detalhesAberto, setDetalhesAberto] = useState(false);
  const [fotosAberto, setFotosAberto] = useState(false);
  const [mensagensAberto, setMensagensAberto] = useState(true);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [avaliacao, setAvaliacao] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviandoAvaliacao, setEnviandoAvaliacao] = useState(false);
  const [fotoViewer, setFotoViewer] = useState<string | null>(null);
  
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const mensagensRef = useRef<HTMLDivElement>(null);
  
  // Scroll to bottom of messages
  useEffect(() => {
    if (mensagensRef.current) {
      mensagensRef.current.scrollTop = mensagensRef.current.scrollHeight;
    }
  }, [mensagens]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <header className="sticky top-0 z-50 bg-background border-b">
          <div className="flex items-center justify-between px-4 py-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Skeleton className="h-5 w-32" />
            <div className="w-10" />
          </div>
        </header>
        <div className="p-4 space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!sinistro) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Sinistro não encontrado</p>
          <Button className="mt-4" onClick={() => navigate('/app/sinistros')}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const status = (sinistro.status || 'comunicado') as StatusSinistro;
  const config = statusConfig[status] || statusConfig.comunicado;
  const StatusIcon = config.icon;
  const TipoIcon = tipoIcons[sinistro.tipo] || HelpCircle;

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy');
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd/MM HH:mm');
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (value: number) => {
    return value?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00';
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
      } catch {
        handleCopyProtocolo();
      }
    } else {
      handleCopyProtocolo();
    }
  };

  const handleEnviarMensagem = async () => {
    if (!novaMensagem.trim() || !id) return;
    
    try {
      await enviarMensagem.mutateAsync({
        sinistroId: id,
        mensagem: novaMensagem.trim(),
      });
      setNovaMensagem('');
      toast.success('Mensagem enviada!');
    } catch (error) {
      toast.error('Erro ao enviar mensagem');
    }
  };

  const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    
    try {
      await uploadFoto.mutateAsync({ sinistroId: id, file });
      toast.success('Foto adicionada!');
    } catch (error) {
      toast.error('Erro ao enviar foto');
    }
  };

  const handleEnviarAvaliacao = async () => {
    setEnviandoAvaliacao(true);
    await new Promise(r => setTimeout(r, 1500));
    setEnviandoAvaliacao(false);
    toast.success("Avaliação enviada!", {
      description: "Obrigado pelo seu feedback."
    });
    setAvaliacao(0);
    setComentario('');
  };

  // Determinar status atual na timeline
  const getStatusIndex = () => {
    const statusOrder = ['comunicado', 'em_analise', 'documentacao_pendente', 'em_regulacao', 'aprovado', 'negado', 'em_reparo', 'aguardando_pagamento', 'pago', 'encerrado'];
    return statusOrder.indexOf(status);
  };

  const documentosPendentes = documentos?.filter(d => d.status === 'pendente' || d.status === 'reprovado') || [];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <p className="font-semibold">Sinistro</p>
            <p className="text-xs text-muted-foreground">{sinistro.protocolo}</p>
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
                <StatusIcon className={`h-8 w-8 ${config.iconColor} ${status === 'em_analise' ? 'animate-pulse' : ''}`} />
              </div>
              
              <h2 className="text-xl font-bold">{config.titulo}</h2>
              <p className="text-muted-foreground mt-1">{config.subtitulo}</p>
              
              {/* Status-specific content */}
              {status === 'comunicado' && sinistro.created_at && (
                <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Recebido em {formatDate(sinistro.created_at)}
                </div>
              )}
              
              {status === 'aprovado' && sinistro.valor_indenizacao && (
                <div className="w-full mt-4 bg-background/80 rounded-lg p-4 border border-green-200">
                  <div className="space-y-2">
                    {sinistro.valor_fipe && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Valor FIPE</span>
                        <span className="font-medium">{formatCurrency(sinistro.valor_fipe)}</span>
                      </div>
                    )}
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
              
              {status === 'documentacao_pendente' && documentosPendentes.length > 0 && (
                <Button 
                  variant="outline" 
                  className="mt-4 border-orange-300 text-orange-700 hover:bg-orange-50"
                  onClick={() => document.getElementById('docs-section')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  Ver {documentosPendentes.length} documento(s) pendente(s)
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card Resumo */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <TipoIcon className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tipo</p>
                <p className="font-medium">{TIPO_SINISTRO_LABELS[sinistro.tipo as keyof typeof TIPO_SINISTRO_LABELS] || sinistro.tipo}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Calendar className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Data do Evento</p>
                <p className="font-medium">{formatDate(sinistro.data_ocorrencia)}</p>
              </div>
            </div>
            {sinistro.veiculo && (
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Car className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Veículo</p>
                  <p className="font-medium">{sinistro.veiculo.placa} - {sinistro.veiculo.marca} {sinistro.veiculo.modelo}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timeline de Status */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-5 w-5 text-primary" />
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {/* Linha vertical */}
              <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-border" />
              
              <div className="space-y-4">
                {ETAPAS_TIMELINE.map((etapa, index) => {
                  const historicoEtapa = historico?.find(h => h.status_novo === etapa.id);
                  const isCompleted = historicoEtapa !== undefined;
                  const isCurrent = status === etapa.id;
                  const EtapaIcon = etapa.icon;
                  
                  // Pular etapas opcionais que não foram atingidas
                  if (etapa.opcional && !isCompleted && !isCurrent) {
                    return null;
                  }
                  
                  return (
                    <div key={etapa.id} className="flex gap-4 relative">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10 ${
                        isCurrent 
                          ? 'bg-primary ring-4 ring-primary/20' 
                          : isCompleted
                          ? 'bg-green-500'
                          : 'bg-muted'
                      }`}>
                        {isCompleted ? (
                          <CheckCircle className="h-4 w-4 text-white" />
                        ) : isCurrent ? (
                          <div className="w-2 h-2 bg-white rounded-full" />
                        ) : (
                          <div className="w-2 h-2 bg-muted-foreground/30 rounded-full" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center justify-between">
                          <p className={`font-medium ${isCurrent ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {etapa.label}
                          </p>
                          {historicoEtapa && (
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(historicoEtapa.created_at)}
                            </span>
                          )}
                        </div>
                        {historicoEtapa?.observacao && (
                          <p className="text-sm text-muted-foreground mt-1">{historicoEtapa.observacao}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Documentos Pendentes */}
        {documentosPendentes.length > 0 && (
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
                        <p className="font-medium">{doc.nome_arquivo || doc.tipo}</p>
                        <Badge variant={doc.status === 'reprovado' ? 'destructive' : 'secondary'} className="text-xs">
                          {doc.status === 'reprovado' ? 'Reprovado' : 'Pendente'}
                        </Badge>
                        {doc.motivo_reprovacao && (
                          <p className="text-xs text-red-600 mt-1">{doc.motivo_reprovacao}</p>
                        )}
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="gap-1 border-orange-300 text-orange-700 hover:bg-orange-100"
                      onClick={() => docInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4" />
                      {doc.status === 'reprovado' ? 'Reenviar' : 'Enviar'}
                    </Button>
                  </div>
                ))}
              </div>
              <input 
                type="file" 
                ref={docInputRef} 
                className="hidden" 
                accept="image/*,.pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && id) {
                    uploadDocumento.mutate({ sinistroId: id, file, tipo: 'documento' });
                    toast.success('Documento enviado!');
                  }
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Analista Responsável */}
        {sinistro.analista_id && (
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Analista responsável</p>
                  <p className="font-semibold">Equipe de Sinistros</p>
                  <p className="text-sm text-muted-foreground">Acompanhando seu caso</p>
                </div>
              </div>
              
              <div className="flex gap-3 mt-4">
                <Button 
                  variant="outline" 
                  className="flex-1 gap-2"
                  onClick={() => setMensagensAberto(true)}
                >
                  <MessageSquare className="h-4 w-4" />
                  Mensagem
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Fotos do Sinistro */}
        <Collapsible open={fotosAberto} onOpenChange={setFotosAberto}>
          <Card className="border-0 shadow-md">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2">
                    <Image className="h-5 w-5 text-primary" />
                    Fotos ({fotos?.length || 0})
                  </div>
                  {fotosAberto ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="grid grid-cols-3 gap-2">
                  {fotos?.map((foto, index) => (
                    <div 
                      key={foto.name || index} 
                      className="aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer"
                      onClick={() => setFotoViewer(foto.url)}
                    >
                      <img 
                        src={foto.url} 
                        alt={`Foto ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                  <button 
                    onClick={() => fotoInputRef.current?.click()}
                    className="aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 hover:bg-muted/50 transition-colors"
                    disabled={uploadFoto.isPending}
                  >
                    {uploadFoto.isPending ? (
                      <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-6 w-6 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Adicionar</span>
                      </>
                    )}
                  </button>
                </div>
                <input 
                  type="file" 
                  ref={fotoInputRef} 
                  className="hidden" 
                  accept="image/*"
                  capture="environment"
                  onChange={handleUploadFoto}
                />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Mensagens / Chat */}
        <Collapsible open={mensagensAberto} onOpenChange={setMensagensAberto}>
          <Card className="border-0 shadow-md">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Mensagens
                    {mensagens && mensagens.length > 0 && (
                      <Badge variant="secondary" className="text-xs">{mensagens.length}</Badge>
                    )}
                  </div>
                  {mensagensAberto ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                {/* Lista de mensagens */}
                <div 
                  ref={mensagensRef}
                  className="max-h-64 overflow-y-auto space-y-2 p-2 bg-muted/30 rounded-lg"
                >
                  {!mensagens || mensagens.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-4">
                      Nenhuma mensagem ainda. Envie uma mensagem para o analista.
                    </p>
                  ) : (
                    mensagens.map(msg => (
                      <div 
                        key={msg.id} 
                        className={`p-3 rounded-lg max-w-[80%] ${
                          msg.remetente_tipo === 'associado' 
                            ? 'ml-auto bg-primary text-primary-foreground' 
                            : 'bg-background border'
                        }`}
                      >
                        <p className="text-sm">{msg.mensagem}</p>
                        <p className={`text-xs mt-1 ${
                          msg.remetente_tipo === 'associado' ? 'opacity-70' : 'text-muted-foreground'
                        }`}>
                          {formatDateTime(msg.created_at)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
                
                {/* Input para nova mensagem */}
                <div className="flex gap-2">
                  <Textarea
                    value={novaMensagem}
                    onChange={(e) => setNovaMensagem(e.target.value)}
                    placeholder="Digite sua mensagem..."
                    className="resize-none"
                    rows={2}
                  />
                  <Button 
                    onClick={handleEnviarMensagem}
                    disabled={!novaMensagem.trim() || enviarMensagem.isPending}
                    className="px-3"
                  >
                    {enviarMensagem.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Detalhes do Sinistro */}
        <Collapsible open={detalhesAberto} onOpenChange={setDetalhesAberto}>
          <Card className="border-0 shadow-md">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Detalhes Completos
                  </div>
                  {detalhesAberto ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                {/* Local */}
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <MapPin className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Local</p>
                    <p className="font-medium">{sinistro.local_ocorrencia}</p>
                    {sinistro.cidade_ocorrencia && (
                      <p className="text-sm text-muted-foreground">{sinistro.cidade_ocorrencia}/{sinistro.estado_ocorrencia}</p>
                    )}
                  </div>
                </div>
                
                {/* Descrição */}
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <FileText className="h-5 w-5 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Descrição</p>
                    <p className="text-sm mt-1">{sinistro.descricao}</p>
                  </div>
                </div>
                
                {/* B.O. */}
                {sinistro.bo_numero && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <FileWarning className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Boletim de Ocorrência</p>
                      <p className="font-medium">{sinistro.bo_numero}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Avaliação (quando encerrado) */}
        {(status === 'encerrado' || status === 'pago') && (
          <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="font-medium mb-3">Como foi sua experiência?</p>
                
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
                      <Label htmlFor="comentario" className="text-sm text-muted-foreground">
                        Comentário opcional
                      </Label>
                      <Textarea
                        id="comentario"
                        value={comentario}
                        onChange={(e) => setComentario(e.target.value)}
                        placeholder="Conte-nos mais sobre sua experiência..."
                        className="mt-1 bg-background resize-none"
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

      {/* Foto Viewer Dialog */}
      <Dialog open={!!fotoViewer} onOpenChange={() => setFotoViewer(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Visualizar Foto</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white"
              onClick={() => setFotoViewer(null)}
            >
              <X className="h-5 w-5" />
            </Button>
            {fotoViewer && (
              <img 
                src={fotoViewer} 
                alt="Foto do sinistro"
                className="w-full h-auto max-h-[90vh] object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
