import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, ArrowRight, Camera, Check, AlertTriangle, 
  FileText, PenTool, Gauge, CheckCircle2, Loader2, X, Car
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FotoCapture } from '@/components/instalador/FotoCapture';
import { SignaturePad } from '@/components/instalador/SignaturePad';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { 
  useVistoriaCompleta, 
  useUploadVistoriaFoto, 
  useExecutarVistoria, 
  useSalvarRascunhoVistoria 
} from '@/hooks/useVistorias';
import { supabase } from '@/integrations/supabase/client';

// Constantes
const FOTOS_OBRIGATORIAS = [
  { tipo: 'frente', label: 'Frente' },
  { tipo: 'traseira', label: 'Traseira' },
  { tipo: 'lateral_esquerda', label: 'Lat. Esquerda' },
  { tipo: 'lateral_direita', label: 'Lat. Direita' },
  { tipo: 'hodometro', label: 'Hodômetro' },
  { tipo: 'chassi', label: 'Chassi' },
];

const PARTES_VEICULO = [
  { id: 'parachoque_dianteiro', label: 'Para-choque dianteiro' },
  { id: 'capo', label: 'Capô' },
  { id: 'parabrisa', label: 'Para-brisa' },
  { id: 'farol_esquerdo', label: 'Farol esquerdo' },
  { id: 'farol_direito', label: 'Farol direito' },
  { id: 'porta_dianteira_esquerda', label: 'Porta dianteira esquerda' },
  { id: 'porta_dianteira_direita', label: 'Porta dianteira direita' },
  { id: 'porta_traseira_esquerda', label: 'Porta traseira esquerda' },
  { id: 'porta_traseira_direita', label: 'Porta traseira direita' },
  { id: 'lateral_esquerda', label: 'Lateral esquerda' },
  { id: 'lateral_direita', label: 'Lateral direita' },
  { id: 'parachoque_traseiro', label: 'Para-choque traseiro' },
  { id: 'lanterna_esquerda', label: 'Lanterna esquerda' },
  { id: 'lanterna_direita', label: 'Lanterna direita' },
  { id: 'teto', label: 'Teto' },
  { id: 'rodas_pneus', label: 'Rodas/Pneus' },
];

const TIPOS_AVARIA = [
  { value: 'amassado', label: 'Amassado' },
  { value: 'risco', label: 'Risco' },
  { value: 'ferrugem', label: 'Ferrugem' },
  { value: 'quebrado', label: 'Quebrado' },
  { value: 'trincado', label: 'Trincado' },
  { value: 'outro', label: 'Outro' },
];

const GRAVIDADE_AVARIA = [
  { value: 'leve', label: 'Leve' },
  { value: 'moderado', label: 'Moderado' },
  { value: 'grave', label: 'Grave' },
];

const CHECKLIST_ITEMS = [
  { id: 'documentacao_ok', label: 'Documentação do veículo OK', obrigatorio: true },
  { id: 'placa_legivel', label: 'Placa legível e sem adulteração', obrigatorio: true },
  { id: 'vidros_ok', label: 'Vidros sem trincas graves', obrigatorio: true },
  { id: 'pneus_ok', label: 'Pneus em bom estado', obrigatorio: true },
  { id: 'iluminacao_ok', label: 'Lanternas e faróis funcionando', obrigatorio: true },
  { id: 'hodometro_ok', label: 'Hodômetro funcionando', obrigatorio: true },
  { id: 'kit_primeiros_socorros', label: 'Veículo tem kit de primeiros socorros', obrigatorio: false },
  { id: 'triangulo', label: 'Triângulo presente', obrigatorio: false },
  { id: 'estepe', label: 'Estepe presente e em bom estado', obrigatorio: false },
];

interface Avaria {
  parteId: string;
  tipo: string;
  gravidade: string;
  descricao: string;
  fotoUrl?: string;
}

interface VistoriaState {
  conferencia: {
    placa: boolean;
    chassi: boolean;
    modelo: boolean;
    cor: boolean;
  };
  hodometro: string;
  avarias: Avaria[];
  semAvarias: boolean;
  checklist: Record<string, boolean>;
  observacoesGerais: string;
  assinaturaBlob: Blob | null;
  nomeCliente: string;
  cpfCliente: string;
}

const ETAPAS = [
  { numero: 1, label: 'Dados', icon: FileText },
  { numero: 2, label: 'Fotos', icon: Camera },
  { numero: 3, label: 'Avarias', icon: AlertTriangle },
  { numero: 4, label: 'Check', icon: Check },
  { numero: 5, label: 'Assin', icon: PenTool },
];

export default function ExecutarVistoria() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Hooks de dados
  const { data: vistoria, isLoading, error } = useVistoriaCompleta(id || null);
  const uploadFoto = useUploadVistoriaFoto();
  const executarVistoria = useExecutarVistoria();
  const salvarRascunho = useSalvarRascunhoVistoria();

  // Estado do wizard
  const [etapaAtual, setEtapaAtual] = useState(1);
  const [uploadingFoto, setUploadingFoto] = useState<string | null>(null);
  const [showConfirmacao, setShowConfirmacao] = useState(false);
  const [finalizando, setFinalizando] = useState(false);

  // Estado dos dados coletados
  const [state, setState] = useState<VistoriaState>({
    conferencia: { placa: false, chassi: false, modelo: false, cor: false },
    hodometro: '',
    avarias: [],
    semAvarias: false,
    checklist: {},
    observacoesGerais: '',
    assinaturaBlob: null,
    nomeCliente: '',
    cpfCliente: '',
  });

  // Carregar dados salvos (rascunho) se existir
  useEffect(() => {
    if (vistoria?.observacoes) {
      try {
        const saved = JSON.parse(vistoria.observacoes);
        if (saved.rascunho) {
          setState(prev => ({
            ...prev,
            conferencia: saved.conferencia || prev.conferencia,
            avarias: saved.avarias || [],
            semAvarias: saved.semAvarias || false,
            checklist: saved.checklist || {},
            observacoesGerais: saved.observacoesGerais || '',
            nomeCliente: saved.nomeCliente || '',
            cpfCliente: saved.cpfCliente || '',
          }));
          if (saved.etapaAtual && saved.etapaAtual > 1) {
            setEtapaAtual(saved.etapaAtual);
          }
        }
      } catch (e) {
        // Observações não são JSON ou não têm rascunho
      }
    }
    if (vistoria?.km_atual) {
      setState(prev => ({ ...prev, hodometro: String(vistoria.km_atual) }));
    }
  }, [vistoria]);

  // Dados do veículo
  const veiculo = vistoria?.veiculo;
  const associado = vistoria?.associado || vistoria?.veiculo?.associado;
  const fotosEnviadas = vistoria?.fotos || [];

  // Mapa de fotos já enviadas por tipo
  const fotosMap = useMemo(() => {
    const map: Record<string, string> = {};
    fotosEnviadas.forEach(f => {
      map[f.tipo] = f.arquivo_url;
    });
    return map;
  }, [fotosEnviadas]);

  // Validações por etapa
  const validacaoEtapa1 = useMemo(() => {
    const { conferencia, hodometro } = state;
    return Object.values(conferencia).every(Boolean) && hodometro.length > 0;
  }, [state.conferencia, state.hodometro]);

  const validacaoEtapa2 = useMemo(() => {
    return FOTOS_OBRIGATORIAS.every(f => fotosMap[f.tipo]);
  }, [fotosMap]);

  const validacaoEtapa3 = useMemo(() => {
    return state.semAvarias || state.avarias.length > 0;
  }, [state.semAvarias, state.avarias]);

  const validacaoEtapa4 = useMemo(() => {
    const obrigatorios = CHECKLIST_ITEMS.filter(i => i.obrigatorio);
    return obrigatorios.every(item => state.checklist[item.id]);
  }, [state.checklist]);

  const validacaoEtapa5 = useMemo(() => {
    return !!state.assinaturaBlob && state.nomeCliente.length > 2 && state.cpfCliente.length >= 11;
  }, [state.assinaturaBlob, state.nomeCliente, state.cpfCliente]);

  const podeAvancar = (etapa: number): boolean => {
    switch (etapa) {
      case 1: return validacaoEtapa1;
      case 2: return validacaoEtapa2;
      case 3: return validacaoEtapa3;
      case 4: return validacaoEtapa4;
      case 5: return validacaoEtapa5;
      default: return false;
    }
  };

  const etapaConcluida = (etapa: number): boolean => {
    return podeAvancar(etapa);
  };

  // Handlers
  const handleVoltar = () => {
    if (etapaAtual > 1) {
      setEtapaAtual(etapaAtual - 1);
    } else {
      navigate('/vistoriador/tarefas');
    }
  };

  const handleAvancar = () => {
    if (podeAvancar(etapaAtual) && etapaAtual < 5) {
      setEtapaAtual(etapaAtual + 1);
    }
  };

  const handleUploadFoto = async (tipo: string, file: File) => {
    if (!id) return;
    setUploadingFoto(tipo);
    try {
      await uploadFoto.mutateAsync({ vistoria_id: id, tipo, file });
      toast.success('Foto enviada!');
    } catch (error) {
      toast.error('Erro ao enviar foto');
    } finally {
      setUploadingFoto(null);
    }
  };

  const handleSalvarRascunho = async () => {
    if (!id) return;
    const rascunhoData = {
      rascunho: true,
      etapaAtual,
      conferencia: state.conferencia,
      avarias: state.avarias,
      semAvarias: state.semAvarias,
      checklist: state.checklist,
      observacoesGerais: state.observacoesGerais,
      nomeCliente: state.nomeCliente,
      cpfCliente: state.cpfCliente,
    };
    await salvarRascunho.mutateAsync({
      id,
      observacoes: JSON.stringify(rascunhoData),
      km_atual: state.hodometro ? parseInt(state.hodometro) : undefined,
    });
  };

  const handleFinalizarVistoria = async () => {
    if (!id || !state.assinaturaBlob) return;
    setFinalizando(true);

    try {
      // 1. Upload da assinatura
      const assinaturaFileName = `${id}/assinatura_${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from('vistoria-fotos')
        .upload(assinaturaFileName, state.assinaturaBlob);

      if (uploadError) throw uploadError;

      const { data: assinaturaUrlData } = supabase.storage
        .from('vistoria-fotos')
        .getPublicUrl(assinaturaFileName);

      // 2. Preparar dados finais
      const dadosFinais = {
        checklist: state.checklist,
        observacoesGerais: state.observacoesGerais,
        assinaturaUrl: assinaturaUrlData.publicUrl,
        nomeCliente: state.nomeCliente,
        cpfCliente: state.cpfCliente,
        finalizadoEm: new Date().toISOString(),
        conferencia: state.conferencia,
      };

      // 3. Executar vistoria
      await executarVistoria.mutateAsync({
        id,
        km_atual: parseInt(state.hodometro),
        avarias: JSON.stringify(state.avarias),
        observacoes: JSON.stringify(dadosFinais),
        status: 'em_analise',
      });

      setShowConfirmacao(true);
    } catch (error) {
      console.error('Erro ao finalizar vistoria:', error);
      toast.error('Erro ao finalizar vistoria');
    } finally {
      setFinalizando(false);
    }
  };

  // Toggle avaria
  const toggleAvaria = (parteId: string) => {
    const exists = state.avarias.find(a => a.parteId === parteId);
    if (exists) {
      setState(prev => ({
        ...prev,
        avarias: prev.avarias.filter(a => a.parteId !== parteId),
      }));
    } else {
      setState(prev => ({
        ...prev,
        avarias: [...prev.avarias, { parteId, tipo: '', gravidade: '', descricao: '' }],
        semAvarias: false,
      }));
    }
  };

  const updateAvaria = (parteId: string, field: keyof Avaria, value: string) => {
    setState(prev => ({
      ...prev,
      avarias: prev.avarias.map(a => 
        a.parteId === parteId ? { ...a, [field]: value } : a
      ),
    }));
  };

  // Loading e Error states
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
        <p className="text-center text-slate-300">Vistoria não encontrada ou erro ao carregar.</p>
        <Button onClick={() => navigate('/vistoriador/tarefas')}>Voltar</Button>
      </div>
    );
  }

  const codigoVistoria = `VIS-${new Date(vistoria.created_at).getFullYear()}-${vistoria.id.slice(0, 5).toUpperCase()}`;

  return (
    <div className="flex min-h-screen flex-col bg-slate-900">
      {/* Header Sticky */}
      <header className="sticky top-0 z-50 border-b border-slate-700 bg-slate-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleVoltar} className="text-slate-400">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">{codigoVistoria}</p>
            <p className="text-xs text-slate-400">
              {associado?.nome || 'Sem associado'} | {veiculo?.placa || 'Sem placa'}
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSalvarRascunho}
            disabled={salvarRascunho.isPending}
            className="border-slate-600 text-slate-300"
          >
            {salvarRascunho.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
          </Button>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="sticky top-14 z-40 border-b border-slate-700 bg-slate-800 px-4 py-3">
        <div className="flex items-center justify-between">
          {ETAPAS.map((etapa, index) => {
            const isCompleted = etapaConcluida(etapa.numero) && etapaAtual > etapa.numero;
            const isCurrent = etapaAtual === etapa.numero;
            const Icon = etapa.icon;

            return (
              <div key={etapa.numero} className="flex flex-1 items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                      isCompleted && 'bg-green-500 text-white',
                      isCurrent && 'bg-blue-500 text-white',
                      !isCompleted && !isCurrent && 'border-2 border-slate-600 text-slate-500'
                    )}
                  >
                    {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span
                    className={cn(
                      'mt-1 text-[10px]',
                      isCompleted && 'text-green-400',
                      isCurrent && 'text-blue-400',
                      !isCompleted && !isCurrent && 'text-slate-500'
                    )}
                  >
                    {etapa.label}
                  </span>
                </div>
                {index < ETAPAS.length - 1 && (
                  <div
                    className={cn(
                      'mx-1 h-0.5 flex-1',
                      etapaConcluida(etapa.numero) ? 'bg-green-500' : 'bg-slate-700'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-4 pb-24">
        {/* Etapa 1: Conferência de Dados */}
        {etapaAtual === 1 && (
          <Card className="border-slate-700 bg-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                <Car className="h-5 w-5 text-blue-400" />
                Confira os dados do veículo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Placa */}
              <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900 p-3">
                <Checkbox
                  id="placa"
                  checked={state.conferencia.placa}
                  onCheckedChange={(checked) => setState(prev => ({
                    ...prev,
                    conferencia: { ...prev.conferencia, placa: !!checked }
                  }))}
                />
                <Label htmlFor="placa" className="flex-1 cursor-pointer">
                  <span className="text-slate-400">Placa confere:</span>{' '}
                  <span className="font-semibold text-white">{veiculo?.placa || 'Não informada'}</span>
                </Label>
              </div>

              {/* Chassi */}
              <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900 p-3">
                <Checkbox
                  id="chassi"
                  checked={state.conferencia.chassi}
                  onCheckedChange={(checked) => setState(prev => ({
                    ...prev,
                    conferencia: { ...prev.conferencia, chassi: !!checked }
                  }))}
                />
                <Label htmlFor="chassi" className="flex-1 cursor-pointer">
                  <span className="text-slate-400">Chassi confere:</span>{' '}
                  <span className="font-semibold text-white">{veiculo?.chassi || 'Não informado'}</span>
                </Label>
              </div>

              {/* Modelo */}
              <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900 p-3">
                <Checkbox
                  id="modelo"
                  checked={state.conferencia.modelo}
                  onCheckedChange={(checked) => setState(prev => ({
                    ...prev,
                    conferencia: { ...prev.conferencia, modelo: !!checked }
                  }))}
                />
                <Label htmlFor="modelo" className="flex-1 cursor-pointer">
                  <span className="text-slate-400">Modelo confere:</span>{' '}
                  <span className="font-semibold text-white">
                    {veiculo?.marca} {veiculo?.modelo} {veiculo?.ano_modelo || ''}
                  </span>
                </Label>
              </div>

              {/* Cor */}
              <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900 p-3">
                <Checkbox
                  id="cor"
                  checked={state.conferencia.cor}
                  onCheckedChange={(checked) => setState(prev => ({
                    ...prev,
                    conferencia: { ...prev.conferencia, cor: !!checked }
                  }))}
                />
                <Label htmlFor="cor" className="flex-1 cursor-pointer">
                  <span className="text-slate-400">Cor confere:</span>{' '}
                  <span className="font-semibold text-white">{veiculo?.cor || 'Não informada'}</span>
                </Label>
              </div>

              {/* Hodômetro */}
              <div className="space-y-2">
                <Label htmlFor="hodometro" className="flex items-center gap-2 text-slate-300">
                  <Gauge className="h-4 w-4" />
                  Hodômetro atual (km)
                </Label>
                <Input
                  id="hodometro"
                  type="number"
                  inputMode="numeric"
                  placeholder="Ex: 45000"
                  value={state.hodometro}
                  onChange={(e) => setState(prev => ({ ...prev, hodometro: e.target.value }))}
                  className="border-slate-600 bg-slate-900 text-white"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Etapa 2: Fotos Obrigatórias */}
        {etapaAtual === 2 && (
          <Card className="border-slate-700 bg-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                <Camera className="h-5 w-5 text-blue-400" />
                Registre as fotos do veículo
              </CardTitle>
              <p className="text-sm text-slate-400">Todas as 6 fotos são obrigatórias</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {FOTOS_OBRIGATORIAS.map((foto) => (
                  <FotoCapture
                    key={foto.tipo}
                    tipo={foto.tipo}
                    label={foto.label}
                    obrigatoria={true}
                    fotoUrl={fotosMap[foto.tipo]}
                    uploading={uploadingFoto === foto.tipo}
                    onCapture={(file) => handleUploadFoto(foto.tipo, file)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Etapa 3: Registro de Avarias */}
        {etapaAtual === 3 && (
          <Card className="border-slate-700 bg-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
                Registre avarias pré-existentes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Checkbox sem avarias */}
              <div className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-3">
                <Checkbox
                  id="sem-avarias"
                  checked={state.semAvarias}
                  onCheckedChange={(checked) => setState(prev => ({
                    ...prev,
                    semAvarias: !!checked,
                    avarias: checked ? [] : prev.avarias,
                  }))}
                />
                <Label htmlFor="sem-avarias" className="flex-1 cursor-pointer text-green-400">
                  Veículo sem avarias aparentes
                </Label>
              </div>

              {/* Lista de partes */}
              {!state.semAvarias && (
                <div className="space-y-2">
                  {PARTES_VEICULO.map((parte) => {
                    const avaria = state.avarias.find(a => a.parteId === parte.id);
                    const isExpanded = !!avaria;

                    return (
                      <div key={parte.id} className="rounded-lg border border-slate-700 bg-slate-900">
                        <div
                          className="flex cursor-pointer items-center gap-3 p-3"
                          onClick={() => toggleAvaria(parte.id)}
                        >
                          <Checkbox checked={isExpanded} />
                          <span className="flex-1 text-sm text-slate-300">{parte.label}</span>
                        </div>

                        {isExpanded && (
                          <div className="space-y-3 border-t border-slate-700 p-3">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-xs text-slate-400">Tipo</Label>
                                <Select
                                  value={avaria.tipo}
                                  onValueChange={(v) => updateAvaria(parte.id, 'tipo', v)}
                                >
                                  <SelectTrigger className="border-slate-600 bg-slate-800">
                                    <SelectValue placeholder="Selecione" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TIPOS_AVARIA.map(t => (
                                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs text-slate-400">Gravidade</Label>
                                <Select
                                  value={avaria.gravidade}
                                  onValueChange={(v) => updateAvaria(parte.id, 'gravidade', v)}
                                >
                                  <SelectTrigger className="border-slate-600 bg-slate-800">
                                    <SelectValue placeholder="Selecione" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {GRAVIDADE_AVARIA.map(g => (
                                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs text-slate-400">Descrição (opcional)</Label>
                              <Input
                                value={avaria.descricao}
                                onChange={(e) => updateAvaria(parte.id, 'descricao', e.target.value)}
                                placeholder="Detalhes da avaria..."
                                className="border-slate-600 bg-slate-800"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Etapa 4: Checklist Final */}
        {etapaAtual === 4 && (
          <Card className="border-slate-700 bg-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                <Check className="h-5 w-5 text-blue-400" />
                Checklist de conferência
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {CHECKLIST_ITEMS.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-3',
                    item.obrigatorio ? 'border-slate-700 bg-slate-900' : 'border-slate-700/50 bg-slate-900/50'
                  )}
                >
                  <Checkbox
                    id={item.id}
                    checked={state.checklist[item.id] || false}
                    onCheckedChange={(checked) => setState(prev => ({
                      ...prev,
                      checklist: { ...prev.checklist, [item.id]: !!checked }
                    }))}
                  />
                  <Label htmlFor={item.id} className="flex-1 cursor-pointer text-sm text-slate-300">
                    {item.label}
                    {item.obrigatorio && <span className="ml-1 text-red-400">*</span>}
                  </Label>
                </div>
              ))}

              <div className="pt-2">
                <Label htmlFor="observacoes" className="text-slate-300">Observações gerais</Label>
                <Textarea
                  id="observacoes"
                  placeholder="Adicione observações relevantes..."
                  value={state.observacoesGerais}
                  onChange={(e) => setState(prev => ({ ...prev, observacoesGerais: e.target.value }))}
                  className="mt-2 min-h-[100px] border-slate-600 bg-slate-900 text-white"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Etapa 5: Assinatura do Cliente */}
        {etapaAtual === 5 && (
          <Card className="border-slate-700 bg-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                <PenTool className="h-5 w-5 text-blue-400" />
                Assinatura do cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-400">
                "Eu, proprietário do veículo, declaro que as informações e fotos registradas correspondem ao estado atual do veículo."
              </p>

              <div className="rounded-lg border border-slate-600 p-2">
                <SignaturePad
                  onSave={(blob) => setState(prev => ({ ...prev, assinaturaBlob: blob }))}
                  width={280}
                  height={150}
                />
              </div>

              {state.assinaturaBlob && (
                <div className="flex items-center gap-2 text-sm text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Assinatura capturada
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <Label htmlFor="nome-cliente" className="text-slate-300">Nome completo do cliente</Label>
                  <Input
                    id="nome-cliente"
                    placeholder="Digite o nome completo"
                    value={state.nomeCliente}
                    onChange={(e) => setState(prev => ({ ...prev, nomeCliente: e.target.value }))}
                    className="mt-1 border-slate-600 bg-slate-900 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="cpf-cliente" className="text-slate-300">CPF do cliente</Label>
                  <Input
                    id="cpf-cliente"
                    placeholder="000.000.000-00"
                    value={state.cpfCliente}
                    onChange={(e) => setState(prev => ({ ...prev, cpfCliente: e.target.value }))}
                    className="mt-1 border-slate-600 bg-slate-900 text-white"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer com botões de navegação */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-slate-700 bg-slate-800 p-4">
        <div className="flex gap-3">
          {etapaAtual > 1 && (
            <Button
              variant="outline"
              onClick={handleVoltar}
              className="flex-1 border-slate-600 text-slate-300"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          )}
          
          {etapaAtual < 5 ? (
            <Button
              onClick={handleAvancar}
              disabled={!podeAvancar(etapaAtual)}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              Próximo
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleFinalizarVistoria}
              disabled={!podeAvancar(5) || finalizando}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {finalizando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Finalizar Vistoria
            </Button>
          )}
        </div>
      </footer>

      {/* Modal de Confirmação */}
      <Dialog open={showConfirmacao} onOpenChange={() => {}}>
        <DialogContent className="border-slate-700 bg-slate-800 text-white sm:max-w-md">
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500">
              <CheckCircle2 className="h-10 w-10 text-white" />
            </div>
            <DialogTitle className="text-xl">Vistoria Concluída!</DialogTitle>
            <p className="text-slate-400">
              A vistoria foi enviada para análise. O cliente será notificado do resultado.
            </p>
            <p className="font-mono text-sm text-slate-300">
              Protocolo: {codigoVistoria}
            </p>
            <Button
              onClick={() => navigate('/vistoriador/tarefas')}
              className="mt-2 w-full bg-blue-600 hover:bg-blue-700"
            >
              Voltar para Tarefas
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
