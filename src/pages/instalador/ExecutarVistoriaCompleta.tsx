import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Camera, Check, AlertTriangle, 
  Gauge, CheckCircle2, Loader2, Car, Video,
  ChevronDown, ChevronUp, XCircle, MapPin, Lock, ShieldCheck, ShieldX, MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FotoCapture } from '@/components/instalador/FotoCapture';
import { VideoCapture } from '@/components/instalador/VideoCapture';
import { ModalRecusaVeiculoComFotos } from '@/components/instalador/ModalRecusaVeiculoComFotos';
import { TemporizadorExecucao } from '@/components/vistoriador/TemporizadorExecucao';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useVistoriaCompleta } from '@/hooks/useVistorias';
import { 
  useAprovarVeiculoVistoria, 
  useRecusarVeiculoVistoria, 
  useUploadVideo360,
  useUploadFotoVistoriaCompleta 
} from '@/hooks/useVistoriaCompleta';
import { 
  agruparFotosPorCategoriaCompleta, 
  TOTAL_FOTOS_OBRIGATORIAS,
  FOTOS_VISTORIA_COMPLETA,
  agruparFotosFiltradas
} from '@/data/vistoriaConfigCompleta';
import { useConfigFipeRastreador, precisaRastreador } from '@/hooks/useConfigRastreador';

export default function ExecutarVistoriaCompleta() {
  const { id: instalacaoId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Hooks - busca por instalacao_id
  const { data: vistoria, isLoading, error } = useVistoriaCompleta(instalacaoId || null);
  const { data: fipeMinRastreador = 30000 } = useConfigFipeRastreador();
  const uploadFoto = useUploadFotoVistoriaCompleta();
  const uploadVideo = useUploadVideo360();
  const aprovarVeiculo = useAprovarVeiculoVistoria();
  const recusarVeiculo = useRecusarVeiculoVistoria();

  // Estado
  const [uploadingFoto, setUploadingFoto] = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [showRecusaModal, setShowRecusaModal] = useState(false);
  const [showConfirmacao, setShowConfirmacao] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [openCategories, setOpenCategories] = useState<string[]>(['identificacao_motor']);
  
  const [conferencia, setConferencia] = useState({
    placa: false, chassi: false, modelo: false, cor: false,
  });
  const [hodometro, setHodometro] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // Dados
  const vistoriaId = vistoria?.id;
  const veiculo = vistoria?.veiculo;
  const associado = vistoria?.associado || vistoria?.veiculo?.associado;
  const fotosEnviadas = vistoria?.fotos || [];
  const video360Url = (vistoria as any)?.video_360_url;
  
  // Verificar se precisa de rastreador baseado no valor FIPE
  const valorFipeVeiculo = useMemo(() => {
    return (veiculo as any)?.valor_fipe || null;
  }, [veiculo]);
  
  const veiculoPrecisaRastreador = useMemo(() => {
    return precisaRastreador(valorFipeVeiculo, fipeMinRastreador);
  }, [valorFipeVeiculo, fipeMinRastreador]);
  
  // Categorias filtradas baseado na necessidade de rastreador
  const categorias = useMemo(() => agruparFotosFiltradas('automovel', veiculoPrecisaRastreador), [veiculoPrecisaRastreador]);

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

  // Total de fotos enviadas (excluindo instalação que é opcional)
  const totalFotosEnviadas = useMemo(() => {
    return FOTOS_VISTORIA_COMPLETA
      .filter(f => f.categoria !== 'instalacao')
      .filter(f => fotosMap[f.id])
      .length;
  }, [fotosMap]);

  // Validação
  const conferenciaCompleta = Object.values(conferencia).every(Boolean) && hodometro.length > 0;
  const todasFotosEnviadas = totalFotosEnviadas >= TOTAL_FOTOS_OBRIGATORIAS;
  const videoEnviado = !!video360Url;
  const podeAprovar = conferenciaCompleta && todasFotosEnviadas && videoEnviado;

  // Handlers
  const handleUploadFoto = async (tipo: string, file: File, visivelCliente: boolean = true) => {
    if (!vistoriaId) return;
    setUploadingFoto(tipo);
    try {
      await uploadFoto.mutateAsync({ vistoriaId, tipo, file, visivelCliente });
      toast.success('Foto enviada!');
    } catch (e) {
      toast.error('Erro ao enviar foto');
    } finally {
      setUploadingFoto(null);
    }
  };

  const handleUploadVideo = async (file: File) => {
    if (!vistoriaId) return;
    setUploadingVideo(true);
    try {
      await uploadVideo.mutateAsync({ vistoriaId, file });
    } catch (e) {
      toast.error('Erro ao enviar vídeo');
    } finally {
      setUploadingVideo(false);
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
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-900 p-4">
        <AlertTriangle className="h-12 w-12 text-red-500" />
        <p className="text-center text-slate-300">Vistoria não encontrada.</p>
        <Button onClick={() => navigate('/vistoriador/tarefas')}>Voltar</Button>
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
    <div className="flex min-h-screen flex-col bg-slate-900 pb-32">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-700 bg-slate-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/vistoriador/tarefas')} className="text-slate-400">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Vistoria Completa</p>
            <p className="text-xs text-slate-400">{associado?.nome} | {veiculo?.placa}</p>
          </div>
        </div>
      </header>

      {/* Progresso */}
      <div className="border-b border-slate-700 bg-slate-800 px-4 py-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Progresso:</span>
          <span className="font-medium text-white">{totalFotosEnviadas}/{TOTAL_FOTOS_OBRIGATORIAS} fotos</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-700">
          <div 
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${(totalFotosEnviadas / TOTAL_FOTOS_OBRIGATORIAS) * 100}%` }}
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

      <main className="flex-1 space-y-4 p-4">
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

        {/* Fotos por categoria */}
        {categorias.map(cat => {
          const stats = fotosPorCategoria[cat.id];
          const isComplete = stats.enviadas === stats.total;
          const isOpen = openCategories.includes(cat.id);

          return (
            <Collapsible key={cat.id} open={isOpen} onOpenChange={() => toggleCategory(cat.id)}>
              <Card className="border-slate-700 bg-slate-800">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer pb-2">
                    <CardTitle className="flex items-center justify-between text-base text-white">
                      <div className="flex items-center gap-2">
                        {cat.id === 'instalacao' ? <MapPin className="h-5 w-5 text-amber-400" /> : <Camera className="h-5 w-5 text-blue-400" />}
                        <span>{cat.nome}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn('text-sm', isComplete ? 'text-green-400' : 'text-slate-400')}>
                          {stats.enviadas}/{stats.total}
                        </span>
                        {isComplete && <CheckCircle2 className="h-4 w-4 text-green-400" />}
                        {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                      </div>
                    </CardTitle>
                    {cat.id === 'instalacao' && (
                      <p className="text-xs text-amber-400">⚠️ Esta foto não será visível ao cliente</p>
                    )}
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-2">
                      {cat.fotos.map(foto => (
                        <FotoCapture
                          key={foto.id}
                          tipo={foto.id}
                          label={foto.nome}
                          obrigatoria={cat.id !== 'instalacao'}
                          fotoUrl={fotosMap[foto.id]}
                          uploading={uploadingFoto === foto.id}
                          onCapture={(file) => handleUploadFoto(foto.id, file, foto.visivelCliente !== false)}
                        />
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}

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
              maxDuration={120}
            />
          </CardContent>
        </Card>
      </main>

      {/* Footer fixo */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-slate-700 bg-slate-800 p-4">
        <div className="flex gap-3">
          <Button
            variant="destructive"
            onClick={() => setShowRecusaModal(true)}
            className="flex-1"
            disabled={processando}
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
        {!podeAprovar && (
          <p className="mt-2 text-center text-xs text-amber-400">
            {!conferenciaCompleta && 'Confirme os dados e hodômetro. '}
            {!todasFotosEnviadas && `Faltam ${TOTAL_FOTOS_OBRIGATORIAS - totalFotosEnviadas} fotos. `}
            {!videoEnviado && 'Envie o vídeo 360°.'}
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
              <p className="text-slate-400">O associado e veículo estão ativos com cobertura total.</p>
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