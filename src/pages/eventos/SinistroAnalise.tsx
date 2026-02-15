import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  XCircle,
  FileText,
  User,
  Car,
  MapPin,
  Calendar,
  CalendarCheck,
  DollarSign,
  AlertTriangle,
  Phone,
  Mail,
  Clock,
  Shield,
  FileCheck,
  Image,
  History,
  Navigation,
  Wrench,
  Search,
  Send,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { useQueryClient } from '@tanstack/react-query';
import { VisualizadorFoto } from '@/components/analise/VisualizadorFoto';
import { useSinistroAnalise, useSinistrosPendentes } from '@/hooks/useSinistroAnalise';
import { usePermissions } from '@/hooks/usePermissions';
import { AprovarSinistroDialog } from '@/components/sinistros/AprovarSinistroDialog';
import { ReprovarSinistroDialog } from '@/components/sinistros/ReprovarSinistroDialog';
import { SolicitarDocumentosSinistroDialog } from '@/components/sinistros/SolicitarDocumentosSinistroDialog';
import { EnviarParaOficinaDialog } from '@/components/sinistros/EnviarParaOficinaDialog';
import { AtribuirFornecedoresDialog } from '@/components/sinistros/AtribuirFornecedoresDialog';
import { EncaminharSindicanciaDialog } from '@/components/sinistros/EncaminharSindicanciaDialog';
import { AnaliseInternaModal } from '@/components/sinistros/AnaliseInternaModal';
import { EncaminharJuridicoEventoModal } from '@/components/sinistros/EncaminharJuridicoEventoModal';
import { SuspenderEventoModal } from '@/components/sinistros/SuspenderEventoModal';
import { TrajetoSinistroCard } from '@/components/sinistros/TrajetoSinistroCard';
import { ComparacaoPosicoes } from '@/components/sinistros/ComparacaoPosicoes';
import { EventoLinkCard } from '@/components/eventos/EventoLinkCard';
import { CotacoesRecebidasTab } from '@/components/sinistros/CotacoesRecebidasTab';
import { TimelineEventoTab } from '@/components/sinistros/TimelineEventoTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// ============================================
// CONFIGURAÇÕES
// ============================================

const statusConfig: Record<string, { label: string; class: string }> = {
  comunicado: { label: 'Comunicado', class: 'bg-warning/20 text-warning border-warning' },
  em_analise: { label: 'Em Análise', class: 'bg-info/20 text-info border-info' },
  documentacao_pendente: { label: 'Doc. Pendente', class: 'bg-orange-100 text-orange-800' },
  aprovado: { label: 'Aprovado', class: 'bg-success/20 text-success border-success' },
  pronto_para_oficina: { label: 'Pronto p/ Oficina', class: 'bg-teal-100 text-teal-800 border-teal-300' },
  em_reparo: { label: 'Em Reparo', class: 'bg-blue-100 text-blue-800 border-blue-300' },
  pagamento_confirmado: { label: 'Pag. Confirmado', class: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  reprovado: { label: 'Reprovado', class: 'bg-red-100 text-red-800 border-red-300' },
  negado: { label: 'Negado', class: 'bg-destructive/20 text-destructive border-destructive' },
};

const tipoConfig: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  colisao: { label: 'Colisão', icon: Car },
  roubo: { label: 'Roubo', icon: Shield },
  furto: { label: 'Furto', icon: Shield },
  incendio: { label: 'Incêndio', icon: AlertTriangle },
  fenomeno_natural: { label: 'Fenômeno Natural', icon: AlertTriangle },
  vidros: { label: 'Vidros', icon: Car },
  outro: { label: 'Outro', icon: FileText },
};

// ============================================
// HELPERS
// ============================================

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return 'R$ ---';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(date: string | null): string {
  if (!date) return '---';
  return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
}

function formatDateTime(date: string | null): string {
  if (!date) return '---';
  return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

function maskCPF(cpf: string | null): string {
  if (!cpf) return '---';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return cpf;
  return `***.${clean.slice(3, 6)}.***-${clean.slice(9)}`;
}

function extrairDocumentosDoLink(linkEvento: any): any[] {
  if (!linkEvento) return [];
  const docs: any[] = [];

  linkEvento.dados_etapa1?.arquivos_urls?.forEach((url: string, i: number) => {
    const isVideo = /\.(mp4|webm|mov)$/i.test(url);
    docs.push({
      id: `link-etapa1-${i}`,
      tipo: isVideo ? 'video_veiculo' : 'foto_veiculo',
      nome_arquivo: isVideo ? `Vídeo ${i + 1}` : `Foto ${i + 1}`,
      arquivo_url: url,
      status: 'enviado',
      origem: 'link_evento',
    });
  });

  linkEvento.dados_etapa2?.arquivos_urls?.forEach((url: string, i: number) => {
    docs.push({
      id: `link-etapa2-${i}`,
      tipo: 'boletim_ocorrencia',
      nome_arquivo: `B.O.${linkEvento.dados_etapa2?.numero_bo ? ' Nº ' + linkEvento.dados_etapa2.numero_bo : ''}`,
      arquivo_url: url,
      status: 'enviado',
      origem: 'link_evento',
    });
  });

  linkEvento.dados_etapa3?.arquivos_urls?.forEach((url: string, i: number) => {
    docs.push({
      id: `link-etapa3-${i}`,
      tipo: 'relato_audio',
      nome_arquivo: `Relato do Associado (Áudio)`,
      arquivo_url: url,
      status: 'enviado',
      origem: 'link_evento',
    });
  });

  return docs;
}

function resolverUrl(url: string | null): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return supabase.storage.from('sinistros').getPublicUrl(url).data.publicUrl;
}

// ============================================
// INFO ITEM COMPONENT
// ============================================

function InfoItem({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="p-2 rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={cn("text-foreground", highlight && "font-semibold text-lg")}>
          {value || '---'}
        </p>
      </div>
    </div>
  );
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function SinistroAnalise() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDiretor, isAnalistaEventos } = usePermissions();

  const [showAprovar, setShowAprovar] = useState(false);
  const [showReprovar, setShowReprovar] = useState(false);
  const [showSolicitarDocs, setShowSolicitarDocs] = useState(false);
  const [showEnviarOficina, setShowEnviarOficina] = useState(false);
  const [showAtribuirFornecedores, setShowAtribuirFornecedores] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [showSindicancia, setShowSindicancia] = useState(false);
  const [showAnaliseInterna, setShowAnaliseInterna] = useState(false);
  const [showJuridico, setShowJuridico] = useState(false);
  const [showSuspender, setShowSuspender] = useState(false);
  const [enviandoLinkAgendamento, setEnviandoLinkAgendamento] = useState(false);
  const [enviandoLinkAutoVistoria, setEnviandoLinkAutoVistoria] = useState(false);
  const [fotoViewer, setFotoViewer] = useState({ open: false, index: 0 });

  const {
    sinistro,
    documentos,
    historicoSinistro,
    rastreador,
    temRastreadorAtivo,
    sinistrosAnteriores,
    contratoAtivo,
    veiculoHistorico,
    linkEvento,
    isLoading,
  } = useSinistroAnalise(id);

  const queryClient = useQueryClient();
  const { data: pendentes } = useSinistrosPendentes();

  // Polling automático para detectar assinatura do termo
  useEffect(() => {
    const aguardandoAssinatura = sinistro?.autentique_documento_id && !sinistro?.termo_anuencia_assinado;
    if (!aguardandoAssinatura) return;

    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['sinistro-analise', id] });
    }, 10000);

    return () => clearInterval(interval);
  }, [sinistro?.autentique_documento_id, sinistro?.termo_anuencia_assinado, id, queryClient]);

  // Navegação entre sinistros
  const currentIndex = pendentes?.findIndex((p) => p.id === id) ?? -1;
  const nextSinistro = currentIndex >= 0 && pendentes ? pendentes[currentIndex + 1] : null;

  const handleActionSuccess = () => {
    if (nextSinistro) {
      navigate(`/eventos/sinistros/${nextSinistro.id}/analisar`);
    } else {
      navigate('/eventos/sinistros');
    }
  };

  // Verificar acesso
  if (!isDiretor && !isAnalistaEventos) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-warning" />
        <h2 className="text-xl font-semibold text-foreground">Acesso Restrito</h2>
        <p className="text-muted-foreground mt-2">
          Apenas diretores e analistas de eventos podem analisar sinistros.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/eventos/sinistros')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48 bg-muted" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64 w-full bg-muted" />
            <Skeleton className="h-64 w-full bg-muted" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48 w-full bg-muted" />
            <Skeleton className="h-48 w-full bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (!sinistro) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-warning" />
        <h2 className="text-xl font-semibold text-foreground">Sinistro não encontrado</h2>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/eventos/sinistros')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>
    );
  }

  const associado = sinistro.associado as any;
  const veiculo = sinistro.veiculo as any;

  // Condições para botão de agendamento de vistoria
  const canSendScheduling = linkEvento &&
    (linkEvento as any).etapa_atual >= 3 &&
    !(linkEvento as any).etapa4_completada_em;
  const schedulingDone = linkEvento && (linkEvento as any).etapa4_completada_em;

  const handleEnviarLinkAgendamento = async () => {
    if (!associado || !linkEvento) return;
    const telefone = associado.whatsapp || associado.telefone;
    if (!telefone) {
      toast.error('Associado não possui telefone cadastrado.');
      return;
    }
    setEnviandoLinkAgendamento(true);
    try {
      const link = `https://pratic-connect-21.lovable.app/evento/${(linkEvento as any).token}`;
      const nome = associado.nome?.split(' ')[0] || 'Associado';
      const mensagem = `Olá ${nome}!\n\nAs informações do seu sinistro ${sinistro.protocolo} foram recebidas com sucesso!\n\nAgora, para darmos andamento ao processo de reparo, você precisa agendar a vistoria presencial do regulador.\n\nAcesse o link abaixo para escolher a data e horário:\n${link}\n\nO regulador irá até o endereço que você informar para avaliar os danos.\n\nABP PraticCar`;
      const { error } = await supabase.functions.invoke('whatsapp-send-text', {
        body: { telefone, mensagem },
      });
      if (error) throw error;
      toast.success('Link de agendamento enviado via WhatsApp!');
    } catch (err: any) {
      console.error('Erro ao enviar link agendamento:', err);
      toast.error('Erro ao enviar link: ' + (err.message || 'Tente novamente'));
    } finally {
      setEnviandoLinkAgendamento(false);
    }
  };
  const handleEnviarLinkAutoVistoria = async () => {
    if (!sinistro || !associado) return;
    const telefone = associado.whatsapp || associado.telefone;
    if (!telefone) {
      toast.error('Associado não possui telefone cadastrado.');
      return;
    }
    setEnviandoLinkAutoVistoria(true);
    try {
      // 1. Gerar link de evento
      const { data: linkData, error: linkError } = await supabase.functions.invoke('gerar-link-evento', {
        body: { sinistro_id: sinistro.id },
      });
      if (linkError || !linkData?.success) {
        throw new Error(linkData?.error || linkError?.message || 'Erro ao gerar link');
      }

      // 2. Buscar dados para calcular coparticipação
      const link = `https://pratic-connect-21.lovable.app/evento/${linkData.token}`;
      const nome = associado.nome?.split(' ')[0] || 'Associado';

      let cotaTexto = "";
      try {
        const veiculo = sinistro.veiculo;
        const planoId = associado.plano?.id;
        if (planoId && veiculo?.valor_fipe) {
          const { data: planoData } = await supabase
            .from('planos')
            .select('nome, cota_participacao, cota_minima, cota_app_percent, cota_app_min')
            .eq('id', planoId)
            .single();

          if (planoData) {
            let percentual = planoData.cota_participacao;
            let minimo = planoData.cota_minima;
            // Check uso_aplicativo from veiculos table
            const { data: veiculoFull } = await supabase
              .from('veiculos')
              .select('uso_aplicativo')
              .eq('id', veiculo.id)
              .single();
            if (veiculoFull?.uso_aplicativo && planoData.cota_app_percent) {
              percentual = planoData.cota_app_percent;
              minimo = planoData.cota_app_min;
            }
            const valorFipe = veiculo.valor_fipe;
            const valorCota = Math.max(valorFipe * (percentual || 0) / 100, minimo || 0);
            const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            cotaTexto = `\n💰 *Cota de coparticipação:*\nSeu plano: ${planoData.nome} (${percentual}% da FIPE)\nValor FIPE do veículo: ${fmtBRL(valorFipe)}\nSua cota: *${fmtBRL(valorCota)}*\n`;
          }
        }
      } catch (cotaErr) {
        console.error('Erro ao calcular cota:', cotaErr);
      }

      const mensagem = `Olá ${nome}!\n\nSeu sinistro ${sinistro.protocolo} foi registrado com sucesso.\n\nPara dar andamento ao processo, acesse o link abaixo e envie os documentos necessários:\n\n${link}\n\n*DOCUMENTOS NECESSÁRIOS:*\n\n📸 *Etapa 1 - Auto Vistoria (fotos e vídeo do veículo)*\n- Frente, traseira, laterais e teto\n- Detalhes dos danos\n- Painel/hodômetro\n- Mínimo de 5 fotos e 1 vídeo dos danos\n\n📋 *Etapa 2 - Boletim de Ocorrência*\n- Número do B.O.\n- Foto ou PDF do documento\n\n📝 *Etapa 3 - Relato do ocorrido*\n- Descrição detalhada do que aconteceu\n- Áudio ou texto\n- Localização do evento\n${cotaTexto}\n⏰ O link é válido por 72 horas.\n\nABP PraticCar`;

      const { error: whatsError } = await supabase.functions.invoke('whatsapp-send-text', {
        body: { telefone, mensagem },
      });
      if (whatsError) throw whatsError;

      // 3. Atualizar status do sinistro
      await supabase
        .from('sinistros')
        .update({ status: 'em_analise' })
        .eq('id', sinistro.id);

      // 4. Registrar no histórico
      await supabase.from('sinistro_historico').insert({
        sinistro_id: sinistro.id,
        status_anterior: sinistro.status,
        status_novo: 'em_analise',
        observacao: 'Link de auto vistoria enviado ao associado via WhatsApp',
      });

      toast.success('Link de auto vistoria enviado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['sinistro-analise', id] });
    } catch (err: any) {
      console.error('Erro ao enviar link auto vistoria:', err);
      toast.error('Erro ao enviar link: ' + (err.message || 'Tente novamente'));
    } finally {
      setEnviandoLinkAutoVistoria(false);
    }
  };

  const TipoIcon = tipoConfig[sinistro.tipo]?.icon || FileText;
  const statusInfo = statusConfig[sinistro.status] || { label: sinistro.status, class: '' };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/dashboard">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/eventos/sinistros">Sinistros</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Análise - {sinistro.protocolo}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/eventos/sinistros')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Análise de Sinistro</h1>
            <p className="text-muted-foreground">
              {sinistro.protocolo} • {pendentes && `${currentIndex + 1} de ${pendentes.length}`}
            </p>
          </div>
          <Badge className={cn("text-sm px-3 py-1", statusInfo.class)}>
            {statusInfo.label}
          </Badge>
          {sinistro.alerta_recem_ativado && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
              <AlertTriangle className="h-4 w-4 mr-1" />
              Recém-ativado
            </Badge>
          )}
        </div>

        {/* Navegação */}
        {nextSinistro && (
          <Button
            variant="outline"
            onClick={() => navigate(`/eventos/sinistros/${nextSinistro.id}/analisar`)}
          >
            Próximo
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Alerta de Recém-Ativado */}
      {sinistro.alerta_recem_ativado && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800">⚠️ Alerta: Associado Recém-Ativado</p>
              <p className="text-sm text-amber-700">
                Este associado foi ativado recentemente. Requer análise criteriosa.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Coluna Esquerda - 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          {(() => {
            const showCotacoesTab = ['pronto_para_oficina', 'em_reparo'].includes(sinistro.status as string);

            const detalhesContent = (
              <div className="space-y-6">
                {/* Dados do Associado */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Dados do Associado
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <InfoItem icon={User} label="Nome" value={associado?.nome} />
                    <InfoItem icon={FileText} label="CPF" value={maskCPF(associado?.cpf)} />
                    <InfoItem icon={Phone} label="Telefone" value={associado?.telefone} />
                    <InfoItem icon={Mail} label="Email" value={associado?.email} />
                    <InfoItem
                      icon={MapPin}
                      label="Endereço"
                      value={associado ? `${associado.logradouro || ''}, ${associado.numero || ''} - ${associado.bairro || ''}, ${associado.cidade || ''}/${associado.uf || ''}` : null}
                    />
                    <InfoItem icon={Calendar} label="Data de Adesão" value={formatDate(associado?.data_adesao)} />
                  </CardContent>
                </Card>

                {/* Dados do Veículo */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Car className="h-5 w-5" />
                      Dados do Veículo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <InfoItem icon={Car} label="Placa" value={veiculo?.placa} highlight />
                    <InfoItem icon={Car} label="Marca/Modelo" value={`${veiculo?.marca || ''} ${veiculo?.modelo || ''}`} />
                    <InfoItem icon={Calendar} label="Ano" value={veiculo?.ano_modelo?.toString()} />
                    <InfoItem icon={Car} label="Cor" value={veiculo?.cor} />
                    <InfoItem icon={FileText} label="Chassi" value={veiculo?.chassi} />
                    <InfoItem icon={DollarSign} label="Valor FIPE" value={formatCurrency(veiculo?.valor_fipe)} highlight />
                    <InfoItem icon={FileText} label="Código FIPE" value={veiculo?.codigo_fipe} />
                  </CardContent>
                </Card>

                {/* Informações do Sinistro */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TipoIcon className="h-5 w-5" />
                      Informações do Sinistro
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <InfoItem icon={TipoIcon} label="Tipo" value={tipoConfig[sinistro.tipo]?.label || sinistro.tipo} />
                    <InfoItem icon={Calendar} label="Data da Ocorrência" value={formatDateTime(sinistro.data_ocorrencia)} />
                    <InfoItem icon={MapPin} label="Local" value={sinistro.local_ocorrencia} />
                    <InfoItem icon={MapPin} label="Cidade/UF" value={`${sinistro.cidade_ocorrencia || ''}/${sinistro.estado_ocorrencia || ''}`} />
                    <InfoItem icon={FileText} label="Nº B.O." value={sinistro.bo_numero || linkEvento?.dados_etapa2?.numero_bo} />
                    <InfoItem icon={Clock} label="Comunicado em" value={formatDateTime(sinistro.created_at)} />
                    <div className="md:col-span-2">
                      <p className="text-sm text-muted-foreground mb-1">Descrição</p>
                      <p className="text-foreground bg-muted p-3 rounded-md">{sinistro.descricao || '---'}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Trajeto 24h */}
                {temRastreadorAtivo && (
                  <TrajetoSinistroCard
                    veiculoId={sinistro.veiculo_id}
                    dataOcorrencia={sinistro.data_ocorrencia}
                    localOcorrencia={sinistro.local_ocorrencia}
                    sinistroId={sinistro.id}
                    protocolo={sinistro.protocolo}
                    veiculo={veiculo}
                    associado={associado}
                    latitudeInformada={sinistro.latitude_informada}
                    longitudeInformada={sinistro.longitude_informada}
                    rastreadorLat={rastreador?.ultima_posicao_lat}
                    rastreadorLng={rastreador?.ultima_posicao_lng}
                  />
                )}

                {/* Comparação GPS */}
                <ComparacaoPosicoes
                  latitudeInformada={sinistro.latitude_informada}
                  longitudeInformada={sinistro.longitude_informada}
                  rastreadorLat={rastreador?.ultima_posicao_lat}
                  rastreadorLng={rastreador?.ultima_posicao_lng}
                  rastreadorCapturadoEm={rastreador?.ultima_comunicacao}
                  localOcorrencia={sinistro.local_ocorrencia}
                />

                {/* Auto-Vistoria do Associado */}
                {linkEvento && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <Image className="h-5 w-5" />
                          Fotos da Auto-Vistoria
                        </CardTitle>
                        <Badge variant={
                          linkEvento.status === 'completado' ? 'default' :
                          linkEvento.status === 'expirado' ? 'destructive' : 'outline'
                        }>
                          {linkEvento.status === 'completado' ? 'Completado' :
                           linkEvento.status === 'expirado' ? 'Expirado' : 'Pendente'}
                        </Badge>
                      </div>
                      <CardDescription>Dados enviados pelo associado via link de auto-vistoria</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Fotos - Etapa 1 */}
                      {linkEvento.dados_etapa1?.arquivos_urls?.length > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-2">Fotos do Veículo ({linkEvento.dados_etapa1.arquivos_urls.length})</p>
                          <div className="grid grid-cols-3 gap-2">
                            {linkEvento.dados_etapa1.arquivos_urls.map((url: string, idx: number) => {
                              const isVideo = /\.(mp4|webm|mov)$/i.test(url);
                              return isVideo ? (
                                <video
                                  key={idx}
                                  src={resolverUrl(url)}
                                  controls
                                  className="h-24 w-full rounded-md object-cover border"
                                />
                              ) : (
                                <img
                                  key={idx}
                                  src={resolverUrl(url)}
                                  alt={`Foto ${idx + 1}`}
                                  className="h-24 w-full rounded-md object-cover cursor-pointer hover:opacity-80 transition-opacity border"
                                  onClick={() => {
                                    const imageUrls = linkEvento.dados_etapa1.arquivos_urls.filter((u: string) => !/\.(mp4|webm|mov)$/i.test(u));
                                    const imageIndex = imageUrls.indexOf(url);
                                    setFotoViewer({ open: true, index: imageIndex >= 0 ? imageIndex : 0 });
                                  }}
                                />
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* B.O. - Etapa 2 */}
                      {linkEvento.dados_etapa2 && (
                        <div>
                          <Separator className="my-2" />
                          <p className="text-sm font-medium mb-1">Boletim de Ocorrência</p>
                          <div className="flex items-center gap-2">
                            {linkEvento.dados_etapa2.numero_bo && (
                              <span className="text-sm">Nº {linkEvento.dados_etapa2.numero_bo}</span>
                            )}
                            {linkEvento.dados_etapa2.arquivos_urls?.[0] && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => window.open(resolverUrl(linkEvento.dados_etapa2.arquivos_urls[0]), '_blank')}
                              >
                                <FileText className="h-3 w-3 mr-1" />
                                Ver arquivo
                              </Button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Relato - Etapa 3 */}
                      {linkEvento.dados_etapa3 && (
                        <div>
                          <Separator className="my-2" />
                          <p className="text-sm font-medium mb-1">Relato do Associado</p>
                          {linkEvento.dados_etapa3.relato_texto && (
                            <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                              {linkEvento.dados_etapa3.relato_texto}
                            </p>
                          )}
                          {(() => {
                            const audioUrl = linkEvento.dados_etapa3.arquivos_urls?.find((u: string) => /\.(webm|ogg|mp3|m4a|wav)$/i.test(u));
                            return audioUrl ? (
                              <audio controls className="w-full mt-1">
                                <source src={resolverUrl(audioUrl)} />
                              </audio>
                            ) : null;
                          })()}
                        </div>
                      )}

                      {/* Link pendente sem dados */}
                      {linkEvento.status !== 'completado' && !linkEvento.dados_etapa1 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Aguardando envio das informações pelo associado
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Documentos */}
                {(() => {
                  const todosDocumentos = [...documentos, ...extrairDocumentosDoLink(linkEvento)];
                  return (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <FileCheck className="h-5 w-5" />
                          Documentos ({todosDocumentos.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {todosDocumentos.length === 0 ? (
                          <p className="text-muted-foreground text-center py-4">
                            Nenhum documento anexado
                          </p>
                        ) : (
                          <div className="grid gap-2">
                            {todosDocumentos.map((doc) => {
                              const docUrl = resolverUrl(doc.arquivo_url);
                              const isEnviado = doc.status === 'enviado' && docUrl;
                              const isImage = docUrl && /\.(jpg|jpeg|png|webp|gif)$/i.test(docUrl);
                              const isAudio = docUrl && /\.(mp3|webm|ogg|wav|m4a)$/i.test(docUrl);
                              const isVideo = docUrl && /\.(mp4|mov)$/i.test(docUrl);
                              return (
                                <div
                                  key={doc.id}
                                  className="flex items-center gap-3 p-3 rounded-md bg-muted"
                                >
                                  {isEnviado && isImage ? (
                                    <img
                                      src={docUrl}
                                      alt={doc.nome_arquivo || doc.tipo}
                                      className="h-14 w-14 rounded-md object-cover flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity border"
                                      onClick={() => setPreviewDoc(doc)}
                                    />
                                  ) : isEnviado && isAudio ? (
                                    <div className="flex-shrink-0 w-14 h-14 rounded-md bg-background border flex items-center justify-center">
                                      🎙️
                                    </div>
                                  ) : isEnviado && isVideo ? (
                                    <div className="flex-shrink-0 w-14 h-14 rounded-md bg-background border flex items-center justify-center">
                                      🎬
                                    </div>
                                  ) : (
                                    <div className="h-14 w-14 rounded-md bg-background border flex items-center justify-center flex-shrink-0">
                                      <FileText className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <span className="text-sm font-medium truncate block">{doc.nome_arquivo || doc.tipo}</span>
                                    {doc.origem === 'link_evento' && (
                                      <span className="text-xs text-muted-foreground">Via auto-vistoria</span>
                                    )}
                                    {isEnviado && isAudio && (
                                      <audio src={docUrl} controls className="mt-1 h-8 w-full max-w-[220px]" preload="metadata" />
                                    )}
                                    {!isAudio && (
                                      <Badge variant={doc.status === 'enviado' ? 'default' : 'outline'} className="mt-1 text-xs">
                                        {doc.status}
                                      </Badge>
                                    )}
                                  </div>
                                  {isEnviado && !isAudio && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 px-3 text-xs flex-shrink-0"
                                      onClick={() => {
                                        if (isVideo) {
                                          window.open(docUrl, '_blank');
                                        } else {
                                          setPreviewDoc(doc);
                                        }
                                      }}
                                    >
                                      {isVideo ? 'Assistir' : 'Ampliar'}
                                    </Button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* Sinistros Anteriores */}
                {sinistrosAnteriores.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <History className="h-5 w-5" />
                        Sinistros Anteriores ({sinistrosAnteriores.length})
                      </CardTitle>
                      <CardDescription>Histórico de sinistros deste veículo</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {sinistrosAnteriores.map((ant) => (
                          <div
                            key={ant.id}
                            className="flex items-center justify-between p-3 rounded-md bg-muted"
                          >
                            <div>
                              <p className="text-sm font-medium">{ant.protocolo}</p>
                              <p className="text-xs text-muted-foreground">
                                {tipoConfig[ant.tipo]?.label || ant.tipo} • {formatDate(ant.data_ocorrencia)}
                              </p>
                            </div>
                            <Badge variant="outline">{ant.status}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            );

            if (!showCotacoesTab) return detalhesContent;

            return (
              <Tabs defaultValue="detalhes">
                <TabsList>
                  <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
                  <TabsTrigger value="cotacoes">Cotações Recebidas</TabsTrigger>
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                </TabsList>
                <TabsContent value="detalhes">{detalhesContent}</TabsContent>
                <TabsContent value="cotacoes">
                  <CotacoesRecebidasTab sinistroId={sinistro.id} />
                </TabsContent>
                <TabsContent value="timeline">
                  <TimelineEventoTab sinistroId={sinistro.id} />
                </TabsContent>
              </Tabs>
            );
          })()}
        </div>

        {/* Coluna Direita - 1/3 */}
        <div className="space-y-6">
          {/* Ações */}
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle>🎬 Ações</CardTitle>
              <CardDescription>Decisão sobre o sinistro</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(() => {
                // Pronto para oficina — atribuir fornecedores
                if ((sinistro.status as string) === 'pronto_para_oficina') {
                  return (
                    <>
                      <div className="flex items-center gap-2 p-3 rounded-md bg-teal-50 border border-teal-200 text-teal-800 text-sm">
                        <CheckCircle className="h-4 w-4 flex-shrink-0" />
                        <span><strong>Pagamento e termo confirmados</strong> — pronto para atribuir fornecedores.</span>
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => setShowAtribuirFornecedores(true)}
                      >
                        <Wrench className="h-4 w-4 mr-2" />
                        Atribuir Fornecedores
                      </Button>
                    </>
                  );
                }

                // Pagamento confirmado — aguardando termo
                if ((sinistro.status as string) === 'pagamento_confirmado') {
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
                        <CheckCircle className="h-4 w-4 flex-shrink-0" />
                        <span><strong>Pagamento confirmado</strong> — aguardando assinatura do termo.</span>
                      </div>
                      {(sinistro as any).cota_paga_em && (
                        <p className="text-xs text-muted-foreground">
                          Pago em {formatDateTime((sinistro as any).cota_paga_em)}
                        </p>
                      )}
                      {(sinistro as any).cota && (
                        <p className="text-xs text-muted-foreground">
                          Valor: {formatCurrency(
                            typeof (sinistro as any).cota === 'object'
                              ? (sinistro as any).cota.valor_cota
                              : (sinistro as any).cota
                          )}
                        </p>
                      )}
                    </div>
                  );
                }

                // Status em_analise: aguardando auto vistoria do associado
                if (sinistro.status === 'em_analise') {
                  return (
                    <div className="space-y-3">
                      {linkEvento?.status === 'completado' ? (
                        <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 border border-green-200 text-green-800 text-sm">
                          <CheckCircle className="h-4 w-4 flex-shrink-0" />
                          <span><strong>Documentação recebida</strong> — pronto para análise.</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                          <Clock className="h-4 w-4 flex-shrink-0" />
                          <span><strong>Aguardando auto vistoria</strong> — link enviado ao associado.</span>
                        </div>
                      )}
                    </div>
                  );
                }

                // Sinistro aprovado (pós-vistoria)
                if (sinistro.status === 'aprovado') {
                  return (
                    <>
                      <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 border border-green-200 text-green-800 text-sm">
                        <CheckCircle className="h-4 w-4 flex-shrink-0" />
                        <span><strong>Sinistro aprovado</strong> — aguardando encaminhamento para oficina.</span>
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => setShowEnviarOficina(true)}
                      >
                        <Wrench className="h-4 w-4 mr-2" />
                        Enviar para Oficina
                      </Button>
                    </>
                  );
                }

                // Em reparo
                if (sinistro.status === 'em_reparo') {
                  return (
                    <div className="flex items-center gap-2 p-3 rounded-md bg-teal-50 border border-teal-200 text-teal-800 text-sm">
                      <Wrench className="h-4 w-4 flex-shrink-0" />
                      <span>Veículo já encaminhado para oficina.</span>
                    </div>
                  );
                }

                const aguardandoAssinatura = sinistro.autentique_documento_id && !sinistro.termo_anuencia_assinado;
                const docsPendentes = documentos.filter(doc => doc.status === 'pendente');
                const temDocsPendentes = docsPendentes.length > 0;

                if (aguardandoAssinatura) {
                  return (
                    <div className="flex items-center gap-2 p-3 rounded-md bg-blue-50 border border-blue-200 text-blue-800 text-sm">
                      <FileCheck className="h-4 w-4 flex-shrink-0" />
                      <span>Aguardando assinatura do <strong>Termo de Entrada de Evento</strong> pelo associado. Nenhuma ação disponível até a assinatura.</span>
                    </div>
                  );
                }

                return (
                  <>
                    {temDocsPendentes && (
                      <div className="flex items-center gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                        <Clock className="h-4 w-4 flex-shrink-0" />
                        <span>Aguardando envio de {docsPendentes.length} documento(s) solicitado(s)</span>
                      </div>
                    )}
                    {isDiretor && !temDocsPendentes && (
                      ['comunicado', 'aberto'].includes(sinistro.status as string) ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 p-3 rounded-md bg-blue-50 border border-blue-200 text-blue-800 text-sm">
                            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                            <span>A IA informará ao associado sobre a cota de coparticipação ao enviar o link.</span>
                          </div>
                          <Button
                            className="w-full bg-green-600 hover:bg-green-700 text-white"
                            onClick={handleEnviarLinkAutoVistoria}
                            disabled={enviandoLinkAutoVistoria}
                          >
                            {enviandoLinkAutoVistoria ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4 mr-2" />
                            )}
                            Enviar Link de Auto Vistoria
                          </Button>
                        </div>
                      ) : (
                        <Button
                          className="w-full bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => setShowAprovar(true)}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Aprovar Sinistro
                        </Button>
                      )
                    )}
                    {isDiretor && (
                      <Button
                        variant="destructive"
                        className="w-full"
                        onClick={() => setShowReprovar(true)}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reprovar Sinistro
                      </Button>
                    )}
                    {!isDiretor && isAnalistaEventos && (
                      <div className="flex items-center gap-2 p-3 rounded-md bg-blue-50 border border-blue-200 text-blue-800 text-sm">
                        <FileCheck className="h-4 w-4 flex-shrink-0" />
                        <span>Analise o sinistro e encaminhe para aprovação da diretoria.</span>
                      </div>
                    )}
                    {!temDocsPendentes && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setShowSolicitarDocs(true)}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Solicitar Documentos
                      </Button>
                    )}
                  </>
                );
              })()}
              {(() => {
                // Mostrar botões adicionais apenas quando status permite
                const statusPermiteAcoes = !['suspenso', 'negado', 'encerrado', 'reprovado', 'em_reparo', 'pronto_para_oficina', 'pagamento_confirmado'].includes(sinistro.status as string);
                if (!statusPermiteAcoes) return null;
                return (
                  <>
                    <Separator className="my-2" />
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-amber-300 text-amber-700 hover:bg-amber-50"
                        onClick={() => setShowSindicancia(true)}
                      >
                        <Search className="h-3.5 w-3.5 mr-1.5" />
                        Sindicância
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-blue-300 text-blue-700 hover:bg-blue-50"
                        onClick={() => setShowAnaliseInterna(true)}
                      >
                        <FileCheck className="h-3.5 w-3.5 mr-1.5" />
                        Análise Interna
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-purple-300 text-purple-700 hover:bg-purple-50"
                        onClick={() => setShowJuridico(true)}
                      >
                        <Shield className="h-3.5 w-3.5 mr-1.5" />
                        Jurídico
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-muted-foreground/30 text-muted-foreground hover:bg-muted"
                        onClick={() => setShowSuspender(true)}
                      >
                        <Clock className="h-3.5 w-3.5 mr-1.5" />
                        Suspender
                      </Button>
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>

          {/* Link de Auto-Vistoria */}
          <EventoLinkCard
            sinistroId={id!}
            sinistroProtocolo={sinistro.protocolo}
            associadoWhatsapp={associado?.whatsapp || associado?.telefone}
            associadoNome={associado?.nome}
            sinistroTipo={sinistro.tipo}
          />

          {/* Checklist */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">📋 Checklist de Análise</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "h-4 w-4 rounded-full",
                  (documentos.length + extrairDocumentosDoLink(linkEvento).length) > 0 ? "bg-green-500" : "bg-muted"
                )} />
                <span className="text-sm">Documentos anexados</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "h-4 w-4 rounded-full",
                  (sinistro.bo_numero || linkEvento?.dados_etapa2?.numero_bo || documentos.some((d: any) => d.tipo === 'bo' && d.status !== 'pendente')) ? "bg-green-500" : "bg-muted"
                )} />
                <span className="text-sm">B.O. informado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "h-4 w-4 rounded-full",
                  sinistro.local_ocorrencia ? "bg-green-500" : "bg-muted"
                )} />
                <span className="text-sm">Local verificado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "h-4 w-4 rounded-full",
                  temRastreadorAtivo ? "bg-green-500" : "bg-amber-500"
                )} />
                <span className="text-sm">
                  {temRastreadorAtivo ? 'Rastreador ativo' : 'Sem rastreador'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Botão Enviar Link de Agendamento de Vistoria */}
          {canSendScheduling && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardContent className="pt-4 space-y-2">
                <p className="text-sm text-blue-800">
                  <CalendarCheck className="h-4 w-4 inline mr-1" />
                  As 3 etapas foram concluídas. Envie o link para o associado agendar a vistoria do regulador.
                </p>
                <Button
                  className="w-full"
                  onClick={handleEnviarLinkAgendamento}
                  disabled={enviandoLinkAgendamento}
                >
                  {enviandoLinkAgendamento ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Enviar Link de Agendamento
                </Button>
              </CardContent>
            </Card>
          )}
          {schedulingDone && (
            <Card className="border-green-200 bg-green-50/50">
              <CardContent className="flex items-center gap-2 pt-4">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-800 font-medium">Agendamento de vistoria realizado</span>
              </CardContent>
            </Card>
          )}

          {/* Histórico do Sinistro */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">📜 Histórico</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-3">
                  {historicoSinistro.map((h) => (
                    <div key={h.id} className="border-l-2 border-muted pl-3 py-1">
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(h.created_at)}
                      </p>
                      <p className="text-sm">
                        <Badge variant="outline" className="text-xs mr-2">
                          {h.status_novo}
                        </Badge>
                      </p>
                      {h.observacao && (
                        <p className="text-xs text-muted-foreground mt-1">{h.observacao}</p>
                      )}
                      {h.usuario && (
                        <p className="text-xs text-muted-foreground">
                          por {(h.usuario as any).nome}
                        </p>
                      )}
                    </div>
                  ))}
                  {historicoSinistro.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum histórico
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <AprovarSinistroDialog
        open={showAprovar}
        onOpenChange={setShowAprovar}
        sinistroId={sinistro.id}
        protocolo={sinistro.protocolo}
        onSuccess={handleActionSuccess}
      />

      <ReprovarSinistroDialog
        open={showReprovar}
        onOpenChange={setShowReprovar}
        sinistroId={sinistro.id}
        protocolo={sinistro.protocolo}
        onSuccess={handleActionSuccess}
      />

      <SolicitarDocumentosSinistroDialog
        open={showSolicitarDocs}
        onOpenChange={setShowSolicitarDocs}
        sinistroId={sinistro.id}
        protocolo={sinistro.protocolo}
        statusAtual={sinistro.status}
        associadoId={sinistro.associado_id}
      />

      <EnviarParaOficinaDialog
        open={showEnviarOficina}
        onOpenChange={setShowEnviarOficina}
        sinistro={sinistro}
        onSuccess={() => navigate('/ordens-servico')}
      />

      <AtribuirFornecedoresDialog
        open={showAtribuirFornecedores}
        onOpenChange={setShowAtribuirFornecedores}
        sinistro={sinistro}
        onSuccess={() => navigate('/ordens-servico')}
      />

      <EncaminharSindicanciaDialog
        open={showSindicancia}
        onClose={() => setShowSindicancia(false)}
        sinistroId={sinistro.id}
        protocolo={sinistro.protocolo}
        tipoEvento={sinistro.tipo}
      />

      <AnaliseInternaModal
        open={showAnaliseInterna}
        onClose={() => setShowAnaliseInterna(false)}
        sinistroId={sinistro.id}
        protocolo={sinistro.protocolo}
        onOpenSindicancia={() => setShowSindicancia(true)}
        onOpenJuridico={() => setShowJuridico(true)}
      />

      <EncaminharJuridicoEventoModal
        open={showJuridico}
        onClose={() => setShowJuridico(false)}
        sinistroId={sinistro.id}
        protocolo={sinistro.protocolo}
        associadoId={sinistro.associado_id}
        associadoNome={associado?.nome}
      />

      <SuspenderEventoModal
        open={showSuspender}
        onClose={() => setShowSuspender(false)}
        sinistroId={sinistro.id}
        protocolo={sinistro.protocolo}
      />

      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          {previewDoc?.arquivo_url && (() => {
            const previewUrl = resolverUrl(previewDoc.arquivo_url);
            return (
            <>
              {/\.(jpg|jpeg|png|webp|gif)$/i.test(previewUrl) ? (
                <img
                  src={previewUrl}
                  alt={previewDoc.nome_arquivo || previewDoc.tipo}
                  className="w-full h-auto max-h-[85vh] object-contain"
                />
              ) : /\.pdf$/i.test(previewUrl) ? (
                <iframe
                  src={previewUrl}
                  title={previewDoc.nome_arquivo || previewDoc.tipo}
                  className="w-full h-[85vh]"
                />
              ) : (
                <div className="p-8 text-center">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="mb-4">{previewDoc.nome_arquivo || previewDoc.tipo}</p>
                  <Button onClick={() => window.open(previewUrl, '_blank')}>
                    Abrir em nova aba
                  </Button>
                </div>
              )}
            </>
            );
          })()}
        </DialogContent>
      </Dialog>
      {/* Lightbox de fotos da auto-vistoria */}
      {(() => {
        const allUrls: string[] = (linkEvento as any)?.dados_etapa1?.arquivos_urls || [];
        const imageUrls = allUrls.filter((u: string) => !/\.(mp4|webm|mov)$/i.test(u));
        const fotos = imageUrls.map((url: string, i: number) => ({
          url: resolverUrl(url),
          label: `Foto ${i + 1}`,
        }));
        return (
          <VisualizadorFoto
            fotos={fotos}
            indexInicial={fotoViewer.index}
            open={fotoViewer.open}
            onClose={() => setFotoViewer({ open: false, index: 0 })}
          />
        );
      })()}
    </div>
  );
}
