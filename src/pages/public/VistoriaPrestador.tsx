import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, Lock, CheckCircle, MapPin, Calendar, User, Car, Hash, Cpu } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChecklistItem, type ChecklistStatus } from '@/components/instalador/ChecklistItem';
import { FotoCapture } from '@/components/instalador/FotoCapture';
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

// ── Checklist items (same as InstaladorChecklist) ──
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

export default function VistoriaPrestador() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [concluding, setConcluding] = useState(false);

  // ── Checklist state ──
  const [checklist, setChecklist] = useState<ChecklistState>(() =>
    CHECKLIST_ITEMS.reduce((acc, item) => ({
      ...acc,
      [item.id]: { status: 'pendente' as ChecklistStatus },
    }), {})
  );

  // ── Fotos state ──
  const [fotosMap, setFotosMap] = useState<Record<string, string>>({});
  const [uploadingFoto, setUploadingFoto] = useState<string | null>(null);
  const [fotoErrors, setFotoErrors] = useState<Record<string, boolean>>({});

  // ── Assinatura state ──
  const [assinaturaUrl, setAssinaturaUrl] = useState<string | null>(null);
  const [uploadingAssinatura, setUploadingAssinatura] = useState(false);

  // ── Token validation query ──
  const { data: link, isLoading, error } = useQuery({
    queryKey: ['vistoria-prestador-link', token],
    queryFn: async () => {
      if (!token) throw new Error('Token inválido');
      const { data, error } = await publicSupabase
        .from('vistoria_prestador_links' as any)
        .select('*')
        .eq('token', token)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return data as any;
    },
    enabled: !!token,
  });

  // ── Installation data query ──
  const { data: instalacao } = useQuery({
    queryKey: ['vistoria-prestador-instalacao', link?.instalacao_id],
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

  // ── Rastreador data ──
  const { data: rastreador } = useQuery({
    queryKey: ['vistoria-prestador-rastreador', instalacao?.rastreador_id],
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

  // ── Detect vehicle type ──
  const veiculo = instalacao?.veiculos as any;
  const tipoVeiculo: TipoVeiculo = useMemo(() => {
    if (!veiculo) return 'automovel';
    return detectarTipoVeiculo(veiculo.tipo_veiculo, veiculo.modelo, veiculo.marca);
  }, [veiculo]);

  // ── Photo categories ──
  const fotosCategorias = useMemo(() => agruparFotosFiltradas(tipoVeiculo, false), [tipoVeiculo]);
  const todasFotos = useMemo(() => fotosCategorias.flatMap(c => c.fotos), [fotosCategorias]);

  // ── Restore saved state from link ──
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
    if (link.assinatura_url) {
      setAssinaturaUrl(link.assinatura_url);
    }
  }, [link]);

  // ── Auto-mark as em_execucao on first load ──
  useEffect(() => {
    if (link?.status === 'aguardando' && token) {
      publicSupabase
        .from('vistoria_prestador_links' as any)
        .update({
          status: 'em_execucao',
          chegada_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('token', token)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['vistoria-prestador-link', token] });
        });
    }
  }, [link?.status, token]);

  // ── Auto-save checklist ──
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const autoSave = useCallback((data: Partial<{ checklist_data: any; fotos_vistoria: any; assinatura_url: string }>) => {
    if (!token) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      await publicSupabase
        .from('vistoria_prestador_links' as any)
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
    setFotoErrors(prev => ({ ...prev, [fotoConfig.id]: false }));

    try {
      let fileToUpload = file;
      if (file.size > 500 * 1024) {
        try {
          fileToUpload = await compressImage(file, { maxWidth: 1920, maxHeight: 1920, quality: 0.75, maxSizeKB: 800 });
        } catch { /* use original */ }
      }

      const ext = fileToUpload.name.split('.').pop() || 'jpg';
      const path = `${link.id}/${fotoConfig.id}_${Date.now()}.${ext}`;

      const { error: uploadErr } = await publicSupabase.storage
        .from('vistoria-prestador-fotos')
        .upload(path, fileToUpload, { upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = publicSupabase.storage
        .from('vistoria-prestador-fotos')
        .getPublicUrl(path);

      setFotosMap(prev => {
        const next = { ...prev, [fotoConfig.id]: urlData.publicUrl };
        autoSave({ fotos_vistoria: next });
        return next;
      });
    } catch (err) {
      console.error('[VistoriaPrestador] Erro upload foto:', err);
      setFotoErrors(prev => ({ ...prev, [fotoConfig.id]: true }));
      toast.error('Erro ao enviar foto. Tente novamente.');
    } finally {
      setUploadingFoto(null);
    }
  }, [link, autoSave]);

  const handleFotoRemove = useCallback((fotoId: string) => {
    setFotosMap(prev => {
      const next = { ...prev };
      delete next[fotoId];
      autoSave({ fotos_vistoria: next });
      return next;
    });
  }, [autoSave]);

  const handleSignatureSave = useCallback(async (blob: Blob) => {
    if (!link) return;
    setUploadingAssinatura(true);
    try {
      const path = `${link.id}/assinatura_${Date.now()}.png`;
      const { error: uploadErr } = await publicSupabase.storage
        .from('vistoria-prestador-fotos')
        .upload(path, blob, { contentType: 'image/png', upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = publicSupabase.storage
        .from('vistoria-prestador-fotos')
        .getPublicUrl(path);

      setAssinaturaUrl(urlData.publicUrl);
      autoSave({ assinatura_url: urlData.publicUrl });
      toast.success('Assinatura salva!');
    } catch {
      toast.error('Erro ao salvar assinatura.');
    } finally {
      setUploadingAssinatura(false);
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
  const fotosMinimoAtingido = fotosPreenchidas >= Math.min(fotosObrigatoriasCount, 10); // min 10 or all if fewer

  const canFinalize = checklistComplete && fotosMinimoAtingido && !!assinaturaUrl;

  // ── Conclude mutation ──
  const handleConfirmConcluir = useCallback(async () => {
    if (!token) return;
    setConcluding(true);
    try {
      const { error } = await publicSupabase
        .from('vistoria_prestador_links' as any)
        .update({
          status: 'concluida',
          concluida_em: new Date().toISOString(),
          checklist_data: checklist,
          fotos_vistoria: fotosMap,
          assinatura_url: assinaturaUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('token', token);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['vistoria-prestador-link', token] });
      toast.success('Vistoria concluída com sucesso!');
    } catch {
      toast.error('Erro ao concluir vistoria.');
    } finally {
      setConcluding(false);
      setShowConfirmDialog(false);
    }
  }, [token, checklist, fotosMap, assinaturaUrl, queryClient]);

  // ════════════════════════════════════
  // RENDERING
  // ════════════════════════════════════

  // ── Estado 1: Validando ──
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
        <p className="text-slate-600 text-sm">Validando acesso...</p>
      </div>
    );
  }

  // ── Estado 2: Inválido ──
  if (error || !link || link.status === 'concluida' || link.status === 'cancelada') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <Lock className="h-8 w-8 text-slate-400" />
        </div>
        <h1 className="text-xl font-bold text-slate-800 mb-2">Link inválido</h1>
        <p className="text-slate-500 text-sm text-center max-w-xs">
          Este link não é válido ou já foi utilizado. Entre em contato com o coordenador.
        </p>
      </div>
    );
  }

  // ── Estado 4: Concluído (just confirmed) ──
  // Note: this is already handled by Estado 2 for 'concluida' status on reload,
  // but we show this success UI right after confirmation via mutation result

  const associado = instalacao?.associados as any;
  const endereco = [
    instalacao?.logradouro,
    instalacao?.numero ? `nº ${instalacao.numero}` : null,
    instalacao?.complemento,
    instalacao?.bairro,
    instalacao?.cidade,
    instalacao?.uf,
  ].filter(Boolean).join(', ');

  // ── Estado 3: Tela principal ──
  return (
    <div className="min-h-screen bg-white pb-28">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-slate-800">PraticCar</span>
          </div>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-semibold">
            VISTORIA EXTERNA
          </Badge>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-5">

        {/* ── Seção 1: Dados da instalação ── */}
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
                <div>
                  <p className="text-sm text-slate-700">
                    {format(new Date(instalacao.data_agendada + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    {instalacao.periodo && ` — ${instalacao.periodo === 'manha' ? 'Manhã' : instalacao.periodo === 'tarde' ? 'Tarde' : instalacao.periodo}`}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-2">
              <User className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-slate-700">{associado?.nome || '—'}</p>
            </div>
          </CardContent>
        </Card>

        {/* ── Seção 2: Equipamentos para instalação ── */}
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

        {/* ── Seção 3: Checklist de Vistoria ── */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-slate-800">Checklist de Vistoria</CardTitle>
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
                    const next = {
                      ...prev,
                      [item.id]: { ...prev[item.id], observacao: value },
                    };
                    autoSave({ checklist_data: next });
                    return next;
                  });
                }}
              />
            ))}
          </CardContent>
        </Card>

        {/* ── Seção 4: Fotos ── */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-slate-800">Fotos da Vistoria</CardTitle>
              <Badge variant="outline" className={
                fotosMinimoAtingido
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }>
                {fotosPreenchidas}/{fotosObrigatoriasCount}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {fotosCategorias.map(categoria => (
              <div key={categoria.id}>
                <p className="text-sm font-semibold text-slate-700 mb-2">{categoria.nome}</p>
                {categoria.descricao && (
                  <p className="text-xs text-slate-400 mb-2">{categoria.descricao}</p>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {categoria.fotos.map(foto => (
                    <FotoCapture
                      key={foto.id}
                      tipo={foto.id}
                      label={foto.nome}
                      obrigatoria={true}
                      fotoUrl={fotosMap[foto.id]}
                      uploading={uploadingFoto === foto.id}
                      hasError={fotoErrors[foto.id]}
                      onCapture={(file) => handleFotoCapture(foto, file)}
                      onRemove={() => handleFotoRemove(foto.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ── Seção 5: Assinatura do associado ── */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-slate-800">Assinatura do Associado</CardTitle>
              {assinaturaUrl && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Coletada
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {assinaturaUrl ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-green-200 bg-green-50/50 p-2">
                  <img src={assinaturaUrl} alt="Assinatura" className="w-full rounded" />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setAssinaturaUrl(null)}
                >
                  Refazer assinatura
                </Button>
              </div>
            ) : (
              <SignaturePad
                onSave={handleSignatureSave}
                disabled={uploadingAssinatura}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Botão fixo no rodapé ── */}
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
            Finalizar Vistoria
          </Button>
          {!canFinalize && (
            <p className="text-xs text-slate-400 text-center mt-2">
              {!checklistComplete && 'Complete o checklist • '}
              {!fotosMinimoAtingido && `Envie ao menos ${Math.min(fotosObrigatoriasCount, 10)} fotos • `}
              {!assinaturaUrl && 'Colete a assinatura'}
            </p>
          )}
        </div>
      </div>

      {/* ── Modal de confirmação ── */}
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
