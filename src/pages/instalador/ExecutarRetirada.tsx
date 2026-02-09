import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Camera, Check, AlertTriangle, 
  Gauge, CheckCircle2, Loader2, Car, Video,
  ChevronDown, ChevronUp, MessageSquare, PackageMinus,
  MessageCircle, Phone
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
import { SignaturePad } from '@/components/instalador/SignaturePad';
import { TemporizadorExecucao } from '@/components/vistoriador/TemporizadorExecucao';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { 
  agruparFotosFiltradas, 
  TOTAL_FOTOS_OBRIGATORIAS,
  FOTOS_VISTORIA_COMPLETA,
} from '@/data/vistoriaConfigCompleta';

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
          associado:associados(id, nome, telefone, cpf, whatsapp),
          veiculo:veiculos!servicos_veiculo_id_fkey(id, placa, marca, modelo, cor, chassi),
          rastreador:rastreadores!servicos_rastreador_id_fkey(id, codigo, imei, plataforma)
        `)
        .eq('id', servicoId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!servicoId,
  });

  // Estados
  const [uploadingFoto, setUploadingFoto] = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [showConfirmacao, setShowConfirmacao] = useState(false);
  const [openCategories, setOpenCategories] = useState<string[]>(['identificacao_motor']);
  
  const [conferencia, setConferencia] = useState({
    placa: false, chassi: false, modelo: false, cor: false,
  });
  const [hodometro, setHodometro] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [assinaturaUrl, setAssinaturaUrl] = useState<string | null>(null);
  const [fotosEnviadas, setFotosEnviadas] = useState<Record<string, string>>({});
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const veiculo = servico?.veiculo;
  const associado = servico?.associado;
  const rastreador = servico?.rastreador;

  // Funções de contato
  const abrirWhatsApp = () => {
    const numero = associado?.whatsapp || associado?.telefone;
    if (numero) {
      const numeroLimpo = numero.replace(/\D/g, '');
      const mensagem = encodeURIComponent(
        `Olá ${associado?.nome?.split(' ')[0] || ''}, sou o técnico da PRATIC. ` +
        `Estou no local para realizar o serviço. Podemos confirmar?`
      );
      window.open(`https://wa.me/55${numeroLimpo}?text=${mensagem}`, '_blank');
    }
  };

  const ligarCliente = () => {
    if (associado?.telefone) {
      window.open(`tel:${associado.telefone}`, '_self');
    }
  };

  // Categorias de fotos (sem rastreador)
  const categorias = useMemo(() => agruparFotosFiltradas('automovel', false), []);

  // Contagem de fotos
  const fotosPorCategoria = useMemo(() => {
    const counts: Record<string, { total: number; enviadas: number }> = {};
    categorias.forEach(cat => {
      const total = cat.fotos.length;
      const enviadas = cat.fotos.filter(f => fotosEnviadas[f.id]).length;
      counts[cat.id] = { total, enviadas };
    });
    return counts;
  }, [categorias, fotosEnviadas]);

  const totalFotosEnviadas = useMemo(() => {
    return FOTOS_VISTORIA_COMPLETA
      .filter(f => f.categoria !== 'instalacao')
      .filter(f => fotosEnviadas[f.id])
      .length;
  }, [fotosEnviadas]);

  // Validação
  const conferenciaCompleta = Object.values(conferencia).every(Boolean) && hodometro.length > 0;
  const todasFotosEnviadas = totalFotosEnviadas >= TOTAL_FOTOS_OBRIGATORIAS;
  const videoEnviado = !!videoUrl;
  const assinaturaEnviada = !!assinaturaUrl;
  const podeConfirmar = conferenciaCompleta && todasFotosEnviadas && videoEnviado && assinaturaEnviada;

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

  if (error || !servico) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-900 p-4">
        <AlertTriangle className="h-12 w-12 text-red-500" />
        <p className="text-center text-slate-300">Serviço não encontrado.</p>
        <Button onClick={() => navigate('/vistoriador/tarefas')}>Voltar</Button>
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
          <span className="text-slate-400">Progresso:</span>
          <span className="font-medium text-white">{totalFotosEnviadas}/{TOTAL_FOTOS_OBRIGATORIAS} fotos</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-700">
          <div 
            className="h-full bg-red-500 transition-all"
            style={{ width: `${(totalFotosEnviadas / TOTAL_FOTOS_OBRIGATORIAS) * 100}%` }}
          />
        </div>
      </div>

      {servico?.iniciada_em && (
        <TemporizadorExecucao iniciadaEm={servico.iniciada_em} className="mx-4 mt-2" />
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
          if (!stats) return null;
          const isComplete = stats.enviadas === stats.total;
          const isOpen = openCategories.includes(cat.id);

          return (
            <Collapsible key={cat.id} open={isOpen} onOpenChange={() => toggleCategory(cat.id)}>
              <Card className="border-slate-700 bg-slate-800">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer pb-2">
                    <CardTitle className="flex items-center justify-between text-base text-white">
                      <div className="flex items-center gap-2">
                        <Camera className="h-5 w-5 text-blue-400" />
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
                          obrigatoria={true}
                          fotoUrl={fotosEnviadas[foto.id]}
                          uploading={uploadingFoto === foto.id}
                          onCapture={(file) => handleUploadFoto(foto.id, file)}
                        />
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}

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
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-slate-700 bg-slate-800 p-4">
        <Button onClick={handleConcluir} disabled={!podeConfirmar || processando} className="w-full bg-red-600 hover:bg-red-700">
          {processando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
          Concluir Retirada
        </Button>
        {!podeConfirmar && (
          <p className="mt-2 text-center text-xs text-amber-400">
            {!conferenciaCompleta && 'Confirme os dados. '}
            {!todasFotosEnviadas && `Faltam ${TOTAL_FOTOS_OBRIGATORIAS - totalFotosEnviadas} fotos. `}
            {!videoEnviado && 'Envie o vídeo. '}
            {!assinaturaEnviada && 'Capture assinatura.'}
          </p>
        )}
      </footer>

      {showConfirmacao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <Card className="w-full max-w-md border-green-500 bg-slate-800">
            <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500">
                <CheckCircle2 className="h-10 w-10 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">Retirada Concluída!</h2>
              <p className="text-slate-400">O rastreador foi devolvido ao seu estoque.</p>
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
