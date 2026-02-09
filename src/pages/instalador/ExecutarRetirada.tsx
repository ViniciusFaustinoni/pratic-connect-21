import { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Camera, Check, AlertTriangle, 
  Gauge, CheckCircle2, Loader2, Car, Video,
  ChevronDown, ChevronUp, MessageSquare, PackageMinus,
  MessageCircle, Phone, MapPin, Play, UserX, Info,
  AlertCircle, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FotoCapture } from '@/components/instalador/FotoCapture';
import { VideoCapture } from '@/components/instalador/VideoCapture';
import { SignaturePad } from '@/components/instalador/SignaturePad';
import { TemporizadorExecucao } from '@/components/vistoriador/TemporizadorExecucao';
import { ChecklistRetirada, type ChecklistRetiradaItem } from '@/components/instalador/ChecklistRetirada';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useIniciarServicoMutation } from '@/hooks/useServicos';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  MOTIVO_RETIRADA_LABELS, 
  SUB_TIPO_RETIRADA_LABELS,
  INTEGRIDADE_APARELHO_LABELS,
  INTEGRIDADE_APARELHO_COLORS,
  type IntegridadeAparelho,
  type MotivoRetirada,
  type SubTipoRetirada,
} from '@/types/retirada';

// Fotos obrigatórias específicas de retirada
const FOTOS_RETIRADA = [
  { id: 'rastreador_removido', nome: 'Rastreador Removido', obrigatoria: true, descricao: 'Foto do aparelho na mão' },
  { id: 'fios_isolados', nome: 'Fios Isolados', obrigatoria: true, descricao: 'Foto dos fios cortados e isolados' },
  { id: 'acabamento_recolocado', nome: 'Acabamento Recolocado', obrigatoria: true, descricao: 'Foto do painel remontado' },
  { id: 'estado_aparelho', nome: 'Estado do Aparelho', obrigatoria: false, descricao: 'Foto geral do aparelho' },
  { id: 'dano_aparelho', nome: 'Dano (se houver)', obrigatoria: false, descricao: 'Foto de qualquer dano visível' },
];

const MOTIVO_COLORS: Record<string, string> = {
  cancelamento_voluntario: 'bg-gray-600 text-white',
  inadimplencia: 'bg-red-600 text-white',
  exclusao_diretoria: 'bg-purple-600 text-white',
  substituicao_veiculo: 'bg-blue-600 text-white',
  busca_apreensao: 'bg-orange-600 text-white',
};

export default function ExecutarRetirada() {
  const { id: servicoId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  // Buscar dados do serviço
  const { data: servico, isLoading, error } = useQuery({
    queryKey: ['servico-retirada', servicoId],
    queryFn: async () => {
      if (!servicoId) return null;
      const { data, error } = await supabase
        .from('servicos')
        .select(`
          *,
          associado:associados!servicos_associado_id_fkey(id, nome, telefone, cpf, whatsapp),
          veiculo:veiculos!servicos_veiculo_id_fkey(id, placa, marca, modelo, cor, chassi),
          rastreador:rastreadores!servicos_rastreador_id_fkey(id, codigo, imei, plataforma),
          novo_veiculo:veiculos!servicos_novo_veiculo_id_fkey(id, placa, marca, modelo)
        `)
        .eq('id', servicoId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!servicoId,
  });

  // Buscar fotos da instalação original
  const { data: instalacaoOriginal, isLoading: loadingInstalacao } = useQuery({
    queryKey: ['instalacao-original', servico?.rastreador?.id],
    queryFn: async () => {
      if (!servico?.rastreador?.id) return null;
      
      const { data, error } = await supabase
        .from('servicos')
        .select(`
          id, observacoes, created_at, checklist_data,
          profissional:profiles!servicos_profissional_id_fkey(nome)
        `)
        .eq('rastreador_id', servico.rastreador.id)
        .eq('tipo', 'instalacao')
        .eq('status', 'concluida')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error || !data) return null;

      // Buscar fotos associadas
      const { data: fotos } = await supabase
        .from('servico_fotos')
        .select('tipo, arquivo_url')
        .eq('servico_id', data.id);
      
      return { ...data, fotos: fotos || [] };
    },
    enabled: !!servico?.rastreador?.id,
  });

  // Hook para iniciar serviço
  const { mutate: iniciarServico, isPending: isIniciando } = useIniciarServicoMutation();

  // Estados
  const [uploadingFoto, setUploadingFoto] = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [showConfirmacao, setShowConfirmacao] = useState(false);
  
  // Checklist de retirada
  const [checklistItems, setChecklistItems] = useState<ChecklistRetiradaItem[]>([]);
  const [checklistCompleto, setChecklistCompleto] = useState(false);
  
  // Conferência de dados
  const [conferencia, setConferencia] = useState({
    placa: false, chassi: false, modelo: false, cor: false,
  });
  const [hodometro, setHodometro] = useState('');
  const [observacoes, setObservacoes] = useState('');
  
  // Integridade do aparelho
  const [integridade, setIntegridade] = useState<IntegridadeAparelho | null>(null);
  const [obsIntegridade, setObsIntegridade] = useState('');
  
  // Uploads
  const [assinaturaUrl, setAssinaturaUrl] = useState<string | null>(null);
  const [fotosEnviadas, setFotosEnviadas] = useState<Record<string, string>>({});
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const veiculo = servico?.veiculo;
  const associado = servico?.associado;
  const rastreador = servico?.rastreador;
  const novoVeiculo = servico?.novo_veiculo;

  // Status checks
  const isAgendada = servico?.status === 'agendada';
  const isEmAndamento = servico?.status === 'em_andamento';
  const motivoRetirada = servico?.motivo_retirada as MotivoRetirada | undefined;
  const subTipoRetirada = servico?.sub_tipo_retirada as SubTipoRetirada | undefined;

  // Callbacks para checklist
  const handleChecklistComplete = useCallback(() => {
    setChecklistCompleto(true);
  }, []);

  const handleChecklistChange = useCallback((items: ChecklistRetiradaItem[]) => {
    setChecklistItems(items);
    const allChecked = items.every(item => item.checked);
    setChecklistCompleto(allChecked);
  }, []);

  // Funções de contato
  const abrirWhatsApp = () => {
    const numero = associado?.whatsapp || associado?.telefone;
    if (numero) {
      const numeroLimpo = numero.replace(/\D/g, '');
      const mensagem = encodeURIComponent(
        `Olá ${associado?.nome?.split(' ')[0] || ''}, sou o técnico da PRATIC. ` +
        `Estou no local para realizar a retirada do rastreador. Podemos confirmar?`
      );
      window.open(`https://wa.me/55${numeroLimpo}?text=${mensagem}`, '_blank');
    }
  };

  const ligarCliente = () => {
    if (associado?.telefone) {
      window.open(`tel:${associado.telefone}`, '_self');
    }
  };

  // Contagem de fotos obrigatórias
  const fotosObrigatoriasEnviadas = useMemo(() => {
    return FOTOS_RETIRADA
      .filter(f => f.obrigatoria)
      .filter(f => fotosEnviadas[f.id])
      .length;
  }, [fotosEnviadas]);

  const totalFotosObrigatorias = FOTOS_RETIRADA.filter(f => f.obrigatoria).length;
  const todasFotosObrigatoriasEnviadas = fotosObrigatoriasEnviadas >= totalFotosObrigatorias;

  // Validação
  const conferenciaCompleta = Object.values(conferencia).every(Boolean) && hodometro.length > 0;
  const videoEnviado = !!videoUrl;
  const assinaturaEnviada = !!assinaturaUrl;
  const integridadeValida = integridade !== null && 
    (integridade === 'integro' || obsIntegridade.trim().length > 0);

  const podeConfirmar = 
    isEmAndamento &&
    conferenciaCompleta && 
    checklistCompleto && 
    todasFotosObrigatoriasEnviadas && 
    videoEnviado && 
    assinaturaEnviada && 
    integridadeValida;

  // Handler para "Cheguei no Local"
  const handleCheguei = () => {
    if (servicoId) {
      iniciarServico(servicoId, {
        onSuccess: () => {
          toast.success('Chegada registrada! Agora você pode realizar a retirada.');
        }
      });
    }
  };

  // Handler para "Associado Ausente"
  const handleNaoCompareceu = async () => {
    if (!servicoId) return;
    setProcessando(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase
        .from('servicos')
        .update({
          status: 'nao_compareceu' as any,
          updated_at: new Date().toISOString(),
        })
        .eq('id', servicoId);
      
      if (error) throw error;
      
      toast.success('Registrado como não compareceu. Coordenador será notificado.');
      queryClient.invalidateQueries({ queryKey: ['tarefa-atual-servico'] });
      navigate('/instalador/tarefas');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao registrar ausência');
    } finally {
      setProcessando(false);
    }
  };

  // Upload de foto
  const handleUploadFoto = async (tipo: string, file: File) => {
    if (!servicoId) return;
    setUploadingFoto(tipo);
    try {
      const fileName = `retirada/${servicoId}/${tipo}_${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('vistorias')
        .upload(fileName, file);
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage.from('vistorias').getPublicUrl(fileName);
      setFotosEnviadas(prev => ({ ...prev, [tipo]: publicUrl }));
      toast.success('Foto enviada!');
    } catch (e) {
      toast.error('Erro ao enviar foto');
    } finally {
      setUploadingFoto(null);
    }
  };

  // Upload de vídeo
  const handleUploadVideo = async (file: File) => {
    if (!servicoId) return;
    setUploadingVideo(true);
    try {
      const fileName = `retirada/${servicoId}/video_360_${Date.now()}.mp4`;
      const { error: uploadError } = await supabase.storage
        .from('vistorias')
        .upload(fileName, file);
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage.from('vistorias').getPublicUrl(fileName);
      setVideoUrl(publicUrl);
      toast.success('Vídeo enviado!');
    } catch (e) {
      toast.error('Erro ao enviar vídeo');
    } finally {
      setUploadingVideo(false);
    }
  };

  // Upload de assinatura
  const handleAssinatura = async (file: File) => {
    if (!servicoId) return;
    try {
      const fileName = `retirada/${servicoId}/assinatura_${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from('vistorias')
        .upload(fileName, file);
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage.from('vistorias').getPublicUrl(fileName);
      setAssinaturaUrl(publicUrl);
      toast.success('Assinatura capturada!');
    } catch (e) {
      toast.error('Erro ao capturar assinatura');
    }
  };

  // Concluir retirada
  const handleConcluir = async () => {
    if (!servicoId || !rastreador || !veiculo || !profile) return;
    setProcessando(true);
    try {
      const { data, error } = await supabase.functions.invoke('concluir-retirada', {
        body: {
          servicoId,
          rastreadorId: rastreador.id,
          veiculoId: veiculo.id,
          profissionalId: profile.id,
          hodometro: parseInt(hodometro),
          assinaturaUrl,
          observacoes: observacoes.trim() || undefined,
          // Novos campos
          integridade,
          obsIntegridade: integridade !== 'integro' ? obsIntegridade : undefined,
          checklistRetirada: checklistItems,
          videoUrl,
          fotosUrls: Object.values(fotosEnviadas),
          criarNovaInstalacao: subTipoRetirada === 'retirada_com_nova_instalacao',
          novoVeiculoId: servico?.novo_veiculo_id,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao concluir');

      queryClient.invalidateQueries({ queryKey: ['tarefa-atual-servico'] });
      setShowConfirmacao(true);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao concluir retirada');
    } finally {
      setProcessando(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !servico) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-900 p-4 max-w-md mx-auto">
        <AlertTriangle className="h-12 w-12 text-red-500" />
        <p className="text-center text-slate-300">Serviço não encontrado.</p>
        <Button onClick={() => navigate('/instalador/tarefas')}>Voltar</Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-900 pb-56 max-w-md mx-auto">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-700 bg-slate-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/instalador/tarefas')} className="text-slate-400">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <PackageMinus className="h-4 w-4 text-red-400" />
              Retirada de Rastreador
            </p>
            <p className="text-xs text-slate-400 truncate">{associado?.nome} | {veiculo?.placa}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={abrirWhatsApp}
            disabled={!associado?.whatsapp && !associado?.telefone}
            className="text-green-500 hover:text-green-400 hover:bg-green-500/10"
          >
            <MessageCircle className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={ligarCliente}
            disabled={!associado?.telefone}
            className="text-slate-400"
          >
            <Phone className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Progresso */}
      <div className="border-b border-slate-700 bg-slate-800 px-4 py-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Fotos obrigatórias:</span>
          <span className="font-medium text-white">{fotosObrigatoriasEnviadas}/{totalFotosObrigatorias}</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-700">
          <div 
            className="h-full bg-red-500 transition-all"
            style={{ width: `${(fotosObrigatoriasEnviadas / totalFotosObrigatorias) * 100}%` }}
          />
        </div>
      </div>

      {servico?.iniciada_em && (
        <TemporizadorExecucao iniciadaEm={servico.iniciada_em} className="mx-4 mt-2" />
      )}

      <main className="flex-1 space-y-4 p-4">
        {/* SEÇÃO 1: Localização do Rastreador (fotos da instalação) */}
        <Card className="border-amber-600/50 bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-amber-400">
              <MapPin className="h-5 w-5" />
              Localização do Rastreador no Veículo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingInstalacao ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
              </div>
            ) : instalacaoOriginal?.fotos && instalacaoOriginal.fotos.length > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {instalacaoOriginal.fotos.slice(0, 6).map((foto, index) => (
                    <img
                      key={index}
                      src={foto.arquivo_url}
                      alt={`Foto instalação ${index + 1}`}
                      className="h-20 w-full rounded-lg object-cover border border-slate-600"
                    />
                  ))}
                </div>
                {instalacaoOriginal.observacoes && (
                  <div className="rounded-lg bg-slate-800 p-3 border border-slate-700">
                    <p className="text-xs text-slate-400 mb-1">Observação do instalador:</p>
                    <p className="text-sm text-white italic">"{instalacaoOriginal.observacoes}"</p>
                  </div>
                )}
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Instalado em: {format(new Date(instalacaoOriginal.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                  </span>
                  {instalacaoOriginal.profissional && (
                    <span>Por: {instalacaoOriginal.profissional.nome}</span>
                  )}
                </div>
              </div>
            ) : (
              <Alert className="border-yellow-600 bg-yellow-950/30">
                <AlertCircle className="h-4 w-4 text-yellow-400" />
                <AlertTitle className="text-yellow-400">Fotos não encontradas</AlertTitle>
                <AlertDescription className="text-yellow-200/80">
                  Fotos de instalação não encontradas. Consulte o coordenador antes de prosseguir.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* SEÇÃO 2: Informações do Serviço de Retirada */}
        <Card className="border-slate-700 bg-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-white">
              <PackageMinus className="h-5 w-5 text-red-400" />
              Informações da Retirada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-slate-400">Motivo</span>
                {motivoRetirada && (
                  <Badge className={cn("mt-1 block w-fit", MOTIVO_COLORS[motivoRetirada])}>
                    {MOTIVO_RETIRADA_LABELS[motivoRetirada]}
                  </Badge>
                )}
              </div>
              <div>
                <span className="text-xs text-slate-400">Subtipo</span>
                <p className="text-sm text-white mt-1">
                  {subTipoRetirada ? SUB_TIPO_RETIRADA_LABELS[subTipoRetirada] : 'Somente Retirada'}
                </p>
              </div>
            </div>
            
            {subTipoRetirada === 'retirada_com_nova_instalacao' && novoVeiculo && (
              <Alert className="border-blue-600 bg-blue-950/30">
                <RefreshCw className="h-4 w-4 text-blue-400" />
                <AlertTitle className="text-blue-400">Nova Instalação Pendente</AlertTitle>
                <AlertDescription className="text-blue-200/80">
                  Após retirada, instalar no veículo: <strong>{novoVeiculo.marca} {novoVeiculo.modelo}</strong> - Placa: <strong>{novoVeiculo.placa}</strong>
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-700">
              <div>
                <span className="text-xs text-slate-400">Rastreador</span>
                <p className="text-sm font-mono text-white">{rastreador?.codigo}</p>
              </div>
              <div>
                <span className="text-xs text-slate-400">IMEI</span>
                <p className="text-sm font-mono text-white">{rastreador?.imei || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Botão "Cheguei no Local" - apenas se status = agendada */}
        {isAgendada && (
          <Button 
            className="w-full bg-blue-600 hover:bg-blue-700 py-6 text-lg" 
            onClick={handleCheguei}
            disabled={isIniciando}
          >
            {isIniciando ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Registrando...
              </>
            ) : (
              <>
                <Play className="mr-2 h-5 w-5" />
                Cheguei no Local
              </>
            )}
          </Button>
        )}

        {/* Seções de execução - apenas se status = em_andamento */}
        {isEmAndamento && (
          <>
            {/* Checklist de Retirada */}
            <ChecklistRetirada
              onComplete={handleChecklistComplete}
              onChecklistChange={handleChecklistChange}
              disabled={false}
            />

            {/* Conferência de Dados */}
            <Card className="border-slate-700 bg-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <Car className="h-5 w-5 text-blue-400" />
                  Conferência de Dados
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { key: 'placa', label: 'Placa', value: veiculo?.placa },
                  { key: 'chassi', label: 'Chassi', value: veiculo?.chassi },
                  { key: 'modelo', label: 'Modelo', value: `${veiculo?.marca} ${veiculo?.modelo}` },
                  { key: 'cor', label: 'Cor', value: veiculo?.cor || 'Não informada' },
                ].map(item => (
                  <div key={item.key} className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900 p-2">
                    <Checkbox
                      checked={conferencia[item.key as keyof typeof conferencia]}
                      onCheckedChange={(c) => setConferencia(prev => ({ ...prev, [item.key]: !!c }))}
                    />
                    <span className="flex-1 text-sm text-slate-300">{item.label}: <span className="font-medium text-white">{item.value}</span></span>
                  </div>
                ))}
                <div>
                  <Label className="text-slate-300">Hodômetro (km)</Label>
                  <Input
                    type="number"
                    placeholder="Ex: 45000"
                    value={hodometro}
                    onChange={(e) => setHodometro(e.target.value)}
                    className="mt-1 border-slate-600 bg-slate-900 text-white"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Fotos de Retirada */}
            <Card className="border-slate-700 bg-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base text-white">
                  <div className="flex items-center gap-2">
                    <Camera className="h-5 w-5 text-blue-400" />
                    Fotos da Retirada
                  </div>
                  <span className={cn("text-sm", todasFotosObrigatoriasEnviadas ? "text-green-400" : "text-slate-400")}>
                    {fotosObrigatoriasEnviadas}/{totalFotosObrigatorias} obrigatórias
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2">
                  {FOTOS_RETIRADA.map(foto => (
                    <FotoCapture
                      key={foto.id}
                      tipo={foto.id}
                      label={foto.nome}
                      obrigatoria={foto.obrigatoria}
                      fotoUrl={fotosEnviadas[foto.id]}
                      uploading={uploadingFoto === foto.id}
                      onCapture={(file) => handleUploadFoto(foto.id, file)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Integridade do Aparelho */}
            <Card className="border-slate-700 bg-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <Gauge className="h-5 w-5 text-orange-400" />
                  Estado do Aparelho Retirado
                  {integridade && <CheckCircle2 className="h-4 w-4 text-green-400" />}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <RadioGroup value={integridade || ''} onValueChange={(v) => setIntegridade(v as IntegridadeAparelho)}>
                  {(['integro', 'danificado', 'violado', 'molhado'] as IntegridadeAparelho[]).map(status => (
                    <div
                      key={status}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                        integridade === status 
                          ? "border-blue-500 bg-blue-950/30" 
                          : "border-slate-700 hover:border-slate-600"
                      )}
                      onClick={() => setIntegridade(status)}
                    >
                      <RadioGroupItem value={status} id={status} className="border-slate-500" />
                      <div className="flex-1">
                        <Label htmlFor={status} className="text-white cursor-pointer flex items-center gap-2">
                          <Badge className={INTEGRIDADE_APARELHO_COLORS[status]}>
                            {INTEGRIDADE_APARELHO_LABELS[status]}
                          </Badge>
                        </Label>
                      </div>
                    </div>
                  ))}
                </RadioGroup>

                {integridade && integridade !== 'integro' && (
                  <div className="space-y-2">
                    <Alert className="border-red-600 bg-red-950/30">
                      <AlertTriangle className="h-4 w-4 text-red-400" />
                      <AlertDescription className="text-red-200/80">
                        Multa de R$ 400,00 será sugerida automaticamente. Rastreador irá para triagem.
                      </AlertDescription>
                    </Alert>
                    <div>
                      <Label className="text-slate-300">Descreva o problema encontrado *</Label>
                      <Textarea
                        placeholder="Detalhe o dano, violação ou condição do aparelho..."
                        value={obsIntegridade}
                        onChange={(e) => setObsIntegridade(e.target.value)}
                        className="mt-1 resize-none border-slate-600 bg-slate-900 text-white min-h-[80px]"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Vídeo 360 */}
            <Card className="border-slate-700 bg-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <Video className="h-5 w-5 text-purple-400" />
                  Vídeo 360° Obrigatório
                  {videoEnviado && <CheckCircle2 className="h-4 w-4 text-green-400" />}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <VideoCapture onCapture={handleUploadVideo} videoUrl={videoUrl} uploading={uploadingVideo} maxDuration={120} />
              </CardContent>
            </Card>

            {/* Assinatura */}
            <Card className="border-slate-700 bg-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  ✍️ Assinatura do Cliente
                  {assinaturaEnviada && <CheckCircle2 className="h-4 w-4 text-green-400" />}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SignaturePad onSave={handleAssinatura} disabled={!!assinaturaUrl} />
              </CardContent>
            </Card>

            {/* Observações */}
            <Card className="border-slate-700 bg-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <MessageSquare className="h-5 w-5 text-amber-400" />
                  Observações (opcional)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Registre observações sobre a retirada..."
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className="resize-none border-slate-600 bg-slate-900 text-white min-h-[80px]"
                />
              </CardContent>
            </Card>
          </>
        )}
      </main>

      {/* Footer */}
      {isEmAndamento && (
        <footer className="fixed bottom-16 left-0 right-0 border-t border-slate-700 bg-slate-800 p-4 pb-2 space-y-2 z-40 max-w-md mx-auto">
          <Button 
            onClick={handleConcluir} 
            disabled={!podeConfirmar || processando} 
            className="w-full bg-red-600 hover:bg-red-700"
          >
            {processando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Concluir Retirada
          </Button>
          
          <Button
            variant="outline"
            className="w-full border-orange-600 text-orange-400 hover:bg-orange-950/30"
            onClick={handleNaoCompareceu}
            disabled={processando}
          >
            <UserX className="mr-2 h-4 w-4" />
            Associado Ausente
          </Button>

          {!podeConfirmar && (
            <p className="text-center text-xs text-amber-400">
              {!checklistCompleto && 'Complete o checklist. '}
              {!conferenciaCompleta && 'Confirme os dados. '}
              {!todasFotosObrigatoriasEnviadas && `Faltam ${totalFotosObrigatorias - fotosObrigatoriasEnviadas} fotos. `}
              {!videoEnviado && 'Envie o vídeo. '}
              {!assinaturaEnviada && 'Capture assinatura. '}
              {!integridadeValida && 'Selecione integridade.'}
            </p>
          )}
        </footer>
      )}

      {showConfirmacao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <Card className="w-full max-w-md border-green-500 bg-slate-800">
            <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500">
                <CheckCircle2 className="h-10 w-10 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">Retirada Concluída!</h2>
              <p className="text-slate-400">
                {integridade === 'integro' 
                  ? 'O rastreador foi devolvido ao seu estoque.'
                  : 'O rastreador foi encaminhado para triagem/bancada.'}
              </p>
              {subTipoRetirada === 'retirada_com_nova_instalacao' && (
                <p className="text-blue-400 text-sm">
                  Uma nova ordem de instalação foi criada para o veículo substituto.
                </p>
              )}
              <Button onClick={() => navigate('/instalador/tarefas')} className="mt-4 w-full bg-blue-600 hover:bg-blue-700">
                Voltar para Tarefas
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
