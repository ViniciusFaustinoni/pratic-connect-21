import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  ArrowRight, 
  User, 
  Car, 
  MapPin, 
  ClipboardCheck,
  Camera,
  PenTool,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Phone,
  Gauge,
  XCircle,
  ShieldCheck,
  ShieldX,
  Lock,
  Video,
  ChevronDown,
  ChevronRight,
  Bike,
  Router,
  Search,
  Package,
  AlertTriangle,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { 
  useServicoDetalhes, 
  useSalvarChecklistServico,
  useAprovarVeiculoServico,
  useRecusarVeiculoServico
} from '@/hooks/useServicos';
import { useVistoriaCompletaPorServico } from '@/hooks/useVistorias';
import { useUploadFotoVistoriaCompleta, useUploadVideo360 } from '@/hooks/useVistoriaCompleta';
import { 
  agruparFotosPorCategoriaCompleta, 
  getFotosByTipoVeiculo,
  getTotalFotosObrigatorias,
  detectarTipoVeiculo,
  agruparFotosFiltradas,
  type TipoVeiculo
} from '@/data/vistoriaConfigCompleta';
import { useSaveAssinatura } from '@/hooks/useAssinatura';
import { ChecklistItem, type ChecklistStatus } from '@/components/instalador/ChecklistItem';
import { VistoriaFotoCard } from '@/components/vistorias/VistoriaFotoCard';
import { SignaturePad } from '@/components/instalador/SignaturePad';
import { ModalRecusaVeiculoComFotos } from '@/components/instalador/ModalRecusaVeiculoComFotos';
import { TemporizadorExecucao } from '@/components/vistoriador/TemporizadorExecucao';
import { useRastreadoresDoPortador, type RastreadorEmPorte } from '@/hooks/useRastreadoresPortador';
import { useConfigFipeRastreador, useConfigFipeRastreadorMoto, precisaRastreador } from '@/hooks/useConfigRastreador';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

const CHECKLIST_ITEMS = [
  { id: 'veiculo_confere', label: 'Veículo corresponde aos dados cadastrados' },
  { id: 'placa_confere', label: 'Placa confere com o documento' },
  { id: 'condicoes_veiculo', label: 'Condições do veículo adequadas' },
  { id: 'local_seguro', label: 'Local de instalação seguro' },
  { id: 'bateria_ok', label: 'Bateria do veículo em boas condições' },
  { id: 'eletrica_ok', label: 'Acessórios elétricos funcionando' },
  { id: 'cliente_ciente', label: 'Associado ciente do procedimento' },
];

const CHECKLIST_ITEMS_MOTO = [
  { id: 'veiculo_confere', label: 'Moto corresponde aos dados cadastrados' },
  { id: 'placa_confere', label: 'Placa confere com o documento' },
  { id: 'chassi_confere', label: 'Chassi visível e confere' },
  { id: 'condicoes_veiculo', label: 'Condições gerais da moto adequadas' },
  { id: 'local_seguro', label: 'Local de instalação seguro' },
  { id: 'eletrica_ok', label: 'Sistema elétrico funcionando' },
  { id: 'cliente_ciente', label: 'Associado ciente do procedimento' },
];

const LOCAIS_INSTALACAO_CARRO = [
  { value: 'painel', label: 'Painel' },
  { value: 'sob_banco', label: 'Sob o banco' },
  { value: 'parachoque_dianteiro', label: 'Para-choque dianteiro' },
  { value: 'parachoque_traseiro', label: 'Para-choque traseiro' },
  { value: 'caixa_roda', label: 'Caixa de roda' },
  { value: 'vao_motor', label: 'Vão do motor' },
  { value: 'console_central', label: 'Console central' },
  { value: 'porta_malas', label: 'Porta-malas' },
  { value: 'outro', label: 'Outro' },
];

const LOCAIS_INSTALACAO_MOTO = [
  { value: 'sob_banco', label: 'Sob o banco' },
  { value: 'carenagem_lateral', label: 'Carenagem lateral' },
  { value: 'caixa_filtro_ar', label: 'Caixa do filtro de ar' },
  { value: 'compartimento_ferramentas', label: 'Compartimento de ferramentas' },
  { value: 'sob_tanque', label: 'Sob o tanque' },
  { value: 'rabeta', label: 'Rabeta/Cola' },
  { value: 'paralama', label: 'Paralama' },
  { value: 'outro', label: 'Outro' },
];

const ETAPAS = [
  { id: 1, label: 'Dados', icon: User },
  { id: 2, label: 'Checklist', icon: ClipboardCheck },
  { id: 3, label: 'Fotos', icon: Camera },
  { id: 4, label: 'Assinatura', icon: PenTool },
  { id: 5, label: 'Decisão', icon: ShieldCheck },
];

type ChecklistState = Record<string, { status: ChecklistStatus; observacao?: string; fotos?: string[] }>;

export default function InstaladorChecklist() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [etapaAtual, setEtapaAtual] = useState(1);
  const [checklist, setChecklist] = useState<ChecklistState>(() => 
    CHECKLIST_ITEMS.reduce((acc, item) => ({ ...acc, [item.id]: { status: 'pendente' as ChecklistStatus } }), {})
  );
  const [quilometragem, setQuilometragem] = useState<string>('');
  const [uploadingFoto, setUploadingFoto] = useState<string | null>(null);
  const [uploadingChecklistFoto, setUploadingChecklistFoto] = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [assinaturaUrl, setAssinaturaUrl] = useState<string | null>(null);
  const [showModalRecusa, setShowModalRecusa] = useState(false);
  const [openCategorias, setOpenCategorias] = useState<string[]>([]);
  const [imeiRastreador, setImeiRastreador] = useState('');
  const [imeiError, setImeiError] = useState('');
  const [modoManualImei, setModoManualImei] = useState(false);
  const [rastreadorSelecionadoId, setRastreadorSelecionadoId] = useState<string | null>(null);
  const [kmIdentificado, setKmIdentificado] = useState<number | null>(null);
  const [processandoOCR, setProcessandoOCR] = useState(false);
  
  // Estados para decisão do instalador (3 opções)
  const [decisaoInstalador, setDecisaoInstalador] = useState<'aprovado' | 'aprovado_ressalva' | 'negado' | null>(null);
  const [ressalvasTexto, setRessalvasTexto] = useState('');
  const [fotosRessalva, setFotosRessalva] = useState<{ file: File; preview: string }[]>([]);
  const [uploadingRessalvaFoto, setUploadingRessalvaFoto] = useState(false);
  
  // Estados para local de instalação do rastreador
  const [localInstalacao, setLocalInstalacao] = useState('');
  const [descricaoInstalacao, setDescricaoInstalacao] = useState('');

  // Estados para validação em tempo real do IMEI
  const [imeiValidando, setImeiValidando] = useState(false);
  const [imeiStatus, setImeiStatus] = useState<'idle' | 'validando' | 'disponivel' | 'nao_encontrado' | 'indisponivel'>('idle');
  const [imeiInfo, setImeiInfo] = useState<{ codigo?: string; plataforma?: string; status?: string } | null>(null);

  const { data: servico, isLoading, error } = useServicoDetalhes(id);
  const { data: vistoriaCompleta, isLoading: isLoadingVistoria } = useVistoriaCompletaPorServico(id ?? null);
  const { data: rastreadoresEmPorte, isLoading: isLoadingRastreadores } = useRastreadoresDoPortador();
  const { data: fipeMinRastreador = 30000 } = useConfigFipeRastreador();
  const { data: fipeMinRastreadorMoto = 9000 } = useConfigFipeRastreadorMoto();
  const uploadFotoMutation = useUploadFotoVistoriaCompleta();
  const uploadVideoMutation = useUploadVideo360();
  const saveAssinaturaMutation = useSaveAssinatura();
  const salvarChecklistMutation = useSalvarChecklistServico();
  const aprovarVeiculoMutation = useAprovarVeiculoServico();
  const recusarVeiculoMutation = useRecusarVeiculoServico();

  const progresso = (etapaAtual / ETAPAS.length) * 100;

  // Fotos da vistoria
  const fotosEnviadas = vistoriaCompleta?.fotos || [];
  const videoUrl = (vistoriaCompleta as any)?.video_360_url as string | undefined;
  const vistoriaId = vistoriaCompleta?.id;

  // Detectar tipo de veículo (moto ou automóvel)
  const tipoVeiculo: TipoVeiculo = useMemo(() => {
    const veiculoData = servico?.veiculos as { tipo_veiculo?: string } | undefined;
    return detectarTipoVeiculo(veiculoData?.tipo_veiculo);
  }, [servico?.veiculos]);

  // Verificar valor FIPE do veículo e se precisa de rastreador
  const valorFipeVeiculo = useMemo(() => {
    const veiculoData = servico?.veiculos as { valor_fipe?: number } | undefined;
    return veiculoData?.valor_fipe || null;
  }, [servico?.veiculos]);

  const veiculoPrecisaRastreador = useMemo(() => {
    return precisaRastreador(valorFipeVeiculo, fipeMinRastreador, tipoVeiculo, fipeMinRastreadorMoto);
  }, [valorFipeVeiculo, fipeMinRastreador, tipoVeiculo, fipeMinRastreadorMoto]);

  // Configuração dinâmica baseada no tipo de veículo (e se precisa rastreador)
  const fotosConfig = useMemo(() => getFotosByTipoVeiculo(tipoVeiculo), [tipoVeiculo]);
  const totalObrigatorias = useMemo(() => getTotalFotosObrigatorias(tipoVeiculo), [tipoVeiculo]);
  
  // Usar categorias filtradas se não precisa de rastreador
  const categoriasComFotos = useMemo(() => {
    return agruparFotosFiltradas(tipoVeiculo, veiculoPrecisaRastreador);
  }, [tipoVeiculo, veiculoPrecisaRastreador]);

  // Carregar checklist e quilometragem salvos
  useEffect(() => {
    if (servico) {
      // Restaurar checklist do banco se existir
      const savedChecklist = (servico as any).checklist_data;
      if (savedChecklist && typeof savedChecklist === 'object' && Object.keys(savedChecklist).length > 0) {
        setChecklist(savedChecklist);
      }
      // Restaurar quilometragem
      const savedKm = (servico as any).quilometragem;
      if (savedKm) {
        setQuilometragem(String(savedKm));
      }
    }
  }, [servico]);

  // Sincronizar KM identificado por OCR automaticamente
  useEffect(() => {
    if (vistoriaCompleta?.km_atual) {
      setKmIdentificado(vistoriaCompleta.km_atual);
      setQuilometragem(String(vistoriaCompleta.km_atual));
    }
  }, [vistoriaCompleta?.km_atual]);

  // Abrir primeira categoria incompleta ao carregar
  useEffect(() => {
    if (openCategorias.length === 0 && categoriasComFotos.length > 0) {
      const primeiraIncompleta = categoriasComFotos.find(cat => {
        const enviadas = cat.fotos.filter(f => 
          fotosEnviadas.some(foto => foto.tipo === f.id)
        ).length;
        return enviadas < cat.fotos.length;
      });
      if (primeiraIncompleta) {
        setOpenCategorias([primeiraIncompleta.id]);
      }
    }
  }, [categoriasComFotos, fotosEnviadas, openCategorias.length]);

  const checklistItems = useMemo(() =>
    tipoVeiculo === 'moto' ? CHECKLIST_ITEMS_MOTO : CHECKLIST_ITEMS
  , [tipoVeiculo]);

  const locaisInstalacao = useMemo(() =>
    tipoVeiculo === 'moto' ? LOCAIS_INSTALACAO_MOTO : LOCAIS_INSTALACAO_CARRO
  , [tipoVeiculo]);

  // Reinicializar checklist quando tipoVeiculo muda (e não há checklist salvo)
  useEffect(() => {
    const savedChecklist = (servico as any)?.checklist_data;
    const hasSaved = savedChecklist && typeof savedChecklist === 'object' && Object.keys(savedChecklist).length > 0;
    if (!hasSaved) {
      setChecklist(checklistItems.reduce((acc, item) => ({ ...acc, [item.id]: { status: 'pendente' as ChecklistStatus } }), {}));
    }
  }, [checklistItems, servico]);

  const checklistCompleto = useMemo(() => 
    checklistItems.every(item => {
      const state = checklist[item.id];
      if (state?.status === 'ok') return true;
      if (state?.status === 'nok' && state.observacao?.trim()) return true;
      return false;
    }),
    [checklist, checklistItems]
  );

  // Itens NOK do checklist (para influenciar decisão)
  const itensNok = useMemo(() => 
    checklistItems.filter(item => checklist[item.id]?.status === 'nok'),
    [checklist, checklistItems]
  );
  const temItensNok = itensNok.length > 0;

  // Verificar se todas as fotos obrigatórias foram enviadas (dinâmico por tipo)
  const fotosObrigatoriasCompletas = useMemo(() => {
    const obrigatorias = fotosConfig.filter(f => f.categoria !== 'instalacao');
    return obrigatorias.every(f => fotosEnviadas.some(foto => foto.tipo === f.id));
  }, [fotosEnviadas, fotosConfig]);

  // Verificar se o vídeo 360 foi enviado
  const video360Enviado = !!videoUrl;

  // Contagem de fotos enviadas
  const totalFotosEnviadas = useMemo(() => {
    const obrigatorias = fotosConfig.filter(f => f.categoria !== 'instalacao');
    return obrigatorias.filter(f => fotosEnviadas.some(foto => foto.tipo === f.id)).length;
  }, [fotosEnviadas, fotosConfig]);

  const toggleCategoria = (categoriaId: string) => {
    setOpenCategorias(prev =>
      prev.includes(categoriaId)
        ? prev.filter(c => c !== categoriaId)
        : [...prev, categoriaId]
    );
  };

  const getFotoUrl = (fotoId: string): string | undefined => {
    const foto = fotosEnviadas.find(f => f.tipo === fotoId);
    return foto?.arquivo_url;
  };

  const getProgressoCategoria = (fotos: { id: string }[]) => {
    const enviadas = fotos.filter(f => getFotoUrl(f.id)).length;
    return { enviadas, total: fotos.length };
  };

  const handleChecklistChange = (itemId: string, status: ChecklistStatus) => {
    setChecklist(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], status },
    }));
  };

  const handleObservacaoChange = (itemId: string, observacao: string) => {
    setChecklist(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], observacao },
    }));
  };


  const handleAddFotoChecklist = async (itemId: string, file: File) => {
    if (!id) return;
    setUploadingChecklistFoto(itemId);
    try {
      const fileName = `checklist/${id}/${itemId}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('instalacoes')
        .upload(fileName, file, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('instalacoes').getPublicUrl(fileName);
      setChecklist(prev => ({
        ...prev,
        [itemId]: { ...prev[itemId], fotos: [...(prev[itemId]?.fotos || []), urlData.publicUrl] },
      }));
      toast.success('Foto adicionada');
    } catch (err) {
      toast.error('Erro ao enviar foto');
    } finally {
      setUploadingChecklistFoto(null);
    }
  };

  const handleRemoveFotoChecklist = (itemId: string, index: number) => {
    setChecklist(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], fotos: (prev[itemId]?.fotos || []).filter((_, i) => i !== index) },
    }));
  };

  const handleFotoCapture = async (fotoId: string, file: File) => {
    if (!vistoriaId) {
      toast.error('Aguarde a vistoria carregar');
      return;
    }
    
    const fotoConfig = fotosConfig.find(f => f.id === fotoId);
    const visivelCliente = fotoConfig?.visivelCliente ?? true;
    const isOdometro = fotoId === 'odometro';
    
    setUploadingFoto(fotoId);
    if (isOdometro) setProcessandoOCR(true);
    
    try {
      const result = await uploadFotoMutation.mutateAsync({ 
        vistoriaId, 
        tipo: fotoId, 
        file,
        visivelCliente 
      });
      
      // Se for odômetro e OCR identificou KM com boa confiança
      if (isOdometro && result.ocrResult) {
        const { km, confianca, observacao } = result.ocrResult;
        if (km && confianca >= 0.7) {
          setKmIdentificado(km);
          setQuilometragem(String(km));
          toast.success(`Quilometragem identificada: ${km.toLocaleString('pt-BR')} km`, {
            description: observacao || 'Valor detectado automaticamente pela IA',
            duration: 5000,
          });
        } else if (km && confianca < 0.7) {
          toast.warning('Quilometragem identificada com baixa confiança', {
            description: `Valor sugerido: ${km.toLocaleString('pt-BR')} km. Verifique e corrija se necessário.`,
          });
          setKmIdentificado(km);
          setQuilometragem(String(km));
        } else {
          toast.info('Não foi possível identificar a quilometragem automaticamente', {
            description: observacao || 'Informe o valor manualmente.',
          });
        }
      } else {
        toast.success('Foto enviada!');
      }
    } catch (err) {
      toast.error('Erro ao enviar foto');
    } finally {
      setUploadingFoto(null);
      if (isOdometro) setProcessandoOCR(false);
    }
  };

  const handleVideoCapture = async (file: File) => {
    if (!vistoriaId) {
      toast.error('Aguarde a vistoria carregar');
      return;
    }
    setUploadingVideo(true);
    try {
      await uploadVideoMutation.mutateAsync({ vistoriaId, file });
    } catch (err) {
      // Erro já tratado no hook
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleAssinaturaSave = async (signatureBlob: Blob) => {
    if (!id) return;
    try {
      // Usar tipo 'servico' para salvar na tabela correta e também em vistoria_fotos
      const url = await saveAssinaturaMutation.mutateAsync({ 
        id, 
        signatureBlob,
        tipo: 'servico' 
      });
      setAssinaturaUrl(url);
      toast.success('Assinatura salva com sucesso!');
    } catch (err) {
      toast.error('Erro ao salvar assinatura');
    }
  };

  // Validação de IMEI (15-17 dígitos)
  const isImeiValido = /^\d{15,17}$/.test(imeiRastreador);

  // Validação em tempo real do IMEI no banco de dados (com debounce)
  useEffect(() => {
    const validarImeiNoBanco = async () => {
      if (!isImeiValido) {
        setImeiStatus('idle');
        setImeiInfo(null);
        return;
      }

      setImeiStatus('validando');
      setImeiValidando(true);

      try {
        const { data: rastreador, error } = await supabase
          .from('rastreadores')
          .select('id, codigo, status, plataforma')
          .eq('imei', imeiRastreador)
          .maybeSingle();

        if (error) throw error;

        if (!rastreador) {
          setImeiStatus('nao_encontrado');
          setImeiInfo(null);
          setImeiError('IMEI não encontrado no estoque. Cadastre o rastreador antes.');
        } else if (rastreador.status !== 'estoque') {
          setImeiStatus('indisponivel');
          setImeiInfo({ codigo: rastreador.codigo, plataforma: rastreador.plataforma, status: rastreador.status });
          setImeiError(`Rastreador ${rastreador.codigo || rastreador.id.slice(0, 8)} não está disponível (status: ${rastreador.status})`);
        } else {
          setImeiStatus('disponivel');
          setImeiInfo({ codigo: rastreador.codigo, plataforma: rastreador.plataforma });
          setImeiError('');
        }
      } catch (err) {
        console.error('Erro ao validar IMEI:', err);
        setImeiStatus('idle');
        setImeiError('Erro ao validar IMEI');
      } finally {
        setImeiValidando(false);
      }
    };

    // Debounce de 500ms para evitar requisições excessivas
    const timeout = setTimeout(validarImeiNoBanco, 500);
    return () => clearTimeout(timeout);
  }, [imeiRastreador, isImeiValido]);

  // Upload de fotos de ressalva para o storage
  const handleAddFotoRessalva = async (file: File) => {
    if (!id) return;
    setUploadingRessalvaFoto(true);
    try {
      const fileName = `ressalvas/${id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('instalacoes')
        .upload(fileName, file, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage.from('instalacoes').getPublicUrl(fileName);
      const preview = urlData.publicUrl;
      setFotosRessalva(prev => [...prev, { file, preview }]);
      toast.success('Foto adicionada');
    } catch (err) {
      toast.error('Erro ao enviar foto');
    } finally {
      setUploadingRessalvaFoto(false);
    }
  };

  const handleRemoveFotoRessalva = (index: number) => {
    setFotosRessalva(prev => prev.filter((_, i) => i !== index));
  };

  const handleConcluirInstalacao = async () => {
    if (!id || !servico?.veiculos?.id || !servico?.associados?.id) {
      toast.error('Dados incompletos');
      return;
    }

    if (!decisaoInstalador) {
      toast.error('Selecione a decisão da instalação');
      return;
    }

    // Validar ressalvas obrigatórias
    if (decisaoInstalador === 'aprovado_ressalva' && !ressalvasTexto.trim()) {
      toast.error('Descreva as ressalvas identificadas');
      return;
    }
    
    // Se veículo precisa de rastreador, validar IMEI e local de instalação
    if (veiculoPrecisaRastreador && decisaoInstalador !== 'negado') {
      const rastreadorValido = rastreadorSelecionadoId || imeiStatus === 'disponivel';
      if (!rastreadorValido || !imeiRastreador) {
        toast.error('Selecione ou informe o rastreador instalado');
        return;
      }
      if (!localInstalacao) {
        toast.error('Selecione o local de instalação do rastreador');
        return;
      }
      if (!descricaoInstalacao.trim()) {
        toast.error('Descreva o ponto exato de instalação do rastreador');
        return;
      }
    }
    
    try {
      await aprovarVeiculoMutation.mutateAsync({
        servicoId: id,
        veiculoId: servico.veiculos.id,
        associadoId: servico.associados.id,
        imeiRastreador: veiculoPrecisaRastreador ? imeiRastreador : undefined,
        decisaoInstalador: decisaoInstalador as 'aprovado' | 'aprovado_ressalva',
        ressalvasInstalador: ressalvasTexto.trim() || undefined,
        fotosRessalva: fotosRessalva.length > 0 ? fotosRessalva.map(f => f.preview) : undefined,
        localInstalacao: veiculoPrecisaRastreador && decisaoInstalador !== 'negado' ? localInstalacao : undefined,
        descricaoInstalacao: veiculoPrecisaRastreador && decisaoInstalador !== 'negado' ? descricaoInstalacao.trim() : undefined,
      });
      navigate('/instalador');
    } catch (err) {
      toast.error('Erro ao concluir instalação');
    }
  };

  const handleRecusarVeiculo = async (motivoCompleto: string, fotos: File[]) => {
    if (!id || !servico?.veiculos?.id || !servico?.associados?.id) return;
    try {
      // Upload das fotos de evidência para o storage
      const fotosUrls: string[] = [];
      for (const foto of fotos) {
        const timestamp = Date.now();
        const fileName = `recusas/${id}/${timestamp}_${foto.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('instalacoes')
          .upload(fileName, foto, { cacheControl: '3600', upsert: false });
        
        if (uploadError) {
          console.error('Erro ao fazer upload de foto de recusa:', uploadError);
          continue;
        }
        const { data: urlData } = supabase.storage
          .from('instalacoes')
          .getPublicUrl(uploadData.path);
        fotosUrls.push(urlData.publicUrl);
      }

      await recusarVeiculoMutation.mutateAsync({
        servicoId: id,
        veiculoId: servico.veiculos.id,
        associadoId: servico.associados.id,
        motivo: motivoCompleto,
        fotosRecusa: fotosUrls,
      });
      setShowModalRecusa(false);
      navigate('/instalador');
    } catch (err) {
      toast.error('Erro ao recusar veículo');
    }
  };

  const podeAvancar = () => {
    switch (etapaAtual) {
      case 1: return true;
      case 2: return checklistCompleto;
      case 3: return fotosObrigatoriasCompletas && video360Enviado;
      case 4: return !!assinaturaUrl || !!servico?.assinatura_cliente_url;
      default: return true;
    }
  };

  const avancar = async () => {
    if (etapaAtual < ETAPAS.length && podeAvancar()) {
      // Salvar checklist e quilometragem ao sair da etapa 2
      if (etapaAtual === 2 && id) {
        try {
          await salvarChecklistMutation.mutateAsync({
            id,
            checklist_data: checklist,
            quilometragem: quilometragem ? parseInt(quilometragem) : undefined,
          });
        } catch (err) {
          toast.error('Erro ao salvar checklist');
          return;
        }
      }
      setEtapaAtual(etapaAtual + 1);
    }
  };

  const voltar = () => {
    if (etapaAtual > 1) {
      setEtapaAtual(etapaAtual - 1);
    } else {
      navigate('/instalador');
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 p-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <p className="mt-4 text-white">Serviço não encontrado</p>
        <Button onClick={() => navigate('/instalador')} className="mt-4">
          Voltar
        </Button>
      </div>
    );
  }

  // Verificar se o serviço já foi finalizado (bloqueio de edição)
  const servicoFinalizado = ['concluida', 'cancelada'].includes(servico?.status || '');
  
  if (servicoFinalizado) {
    const foiConcluido = servico.status === 'concluida';
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-900 p-6">
        <div className={`rounded-full p-6 ${foiConcluido ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
          {foiConcluido ? (
            <ShieldCheck className="h-16 w-16 text-green-500" />
          ) : (
            <ShieldX className="h-16 w-16 text-red-500" />
          )}
        </div>
        
        <div className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${
          foiConcluido ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>
          <Lock className="h-3 w-3" />
          Instalação {foiConcluido ? 'Concluída' : 'Cancelada'}
        </div>
        
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-white">
            Instalação Finalizada
          </h2>
          <p className="text-slate-400 max-w-sm">
            Esta instalação já foi {foiConcluido ? 'concluída' : 'cancelada'} e não pode mais ser editada.
          </p>
        </div>

        <Card className="border-slate-700 bg-slate-800 w-full max-w-sm">
          <CardContent className="py-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Veículo:</span>
              <span className="text-white font-medium">{servico.veiculos?.placa}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Associado:</span>
              <span className="text-white">{servico.associados?.nome}</span>
            </div>
            {servico.updated_at && (
              <div className="flex justify-between">
                <span className="text-slate-400">Concluída em:</span>
                <span className="text-white">
                  {new Date(servico.updated_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Button 
          onClick={() => navigate('/instalador')} 
          className="mt-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Fila
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-slate-900">
      {/* Progress Bar */}
      <div className="sticky top-0 z-40 border-b border-slate-700 bg-slate-800 px-4 py-3">
        <div className="mb-2 flex justify-between">
          {ETAPAS.map((etapa) => {
            const Icon = etapa.icon;
            const isActive = etapa.id === etapaAtual;
            const isCompleted = etapa.id < etapaAtual;
            return (
              <div
                key={etapa.id}
                className={`flex flex-col items-center ${
                  isActive ? 'text-blue-400' : isCompleted ? 'text-green-400' : 'text-slate-500'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="mt-1 text-[10px]">{etapa.label}</span>
              </div>
            );
          })}
        </div>
        <Progress value={progresso} className="h-1" />
      </div>

      {/* Temporizador de Execução */}
      {servico?.iniciada_em && (
        <TemporizadorExecucao 
          iniciadaEm={servico.iniciada_em} 
          className="mx-4 mt-4"
        />
      )}

      {/* Content */}
      <div className="flex-1 p-4 pb-24">
        {/* Etapa 1: Dados */}
        {etapaAtual === 1 && (
          <div className="space-y-4">
            <Card className="border-slate-700 bg-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <User className="h-4 w-4" />
                  Associado
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-medium text-white">{(servico as any).associados?.nome}</p>
                <div className="flex items-center gap-2 text-slate-400">
                  <Phone className="h-4 w-4" />
                  <span>{(servico as any).associados?.telefone}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-700 bg-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <Car className="h-4 w-4" />
                  Veículo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-medium text-white">
                  {(servico as any).veiculos?.marca} {(servico as any).veiculos?.modelo}
                </p>
                <p className="text-slate-400">Placa: {(servico as any).veiculos?.placa}</p>
                <p className="text-slate-400">Ano: {(servico as any).veiculos?.ano_modelo}</p>
                {(servico as any).veiculos?.cor && (
                  <p className="text-slate-400">Cor: {(servico as any).veiculos.cor}</p>
                )}
                {/* Badge indicando tipo de checklist */}
                <div className="pt-2">
                  {tipoVeiculo === 'moto' ? (
                    <Badge variant="secondary" className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                      <Bike className="h-3 w-3 mr-1" />
                      Checklist de Moto ({totalObrigatorias} fotos)
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                      <Car className="h-3 w-3 mr-1" />
                      Checklist de Automóvel ({totalObrigatorias} fotos)
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-700 bg-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <MapPin className="h-4 w-4" />
                  Endereço
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-400">
                <p>
                  {[(servico as any).logradouro, (servico as any).numero].filter(Boolean).join(', ')}
                </p>
                <p>
                  {[(servico as any).bairro, (servico as any).cidade, (servico as any).uf].filter(Boolean).join(' - ')}
                </p>
                {(servico as any).cep && <p>CEP: {(servico as any).cep}</p>}
              </CardContent>
            </Card>

            {(servico as any).rastreadores && (
              <Card className="border-slate-700 bg-slate-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-white">Rastreador</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-400">
                  <p>Código: {(servico as any).rastreadores.codigo}</p>
                  {(servico as any).rastreadores.numero_serie && (
                    <p>Série: {(servico as any).rastreadores.numero_serie}</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Etapa 2: Checklist */}
        {etapaAtual === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Verifique todos os itens antes de iniciar a instalação:
            </p>
            
            {/* Card de KM identificado pela IA (extraído da foto do odômetro) */}
            <Card className={cn(
              "border transition-all",
              processandoOCR 
                ? "bg-blue-950/20 border-blue-800/50 animate-pulse"
                : kmIdentificado 
                  ? "bg-emerald-950/30 border-emerald-800"
                  : "bg-slate-800 border-slate-700"
            )}>
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-full",
                    processandoOCR ? "bg-blue-500/20" : kmIdentificado ? "bg-emerald-500/30" : "bg-slate-600"
                  )}>
                    <Gauge className={cn(
                      "h-6 w-6",
                      processandoOCR ? "text-blue-400" : kmIdentificado ? "text-emerald-400" : "text-slate-400"
                    )} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-400">
                      {processandoOCR 
                        ? 'Analisando odômetro...' 
                        : kmIdentificado 
                          ? 'Quilometragem Identificada (IA)' 
                          : 'Quilometragem (via foto do odômetro)'}
                    </p>
                    {processandoOCR ? (
                      <div className="flex items-center gap-2 mt-1">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                        <span className="text-sm text-slate-300">Processando imagem...</span>
                      </div>
                    ) : kmIdentificado ? (
                      <p className="font-bold text-emerald-400 text-lg">
                        {kmIdentificado.toLocaleString('pt-BR')} km
                      </p>
                    ) : (
                      <p className="text-sm text-slate-500">
                        Capture a foto do odômetro na próxima etapa
                      </p>
                    )}
                  </div>
                  {kmIdentificado && !processandoOCR && (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Itens do Checklist */}
            {checklistItems.map((item) => (
              <ChecklistItem
                key={item.id}
                label={item.label}
                status={checklist[item.id]?.status || 'pendente'}
                observacao={checklist[item.id]?.observacao}
                fotos={checklist[item.id]?.fotos}
                uploadingFoto={uploadingChecklistFoto === item.id}
                onStatusChange={(status) => handleChecklistChange(item.id, status)}
                onObservacaoChange={(obs) => handleObservacaoChange(item.id, obs)}
                onAddFoto={(file) => handleAddFotoChecklist(item.id, file)}
                onRemoveFoto={(index) => handleRemoveFotoChecklist(item.id, index)}
              />
            ))}
          </div>
        )}

        {/* Etapa 3: Fotos da Vistoria Completa (31 fotos + vídeo) */}
        {etapaAtual === 3 && (
          <div className="space-y-4">
            {/* Header com progresso geral */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">
                  Capture as fotos obrigatórias da vistoria:
                </p>
              </div>
              <div className={cn(
                "text-sm font-medium px-3 py-1 rounded-full",
                totalFotosEnviadas === totalObrigatorias
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-blue-500/20 text-blue-400"
              )}>
                {totalFotosEnviadas}/{totalObrigatorias} fotos
              </div>
            </div>

            {/* Loading da vistoria */}
            {isLoadingVistoria && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                <span className="ml-2 text-slate-400">Carregando vistoria...</span>
              </div>
            )}

            {/* Erro ao criar/carregar vistoria */}
            {!isLoadingVistoria && !vistoriaId && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="h-8 w-8 text-amber-500 mb-3" />
                <p className="text-white font-medium">Não foi possível carregar a vistoria</p>
                <p className="text-sm text-slate-400 mb-4">
                  Ocorreu um erro ao criar o registro de vistoria. Tente novamente.
                </p>
                <Button 
                  variant="outline"
                  onClick={() => window.location.reload()}
                  className="gap-2"
                >
                  <Loader2 className="h-4 w-4" />
                  Tentar novamente
                </Button>
              </div>
            )}

            {/* Categorias de Fotos */}
            {!isLoadingVistoria && vistoriaId && (
              <div className="space-y-3">
                {categoriasComFotos.map((categoria) => {
                  const { enviadas, total } = getProgressoCategoria(categoria.fotos);
                  const isComplete = enviadas === total;
                  const isOpen = openCategorias.includes(categoria.id);

                  return (
                    <Collapsible
                      key={categoria.id}
                      open={isOpen}
                      onOpenChange={() => toggleCategoria(categoria.id)}
                    >
                      <CollapsibleTrigger className="w-full">
                        <div
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg border transition-all",
                            isComplete
                              ? "bg-emerald-950/30 border-emerald-800"
                              : "bg-slate-800 border-slate-700 hover:border-slate-600"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            {isOpen ? (
                              <ChevronDown className="h-4 w-4 text-slate-400" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-slate-400" />
                            )}
                            <span className="font-medium text-white text-sm">{categoria.nome}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            {isComplete && (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            )}
                            <span
                              className={cn(
                                "text-xs font-medium px-2 py-0.5 rounded-full",
                                isComplete
                                  ? "bg-emerald-900/50 text-emerald-300"
                                  : "bg-slate-700 text-slate-400"
                              )}
                            >
                              {enviadas}/{total}
                            </span>
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="grid grid-cols-2 gap-3 mt-3 px-1">
                          {categoria.fotos.map((foto) => (
                            <VistoriaFotoCard
                              key={foto.id}
                              foto={foto}
                              fotoUrl={getFotoUrl(foto.id)}
                              isUploading={uploadingFoto === foto.id}
                              onUpload={(file) => handleFotoCapture(foto.id, file)}
                            />
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}


                {/* Vídeo 360 Obrigatório */}
                <Card className={cn(
                  "border transition-all",
                  video360Enviado
                    ? "bg-emerald-950/30 border-emerald-800"
                    : "bg-slate-800 border-slate-700"
                )}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-white">
                        <Video className="h-4 w-4" />
                        Vídeo 360° Obrigatório
                      </div>
                      {video360Enviado && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      )}
                    </CardTitle>
                    <p className="text-xs text-slate-400">
                      {tipoVeiculo === 'moto' 
                        ? 'Inicie pelo chassi e dê a volta completa na moto (foco em tanque, manetes e escape)'
                        : 'Inicie pelo chassi e faça uma volta completa ao redor do veículo'}
                    </p>
                  </CardHeader>
                  <CardContent>
                    {video360Enviado ? (
                      <div className="space-y-3">
                        <video 
                          src={videoUrl} 
                          controls 
                          className="w-full rounded-lg max-h-48"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-slate-600 text-slate-300"
                          onClick={() => {
                            const input = document.getElementById('video-input') as HTMLInputElement;
                            input?.click();
                          }}
                          disabled={uploadingVideo}
                        >
                          {uploadingVideo ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Video className="h-4 w-4 mr-2" />
                          )}
                          Substituir vídeo
                        </Button>
                      </div>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => {
                          const input = document.getElementById('video-input') as HTMLInputElement;
                          input?.click();
                        }}
                        disabled={uploadingVideo}
                      >
                        {uploadingVideo ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Video className="h-4 w-4 mr-2" />
                            Gravar Vídeo 360°
                          </>
                        )}
                      </Button>
                    )}
                    <input
                      id="video-input"
                      type="file"
                      accept="video/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleVideoCapture(file);
                        e.target.value = '';
                      }}
                    />
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Etapa 4: Assinatura */}
        {etapaAtual === 4 && (
          <div className="space-y-4">
            {/* Alerta se fotos ou vídeo estão incompletos */}
            {(!fotosObrigatoriasCompletas || !video360Enviado) && (
              <Card className="border-amber-500/50 bg-amber-500/10">
                <CardContent className="flex items-center gap-3 p-4">
                  <AlertCircle className="h-6 w-6 text-amber-400 shrink-0" />
                  <div>
                    <p className="font-medium text-amber-300">Etapas anteriores incompletas</p>
                    <p className="text-sm text-slate-400">
                      Complete o envio de todas as fotos obrigatórias{!video360Enviado && ' e o vídeo 360°'} antes de coletar a assinatura.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-slate-700 bg-slate-800">
              <CardHeader>
                <CardTitle className="text-base text-white">
                  Assinatura do Associado
                </CardTitle>
                <p className="text-sm text-slate-400">
                  {(servico as any).associados?.nome}
                </p>
              </CardHeader>
              <CardContent>
                {assinaturaUrl || (servico as any).assinatura_cliente_url ? (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
                      <div className="flex items-center gap-2 text-green-400">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="font-medium">Assinatura coletada</span>
                      </div>
                      <img
                        src={assinaturaUrl || (servico as any).assinatura_cliente_url || ''}
                        alt="Assinatura"
                        className="mt-3 rounded-lg bg-white"
                      />
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setAssinaturaUrl(null)}
                      className="w-full border-slate-600 text-slate-300"
                    >
                      Coletar nova assinatura
                    </Button>
                  </div>
                ) : (
                  <SignaturePad
                    onSave={handleAssinaturaSave}
                    disabled={saveAssinaturaMutation.isPending || !fotosObrigatoriasCompletas || !video360Enviado}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Etapa 5: Decisão do Instalador */}
        {etapaAtual === 5 && (
          <div className="space-y-4">
            {/* Resumo dos dados */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between rounded-lg bg-slate-800 p-3">
                <span className="text-slate-400">Associado</span>
                <span className="text-white">{(servico as any).associados?.nome}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-slate-800 p-3">
                <span className="text-slate-400">Veículo</span>
                <span className="text-white">{(servico as any).veiculos?.placa}</span>
              </div>
              {quilometragem && (
                <div className="flex justify-between rounded-lg bg-slate-800 p-3">
                  <span className="text-slate-400">Quilometragem</span>
                  <span className="text-white">{parseInt(quilometragem).toLocaleString('pt-BR')} km</span>
                </div>
              )}
              <div className="flex justify-between rounded-lg bg-slate-800 p-3">
                <span className="text-slate-400">Fotos / Vídeo 360°</span>
                <span className="text-white">
                  {totalFotosEnviadas}/{totalObrigatorias} • {video360Enviado ? '✓' : '—'}
                </span>
              </div>
            </div>

            {/* Alerta de itens NOK no checklist */}
            {temItensNok && (
              <Alert className="border-amber-500/50 bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <AlertDescription className="text-amber-200">
                  <strong className="text-amber-300">Itens reprovados no checklist:</strong>
                  <ul className="mt-2 space-y-1 text-sm text-slate-300">
                    {itensNok.map(item => (
                      <li key={item.id} className="flex items-start gap-2">
                        <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                        <span>
                          <strong>{item.label}</strong>
                          {checklist[item.id]?.observacao && (
                            <span className="text-slate-400"> — {checklist[item.id].observacao}</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-amber-400">
                    A opção "Aprovado" está bloqueada. Selecione "Aprovado com Ressalva" ou "Negado".
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {/* Decisão obrigatória */}
            <Card className="border-slate-700 bg-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-white">Decisão da Instalação *</CardTitle>
                <p className="text-sm text-slate-400">Selecione o resultado da análise do veículo</p>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={decisaoInstalador || ''}
                  onValueChange={(v) => {
                    if (v === 'aprovado' && temItensNok) return;
                    setDecisaoInstalador(v as 'aprovado' | 'aprovado_ressalva' | 'negado');
                    if (v === 'aprovado') {
                      setRessalvasTexto('');
                      setFotosRessalva([]);
                    }
                    // Pre-preencher ressalvas com itens NOK
                    if (v === 'aprovado_ressalva' && temItensNok && !ressalvasTexto.trim()) {
                      const textoNok = itensNok.map(item => 
                        `${item.label}${checklist[item.id]?.observacao ? ': ' + checklist[item.id].observacao : ''}`
                      ).join('\n');
                      setRessalvasTexto(textoNok);
                    }
                  }}
                  className="space-y-3"
                >
                  {/* Aprovado */}
                  <label
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-4 transition-all",
                      temItensNok
                        ? "border-slate-700 opacity-50 cursor-not-allowed"
                        : decisaoInstalador === 'aprovado'
                          ? "border-emerald-500 bg-emerald-500/10 cursor-pointer"
                          : "border-slate-600 hover:border-slate-500 cursor-pointer"
                    )}
                  >
                    <RadioGroupItem value="aprovado" className="mt-0.5" disabled={temItensNok} />
                    <div>
                      <p className="font-medium text-white flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                        Aprovado
                        {temItensNok && <Lock className="h-3 w-3 text-slate-500" />}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Instalação realizada normalmente, sem irregularidades
                      </p>
                    </div>
                  </label>

                  {/* Aprovado com ressalva */}
                  <label
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-all",
                      decisaoInstalador === 'aprovado_ressalva'
                        ? "border-amber-500 bg-amber-500/10"
                        : "border-slate-600 hover:border-slate-500"
                    )}
                  >
                    <RadioGroupItem value="aprovado_ressalva" className="mt-0.5" />
                    <div>
                      <p className="font-medium text-white flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-400" />
                        Aprovado com Ressalva
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Instalação realizada com observações registradas (bateria fraca, pequenas avarias, etc.)
                      </p>
                    </div>
                  </label>

                  {/* Negado */}
                  <label
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-all",
                      decisaoInstalador === 'negado'
                        ? "border-red-500 bg-red-500/10"
                        : "border-slate-600 hover:border-slate-500"
                    )}
                  >
                    <RadioGroupItem value="negado" className="mt-0.5" />
                    <div>
                      <p className="font-medium text-white flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-400" />
                        Negado (Não Instalar)
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Irregularidade grave: chassi divergente, documento irregular, sinistro relevante, etc.
                      </p>
                    </div>
                  </label>
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Campos condicionais: Ressalva */}
            {decisaoInstalador === 'aprovado_ressalva' && (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-amber-300 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Descreva as Ressalvas *
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    placeholder="Ex: Bateria fraca, pneus desgastados, pequena avaria no para-choque..."
                    value={ressalvasTexto}
                    onChange={(e) => setRessalvasTexto(e.target.value)}
                    rows={3}
                    className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                  />
                  {!ressalvasTexto.trim() && (
                    <p className="text-xs text-amber-400">Descrição obrigatória</p>
                  )}

                  {/* Fotos de evidência */}
                  <div>
                    <Label className="text-sm text-slate-300">Fotos de Evidência (opcional)</Label>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {fotosRessalva.map((foto, index) => (
                        <div key={index} className="relative aspect-square">
                          <img src={foto.preview} alt={`Evidência ${index + 1}`} className="h-full w-full rounded-lg object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemoveFotoRessalva(index)}
                            className="absolute -right-1 -top-1 rounded-full bg-red-500 p-1 text-white shadow-lg"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      {fotosRessalva.length < 5 && (
                        <button
                          type="button"
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.capture = 'environment';
                            input.onchange = (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0];
                              if (file) handleAddFotoRessalva(file);
                            };
                            input.click();
                          }}
                          disabled={uploadingRessalvaFoto}
                          className="flex aspect-square flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-600 bg-slate-800 hover:border-slate-500"
                        >
                          {uploadingRessalvaFoto ? (
                            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                          ) : (
                            <>
                              <Camera className="h-6 w-6 text-slate-400" />
                              <span className="mt-1 text-xs text-slate-500">Adicionar</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Alerta de dispensa de rastreador */}
            {!veiculoPrecisaRastreador && decisaoInstalador !== 'negado' && (
              <Alert className="border-blue-500/50 bg-blue-500/10">
                <Router className="h-4 w-4 text-blue-400" />
                <AlertDescription className="text-blue-200">
                  <strong className="text-blue-300">Rastreador dispensado</strong>
                  <br />
                  <span className="text-slate-400">
                    Veículo com FIPE abaixo de R$ {(tipoVeiculo === 'moto' ? fipeMinRastreadorMoto : fipeMinRastreador).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} não requer instalação de rastreador.
                    {valorFipeVeiculo && (
                      <span className="block mt-1">
                        FIPE do veículo: R$ {valorFipeVeiculo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                  </span>
                </AlertDescription>
              </Alert>
            )}

            {/* Local de Instalação do Rastreador */}
            {veiculoPrecisaRastreador && decisaoInstalador !== 'negado' && (
              <Card className="border-cyan-500/50 bg-cyan-500/10">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base text-white">
                    <MapPin className="h-5 w-5 text-cyan-400" />
                    Local de Instalação do Rastreador
                  </CardTitle>
                  <p className="text-sm text-slate-400">
                    Informe onde o rastreador foi instalado fisicamente no veículo
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-300">Local de Instalação *</Label>
                    <Select value={localInstalacao} onValueChange={setLocalInstalacao}>
                      <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                        <SelectValue placeholder="Selecione o local" />
                      </SelectTrigger>
                      <SelectContent>
                        {locaisInstalacao.map(local => (
                          <SelectItem key={local.value} value={local.value}>{local.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-300">Descrição do ponto exato *</Label>
                    <Textarea
                      placeholder="Ex: Sob o volante, lado esquerdo, fixado com abraçadeira no chicote principal"
                      value={descricaoInstalacao}
                      onChange={(e) => setDescricaoInstalacao(e.target.value)}
                      className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 min-h-[80px]"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Seleção de Rastreador - apenas se precisa e não negado */}
            {veiculoPrecisaRastreador && decisaoInstalador !== 'negado' && (
            <Card className={cn(
              "border-purple-500/50 bg-purple-500/10",
              (imeiStatus === 'disponivel' || rastreadorSelecionadoId) && "border-green-500/50 bg-green-500/10",
              imeiStatus === 'nao_encontrado' && "border-destructive/50 bg-destructive/10",
              imeiStatus === 'indisponivel' && "border-amber-500/50 bg-amber-500/10"
            )}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <Router className="h-5 w-5 text-purple-400" />
                  Rastreador Instalado
                </CardTitle>
                <p className="text-sm text-slate-400">
                  {rastreadoresEmPorte && rastreadoresEmPorte.length > 0
                    ? 'Selecione o rastreador do seu porte que foi instalado'
                    : 'Você não possui rastreadores em porte. Use o modo manual ou solicite ao coordenador.'}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Dropdown de rastreadores em porte */}
                {!modoManualImei && (
                  <>
                    {isLoadingRastreadores ? (
                      <div className="flex items-center gap-2 text-slate-400 py-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Carregando rastreadores...</span>
                      </div>
                    ) : rastreadoresEmPorte && rastreadoresEmPorte.length > 0 ? (
                      <>
                        <Select
                          value={rastreadorSelecionadoId || ''}
                          onValueChange={(value) => {
                            if (value === 'manual') {
                              setModoManualImei(true);
                              setRastreadorSelecionadoId(null);
                              setImeiRastreador('');
                              setImeiStatus('idle');
                              setImeiInfo(null);
                            } else {
                              setRastreadorSelecionadoId(value);
                              const rastreador = rastreadoresEmPorte.find(r => r.id === value);
                              if (rastreador?.imei) {
                                setImeiRastreador(rastreador.imei);
                                setImeiStatus('disponivel');
                                setImeiInfo({ codigo: rastreador.codigo, plataforma: rastreador.plataforma });
                                setImeiError('');
                              }
                            }
                          }}
                        >
                          <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                            <SelectValue placeholder="Selecione um rastreador" />
                          </SelectTrigger>
                          <SelectContent>
                            {rastreadoresEmPorte.map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                <div className="flex items-center gap-2">
                                  <Package className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{r.codigo}</span>
                                  {r.plataforma && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary capitalize">
                                      {r.plataforma.replace(/_/g, ' ')}
                                    </span>
                                  )}
                                  {r.imei && (
                                    <span className="text-muted-foreground font-mono text-xs">
                                      IMEI: {r.imei}
                                    </span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                            <SelectItem value="manual">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Search className="h-4 w-4" />
                                <span>Outro IMEI (não está na minha lista)</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-400">
                          {rastreadoresEmPorte.length} rastreador(es) em seu porte
                        </p>
                      </>
                    ) : (
                      <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
                        <p className="text-sm text-amber-400 flex items-center gap-2 font-medium">
                          <AlertCircle className="h-4 w-4" />
                          Nenhum rastreador em porte
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Solicite rastreadores ao coordenador ou use o modo manual abaixo.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 border-slate-600 text-slate-300"
                          onClick={() => setModoManualImei(true)}
                        >
                          <Search className="h-4 w-4 mr-2" />
                          Inserir IMEI manualmente
                        </Button>
                      </div>
                    )}

                    {rastreadorSelecionadoId && (
                      <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-3">
                        <p className="text-sm text-green-400 flex items-center gap-2 font-medium">
                          <CheckCircle2 className="h-4 w-4" />
                          Rastreador selecionado
                        </p>
                        <div className="mt-2 text-xs text-slate-300 space-y-1">
                          {imeiInfo?.codigo && (
                            <p>Código: <span className="font-mono font-medium">{imeiInfo.codigo}</span></p>
                          )}
                          {imeiRastreador && (
                            <p>IMEI: <span className="font-mono font-medium">{imeiRastreador}</span></p>
                          )}
                          {imeiInfo?.plataforma && (
                            <p>Plataforma: <span className="capitalize">{imeiInfo.plataforma.replace('_', ' ')}</span></p>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Modo manual de IMEI */}
                {modoManualImei && (
                  <>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-slate-300">IMEI Manual (15-17 dígitos)</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-slate-400"
                        onClick={() => {
                          setModoManualImei(false);
                          setImeiRastreador('');
                          setImeiStatus('idle');
                          setImeiInfo(null);
                          setImeiError('');
                        }}
                      >
                        ← Voltar à lista
                      </Button>
                    </div>
                    <div className="relative">
                      <Input
                        id="imei-rastreador"
                        type="text"
                        inputMode="numeric"
                        placeholder="000000000000000"
                        value={imeiRastreador}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          setImeiRastreador(value);
                          setRastreadorSelecionadoId(null);
                          setImeiStatus('idle');
                          setImeiInfo(null);
                          if (value && !/^\d{15,17}$/.test(value)) {
                            setImeiError('IMEI deve ter entre 15 e 17 dígitos');
                          } else {
                            setImeiError('');
                          }
                        }}
                        maxLength={17}
                        className={cn(
                          "text-lg font-mono tracking-wider bg-slate-800 border-slate-600 pr-10",
                          imeiStatus === 'nao_encontrado' && 'border-destructive',
                          imeiStatus === 'indisponivel' && 'border-amber-500',
                          imeiStatus === 'disponivel' && 'border-green-500'
                        )}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {imeiValidando && <Loader2 className="h-5 w-5 animate-spin text-blue-400" />}
                        {imeiStatus === 'disponivel' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                        {imeiStatus === 'nao_encontrado' && <XCircle className="h-5 w-5 text-destructive" />}
                        {imeiStatus === 'indisponivel' && <AlertCircle className="h-5 w-5 text-amber-500" />}
                      </div>
                    </div>

                    {imeiValidando && (
                      <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-3">
                        <p className="text-sm text-blue-400 flex items-center gap-2">
                          <Search className="h-4 w-4" />
                          Verificando disponibilidade no estoque...
                        </p>
                      </div>
                    )}

                    {imeiStatus === 'disponivel' && imeiInfo && (
                      <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-3">
                        <p className="text-sm text-green-400 flex items-center gap-2 font-medium">
                          <CheckCircle2 className="h-4 w-4" />
                          Rastreador disponível no estoque
                        </p>
                        <div className="mt-2 text-xs text-slate-300 space-y-1">
                          {imeiInfo.codigo && <p>Código: <span className="font-mono font-medium">{imeiInfo.codigo}</span></p>}
                          {imeiInfo.plataforma && <p>Plataforma: <span className="capitalize">{imeiInfo.plataforma.replace('_', ' ')}</span></p>}
                        </div>
                      </div>
                    )}

                    {imeiStatus === 'nao_encontrado' && (
                      <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3">
                        <p className="text-sm text-destructive flex items-center gap-2 font-medium">
                          <XCircle className="h-4 w-4" />
                          IMEI não encontrado no estoque
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Cadastre o rastreador no sistema antes de instalá-lo.
                        </p>
                      </div>
                    )}

                    {imeiStatus === 'indisponivel' && imeiInfo && (
                      <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
                        <p className="text-sm text-amber-400 flex items-center gap-2 font-medium">
                          <AlertCircle className="h-4 w-4" />
                          Rastreador não disponível
                        </p>
                        <div className="mt-2 text-xs text-slate-300 space-y-1">
                          {imeiInfo.codigo && <p>Código: <span className="font-mono font-medium">{imeiInfo.codigo}</span></p>}
                          <p>Status atual: <Badge variant="outline" className="text-amber-400 border-amber-400/50 ml-1">{imeiInfo.status}</Badge></p>
                        </div>
                      </div>
                    )}

                    {imeiError && imeiStatus === 'idle' && !imeiValidando && (
                      <p className="text-sm text-destructive">{imeiError}</p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
            )}

            {/* Botões de ação */}
            <div className="space-y-3 mt-6">
              {decisaoInstalador === 'negado' ? (
                <Button
                  variant="destructive"
                  onClick={() => setShowModalRecusa(true)}
                  disabled={aprovarVeiculoMutation.isPending || recusarVeiculoMutation.isPending}
                  className="w-full py-6 text-lg font-semibold"
                >
                  <XCircle className="mr-2 h-5 w-5" />
                  Registrar Recusa do Veículo
                </Button>
              ) : (
                <Button
                  onClick={handleConcluirInstalacao}
                  disabled={
                    !decisaoInstalador ||
                    (decisaoInstalador === 'aprovado_ressalva' && !ressalvasTexto.trim()) ||
                    (veiculoPrecisaRastreador && !rastreadorSelecionadoId && imeiStatus !== 'disponivel') ||
                    (veiculoPrecisaRastreador && (!localInstalacao || !descricaoInstalacao.trim())) ||
                    aprovarVeiculoMutation.isPending ||
                    recusarVeiculoMutation.isPending
                  }
                  className={cn(
                    "w-full py-6 text-lg font-semibold",
                    decisaoInstalador === 'aprovado_ressalva'
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  )}
                >
                  {aprovarVeiculoMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Finalizando...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="mr-2 h-5 w-5" />
                      {decisaoInstalador === 'aprovado_ressalva' 
                        ? 'Concluir com Ressalva' 
                        : 'Concluir Instalação'}
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Modal de Recusa (para decisão Negado) */}
            <ModalRecusaVeiculoComFotos
              open={showModalRecusa}
              onClose={() => setShowModalRecusa(false)}
              onConfirm={({ motivoCompleto, fotos }) => {
                handleRecusarVeiculo(motivoCompleto, fotos);
              }}
              isPending={recusarVeiculoMutation.isPending}
              veiculoInfo={{
                placa: (servico as any).veiculos?.placa,
                modelo: (servico as any).veiculos?.modelo,
              }}
            />
          </div>
        )}
      </div>

      {/* Footer com navegação - FIXO na parte inferior - z-index maior que o menu do layout */}
      <div className="fixed bottom-0 left-0 right-0 z-[60] border-t border-slate-700 bg-slate-800 p-4 safe-area-pb">
        <div className="flex gap-3 max-w-lg mx-auto">
          <Button
            variant="outline"
            onClick={voltar}
            className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {etapaAtual === 1 ? 'Cancelar' : 'Voltar'}
          </Button>
          {etapaAtual < ETAPAS.length && (
            <Button
              onClick={avancar}
              disabled={!podeAvancar()}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              Próximo
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
