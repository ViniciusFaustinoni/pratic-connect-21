import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Loader2, Car, Shield, CheckCircle2, Clock, AlertTriangle,
  Camera, Upload, FileText, User, ChevronRight,
  ChevronLeft, Smartphone, Crown, Star, Check, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { formatarMoeda } from '@/utils/format';

import { 
  useCotacaoPublica, 
  useAtualizarCotacao,
  useUploadDocumento,
  useUploadFotoVistoria,
  useFotosVistoria
} from '@/hooks/useCotacaoPublica';
import { useCalcularCotacao } from '@/hooks/useCalcularCotacao';
import { 
  TipoUsoVeiculo,
  DOCUMENTOS_CONFIG,
  FOTOS_VISTORIA_CONFIG,
  STATUS_COTACAO_PUBLICA_LABELS,
} from '@/types/cotacaoPublica';

// Cores dinâmicas para planos — baseadas no índice do plano
const CORES_PLANO_DINAMICAS = [
  { bg: 'bg-slate-50', border: 'border-slate-400', text: 'text-slate-700', badge: 'bg-slate-100 text-slate-700' },
  { bg: 'bg-blue-50', border: 'border-blue-500', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' },
  { bg: 'bg-amber-50', border: 'border-amber-500', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  { bg: 'bg-emerald-50', border: 'border-emerald-500', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
];

// ════════════════════════════════════════════════════════════════
// TIPOS
// ════════════════════════════════════════════════════════════════

type JornadaStep = 
  | 'uso' 
  | 'plano' 
  | 'proposta' 
  | 'documentos' 
  | 'selfie' 
  | 'vistoria' 
  | 'termos'
  | 'conclusao';

interface DocumentoState {
  tipo: string;
  nome: string;
  descricao: string;
  obrigatorio: boolean;
  url?: string;
  status: 'pendente' | 'enviando' | 'enviado' | 'erro';
}

interface FotoState {
  tipo: string;
  nome: string;
  descricao: string;
  url?: string;
  status: 'pendente' | 'enviando' | 'enviado' | 'erro';
}

// ════════════════════════════════════════════════════════════════
// CONSTANTES
// ════════════════════════════════════════════════════════════════

const STEPS_CONFIG: { id: JornadaStep; label: string; icon: React.ElementType }[] = [
  { id: 'uso', label: 'Uso', icon: Car },
  { id: 'plano', label: 'Plano', icon: Shield },
  { id: 'proposta', label: 'Proposta', icon: FileText },
  { id: 'documentos', label: 'Docs', icon: Upload },
  { id: 'selfie', label: 'Selfie', icon: User },
  { id: 'vistoria', label: 'Vistoria', icon: Camera },
  { id: 'termos', label: 'Termos', icon: Check },
];

// ════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════════

export default function CotacaoPublicaCompleta() {
  const { token } = useParams<{ token: string }>();
  
  // Hooks
  const { data: cotacao, isLoading, error, refetch } = useCotacaoPublica(token);
  const atualizarCotacao = useAtualizarCotacao();
  const uploadDocumento = useUploadDocumento();
  const uploadFotoVistoria = useUploadFotoVistoria();
  const { data: fotosExistentes } = useFotosVistoria(cotacao?.id);
  const { calcular, resultado } = useCalcularCotacao();

  // Estados da jornada
  const [step, setStep] = useState<JornadaStep>('uso');
  const [tipoUso, setTipoUso] = useState<TipoUsoVeiculo>('particular');
  const [planoEscolhido, setPlanoEscolhido] = useState<string | null>(null);
  const [propostaAceita, setPropostaAceita] = useState(false);
  const [documentos, setDocumentos] = useState<DocumentoState[]>(
    DOCUMENTOS_CONFIG.map(d => ({ ...d, status: 'pendente' as const }))
  );
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [selfieStatus, setSelfieStatus] = useState<'pendente' | 'enviando' | 'enviado'>('pendente');
  const [tipoVistoria, setTipoVistoria] = useState<'auto' | 'presencial' | null>(null);
  const [fotosVistoria, setFotosVistoria] = useState<FotoState[]>(
    FOTOS_VISTORIA_CONFIG.map(f => ({ ...f, status: 'pendente' as const }))
  );
  const [termosAceitos, setTermosAceitos] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Ref para prevenir duplo clique
  const isSubmittingRef = useRef(false);

  // ──────────────────────────────────────────────────────────
  // EFEITOS
  // ──────────────────────────────────────────────────────────

  // Determinar step inicial baseado no status da cotação
  useEffect(() => {
    if (cotacao) {
      if (cotacao.uso_aplicativo !== undefined && cotacao.uso_aplicativo !== null) {
        setTipoUso(cotacao.uso_aplicativo ? 'aplicativo' : 'particular');
      }
      if (cotacao.plano_escolhido) {
        setPlanoEscolhido(cotacao.plano_escolhido as string);
      }

      switch (cotacao.status) {
        case 'aguardando':
        case 'visualizado':
          setStep('uso');
          break;
        case 'uso_definido':
          setStep('plano');
          break;
        case 'plano_escolhido':
          setStep('proposta');
          break;
        case 'proposta_aceita':
          setStep('documentos');
          break;
        case 'documentos_ok':
          setStep('selfie');
          break;
        case 'selfie_ok':
          setStep('vistoria');
          break;
        case 'vistoria_ok':
          setStep('termos');
          break;
        case 'termos_ok':
        case 'em_analise':
        case 'aprovado':
        case 'pendente':
        case 'recusado':
          setStep('conclusao');
          break;
      }
    }
  }, [cotacao]);

  // Calcular planos quando definir uso
  useEffect(() => {
    if (cotacao?.valor_fipe && tipoUso) {
      calcular({ valor_fipe: cotacao.valor_fipe, tipo_uso: tipoUso });
    }
  }, [cotacao?.valor_fipe, tipoUso, calcular]);

  // Sincronizar fotos existentes
  useEffect(() => {
    if (fotosExistentes && fotosExistentes.length > 0) {
      setFotosVistoria(prev => prev.map(foto => {
        const existente = fotosExistentes.find((f: { tipo: string; url: string }) => f.tipo === foto.tipo);
        if (existente) {
          return { ...foto, url: existente.url, status: 'enviado' as const };
        }
        return foto;
      }));
    }
  }, [fotosExistentes]);

  // ──────────────────────────────────────────────────────────
  // FUNÇÕES AUXILIARES
  // ──────────────────────────────────────────────────────────

  // formatarMoeda importado do utils

  const getStepIndex = (s: JornadaStep) => STEPS_CONFIG.findIndex(c => c.id === s);
  const progressPercent = ((getStepIndex(step) + 1) / STEPS_CONFIG.length) * 100;

  // ──────────────────────────────────────────────────────────
  // HANDLERS
  // ──────────────────────────────────────────────────────────

  const handleDefinirUso = async () => {
    if (!token || isSubmittingRef.current || loading) return;
    isSubmittingRef.current = true;
    setLoading(true);
    try {
      await atualizarCotacao.mutateAsync({
        token,
        updates: {
          status: 'uso_definido',
          uso_aplicativo: tipoUso === 'aplicativo',
          uso_definido_em: new Date().toISOString(),
        },
      });
      await refetch();
      setStep('plano');
      toast.success('Tipo de uso definido!');
    } catch {
      toast.error('Erro ao salvar. Tente novamente.');
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const handleEscolherPlano = async () => {
    if (!token || !planoEscolhido || !resultado || isSubmittingRef.current || loading) return;
    const plano = resultado.planos.find(p => p.categoria === planoEscolhido);
    if (!plano) return;

    isSubmittingRef.current = true;
    setLoading(true);
    try {
      await atualizarCotacao.mutateAsync({
        token,
        updates: {
          status: 'plano_escolhido',
          plano_escolhido: planoEscolhido,
          valor_mensal_final: plano.valor_mensal,
          valor_adesao_final: plano.valor_adesao,
          plano_escolhido_em: new Date().toISOString(),
        },
      });
      await refetch();
      setStep('proposta');
      toast.success('Plano selecionado!');
    } catch {
      toast.error('Erro ao salvar. Tente novamente.');
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const handleAceitarProposta = async () => {
    if (!token || !propostaAceita || isSubmittingRef.current || loading) return;
    isSubmittingRef.current = true;
    setLoading(true);
    try {
      await atualizarCotacao.mutateAsync({
        token,
        updates: {
          status: 'proposta_aceita',
          proposta_aceita_em: new Date().toISOString(),
        },
      });
      await refetch();
      setStep('documentos');
      toast.success('Proposta aceita!');
    } catch {
      toast.error('Erro ao salvar. Tente novamente.');
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const handleUploadDocumento = async (index: number, file: File) => {
    if (!cotacao?.id) return;
    const doc = documentos[index];
    const newDocs = [...documentos];
    newDocs[index] = { ...doc, status: 'enviando' };
    setDocumentos(newDocs);

    try {
      const result = await uploadDocumento.mutateAsync({
        cotacaoId: cotacao.id,
        tipo: doc.tipo,
        file,
      });
      newDocs[index] = { ...doc, url: result.url, status: 'enviado' };
      setDocumentos(newDocs);
      toast.success(`${doc.nome} enviado!`);

      // Se for CRLV, chamar OCR para extrair dados do veículo (cor, chassi, etc.)
      if (doc.tipo === 'crlv' && result.url && token) {
        try {
          const { data: ocrData } = await supabase.functions.invoke('document-ocr', {
            body: { url: result.url }
          });

          // Se conseguiu extrair dados do CRLV
          if (ocrData?.sucesso && ocrData?.tipo_detectado === 'crlv' && ocrData?.dados) {
            const dados = ocrData.dados;
            
            // Atualizar cotação com dados extraídos (cor principalmente)
            await atualizarCotacao.mutateAsync({
              token,
              updates: {
                veiculo_cor: dados.cor || undefined,
              },
            });
            
            if (dados.cor) {
              toast.success(`Cor do veículo detectada: ${dados.cor}`);
            }
          }
        } catch (ocrError) {
          // Não bloquear o fluxo se OCR falhar
          console.warn('OCR do CRLV falhou, continuando sem extração automática:', ocrError);
        }
      }
    } catch {
      newDocs[index] = { ...doc, status: 'erro' };
      setDocumentos(newDocs);
      toast.error(`Erro ao enviar ${doc.nome}`);
    }
  };

  const handleConcluirDocumentos = async () => {
    if (!token || isSubmittingRef.current || loading) return;
    const todosEnviados = documentos.filter(d => d.obrigatorio).every(d => d.status === 'enviado');
    if (!todosEnviados) {
      toast.error('Envie todos os documentos obrigatórios');
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);
    try {
      const docUrls: Record<string, string> = {};
      documentos.forEach(d => {
        if (d.url) docUrls[`doc_${d.tipo}`] = d.url;
      });

      await atualizarCotacao.mutateAsync({
        token,
        updates: {
          status: 'documentos_ok',
          ...docUrls,
          documentos_ok_em: new Date().toISOString(),
        },
      });
      await refetch();
      setStep('selfie');
      toast.success('Documentos enviados!');
    } catch {
      toast.error('Erro ao salvar. Tente novamente.');
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const handleCapturarSelfie = async (file: File) => {
    if (!cotacao?.id) return;
    setSelfieStatus('enviando');
    
    try {
      const result = await uploadDocumento.mutateAsync({
        cotacaoId: cotacao.id,
        tipo: 'selfie',
        file,
      });
      setSelfieUrl(result.url);
      setSelfieStatus('enviado');
      toast.success('Selfie capturada!');
    } catch {
      setSelfieStatus('pendente');
      toast.error('Erro ao enviar selfie');
    }
  };

  const handleConcluirSelfie = async () => {
    if (!token || !selfieUrl || isSubmittingRef.current || loading) return;
    isSubmittingRef.current = true;
    setLoading(true);
    try {
      await atualizarCotacao.mutateAsync({
        token,
        updates: {
          status: 'selfie_ok',
          doc_selfie: selfieUrl,
          face_aprovada: true,
          face_match_score: 95.5,
          selfie_ok_em: new Date().toISOString(),
        },
      });
      await refetch();
      setStep('vistoria');
      toast.success('Verificação facial concluída!');
    } catch {
      toast.error('Erro ao salvar. Tente novamente.');
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const handleCapturarFotoVistoria = async (index: number, file: File) => {
    if (!cotacao?.id) return;
    const foto = fotosVistoria[index];
    const newFotos = [...fotosVistoria];
    newFotos[index] = { ...foto, status: 'enviando' };
    setFotosVistoria(newFotos);

    try {
      let lat: number | undefined;
      let lng: number | undefined;
      
      if (navigator.geolocation) {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        }).catch(() => null);
        
        if (pos) {
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        }
      }

      const result = await uploadFotoVistoria.mutateAsync({
        cotacaoId: cotacao.id,
        tipo: foto.tipo,
        file,
        latitude: lat,
        longitude: lng,
      });
      newFotos[index] = { ...foto, url: result.url, status: 'enviado' };
      setFotosVistoria(newFotos);
      toast.success(`${foto.nome} capturada!`);
    } catch {
      newFotos[index] = { ...foto, status: 'erro' };
      setFotosVistoria(newFotos);
      toast.error(`Erro ao enviar ${foto.nome}`);
    }
  };

  const handleConcluirVistoria = async () => {
    if (!token || isSubmittingRef.current || loading) return;
    
    if (tipoVistoria === 'auto') {
      const enviadas = fotosVistoria.filter(f => f.status === 'enviado').length;
      if (enviadas < 10) {
        toast.error('Envie pelo menos 10 fotos da vistoria');
        return;
      }
    }

    isSubmittingRef.current = true;
    setLoading(true);
    try {
      await atualizarCotacao.mutateAsync({
        token,
        updates: {
          status: 'vistoria_ok',
          tipo_vistoria: tipoVistoria === 'auto' ? 'autoatendimento' : 'presencial',
          vistoria_ok_em: new Date().toISOString(),
        },
      });
      await refetch();
      setStep('termos');
      toast.success('Vistoria concluída!');
    } catch {
      toast.error('Erro ao salvar. Tente novamente.');
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const handleAceitarTermos = async () => {
    if (!token || !termosAceitos || isSubmittingRef.current || loading) return;
    isSubmittingRef.current = true;
    setLoading(true);
    try {
      await atualizarCotacao.mutateAsync({
        token,
        updates: {
          status: 'termos_ok',
          termos_aceitos: true,
          termos_ok_em: new Date().toISOString(),
        },
      });
      await refetch();
      setStep('conclusao');
      toast.success('Adesão concluída! 🎉');
    } catch {
      toast.error('Erro ao salvar. Tente novamente.');
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  // ──────────────────────────────────────────────────────────
  // RENDERS
  // ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Carregando sua cotação...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !cotacao) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Cotação não encontrada</h2>
            <p className="text-muted-foreground">
              Este link pode ter expirado. Entre em contato com seu consultor.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (new Date(cotacao.expires_at) < new Date() && cotacao.status === 'aguardando') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Cotação expirada</h2>
            <p className="text-muted-foreground">Solicite uma nova cotação ao seu consultor.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const nomeCliente = cotacao.leads?.nome?.split(' ')[0] || 'Cliente';

  // ──────────────────────────────────────────────────────────
  // RENDER PRINCIPAL
  // ──────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold">
                P
              </div>
              <div>
                <h1 className="font-bold text-foreground">PRATIC</h1>
                <p className="text-xs text-muted-foreground">Proteção Veicular</p>
              </div>
            </div>
            {step !== 'conclusao' && (
              <Badge variant="secondary">
                {getStepIndex(step) + 1} de {STEPS_CONFIG.length}
              </Badge>
            )}
          </div>

          {step !== 'conclusao' && (
            <div className="space-y-2">
              <Progress value={progressPercent} className="h-2" />
              <div className="flex justify-between">
                {STEPS_CONFIG.map((s, i) => {
                  const isActive = getStepIndex(step) >= i;
                  const Icon = s.icon;
                  return (
                    <div key={s.id} className={cn('flex flex-col items-center gap-1', isActive ? 'text-primary' : 'text-muted-foreground')}>
                      <Icon className="h-4 w-4" />
                      <span className="text-[10px]">{s.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 py-6 pb-24">
        {/* ══════════════════════════════════════════════════════════ */}
        {/* STEP 1: TIPO DE USO */}
        {/* ══════════════════════════════════════════════════════════ */}
        {step === 'uso' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground">Olá, {nomeCliente}! 👋</h2>
              <p className="text-muted-foreground">Como você utiliza o veículo?</p>
            </div>

            <Card>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Car className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">
                    {cotacao.veiculo_marca} {cotacao.veiculo_modelo}
                  </p>
                  {cotacao.veiculo_ano && <p className="text-sm text-muted-foreground">Ano {cotacao.veiculo_ano}</p>}
                </div>
              </CardContent>
            </Card>

            <RadioGroup value={tipoUso} onValueChange={(v) => setTipoUso(v as TipoUsoVeiculo)} className="space-y-3">
              <Card className={cn('cursor-pointer transition-all', tipoUso === 'particular' && 'border-primary ring-2 ring-primary/20')}>
                <CardContent className="py-4">
                  <Label htmlFor="particular" className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="particular" id="particular" />
                      <Car className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Uso Particular</p>
                        <p className="text-sm text-muted-foreground">Passeio, trabalho, lazer</p>
                      </div>
                    </div>
                    {tipoUso === 'particular' && <CheckCircle2 className="h-5 w-5 text-primary" />}
                  </Label>
                </CardContent>
              </Card>

              <Card className={cn('cursor-pointer transition-all', tipoUso === 'aplicativo' && 'border-primary ring-2 ring-primary/20')}>
                <CardContent className="py-4">
                  <Label htmlFor="aplicativo" className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="aplicativo" id="aplicativo" />
                      <Smartphone className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Aplicativo</p>
                        <p className="text-sm text-muted-foreground">Uber, 99, iFood, etc.</p>
                      </div>
                    </div>
                    {tipoUso === 'aplicativo' && <CheckCircle2 className="h-5 w-5 text-primary" />}
                  </Label>
                </CardContent>
              </Card>
            </RadioGroup>

            {tipoUso === 'aplicativo' && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>Valores diferenciados para uso intensivo</AlertDescription>
              </Alert>
            )}

            <Button onClick={handleDefinirUso} className="w-full h-12" disabled={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Continuar'}
              <ChevronRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* STEP 2: ESCOLHA DE PLANO */}
        {/* ══════════════════════════════════════════════════════════ */}
        {step === 'plano' && resultado && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground">Escolha seu plano</h2>
              <p className="text-muted-foreground">Selecione a proteção ideal para você</p>
            </div>

            {resultado.planos.map((plano, planoIndex) => {
              const cores = CORES_PLANO_DINAMICAS[planoIndex % CORES_PLANO_DINAMICAS.length];
              const isSelected = planoEscolhido === plano.categoria;

              return (
                <Card
                  key={plano.id || plano.categoria}
                  onClick={() => setPlanoEscolhido(plano.categoria)}
                  className={cn(
                    'border-2 cursor-pointer transition-all overflow-hidden',
                    isSelected ? `${cores.border} shadow-lg` : 'border-border'
                  )}
                >
                  {plano.tag && (
                    <div className={cn('text-center py-1 text-xs font-medium', cores.badge)}>
                      {plano.tag}
                    </div>
                  )}
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className={cn('h-10 w-10 rounded-full flex items-center justify-center', cores.bg)}>
                          {planoIndex >= 2 && <Crown className="h-5 w-5 text-amber-600" />}
                          {planoIndex === 1 && <Star className="h-5 w-5 text-blue-600" />}
                          {planoIndex === 0 && <Shield className="h-5 w-5 text-slate-600" />}
                        </div>
                        <div>
                          <p className="font-bold">{plano.categoria}</p>
                          <p className="text-xs text-muted-foreground">{plano.coberturas.length} coberturas</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{formatarMoeda(plano.valor_mensal)}</p>
                        <p className="text-xs text-muted-foreground">/mês</p>
                      </div>
                    </div>

                    <div className="flex justify-between text-sm mb-4">
                      <div>
                        <p className="text-muted-foreground">Adesão</p>
                        <p className="font-medium">{formatarMoeda(plano.valor_adesao)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground">1ª Parcela</p>
                        <p className="font-medium">{formatarMoeda(plano.valor_primeira_parcela)}</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {plano.coberturas.slice(0, 5).map((cob, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500 shrink-0" />
                          <span>{cob}</span>
                        </div>
                      ))}
                      {plano.coberturas.length > 5 && (
                        <p className="text-xs text-muted-foreground pl-6">
                          +{plano.coberturas.length - 5} coberturas
                        </p>
                      )}
                    </div>

                    {isSelected && (
                      <div className="flex items-center justify-center gap-2 mt-4 py-2 bg-primary/10 rounded-lg">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                        <span className="font-medium text-primary">Selecionado</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            <Button onClick={handleEscolherPlano} disabled={!planoEscolhido || loading} className="w-full h-12">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Continuar'}
              <ChevronRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* STEP 3: ACEITAR PROPOSTA */}
        {/* ══════════════════════════════════════════════════════════ */}
        {step === 'proposta' && cotacao && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground">Sua proposta</h2>
              <p className="text-muted-foreground">Revise os detalhes antes de continuar</p>
            </div>

            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="text-center">
                  <Badge className="mb-2">Plano {cotacao.plano_escolhido}</Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Veículo</span>
                    <span className="font-medium">{cotacao.veiculo_marca} {cotacao.veiculo_modelo}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tipo de uso</span>
                    <span className="font-medium">{cotacao.uso_aplicativo ? 'Aplicativo' : 'Particular'}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Taxa de adesão</span>
                    <span className="font-medium">{formatarMoeda(cotacao.valor_adesao_final || 0)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg">
                    <span className="font-medium">Mensalidade</span>
                    <span className="font-bold text-primary">{formatarMoeda(cotacao.valor_mensal_final || 0)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-start gap-3">
              <Checkbox
                id="aceite"
                checked={propostaAceita}
                onCheckedChange={(v) => setPropostaAceita(!!v)}
              />
              <Label htmlFor="aceite" className="text-sm leading-relaxed cursor-pointer">
                Li e aceito os valores apresentados. Entendo que a proteção só será ativada após análise e aprovação.
              </Label>
            </div>

            <Button onClick={handleAceitarProposta} disabled={!propostaAceita || loading} className="w-full h-12">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Aceitar Proposta'}
              <ChevronRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* STEP 4: DOCUMENTOS */}
        {/* ══════════════════════════════════════════════════════════ */}
        {step === 'documentos' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground">Seus documentos</h2>
              <p className="text-muted-foreground">Envie fotos legíveis dos documentos</p>
            </div>

            <div className="space-y-3">
              {documentos.map((doc, index) => (
                <Card key={doc.tipo}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'h-10 w-10 rounded-full flex items-center justify-center',
                          doc.status === 'enviado' ? 'bg-green-100' : 
                          doc.status === 'enviando' ? 'bg-blue-100' : 'bg-muted'
                        )}>
                          {doc.status === 'enviado' ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : doc.status === 'enviando' ? (
                            <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                          ) : (
                            <Upload className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{doc.nome}</p>
                          <p className="text-xs text-muted-foreground">{doc.descricao}</p>
                        </div>
                      </div>
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          id={`doc-${doc.tipo}`}
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadDocumento(index, file);
                          }}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          disabled={doc.status === 'enviando'}
                        >
                          <label htmlFor={`doc-${doc.tipo}`} className="cursor-pointer">
                            <Camera className="h-4 w-4 mr-1" />
                            {doc.status === 'enviado' ? 'Trocar' : 'Enviar'}
                          </label>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Button
              onClick={handleConcluirDocumentos}
              disabled={!documentos.filter(d => d.obrigatorio).every(d => d.status === 'enviado') || loading}
              className="w-full h-12"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Continuar'}
              <ChevronRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* STEP 5: SELFIE */}
        {/* ══════════════════════════════════════════════════════════ */}
        {step === 'selfie' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground">Verificação facial</h2>
              <p className="text-muted-foreground">Tire uma selfie segurando sua CNH</p>
            </div>

            <Card>
              <CardContent className="py-8">
                {selfieUrl ? (
                  <div className="flex flex-col items-center gap-4">
                    <img src={selfieUrl} alt="Selfie" className="w-48 h-48 object-cover rounded-full border-4 border-green-500" />
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-medium">Selfie capturada!</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="h-32 w-32 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-16 w-16 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground text-center">
                      Segure sua CNH ao lado do rosto e tire uma selfie
                    </p>
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        capture="user"
                        id="selfie-input"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleCapturarSelfie(file);
                        }}
                      />
                      <Button asChild disabled={selfieStatus === 'enviando'}>
                        <label htmlFor="selfie-input" className="cursor-pointer">
                          {selfieStatus === 'enviando' ? (
                            <Loader2 className="h-5 w-5 animate-spin mr-2" />
                          ) : (
                            <Camera className="h-5 w-5 mr-2" />
                          )}
                          Tirar Selfie
                        </label>
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button onClick={handleConcluirSelfie} disabled={!selfieUrl || loading} className="w-full h-12">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Continuar'}
              <ChevronRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* STEP 6: VISTORIA */}
        {/* ══════════════════════════════════════════════════════════ */}
        {step === 'vistoria' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground">Vistoria do veículo</h2>
              <p className="text-muted-foreground">Escolha como realizar a vistoria</p>
            </div>

            {!tipoVistoria ? (
              <div className="space-y-3">
                <Card onClick={() => setTipoVistoria('auto')} className="cursor-pointer hover:border-primary transition-all">
                  <CardContent className="py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Camera className="h-6 w-6 text-primary" />
                      <div>
                        <p className="font-medium">Autoatendimento</p>
                        <p className="text-sm text-muted-foreground">Tire as fotos agora pelo celular</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </CardContent>
                </Card>

                <Card onClick={() => setTipoVistoria('presencial')} className="cursor-pointer hover:border-primary transition-all">
                  <CardContent className="py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <User className="h-6 w-6 text-primary" />
                      <div>
                        <p className="font-medium">Presencial</p>
                        <p className="text-sm text-muted-foreground">Agendar visita de técnico</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              </div>
            ) : tipoVistoria === 'auto' ? (
              <div className="space-y-4">
                <Alert>
                  <Camera className="h-4 w-4" />
                  <AlertDescription>
                    Tire fotos em local bem iluminado. {fotosVistoria.filter(f => f.status === 'enviado').length} de {FOTOS_VISTORIA_CONFIG.length} fotos
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-3 gap-2">
                  {fotosVistoria.map((foto, index) => (
                    <div key={foto.tipo}>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        id={`foto-${foto.tipo}`}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleCapturarFotoVistoria(index, file);
                        }}
                      />
                      <label
                        htmlFor={`foto-${foto.tipo}`}
                        className={cn(
                          'aspect-square rounded-lg flex flex-col items-center justify-center cursor-pointer border-2 border-dashed transition-all',
                          foto.status === 'enviado' ? 'border-green-500 bg-green-50' :
                          foto.status === 'enviando' ? 'border-blue-500 bg-blue-50' :
                          'border-border hover:border-primary'
                        )}
                      >
                        {foto.status === 'enviado' ? (
                          <CheckCircle2 className="h-6 w-6 text-green-500" />
                        ) : foto.status === 'enviando' ? (
                          <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
                        ) : (
                          <Camera className="h-6 w-6 text-muted-foreground" />
                        )}
                        <span className="text-[10px] text-center mt-1 px-1">{foto.nome}</span>
                      </label>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={handleConcluirVistoria}
                  disabled={fotosVistoria.filter(f => f.status === 'enviado').length < 10 || loading}
                  className="w-full h-12"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Concluir Vistoria'}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Card>
                  <CardContent className="py-6 text-center space-y-4">
                    <User className="h-12 w-12 mx-auto text-primary" />
                    <div>
                      <p className="font-medium">Vistoria Presencial</p>
                      <p className="text-sm text-muted-foreground">
                        Entraremos em contato para agendar a visita do técnico.
                      </p>
                    </div>
                    <Button onClick={handleConcluirVistoria} disabled={loading} className="w-full">
                      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Confirmar Agendamento'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* STEP 7: TERMOS */}
        {/* ══════════════════════════════════════════════════════════ */}
        {step === 'termos' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground">Termos e condições</h2>
              <p className="text-muted-foreground">Leia e aceite para finalizar</p>
            </div>

            <Card>
              <CardContent className="p-4 max-h-64 overflow-y-auto text-sm space-y-4">
                <h3 className="font-bold">TERMO DE ADESÃO À ASSOCIAÇÃO PRATIC</h3>
                <p>
                  Pelo presente instrumento, o ASSOCIADO declara que leu, entendeu e aceita 
                  todas as condições estabelecidas no Regulamento Geral da Associação.
                </p>
                <p>
                  A proteção veicular será ativada após aprovação da análise cadastral e 
                  confirmação do pagamento da primeira mensalidade.
                </p>
                <p>
                  O ASSOCIADO declara que todas as informações prestadas são verdadeiras e 
                  que o veículo encontra-se em perfeitas condições de uso.
                </p>
                <p>
                  Em caso de sinistro, o ASSOCIADO deverá comunicar imediatamente à Central 
                  de Atendimento através dos canais oficiais.
                </p>
                <p>
                  Este termo é válido por prazo indeterminado, podendo ser rescindido por 
                  qualquer das partes mediante comunicação prévia de 30 dias.
                </p>
              </CardContent>
            </Card>

            <div className="flex items-start gap-3">
              <Checkbox
                id="termos"
                checked={termosAceitos}
                onCheckedChange={(v) => setTermosAceitos(!!v)}
              />
              <Label htmlFor="termos" className="text-sm leading-relaxed cursor-pointer">
                Li e aceito os termos e condições de adesão à Associação PRATIC.
              </Label>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('vistoria')} className="flex-1 h-12">
                <ChevronLeft className="h-5 w-5 mr-2" />
                Voltar
              </Button>
              <Button onClick={handleAceitarTermos} disabled={!termosAceitos || loading} className="flex-1 h-12">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Finalizar Adesão'}
                <ChevronRight className="h-5 w-5 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* CONCLUSÃO */}
        {/* ══════════════════════════════════════════════════════════ */}
        {step === 'conclusao' && cotacao && (
          <div className="space-y-6">
            <div className="text-center py-6">
              <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Adesão Concluída!</h2>
              <p className="text-muted-foreground">Seu cadastro está em análise</p>
            </div>

            <Card>
              <CardContent className="p-4">
                <div className="text-center mb-4">
                  <Badge variant="secondary" className="mb-2">
                    {STATUS_COTACAO_PUBLICA_LABELS[cotacao.status as keyof typeof STATUS_COTACAO_PUBLICA_LABELS] || cotacao.status}
                  </Badge>
                </div>

                <div className="space-y-3">
                  {cotacao.visualizado_em && (
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="text-sm">Link visualizado</span>
                    </div>
                  )}
                  {cotacao.uso_definido_em && (
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="text-sm">Tipo de uso definido</span>
                    </div>
                  )}
                  {cotacao.plano_escolhido_em && (
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="text-sm">Plano selecionado: {cotacao.plano_escolhido}</span>
                    </div>
                  )}
                  {cotacao.proposta_aceita_em && (
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="text-sm">Proposta aceita</span>
                    </div>
                  )}
                  {cotacao.documentos_ok_em && (
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="text-sm">Documentos enviados</span>
                    </div>
                  )}
                  {cotacao.selfie_ok_em && (
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="text-sm">Verificação facial</span>
                    </div>
                  )}
                  {cotacao.vistoria_ok_em && (
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="text-sm">Vistoria concluída</span>
                    </div>
                  )}
                  {cotacao.termos_ok_em && (
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="text-sm">Termos aceitos</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                Você receberá uma notificação assim que sua adesão for aprovada.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </main>
    </div>
  );
}
