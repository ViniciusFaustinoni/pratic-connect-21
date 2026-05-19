import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Loader2, Lock, CheckCircle, MapPin, Calendar, User, Car, Hash, Cpu,
  Navigation as NavIcon, ThumbsUp, ThumbsDown, PlayCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ChecklistItem, type ChecklistStatus } from '@/components/instalador/ChecklistItem';
import { VistoriaFotoSequencial } from '@/components/vistorias/VistoriaFotoSequencial';
import { SignaturePad } from '@/components/instalador/SignaturePad';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  detectarTipoVeiculo,
  agruparFotosFiltradas,
  type TipoVeiculo,
  type VistoriaFotoConfig,
} from '@/data/vistoriaConfigCompleta';
import { compressImage } from '@/lib/imageCompressor';

// ── Checklist items espelhando InstaladorChecklist ──
const CHECKLIST_ITEMS = [
  { id: 'veiculo_confere', label: 'Veículo corresponde aos dados cadastrados', critico: true },
  { id: 'placa_confere', label: 'Placa confere com o documento', critico: true },
  { id: 'condicoes_veiculo', label: 'Condições do veículo adequadas', critico: false },
  { id: 'local_seguro', label: 'Local de instalação seguro', critico: false },
  { id: 'bateria_ok', label: 'Bateria do veículo em boas condições', critico: false },
  { id: 'eletrica_ok', label: 'Acessórios elétricos funcionando', critico: false },
  { id: 'cliente_ciente', label: 'Associado ciente do procedimento', critico: false },
];

type ChecklistState = Record<string, { status: ChecklistStatus; observacao?: string; fotos?: string[] }>;

export default function PrestadorInstalacao() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [concluding, setConcluding] = useState(false);
  const [showRecusarDialog, setShowRecusarDialog] = useState(false);
  const [recusaMotivo, setRecusaMotivo] = useState('');

  const [checklist, setChecklist] = useState<ChecklistState>(() =>
    CHECKLIST_ITEMS.reduce((acc, item) => ({
      ...acc,
      [item.id]: { status: 'pendente' as ChecklistStatus },
    }), {} as ChecklistState)
  );

  const [fotosMap, setFotosMap] = useState<Record<string, string>>({});
  const [uploadingFoto, setUploadingFoto] = useState<string | null>(null);
  const [assinaturaUrl, setAssinaturaUrl] = useState<string | null>(null);
  const [uploadingSig, setUploadingSig] = useState(false);
  const [imeiRastreador, setImeiRastreador] = useState<string>('');

  const fotosEnviadasArray = useMemo(
    () => Object.entries(fotosMap).map(([tipo, arquivo_url]) => ({ tipo, arquivo_url })),
    [fotosMap]
  );

  // ── Token validation ──
  const { data: link, isLoading, error } = useQuery({
    queryKey: ['prestador-link', token],
    queryFn: async () => {
      if (!token) throw new Error('Token inválido');
      const { data, error } = await publicSupabase
        .from('instalacao_prestador_links' as any)
        .select('*')
        .eq('token', token)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      if ((data as any).expires_at && new Date((data as any).expires_at) < new Date()) {
        throw new Error('Este link expirou');
      }
      return data as any;
    },
    enabled: !!token,
  });

  // ── Instalação data ──
  const { data: instalacao } = useQuery({
    queryKey: ['prestador-instalacao', link?.instalacao_id],
    queryFn: async () => {
      const { data, error } = await publicSupabase
        .from('instalacoes' as any)
        .select(`
          id, data_agendada, periodo, logradouro, numero, complemento, bairro, cidade, uf, cep,
          rastreador_id,
          associados:associado_id(nome, telefone),
          veiculos:veiculo_id(marca, modelo, ano, placa, tipo_veiculo)
        `)
        .eq('id', link.instalacao_id)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!link?.instalacao_id,
  });

  // ── Rastreador ──
  const { data: rastreador } = useQuery({
    queryKey: ['prestador-rastreador', instalacao?.rastreador_id],
    queryFn: async () => {
      const { data, error } = await publicSupabase
        .from('rastreadores' as any)
        .select('id, codigo, modelo')
        .eq('id', instalacao.rastreador_id)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!instalacao?.rastreador_id,
  });

  // ── Vehicle type & photo categories ──
  const veiculo = instalacao?.veiculos as any;
  const tipoVeiculo: TipoVeiculo = useMemo(() => {
    if (!veiculo) return 'automovel';
    return detectarTipoVeiculo(veiculo.tipo_veiculo, veiculo.modelo, veiculo.marca);
  }, [veiculo]);

  const fotosCategorias = useMemo(() => agruparFotosFiltradas(tipoVeiculo, false), [tipoVeiculo]);
  const todasFotos = useMemo(() => fotosCategorias.flatMap(c => c.fotos), [fotosCategorias]);

  // ── Restore from saved state ──
  const restoredRef = useRef(false);
  useEffect(() => {
    if (!link || restoredRef.current) return;
    restoredRef.current = true;
    if (link.checklist_data && typeof link.checklist_data === 'object') {
      setChecklist(link.checklist_data as ChecklistState);
    }
    if (link.fotos_vistoria && typeof link.fotos_vistoria === 'object') {
      setFotosMap(link.fotos_vistoria as Record<string, string>);
    }
    if (link.assinatura_url) setAssinaturaUrl(link.assinatura_url);
  }, [link]);

  // ── Geolocalização contínua ──
  useEffect(() => {
    if (!token || !link) return;
    if (link.status === 'concluida' || link.status === 'cancelada') return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    let lastSent = 0;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSent < 25_000) return;
        lastSent = now;
        publicSupabase
          .from('instalacao_prestador_links' as any)
          .update({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            precisao_metros: pos.coords.accuracy,
            localizacao_atualizada_em: new Date().toISOString(),
          })
          .eq('token', token)
          .then(() => {});
      },
      (err) => console.warn('[PrestadorInstalacao] geolocation error', err),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [token, link?.status, link?.id]);

  // ── Status transitions ──
  const transicionarStatus = useCallback(async (
    novoStatus: 'aceito' | 'em_rota' | 'em_execucao',
  ) => {
    if (!token) return;

    // Refresh defensivo: detectar reatribuição/cancelamento antes de gravar
    const { data: fresh, error: freshErr } = await publicSupabase
      .from('instalacao_prestador_links' as any)
      .select('status')
      .eq('token', token)
      .maybeSingle();
    if (freshErr) {
      toast.error(`Erro ao atualizar status: ${freshErr.message || 'tente novamente'}`);
      return;
    }
    if (!fresh) {
      toast.error('Link não encontrado');
      return;
    }
    const freshStatus = (fresh as any).status as string;
    if (!['aguardando', 'aceito', 'em_rota'].includes(freshStatus)) {
      toast.error('Esta tarefa foi reatribuída ou encerrada. Abra o link mais recente enviado por WhatsApp.');
      queryClient.invalidateQueries({ queryKey: ['prestador-link', token] });
      return;
    }

    const stamp = new Date().toISOString();
    const fieldStamp =
      novoStatus === 'aceito' ? 'aceito_em' :
      novoStatus === 'em_rota' ? 'em_rota_em' :
      'iniciada_em';
    const payload: any = {
      status: novoStatus,
      [fieldStamp]: stamp,
      updated_at: stamp,
    };
    if (novoStatus === 'em_execucao') payload.chegada_em = stamp;
    const { data, error } = await publicSupabase
      .from('instalacao_prestador_links' as any)
      .update(payload)
      .eq('token', token)
      .select('id, status');
    if (error) {
      console.error('[PrestadorInstalacao] update status error', error);
      toast.error(`Erro ao atualizar status: ${error.message || 'tente novamente'}`);
      return;
    }
    if (!data || data.length === 0) {
      toast.error('Esta tarefa foi reatribuída ou encerrada. Abra o link mais recente enviado por WhatsApp.');
      queryClient.invalidateQueries({ queryKey: ['prestador-link', token] });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['prestador-link', token] });
  }, [token, queryClient]);

  const recusarTarefa = useCallback(async () => {
    if (!token) return;
    const stamp = new Date().toISOString();
    const { error } = await publicSupabase
      .from('instalacao_prestador_links' as any)
      .update({
        status: 'cancelada',
        recusado_em: stamp,
        recusa_motivo: recusaMotivo || null,
        updated_at: stamp,
      })
      .eq('token', token);
    if (error) { toast.error('Erro ao recusar'); return; }
    setShowRecusarDialog(false);
    queryClient.invalidateQueries({ queryKey: ['prestador-link', token] });
    toast.success('Tarefa recusada');
  }, [token, recusaMotivo, queryClient]);

  // ── Auto-save ──
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const autoSave = useCallback((data: Partial<{ checklist_data: any; fotos_vistoria: any; assinatura_url: string }>) => {
    if (!token) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      await publicSupabase
        .from('instalacao_prestador_links' as any)
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('token', token);
    }, 1500);
  }, [token]);

  // ── Handlers ──
  const handleChecklistChange = useCallback((itemId: string, status: ChecklistStatus) => {
    setChecklist(prev => {
      const next = { ...prev, [itemId]: { ...prev[itemId], status } };
      autoSave({ checklist_data: next });
      return next;
    });
  }, [autoSave]);

  const handleFotoCapture = useCallback(async (fotoConfig: VistoriaFotoConfig, file: File) => {
    if (!link) return;
    setUploadingFoto(fotoConfig.id);
    try {
      let fileToUpload = file;
      if (file.size > 500 * 1024) {
        try {
          fileToUpload = await compressImage(file);
        } catch { /* use original */ }
      }
      const ext = fileToUpload.name.split('.').pop() || 'jpg';
      const path = `${link.id}/${fotoConfig.id}_${Date.now()}.${ext}`;

      const { error: uploadErr } = await publicSupabase.storage
        .from('prestador-fotos')
        .upload(path, fileToUpload, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = publicSupabase.storage
        .from('prestador-fotos')
        .getPublicUrl(path);

      setFotosMap(prev => {
        const next = { ...prev, [fotoConfig.id]: urlData.publicUrl };
        autoSave({ fotos_vistoria: next });
        return next;
      });
    } catch (err) {
      console.error('[PrestadorInstalacao] Erro upload foto:', err);
      toast.error('Erro ao enviar foto. Tente novamente.');
    } finally {
      setUploadingFoto(null);
    }
  }, [link, autoSave]);

  const handleAssinaturaSave = useCallback(async (blob: Blob) => {
    if (!link) return;
    setUploadingSig(true);
    try {
      const path = `${link.id}/assinatura_${Date.now()}.png`;
      const { error: upErr } = await publicSupabase.storage
        .from('assinaturas')
        .upload(path, blob, { upsert: true, contentType: 'image/png' });
      if (upErr) throw upErr;
      const { data: urlData } = publicSupabase.storage.from('assinaturas').getPublicUrl(path);
      setAssinaturaUrl(urlData.publicUrl);
      autoSave({ assinatura_url: urlData.publicUrl });
      toast.success('Assinatura registrada');
    } catch (err) {
      console.error('[PrestadorInstalacao] Erro assinatura:', err);
      toast.error('Erro ao salvar assinatura');
    } finally {
      setUploadingSig(false);
    }
  }, [link, autoSave]);

  // ── Completion checks ──
  const checklistComplete = useMemo(() =>
    CHECKLIST_ITEMS.every(item => checklist[item.id]?.status === 'ok' || checklist[item.id]?.status === 'nok'),
    [checklist]
  );

  const fotosObrigatoriasCount = todasFotos.length;
  const fotosPreenchidas = useMemo(() =>
    todasFotos.filter(f => !!fotosMap[f.id]).length,
    [todasFotos, fotosMap]
  );
  const fotosMinimoAtingido = fotosPreenchidas >= Math.min(fotosObrigatoriasCount, 10);

  const canFinalize = checklistComplete && fotosMinimoAtingido && !!assinaturaUrl;

  const handleConfirmConcluir = useCallback(async () => {
    if (!token) return;
    setConcluding(true);
    try {
      const { data, error } = await publicSupabase.functions.invoke('concluir-instalacao-prestador', {
        body: {
          token,
          checklist_data: checklist,
          fotos_vistoria: fotosMap,
          assinatura_url: assinaturaUrl,
        },
      });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || 'Erro ao concluir');
      queryClient.invalidateQueries({ queryKey: ['prestador-link', token] });
      toast.success('Instalação concluída com sucesso!');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao concluir instalação.');
    } finally {
      setConcluding(false);
      setShowConfirmDialog(false);
    }
  }, [token, checklist, fotosMap, assinaturaUrl, queryClient]);

  // ════════════════════════════════════
  // RENDERING
  // ════════════════════════════════════

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
        <p className="text-slate-600 text-sm">Validando acesso...</p>
      </div>
    );
  }

  if (error || !link || link.status === 'concluida' || link.status === 'cancelada') {
    const isReatribuida =
      link?.status === 'cancelada' && !(link as any)?.recusado_em;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          {link?.status === 'concluida' ? (
            <CheckCircle className="h-8 w-8 text-green-600" />
          ) : (
            <Lock className="h-8 w-8 text-slate-400" />
          )}
        </div>
        <h1 className="text-xl font-bold text-slate-800 mb-2">
          {link?.status === 'concluida'
            ? 'Instalação concluída'
            : isReatribuida
              ? 'Tarefa reatribuída'
              : 'Link inválido'}
        </h1>
        <p className="text-slate-500 text-sm text-center max-w-xs">
          {link?.status === 'concluida'
            ? 'Obrigado! A equipe Praticcar foi notificada.'
            : isReatribuida
              ? 'Esta tarefa foi reatribuída pela central. Verifique o WhatsApp para o novo link de acesso.'
              : 'Este link não é válido ou já foi utilizado. Entre em contato com o coordenador.'}
        </p>
      </div>
    );
  }

  const associado = instalacao?.associados as any;
  const endereco = [
    instalacao?.logradouro,
    instalacao?.numero ? `nº ${instalacao.numero}` : null,
    instalacao?.complemento,
    instalacao?.bairro,
    instalacao?.cidade,
    instalacao?.uf,
  ].filter(Boolean).join(', ');

  return (
    <div className="min-h-screen bg-white pb-28">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-slate-800">PraticCar</span>
          </div>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-semibold">
            INSTALAÇÃO EXTERNA
          </Badge>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-5">

        {/* Dados da instalação */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-800 flex items-center gap-2">
              <Car className="h-4 w-4 text-blue-600" />
              Dados da Instalação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {veiculo && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Veículo</p>
                <p className="font-medium text-slate-800">
                  {[veiculo.marca, veiculo.modelo, veiculo.ano].filter(Boolean).join(' ')}
                </p>
                {veiculo.placa && (
                  <span className="inline-block mt-1 px-3 py-1 bg-slate-900 text-white font-bold text-lg rounded tracking-widest">
                    {veiculo.placa}
                  </span>
                )}
              </div>
            )}

            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-slate-700">{endereco || 'Endereço não informado'}</p>
                {instalacao?.cep && <p className="text-xs text-slate-400">CEP: {instalacao.cep}</p>}
              </div>
            </div>

            {instalacao?.data_agendada && (
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-slate-700">
                  {format(new Date(instalacao.data_agendada + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  {instalacao.periodo && ` — ${instalacao.periodo === 'manha' ? 'Manhã' : instalacao.periodo === 'tarde' ? 'Tarde' : instalacao.periodo}`}
                </p>
              </div>
            )}

            <div className="flex items-start gap-2">
              <User className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-slate-700">{associado?.nome || '—'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Equipamentos */}
        {rastreador && (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-slate-800 flex items-center gap-2">
                <Cpu className="h-4 w-4 text-blue-600" />
                Equipamentos para instalação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Hash className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-800 text-sm">{rastreador.codigo || 'Sem código'}</p>
                  <p className="text-xs text-slate-500">{rastreador.modelo || 'Modelo não informado'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ciclo de vida */}
        {link.status === 'aguardando' && (
          <Card className="border-amber-200 bg-amber-50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-amber-900">Nova tarefa recebida</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-amber-800">
                Você recebeu uma nova tarefa de instalação. Confirme se aceita realizá-la.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button className="h-12 bg-green-600 hover:bg-green-700 text-white" onClick={() => transicionarStatus('aceito')}>
                  <ThumbsUp className="h-4 w-4 mr-2" />Aceitar
                </Button>
                <Button variant="outline" className="h-12 border-red-300 text-red-700 hover:bg-red-50" onClick={() => setShowRecusarDialog(true)}>
                  <ThumbsDown className="h-4 w-4 mr-2" />Recusar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {link.status === 'aceito' && (
          <Card className="border-blue-200 bg-blue-50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-blue-900">Tarefa aceita</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-blue-800">
                Quando estiver a caminho, toque em "Iniciar Rota". Sua localização será compartilhada com o coordenador.
              </p>
              <Button className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => transicionarStatus('em_rota')}>
                <NavIcon className="h-4 w-4 mr-2" />Iniciar Rota
              </Button>
            </CardContent>
          </Card>
        )}

        {link.status === 'em_rota' && (
          <Card className="border-purple-200 bg-purple-50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-purple-900">Em rota até o local</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-purple-800">
                Ao chegar no local, toque em "Cheguei / Iniciar Instalação" para liberar o checklist e as fotos.
              </p>
              <Button className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white" onClick={() => transicionarStatus('em_execucao')}>
                <PlayCircle className="h-4 w-4 mr-2" />Cheguei / Iniciar Instalação
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Em execução: checklist + fotos + assinatura */}
        {link.status === 'em_execucao' && (
          <>
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base text-slate-800">Checklist de Instalação</CardTitle>
                  <Badge variant="outline" className={
                    checklistComplete
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }>
                    {Object.values(checklist).filter(c => c.status !== 'pendente').length}/{CHECKLIST_ITEMS.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {CHECKLIST_ITEMS.map(item => (
                  <ChecklistItem
                    key={item.id}
                    label={item.label}
                    status={checklist[item.id]?.status || 'pendente'}
                    observacao={checklist[item.id]?.observacao}
                    onStatusChange={(status) => handleChecklistChange(item.id, status)}
                    onObservacaoChange={(value) => {
                      setChecklist(prev => {
                        const next = { ...prev, [item.id]: { ...prev[item.id], observacao: value } };
                        autoSave({ checklist_data: next });
                        return next;
                      });
                    }}
                  />
                ))}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base text-slate-800">Fotos da Instalação</CardTitle>
                  <Badge variant="outline" className={
                    fotosMinimoAtingido
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }>
                    {fotosPreenchidas}/{fotosObrigatoriasCount}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <VistoriaFotoSequencial
                  fotos={todasFotos}
                  fotosEnviadas={fotosEnviadasArray}
                  uploadingFoto={uploadingFoto}
                  onUpload={(fotoId, file) => {
                    const foto = todasFotos.find(f => f.id === fotoId);
                    if (foto) handleFotoCapture(foto, file);
                  }}
                />
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base text-slate-800">Assinatura do Associado</CardTitle>
                  <Badge variant="outline" className={
                    assinaturaUrl
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }>
                    {assinaturaUrl ? 'OK' : 'Pendente'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {assinaturaUrl ? (
                  <div className="space-y-2">
                    <img src={assinaturaUrl} alt="Assinatura" className="w-full border border-slate-200 rounded-lg bg-white" />
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setAssinaturaUrl(null)}
                      disabled={uploadingSig}
                    >
                      Refazer assinatura
                    </Button>
                  </div>
                ) : (
                  <SignaturePad onSave={handleAssinaturaSave} disabled={uploadingSig} />
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Botão fixo */}
      {link.status === 'em_execucao' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 z-50">
          <div className="max-w-lg mx-auto">
            <Button
              className="w-full h-14 text-base bg-green-600 hover:bg-green-700 text-white font-semibold"
              disabled={!canFinalize || concluding}
              onClick={() => setShowConfirmDialog(true)}
            >
              {concluding ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-5 w-5 mr-2" />
              )}
              Finalizar Instalação
            </Button>
            {!canFinalize && (
              <p className="text-xs text-slate-400 text-center mt-2">
                {!checklistComplete && 'Complete o checklist • '}
                {!fotosMinimoAtingido && `Envie ao menos ${Math.min(fotosObrigatoriasCount, 10)} fotos • `}
                {!assinaturaUrl && 'Capture a assinatura'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Modal de recusa */}
      <AlertDialog open={showRecusarDialog} onOpenChange={setShowRecusarDialog}>
        <AlertDialogContent className="max-w-sm mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Recusar tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              Informe o motivo (opcional). O coordenador será avisado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Motivo da recusa..."
            value={recusaMotivo}
            onChange={(e) => setRecusaMotivo(e.target.value)}
            className="min-h-[80px]"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={recusarTarefa} className="bg-red-600 hover:bg-red-700">
              Confirmar Recusa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de confirmação */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-sm mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar conclusão?</AlertDialogTitle>
            <AlertDialogDescription>
              Após confirmar, este link não poderá mais ser usado. Certifique-se de que todas as informações estão corretas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={concluding}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmConcluir}
              disabled={concluding}
              className="bg-green-600 hover:bg-green-700"
            >
              {concluding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
