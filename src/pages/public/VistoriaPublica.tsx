import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import {
  Camera,
  Cpu,
  Loader2,
  Lock,
  CheckCircle,
  ArrowLeft,
  Car,
  MapPin,
  User,
  Video,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  detectarTipoVeiculo,
  agruparFotosFiltradas,
  agruparFotosApenasInstalacao,
  type TipoVeiculo,
  type VistoriaFotoConfig,
} from '@/data/vistoriaConfigCompleta';
import { compressImage } from '@/lib/imageCompressor';
import { VistoriaFotoSequencial } from '@/components/vistorias/VistoriaFotoSequencial';
import { VideoCapture } from '@/components/instalador/VideoCapture';
import { ChecklistItem, type ChecklistStatus } from '@/components/instalador/ChecklistItem';
import {
  useVistoriaLinkPorToken,
  useConcluirEtapaFotosPublica,
  useConcluirEtapaInstalacaoPublica,
  useIniciarEtapaPublica,
} from '@/hooks/useVistoriaLinkPublica';

// Itens do checklist da instalação (mesmos do fluxo legado)
const CHECKLIST_INSTALACAO = [
  { id: 'veiculo_confere', label: 'Veículo corresponde aos dados cadastrados', critico: true },
  { id: 'placa_confere', label: 'Placa confere com o documento', critico: true },
  { id: 'condicoes_veiculo', label: 'Condições do veículo adequadas', critico: false },
  { id: 'local_seguro', label: 'Local de instalação seguro', critico: false },
  { id: 'bateria_ok', label: 'Bateria do veículo em boas condições', critico: false },
  { id: 'eletrica_ok', label: 'Acessórios elétricos funcionando', critico: false },
  { id: 'cliente_ciente', label: 'Associado ciente do procedimento', critico: false },
];

type Etapa = 'home' | 'fotos' | 'instalacao';

export default function VistoriaPublica() {
  const { token } = useParams<{ token: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const etapa = (searchParams.get('etapa') as Etapa) || 'home';

  const setEtapa = (e: Etapa) => {
    if (e === 'home') setSearchParams({});
    else setSearchParams({ etapa: e });
  };

  const { data: link, isLoading, error, refetch } = useVistoriaLinkPorToken(token);

  // Ao voltar para a home, refazer fetch para refletir etapas concluídas
  // (esconde automaticamente botões de etapas já finalizadas).
  useEffect(() => {
    if (etapa === 'home') refetch();
  }, [etapa, refetch]);

  // Dados da instalação / veículo / associado
  const { data: instalacao } = useQuery({
    queryKey: ['vistoria-publica-instalacao', link?.instalacao_id],
    enabled: !!link?.instalacao_id,
    queryFn: async () => {
      const { data, error } = await publicSupabase
        .from('instalacoes' as any)
        .select(`
          id, data_agendada, periodo, logradouro, numero, complemento, bairro, cidade, uf, cep,
          rastreador_id,
          associados:associado_id(nome, telefone),
          veiculos:veiculo_id(marca, modelo, ano, placa, tipo_veiculo)
        `)
        .eq('id', link!.instalacao_id)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: rastreador } = useQuery({
    queryKey: ['vistoria-publica-rastreador', instalacao?.rastreador_id],
    enabled: !!instalacao?.rastreador_id,
    queryFn: async () => {
      const { data } = await publicSupabase
        .from('rastreadores' as any)
        .select('id, codigo, modelo')
        .eq('id', instalacao.rastreador_id)
        .single();
      return data as any;
    },
  });

  // ── Estados gerais ──
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground text-sm">Validando acesso...</p>
      </div>
    );
  }

  if (error || !link || link.status === 'cancelado') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Lock className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-bold mb-2">Link inválido</h1>
        <p className="text-muted-foreground text-sm text-center max-w-xs">
          Este link não é válido ou foi cancelado. Entre em contato com a PraticCar.
        </p>
      </div>
    );
  }

  if (link.status === 'concluido') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mb-4">
          <CheckCircle className="h-8 w-8 text-success" />
        </div>
        <h1 className="text-xl font-bold mb-2">Vistoria concluída</h1>
        <p className="text-muted-foreground text-sm text-center max-w-xs">
          As duas etapas foram finalizadas. Aguarde a análise da PraticCar.
        </p>
      </div>
    );
  }

  const veiculo = instalacao?.veiculos as any;
  const associado = instalacao?.associados as any;
  const tipoVeiculo: TipoVeiculo = veiculo
    ? detectarTipoVeiculo(veiculo.tipo_veiculo, veiculo.modelo, veiculo.marca)
    : 'automovel';

  return (
    <div className="min-h-screen bg-background pb-10">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          {etapa !== 'home' ? (
            <Button variant="ghost" size="sm" onClick={() => setEtapa('home')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          ) : (
            <span className="text-lg font-bold">PraticCar</span>
          )}
          <Badge variant="outline" className="text-xs font-semibold">
            VISTORIA
          </Badge>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Dados sempre visíveis no topo da home */}
        {etapa === 'home' && (
          <DadosVistoria veiculo={veiculo} associado={associado} instalacao={instalacao} rastreador={rastreador} />
        )}

        {etapa === 'home' && (
          <HomeEtapas link={link} token={token!} onEtapa={setEtapa} />
        )}

        {etapa === 'fotos' && instalacao && (
          <EtapaFotos
            token={token!}
            tipoVeiculo={tipoVeiculo}
            onConcluida={() => setEtapa('home')}
          />
        )}

        {etapa === 'instalacao' && instalacao && (
          <EtapaInstalacao
            token={token!}
            tipoVeiculo={tipoVeiculo}
            link={link}
            onConcluida={() => setEtapa('home')}
          />
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Sub-componentes
// ──────────────────────────────────────────────────────────────────

function DadosVistoria({ veiculo, associado, instalacao, rastreador }: any) {
  const endereco = [
    instalacao?.logradouro,
    instalacao?.numero ? `nº ${instalacao.numero}` : null,
    instalacao?.bairro,
    instalacao?.cidade,
    instalacao?.uf,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Car className="h-4 w-4 text-primary" />
          Dados da vistoria
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {veiculo && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Veículo</p>
            <p className="font-medium">
              {[veiculo.marca, veiculo.modelo, veiculo.ano].filter(Boolean).join(' ')}
            </p>
            {veiculo.placa && (
              <span className="inline-block mt-1 px-3 py-1 bg-foreground text-background font-bold rounded tracking-widest">
                {veiculo.placa}
              </span>
            )}
          </div>
        )}
        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p>{endereco || 'Endereço não informado'}</p>
        </div>
        <div className="flex items-start gap-2">
          <User className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p>{associado?.nome || '—'}</p>
        </div>
        {rastreador && (
          <div className="flex items-start gap-2">
            <Cpu className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p>
              Rastreador: <span className="font-medium">{rastreador.codigo}</span>
              {rastreador.modelo ? ` (${rastreador.modelo})` : ''}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HomeEtapas({
  link,
  token,
  onEtapa,
}: {
  link: any;
  token: string;
  onEtapa: (e: Etapa) => void;
}) {
  const fotosFeitas = link.fotos_etapa_status === 'concluida';
  const instFeita = link.instalacao_etapa_status === 'concluida';

  const iniciarMut = useIniciarEtapaPublica();

  const handleEtapa = async (e: Etapa, etapaApi: 'fotos' | 'instalacao') => {
    // Dispara o "em andamento" no backend (não bloqueia navegação se falhar)
    try {
      await iniciarMut.mutateAsync({ token, etapa: etapaApi });
    } catch (err) {
      console.warn('[VistoriaPublica] iniciar etapa falhou (não bloqueante):', err);
    }
    onEtapa(e);
  };

  return (
    <div className="space-y-3">
      {!fotosFeitas && (
        <button
          onClick={() => handleEtapa('fotos', 'fotos')}
          disabled={iniciarMut.isPending}
          className="w-full text-left rounded-xl border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 transition-all p-5 flex items-center gap-4 disabled:opacity-60"
        >
          <div className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
            <Camera className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-base">Realizar Fotos e Vídeo</p>
            <p className="text-xs text-muted-foreground mt-1">
              Fotos do veículo, vídeo 360° e checklist visual.
            </p>
          </div>
        </button>
      )}

      {!instFeita && (
        <button
          onClick={() => handleEtapa('instalacao', 'instalacao')}
          disabled={iniciarMut.isPending}
          className="w-full text-left rounded-xl border-2 border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 transition-all p-5 flex items-center gap-4 disabled:opacity-60"
        >
          <div className="w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center">
            <Cpu className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-base">Realizar Instalação do Rastreador</p>
            <p className="text-xs text-muted-foreground mt-1">
              Checklist de instalação e fotos do equipamento instalado.
            </p>
          </div>
        </button>
      )}

      {fotosFeitas && (
        <div className="rounded-lg border border-success/30 bg-success/5 p-3 flex items-center gap-2 text-sm">
          <CheckCircle className="h-4 w-4 text-success" />
          Fotos e vídeo já enviados.
        </div>
      )}
      {instFeita && (
        <div className="rounded-lg border border-success/30 bg-success/5 p-3 flex items-center gap-2 text-sm">
          <CheckCircle className="h-4 w-4 text-success" />
          Instalação do rastreador já registrada.
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// ETAPA: FOTOS & VÍDEO
// ──────────────────────────────────────────────────────────────────

function EtapaFotos({
  token,
  tipoVeiculo,
  onConcluida,
}: {
  token: string;
  tipoVeiculo: TipoVeiculo;
  onConcluida: () => void;
}) {
  const [fotosMap, setFotosMap] = useState<Record<string, string>>({});
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploadingFoto, setUploadingFoto] = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [executorNome, setExecutorNome] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);

  const concluirMut = useConcluirEtapaFotosPublica();

  const categorias = useMemo(() => agruparFotosFiltradas(tipoVeiculo, false), [tipoVeiculo]);
  const todasFotos = useMemo(() => categorias.flatMap(c => c.fotos), [categorias]);

  const fotosEnviadasArray = useMemo(
    () => Object.entries(fotosMap).map(([tipo, arquivo_url]) => ({ tipo, arquivo_url })),
    [fotosMap],
  );
  const fotosOk = todasFotos.filter(f => !!fotosMap[f.id]).length;
  const minimo = Math.min(10, todasFotos.length);
  const podeFinalizar = fotosOk >= minimo && !!videoUrl && executorNome.trim().length >= 2;

  const handleUploadFoto = useCallback(
    async (foto: VistoriaFotoConfig, file: File) => {
      setUploadingFoto(foto.id);
      try {
        let toUpload = file;
        if (file.size > 500 * 1024) {
          try {
            toUpload = await compressImage(file, { maxWidth: 1920, maxHeight: 1920, quality: 0.75 });
          } catch {
            /* original */
          }
        }
        const ext = toUpload.name.split('.').pop() || 'jpg';
        const path = `${token}/fotos/${foto.id}_${Date.now()}.${ext}`;
        const { error } = await publicSupabase.storage
          .from('vistoria-prestador-fotos')
          .upload(path, toUpload, { upsert: true });
        if (error) throw error;
        const { data: urlData } = publicSupabase.storage
          .from('vistoria-prestador-fotos')
          .getPublicUrl(path);
        setFotosMap(prev => ({ ...prev, [foto.id]: urlData.publicUrl }));
      } catch (err: any) {
        console.error('[EtapaFotos] erro upload', err);
        toast.error('Erro ao enviar foto. Tente novamente.');
      } finally {
        setUploadingFoto(null);
      }
    },
    [token],
  );

  const handleUploadVideo = useCallback(
    async (file: File) => {
      setUploadingVideo(true);
      try {
        const ext = file.name.split('.').pop() || 'mp4';
        const path = `${token}/video/video_360_${Date.now()}.${ext}`;
        const { error } = await publicSupabase.storage
          .from('vistoria-prestador-fotos')
          .upload(path, file, { upsert: true, contentType: file.type });
        if (error) throw error;
        const { data: urlData } = publicSupabase.storage
          .from('vistoria-prestador-fotos')
          .getPublicUrl(path);
        setVideoUrl(urlData.publicUrl);
      } catch (err: any) {
        toast.error('Erro ao enviar vídeo');
      } finally {
        setUploadingVideo(false);
      }
    },
    [token],
  );

  const handleFinalizar = async () => {
    if (!podeFinalizar) return;
    setSalvando(true);
    try {
      await concluirMut.mutateAsync({
        token,
        executorNome,
        fotos: fotosMap,
        video360Url: videoUrl,
        observacoes: observacoes || null,
      });
      onConcluida();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Quem está realizando?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="exec-fotos">Nome de quem está enviando as fotos</Label>
          <Input
            id="exec-fotos"
            value={executorNome}
            onChange={e => setExecutorNome(e.target.value)}
            placeholder="Ex.: João Silva"
            className="mt-1"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-primary" />
              Fotos do veículo
            </span>
            <Badge variant="outline">
              {fotosOk}/{todasFotos.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <VistoriaFotoSequencial
            fotos={todasFotos}
            fotosEnviadas={fotosEnviadasArray}
            uploadingFoto={uploadingFoto}
            onUpload={(fotoId, file) => {
              const foto = todasFotos.find(f => f.id === fotoId);
              if (foto) handleUploadFoto(foto, file);
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Video className="h-4 w-4 text-primary" />
            Vídeo 360° {videoUrl && <CheckCircle className="h-4 w-4 text-success" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <VideoCapture
            onCapture={handleUploadVideo}
            videoUrl={videoUrl ?? undefined}
            uploading={uploadingVideo}
            maxDuration={120}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Observações (opcional)</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={observacoes}
            onChange={e => setObservacoes(e.target.value)}
            placeholder="Algo relevante sobre o veículo?"
            rows={3}
          />
        </CardContent>
      </Card>

      <Button
        size="lg"
        className="w-full h-14 text-base font-semibold"
        disabled={!podeFinalizar || salvando}
        onClick={handleFinalizar}
      >
        {salvando ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <CheckCircle className="h-5 w-5 mr-2" />}
        Finalizar etapa de fotos
      </Button>
      {!podeFinalizar && (
        <p className="text-xs text-muted-foreground text-center">
          {executorNome.trim().length < 2 && 'Informe seu nome • '}
          {fotosOk < minimo && `Envie ao menos ${minimo} fotos • `}
          {!videoUrl && 'Envie o vídeo 360°'}
        </p>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// ETAPA: INSTALAÇÃO DO RASTREADOR
// ──────────────────────────────────────────────────────────────────

function EtapaInstalacao({
  token,
  tipoVeiculo,
  link,
  onConcluida,
}: {
  token: string;
  tipoVeiculo: TipoVeiculo;
  link: any;
  onConcluida: () => void;
}) {
  // Resolver nome travado quando há atribuição interna/prestador
  const [identDialogOpen, setIdentDialogOpen] = useState(true);
  const [nomeBloqueado, setNomeBloqueado] = useState<string | null>(null);
  const [executorNome, setExecutorNome] = useState('');
  const [confirmadoIdent, setConfirmadoIdent] = useState(false);

  // Buscar o nome bloqueado (interno > prestador) — server também valida
  const { data: nomeAtribuido } = useQuery({
    queryKey: ['vistoria-publica-nome-atribuido', link.id],
    queryFn: async () => {
      if (link.tecnico_atribuido_id) {
        const { data } = await publicSupabase
          .from('profiles' as any)
          .select('nome')
          .eq('id', link.tecnico_atribuido_id)
          .maybeSingle();
        return { nome: (data as any)?.nome || null, tipo: 'interno' };
      }
      if (link.prestador_atribuido_id) {
        const { data } = await publicSupabase
          .from('vistoriadores_prestadores' as any)
          .select('nome')
          .eq('id', link.prestador_atribuido_id)
          .maybeSingle();
        return { nome: (data as any)?.nome || null, tipo: 'prestador' };
      }
      return { nome: null, tipo: 'publico' };
    },
  });

  useEffect(() => {
    if (nomeAtribuido?.nome) {
      setNomeBloqueado(nomeAtribuido.nome);
      setExecutorNome(nomeAtribuido.nome);
    }
  }, [nomeAtribuido]);

  const [checklist, setChecklist] = useState<Record<string, { status: ChecklistStatus; observacao?: string }>>(() =>
    CHECKLIST_INSTALACAO.reduce((acc, i) => ({ ...acc, [i.id]: { status: 'pendente' as ChecklistStatus } }), {}),
  );
  const [fotosMap, setFotosMap] = useState<Record<string, string>>({});
  const [uploadingFoto, setUploadingFoto] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const concluirMut = useConcluirEtapaInstalacaoPublica();

  const categoriasInst = useMemo(() => agruparFotosApenasInstalacao(tipoVeiculo), [tipoVeiculo]);
  const fotosInstalacao = useMemo(() => categoriasInst.flatMap(c => c.fotos), [categoriasInst]);
  const fotosEnviadasArray = useMemo(
    () => Object.entries(fotosMap).map(([tipo, arquivo_url]) => ({ tipo, arquivo_url })),
    [fotosMap],
  );

  const checklistOk = CHECKLIST_INSTALACAO.every(
    i => checklist[i.id]?.status === 'ok' || checklist[i.id]?.status === 'nok',
  );
  const minFotosInst = Math.max(1, Math.min(3, fotosInstalacao.length));
  const fotosInstOk = fotosInstalacao.filter(f => !!fotosMap[f.id]).length >= minFotosInst;
  const podeFinalizar = checklistOk && fotosInstOk && !!executorNome.trim();

  const handleUploadFoto = useCallback(
    async (foto: VistoriaFotoConfig, file: File) => {
      setUploadingFoto(foto.id);
      try {
        let toUpload = file;
        if (file.size > 500 * 1024) {
          try {
            toUpload = await compressImage(file, { maxWidth: 1920, maxHeight: 1920, quality: 0.75 });
          } catch {
            /* original */
          }
        }
        const ext = toUpload.name.split('.').pop() || 'jpg';
        const path = `${token}/instalacao/${foto.id}_${Date.now()}.${ext}`;
        const { error } = await publicSupabase.storage
          .from('vistoria-prestador-fotos')
          .upload(path, toUpload, { upsert: true });
        if (error) throw error;
        const { data: urlData } = publicSupabase.storage
          .from('vistoria-prestador-fotos')
          .getPublicUrl(path);
        setFotosMap(prev => ({ ...prev, [foto.id]: urlData.publicUrl }));
      } catch (err: any) {
        toast.error('Erro ao enviar foto');
      } finally {
        setUploadingFoto(null);
      }
    },
    [token],
  );

  const handleFinalizar = async () => {
    if (!podeFinalizar) return;
    setSalvando(true);
    try {
      await concluirMut.mutateAsync({
        token,
        executorNome,
        checklistData: checklist,
        fotos: fotosMap,
      });
      onConcluida();
    } finally {
      setSalvando(false);
    }
  };

  // Modal obrigatório de identificação antes de mostrar o resto
  return (
    <>
      <Dialog open={identDialogOpen && !confirmadoIdent} onOpenChange={setIdentDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Identificação do técnico</DialogTitle>
            <DialogDescription>
              {nomeBloqueado
                ? 'Confirme que você é o técnico responsável atribuído a esta tarefa.'
                : 'Informe o nome do técnico responsável pela instalação.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="exec-inst">Nome do técnico</Label>
            <Input
              id="exec-inst"
              value={executorNome}
              onChange={e => setExecutorNome(e.target.value)}
              placeholder="Nome completo"
              disabled={!!nomeBloqueado}
            />
            {nomeBloqueado && (
              <p className="text-xs text-muted-foreground">
                Técnico atribuído pelo coordenador — não é possível editar.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                if (executorNome.trim().length < 2) {
                  toast.error('Informe um nome válido');
                  return;
                }
                setConfirmadoIdent(true);
                setIdentDialogOpen(false);
              }}
            >
              Iniciar instalação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmadoIdent && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Técnico:</span>
            <span className="font-semibold">{executorNome}</span>
            {nomeBloqueado && <Badge variant="secondary" className="ml-auto">Atribuído</Badge>}
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                Checklist de instalação
                <Badge variant="outline" className={checklistOk ? 'border-success text-success' : ''}>
                  {Object.values(checklist).filter(c => c.status !== 'pendente').length}/{CHECKLIST_INSTALACAO.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {CHECKLIST_INSTALACAO.map(item => (
                <ChecklistItem
                  key={item.id}
                  label={item.label}
                  status={checklist[item.id]?.status || 'pendente'}
                  observacao={checklist[item.id]?.observacao}
                  onStatusChange={status =>
                    setChecklist(prev => ({ ...prev, [item.id]: { ...prev[item.id], status } }))
                  }
                  onObservacaoChange={value =>
                    setChecklist(prev => ({ ...prev, [item.id]: { ...prev[item.id], observacao: value } }))
                  }
                />
              ))}
            </CardContent>
          </Card>

          {fotosInstalacao.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-primary" />
                    Fotos da instalação
                  </span>
                  <Badge variant="outline">
                    {fotosInstalacao.filter(f => !!fotosMap[f.id]).length}/{fotosInstalacao.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <VistoriaFotoSequencial
                  fotos={fotosInstalacao}
                  fotosEnviadas={fotosEnviadasArray}
                  uploadingFoto={uploadingFoto}
                  onUpload={(fotoId, file) => {
                    const foto = fotosInstalacao.find(f => f.id === fotoId);
                    if (foto) handleUploadFoto(foto, file);
                  }}
                />
              </CardContent>
            </Card>
          )}

          <Button
            size="lg"
            className="w-full h-14 text-base font-semibold"
            disabled={!podeFinalizar || salvando}
            onClick={handleFinalizar}
          >
            {salvando ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <CheckCircle className="h-5 w-5 mr-2" />}
            Finalizar instalação
          </Button>
          {!podeFinalizar && (
            <p className="text-xs text-muted-foreground text-center">
              {!checklistOk && 'Complete o checklist • '}
              {!fotosInstOk && `Envie ao menos ${minFotosInst} foto(s) da instalação`}
            </p>
          )}
        </div>
      )}
    </>
  );
}
