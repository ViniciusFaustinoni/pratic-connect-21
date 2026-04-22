import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Camera, Check, AlertTriangle, 
  Gauge, CheckCircle2, Loader2, Car, Video,
  ChevronDown, ChevronUp, XCircle, MapPin, Lock, ShieldCheck, ShieldX, MessageSquare,
  MessageCircle, Phone, CloudUpload
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { VistoriaFotoSequencial } from '@/components/vistorias/VistoriaFotoSequencial';
import { VideoCapture } from '@/components/instalador/VideoCapture';
import { ModalRecusaVeiculoComFotos } from '@/components/instalador/ModalRecusaVeiculoComFotos';
import { TemporizadorExecucao } from '@/components/vistoriador/TemporizadorExecucao';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useVistoriaCompleta, useSalvarRascunhoVistoriaCompleta, DadosParciaisVistoria, useVistoriaCompletaPorServico, useVistoriaCompletaPorAgendamentoBase } from '@/hooks/useVistorias';
import { 
  useAprovarVeiculoVistoria, 
  useRecusarVeiculoVistoria, 
  useUploadVideo360,
  useUploadFotoVistoriaCompleta 
} from '@/hooks/useVistoriaCompleta';
import { useUploadVistoriaOffline } from '@/hooks/useUploadVistoriaOffline';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { 
  agruparFotosPorCategoriaCompleta, 
  agruparFotosFiltradas,
  detectarTipoVeiculo,
  getTotalFotosObrigatorias,
  getFotosFiltradas
} from '@/data/vistoriaConfigCompleta';
import { useConfigFipeRastreador, useConfigFipeRastreadorMoto, precisaRastreador } from '@/hooks/useConfigRastreador';
import { compressImage } from '@/lib/imageCompressor';
import { useDeviceCapability } from '@/hooks/useDeviceCapability';

export default function ExecutarVistoriaCompleta() {
  // A rota /instalador/vistoria/:id agora recebe o ID do SERVIÇO (servicos.id),
  // vindo de useTarefaAtual/TarefaAtualCard. O hook resolve a vistoria associada
  // (suporta tarefas materializadas a partir de agendamentos_base, instalações
  // e cotações). Mantemos o nome `instalacaoId` por compat com o restante do arquivo.
  const { id: routeId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // 1) Tenta resolver via serviço (caminho atual / fluxo base + reatribuição)
  const vistoriaPorServicoQuery = useVistoriaCompletaPorServico(routeId || null);
  // 2) Fallback: se o ID for um instalacao_id (rotas antigas), tenta o hook legado
  const vistoriaPorInstalacaoQuery = useVistoriaCompleta(
    !vistoriaPorServicoQuery.data && !vistoriaPorServicoQuery.isLoading ? routeId || null : null
  );
  // 3) Fallback final: vistoria de base atribuída via mapa — o ID na rota é
  //    `agendamentos_base.id`, e a vistoria real fica em `agendamentos_base.vistoria_id`.
  const vistoriaPorAgendamentoBaseQuery = useVistoriaCompletaPorAgendamentoBase(
    !vistoriaPorServicoQuery.data &&
    !vistoriaPorServicoQuery.isLoading &&
    !vistoriaPorInstalacaoQuery.data &&
    !vistoriaPorInstalacaoQuery.isLoading
      ? routeId || null
      : null
  );

  const vistoria =
    vistoriaPorServicoQuery.data ||
    vistoriaPorInstalacaoQuery.data ||
    vistoriaPorAgendamentoBaseQuery.data;
  const isLoading =
    vistoriaPorServicoQuery.isLoading ||
    vistoriaPorInstalacaoQuery.isLoading ||
    vistoriaPorAgendamentoBaseQuery.isLoading;
  const error =
    vistoriaPorServicoQuery.error ||
    vistoriaPorInstalacaoQuery.error ||
    vistoriaPorAgendamentoBaseQuery.error;
  const instalacaoId = (vistoria as any)?.instalacao_id ?? routeId;
  const { data: fipeMinRastreador = 30000 } = useConfigFipeRastreador();
  const { data: fipeMinRastreadorMoto = 9000 } = useConfigFipeRastreadorMoto();
  const uploadFoto = useUploadFotoVistoriaCompleta();
  const uploadVideo = useUploadVideo360();
  const aprovarVeiculo = useAprovarVeiculoVistoria();
  const recusarVeiculo = useRecusarVeiculoVistoria();
  const salvarRascunho = useSalvarRascunhoVistoriaCompleta();
  const online = useOnlineStatus();
  const offlineQueue = useUploadVistoriaOffline(
    (vistoriaPorServicoQuery.data || vistoriaPorInstalacaoQuery.data || vistoriaPorAgendamentoBaseQuery.data)?.id
  );


  // Estado
  const [uploadingFoto, setUploadingFoto] = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState<number>(0);
  const [showRecusaModal, setShowRecusaModal] = useState(false);
  const [showConfirmacao, setShowConfirmacao] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [openCategories, setOpenCategories] = useState<string[]>(['identificacao_motor']);
  const [salvando, setSalvando] = useState(false);
  const [dadosRestaurados, setDadosRestaurados] = useState(false);
  const restauradoToastRef = useRef(false);
  const capability = useDeviceCapability();

  // Telemetria de capacidade do dispositivo + alerta de restauração após OOM
  useEffect(() => {
    console.log(
      `[Vistoria] Capacidade do dispositivo: deviceMemory=${capability.deviceMemory ?? '?'}GB cores=${capability.hardwareConcurrency ?? '?'} lowEnd=${capability.lowEnd} heap=${capability.usedHeapMB ?? '?'}MB wasDiscarded=${capability.wasDiscarded}`
    );
    if (capability.wasDiscarded && !restauradoToastRef.current) {
      restauradoToastRef.current = true;
      toast.info('Continuamos de onde você parou.', {
        description: 'O app foi recarregado por falta de memória, mas suas fotos e dados foram preservados.',
        duration: 6000,
      });
    }
  }, [capability]);
  
  const [conferencia, setConferencia] = useState({
    placa: false, chassi: false, modelo: false, cor: false,
  });
  const [hodometro, setHodometro] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // Dados
  const vistoriaId = vistoria?.id;
  const veiculo = vistoria?.veiculo;
  const associado = vistoria?.associado || vistoria?.veiculo?.associado;
  const fotosServidor = vistoria?.fotos || [];
  const video360UrlServidor = (vistoria as any)?.video_360_url;

  // Combina fotos do servidor com previews locais (pendentes na fila)
  const fotosEnviadas = useMemo(() => {
    const map = new Map<string, { tipo: string; arquivo_url: string }>();
    fotosServidor.forEach((f: any) => map.set(f.tipo, { tipo: f.tipo, arquivo_url: f.arquivo_url }));
    Object.entries(offlineQueue.previewsFotos).forEach(([tipo, url]) => {
      if (!map.has(tipo)) map.set(tipo, { tipo, arquivo_url: url });
    });
    return Array.from(map.values());
  }, [fotosServidor, offlineQueue.previewsFotos]);

  const video360Url = video360UrlServidor || offlineQueue.previewVideo;

  // ========== RESTAURAR DADOS SALVOS ==========
  useEffect(() => {
    if (vistoria && !dadosRestaurados) {
      const dadosParciais = (vistoria as any).dados_parciais as DadosParciaisVistoria | null;
      
      // Restaurar conferência
      if (dadosParciais?.conferencia) {
        setConferencia(dadosParciais.conferencia);
      }
      
      // Restaurar hodômetro (prioridade: km_atual > dados_parciais)
      if (vistoria.km_atual) {
        setHodometro(String(vistoria.km_atual));
      } else if (dadosParciais?.hodometro) {
        setHodometro(dadosParciais.hodometro);
      }
      
      // Restaurar observações (prioridade: observacoes > dados_parciais)
      if (vistoria.observacoes) {
        setObservacoes(vistoria.observacoes);
      } else if (dadosParciais?.observacoes) {
        setObservacoes(dadosParciais.observacoes);
      }
      
      // Restaurar categorias abertas
      if (dadosParciais?.openCategories && dadosParciais.openCategories.length > 0) {
        setOpenCategories(dadosParciais.openCategories);
      }
      
      setDadosRestaurados(true);
      console.log('[Vistoria] Dados restaurados:', { dadosParciais, km_atual: vistoria.km_atual });
    }
  }, [vistoria, dadosRestaurados]);

  // ========== AUTO-SAVE COM DEBOUNCE ==========
  useEffect(() => {
    // Não salvar se não tiver vistoriaId ou dados ainda não foram restaurados
    if (!vistoriaId || !dadosRestaurados) return;
    
    // Não salvar se a vistoria já foi finalizada
    if (['aprovada', 'reprovada'].includes(vistoria?.status || '')) return;

    setSalvando(true);
    
    const timeoutId = setTimeout(() => {
      salvarRascunho.mutate({
        vistoriaId,
        dadosParciais: {
          conferencia,
          hodometro,
          observacoes,
          openCategories,
        },
        hodometro: hodometro ? parseInt(hodometro, 10) : undefined,
        observacoes: observacoes || undefined,
      }, {
        onSettled: () => setSalvando(false),
      });
    }, 2000); // Debounce de 2 segundos

    return () => {
      clearTimeout(timeoutId);
      setSalvando(false);
    };
  }, [conferencia, hodometro, observacoes, openCategories, vistoriaId, dadosRestaurados]);

  // Funções de contato
  const abrirWhatsApp = () => {
    const assoc = associado as { whatsapp?: string | null; telefone?: string; nome?: string } | null;
    const numero = assoc?.whatsapp || assoc?.telefone;
    if (numero) {
      const numeroLimpo = numero.replace(/\D/g, '');
      const mensagem = encodeURIComponent(
        `Olá ${assoc?.nome?.split(' ')[0] || ''}, sou o técnico da PRATIC. ` +
        `Estou no local para realizar o serviço. Podemos confirmar?`
      );
      window.open(`https://wa.me/55${numeroLimpo}?text=${mensagem}`, '_blank');
    }
  };

  const ligarCliente = () => {
    if (associado?.telefone) {
      const numeroLimpo = associado.telefone.replace(/\D/g, '');
      window.location.href = `tel:${numeroLimpo}`;
    }
  };

  const hasWhatsApp = !!(associado as any)?.whatsapp || !!associado?.telefone;
  
  // Verificar se precisa de rastreador baseado no valor FIPE
  const valorFipeVeiculo = useMemo(() => {
    return (veiculo as any)?.valor_fipe || null;
  }, [veiculo]);

  // Detectar tipo de veículo usando tipo_veiculo, modelo e marca
  const tipoVeiculoDetectado = useMemo(() => {
    const resultado = detectarTipoVeiculo(
      (veiculo as any)?.tipo_veiculo,
      (veiculo as any)?.modelo,
      (veiculo as any)?.marca
    );
    console.log('[ExecutarVistoria] Deteccao tipo veiculo:', { modelo: (veiculo as any)?.modelo, marca: (veiculo as any)?.marca, resultado });
    return resultado;
  }, [(veiculo as any)?.modelo, (veiculo as any)?.marca]);
  
  const veiculoPrecisaRastreador = useMemo(() => {
    return precisaRastreador(valorFipeVeiculo, fipeMinRastreador, tipoVeiculoDetectado, fipeMinRastreadorMoto);
  }, [valorFipeVeiculo, fipeMinRastreador, tipoVeiculoDetectado, fipeMinRastreadorMoto]);
  
  // Categorias filtradas baseado na necessidade de rastreador
  const categorias = useMemo(() => agruparFotosFiltradas(tipoVeiculoDetectado, veiculoPrecisaRastreador), [tipoVeiculoDetectado, veiculoPrecisaRastreador]);

  // Mapa de fotos
  const fotosMap = useMemo(() => {
    const map: Record<string, string> = {};
    fotosEnviadas.forEach((f: any) => { map[f.tipo] = f.arquivo_url; });
    return map;
  }, [fotosEnviadas]);

  // Contagem de fotos por categoria
  const fotosPorCategoria = useMemo(() => {
    const counts: Record<string, { total: number; enviadas: number }> = {};
    categorias.forEach(cat => {
      const total = cat.fotos.length;
      const enviadas = cat.fotos.filter(f => fotosMap[f.id]).length;
      counts[cat.id] = { total, enviadas };
    });
    return counts;
  }, [categorias, fotosMap]);

  // Total de fotos obrigatórias e enviadas — dinâmico por tipo de veículo
  const totalFotosObrigatorias = useMemo(
    () => getTotalFotosObrigatorias(tipoVeiculoDetectado),
    [tipoVeiculoDetectado]
  );

  const fotosObrigatoriasDoTipo = useMemo(
    () => getFotosFiltradas(tipoVeiculoDetectado, false),
    [tipoVeiculoDetectado]
  );

  const totalFotosEnviadas = useMemo(
    () => fotosObrigatoriasDoTipo.filter(f => fotosMap[f.id]).length,
    [fotosObrigatoriasDoTipo, fotosMap]
  );

  // Validação
  const conferenciaCompleta = Object.values(conferencia).every(Boolean) && hodometro.length > 0;
  const todasFotosEnviadas = totalFotosEnviadas >= totalFotosObrigatorias;
  const videoEnviado = !!video360Url;
  const podeAprovar = conferenciaCompleta && todasFotosEnviadas && videoEnviado;

  // Handlers
  const handleUploadFoto = async (tipo: string, file: File, visivelCliente: boolean = true) => {
    if (!vistoriaId) return;
    // Comprime ANTES de qualquer envio/enfileiramento — reduz heap, banda e quota IndexedDB.
    // Fotos da câmera vêm de 5-12 MB; após compressão ficam 250-700 KB conforme perfil do device.
    let arquivoFinal = file;
    try {
      if (file.size > 250 * 1024) {
        arquivoFinal = await compressImage(file);
      }
    } catch (err) {
      console.warn('[Vistoria] Falha ao comprimir, usando original:', err);
    }
    // Offline: enfileira direto
    if (!online || !navigator.onLine) {
      await offlineQueue.enfileirarFoto(tipo, arquivoFinal);
      return;
    }
    setUploadingFoto(tipo);
    try {
      await uploadFoto.mutateAsync({ vistoriaId, tipo, file: arquivoFinal, visivelCliente });
      toast.success('Foto enviada!');
    } catch (e: any) {
      // Falha de rede → enfileira para reenvio automático
      console.warn('[Vistoria] Upload falhou, enfileirando offline:', e?.message);
      await offlineQueue.enfileirarFoto(tipo, arquivoFinal);
    } finally {
      setUploadingFoto(null);
    }
  };

  const handleUploadVideo = async (file: File) => {
    if (!vistoriaId) return;
    // Aviso informativo — sem compressão (custosa em CPU para low-end).
    const WARN_BYTES = 80 * 1024 * 1024;
    if (file.size > WARN_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(0);
      toast.info(`Vídeo grande detectado (${mb} MB)`, {
        description: 'O envio pode demorar em conexão lenta.',
      });
    }
    if (!online || !navigator.onLine) {
      await offlineQueue.enfileirarVideo(file);
      return;
    }
    setUploadingVideo(true);
    setVideoUploadProgress(0);
    try {
      await uploadVideo.mutateAsync({
        vistoriaId,
        file,
        onProgress: (pct: number) => setVideoUploadProgress(pct),
      } as any);
    } catch (e: any) {
      console.warn('[Vistoria] Upload de vídeo falhou, enfileirando offline:', e?.message);
      await offlineQueue.enfileirarVideo(file);
    } finally {
      setUploadingVideo(false);
      setVideoUploadProgress(0);
    }
  };


  const handleAprovar = async () => {
    if (!vistoriaId || !veiculo || !associado) return;
    setProcessando(true);
    try {
      await aprovarVeiculo.mutateAsync({
        vistoriaId,
        instalacaoId,
        veiculoId: veiculo.id,
        associadoId: associado.id,
        hodometro: parseInt(hodometro),
        observacoes: observacoes.trim() || undefined,
      });
      setShowConfirmacao(true);
    } catch (e) {
      // erro tratado no hook
    } finally {
      setProcessando(false);
    }
  };

  const handleRecusar = async (data: { motivo: string; motivoCompleto: string; detalhes: string; fotos: File[] }) => {
    if (!vistoriaId || !veiculo || !associado) return;
    try {
      await recusarVeiculo.mutateAsync({
        vistoriaId,
        instalacaoId,
        veiculoId: veiculo.id,
        associadoId: associado.id,
        motivo: data.motivoCompleto,
        observacoes: data.detalhes,
        fotosRecusa: data.fotos,
      });
      navigate('/vistoriador/tarefas');
    } catch (e) {
      // erro tratado no hook
    }
  };

  const toggleCategory = (catId: string) => {
    setOpenCategories(prev => 
      prev.includes(catId) ? prev.filter(c => c !== catId) : [...prev, catId]
    );
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !vistoria) {
    if (typeof window !== 'undefined') {
      console.warn('[ExecutarVistoriaCompleta] Vistoria não resolvida para id da rota:', routeId, {
        servicoErr: vistoriaPorServicoQuery.error,
        instalacaoErr: vistoriaPorInstalacaoQuery.error,
        agendamentoBaseErr: vistoriaPorAgendamentoBaseQuery.error,
      });
    }
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-900 p-4">
        <AlertTriangle className="h-12 w-12 text-red-500" />
        <p className="text-center text-slate-300">
          Não foi possível carregar esta tarefa.
        </p>
        <p className="text-center text-xs text-slate-500 max-w-sm">
          A vistoria pode ainda estar sendo preparada pelo sistema, ou você
          pode não ter acesso a esta tarefa específica. Volte para a lista
          de tarefas e tente novamente.
        </p>
        <Button onClick={() => navigate('/vistoriador/tarefas')}>Voltar para tarefas</Button>
      </div>
    );
  }

  // Verificar se a vistoria já foi finalizada (bloqueio de edição)
  const vistoriaFinalizada = ['aprovada', 'reprovada'].includes(vistoria?.status || '');
  
  if (vistoriaFinalizada) {
    const foiAprovada = vistoria.status === 'aprovada';
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-900 p-6">
        <div className={`rounded-full p-6 ${foiAprovada ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
          {foiAprovada ? (
            <ShieldCheck className="h-16 w-16 text-green-500" />
          ) : (
            <ShieldX className="h-16 w-16 text-red-500" />
          )}
        </div>
        
        <Badge className={foiAprovada ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
          <Lock className="mr-1 h-3 w-3" />
          Vistoria {foiAprovada ? 'Aprovada' : 'Reprovada'}
        </Badge>
        
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-white">
            Vistoria Finalizada
          </h2>
          <p className="text-slate-400 max-w-sm">
            Esta vistoria já foi {foiAprovada ? 'aprovada' : 'reprovada'} e não pode mais ser editada.
          </p>
        </div>

        <Card className="border-slate-700 bg-slate-800 w-full max-w-sm">
          <CardContent className="py-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Veículo:</span>
              <span className="text-white font-medium">{veiculo?.placa}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Associado:</span>
              <span className="text-white">{associado?.nome}</span>
            </div>
            {vistoria.updated_at && (
              <div className="flex justify-between">
                <span className="text-slate-400">Concluída em:</span>
                <span className="text-white">
                  {new Date(vistoria.updated_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Button 
          onClick={() => navigate('/vistoriador/tarefas')} 
          className="mt-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Tarefas
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-slate-900 overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-slate-700 bg-slate-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/vistoriador/tarefas')} className="text-slate-400">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-white">Vistoria Completa</p>
              {salvando && (
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <CloudUpload className="h-3 w-3 animate-pulse" />
                  Salvando...
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 truncate">{associado?.nome} | {veiculo?.placa}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={abrirWhatsApp}
            disabled={!hasWhatsApp}
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
      <div className="flex-shrink-0 border-b border-slate-700 bg-slate-800 px-4 py-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Progresso:</span>
          <span className="font-medium text-white">{totalFotosEnviadas}/{totalFotosObrigatorias} fotos</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-700">
          <div 
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${(totalFotosEnviadas / totalFotosObrigatorias) * 100}%` }}
          />
        </div>
      </div>

      {/* Temporizador de Execução */}
      {(vistoria as any)?.iniciada_em && (
        <TemporizadorExecucao 
          iniciadaEm={(vistoria as any).iniciada_em} 
          className="mx-4 mt-2"
        />
      )}

      <main className="flex-1 overflow-y-auto overscroll-contain space-y-4 p-4" style={{ WebkitOverflowScrolling: 'touch' as any }}>
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

        {/* Fotos sequenciais */}
        <Card className="border-slate-700 bg-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-white">
              <Camera className="h-5 w-5 text-blue-400" />
              Fotos da Vistoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <VistoriaFotoSequencial
              fotos={categorias.flatMap(c => c.fotos)}
              fotosEnviadas={fotosEnviadas}
              uploadingFoto={uploadingFoto}
              onUpload={(fotoId, file) => {
                const foto = categorias.flatMap(c => c.fotos).find(f => f.id === fotoId);
                handleUploadFoto(fotoId, file, foto?.visivelCliente !== false);
              }}
            />
          </CardContent>
        </Card>

        {/* Observações do Vistoriador (opcional) */}
        <Card className="border-slate-700 bg-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-white">
              <MessageSquare className="h-5 w-5 text-amber-400" />
              Observações (opcional)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Registre qualquer observação relevante sobre o veículo ou a vistoria..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="resize-none border-slate-600 bg-slate-900 text-white min-h-[100px]"
              rows={4}
            />
            <p className="text-xs text-slate-400 mt-2">
              Essas observações serão visíveis para o analista de cadastro.
            </p>
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
            <VideoCapture
              onCapture={handleUploadVideo}
              videoUrl={video360Url}
              uploading={uploadingVideo}
              uploadProgress={uploadingVideo ? videoUploadProgress : undefined}
              maxDuration={120}
            />
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="flex-shrink-0 border-t border-slate-700 bg-slate-800 p-4">
        <div className="flex gap-3">
          <Button
            variant="destructive"
            onClick={() => setShowRecusaModal(true)}
            className="flex-1"
            disabled={processando || !todasFotosEnviadas}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Reprovar
          </Button>
          <Button
            onClick={handleAprovar}
            disabled={!podeAprovar || processando}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            {processando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Aprovar
          </Button>
        </div>
        {(!podeAprovar || !todasFotosEnviadas) && (
          <p className="mt-2 text-center text-xs text-amber-400">
            {!conferenciaCompleta && 'Confirme os dados e hodômetro. '}
            {!todasFotosEnviadas && `📸 Tire todas as fotos obrigatórias (faltam ${totalFotosObrigatorias - totalFotosEnviadas}). `}
            {!videoEnviado && 'Envie o vídeo 360°.'}
          </p>
        )}
        {offlineQueue.totalPendentes > 0 && (
          <p className="mt-2 text-center text-xs text-blue-300">
            ☁️ {offlineQueue.totalPendentes} mídia(s) ainda serão enviadas em segundo plano quando a internet voltar.
          </p>
        )}
      </footer>

      {/* Modais */}
      <ModalRecusaVeiculoComFotos
        open={showRecusaModal}
        onClose={() => setShowRecusaModal(false)}
        onConfirm={handleRecusar}
        isPending={recusarVeiculo.isPending}
        veiculoInfo={{ placa: veiculo?.placa, modelo: `${veiculo?.marca} ${veiculo?.modelo}` }}
      />

      {showConfirmacao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <Card className="w-full max-w-md border-green-500 bg-slate-800">
            <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500">
                <CheckCircle2 className="h-10 w-10 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">Veículo Aprovado!</h2>
              <p className="text-slate-400">O associado e veículo estão ativos com Proteção 360º.</p>
              <Button onClick={() => navigate('/vistoriador/tarefas')} className="mt-4 w-full bg-blue-600 hover:bg-blue-700">
                Voltar para Tarefas
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}