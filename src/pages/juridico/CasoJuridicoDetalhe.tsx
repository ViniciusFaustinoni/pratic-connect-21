import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, ChevronDown, Download, ZoomIn, Upload, FileText, Image, Music, Video, Clock, User, AlertTriangle, CheckCircle, XCircle, Scale, Gavel, Handshake, Archive, Shield, UserX, UserMinus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useAdvogados } from '@/hooks/useAdvogados';
import { RegistrarAcaoModal } from '@/components/juridico/RegistrarAcaoModal';
import { differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { notificarDecisaoRegistrada, notificarParecerEmitido } from '@/components/sinistros/NotificacaoHelper';

// ===== Helpers =====
function getTipoBadge(assunto: string, tipo?: string) {
  if (tipo === 'sindicancia_fraude' || /fraude/i.test(assunto)) return { label: 'Fraude', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' };
  if (/carta de cancelamento/i.test(assunto)) return { label: 'Carta Cancel.', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' };
  if (/encaminhamento jur/i.test(assunto)) return { label: 'Questão Legal', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' };
  if (/indeniza/i.test(assunto)) return { label: 'Indenização', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' };
  if (/alagamento|inc[êe]ndio/i.test(assunto)) return { label: 'Análise Técnica', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' };
  return { label: 'Outro', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' };
}

const statusLabels: Record<string, string> = { pendente: 'Pendente', em_analise: 'Em Análise', respondida: 'Respondida', arquivada: 'Arquivada', ativo: 'Ativo', suspenso: 'Suspenso' };
const statusBadge: Record<string, string> = { pendente: 'bg-yellow-100 text-yellow-800', em_analise: 'bg-blue-100 text-blue-800', respondida: 'bg-green-100 text-green-800', arquivada: 'bg-gray-100 text-gray-600', ativo: 'bg-blue-100 text-blue-800' };
const prioridadeBadge: Record<string, string> = { urgente: 'bg-red-500 text-white', alta: 'bg-orange-500 text-white', media: 'bg-yellow-100 text-yellow-800', baixa: 'bg-green-100 text-green-800' };

const DECISOES = [
  { value: 'aprovado', label: 'Evento Aprovado', icon: CheckCircle, desc: 'A análise jurídica concluiu que o evento pode prosseguir. O associado será notificado da aprovação.' },
  { value: 'negado', label: 'Evento Negado', icon: XCircle, desc: 'O evento será negado definitivamente.' },
  { value: 'suspensao_associado', label: 'Suspensão do Associado', icon: UserMinus, desc: 'Além de negar o evento, o associado será suspenso. Seus veículos ficam sem cobertura.' },
  { value: 'exclusao_associado', label: 'Exclusão do Associado', icon: UserX, desc: 'O associado será excluído da associação. Todos os veículos perdem cobertura.' },
  { value: 'acao_judicial', label: 'Ação Judicial', icon: Gavel, desc: 'Processo judicial contra o associado. O caso fica aberto para acompanhamento.' },
  { value: 'acordo', label: 'Acordo', icon: Handshake, desc: 'Resolução amigável. Descrever termos nas observações.' },
  { value: 'arquivar', label: 'Arquivar', icon: Archive, desc: 'Caso arquivado sem ação adicional. O evento volta para o analista.' },
];

export default function CasoJuridicoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const { advogados } = useAdvogados({ ativo: true });

  // ===== Fetch caso (tenta consulta, depois processo) =====
  const { data: caso, isLoading } = useQuery({
    queryKey: ['caso-detalhe', id],
    queryFn: async () => {
      // Try consulta first
      const { data: consulta } = await supabase
        .from('consultas_juridicas')
        .select(`
          *,
          sinistro:sinistros!consultas_juridicas_sinistro_id_fkey(
            id, protocolo, tipo, status, data_ocorrencia, valor_fipe, valor_orcamento,
            descricao, bo_arquivo_url, resultado_sindicancia, parecer_sindicancia,
            tipo_sindicancia, motivo_sindicancia,
            associado_id, veiculo_id,
            associado:associados!sinistros_associado_id_fkey(
              id, nome, cpf, telefone, email, status, data_adesao, plano_id, pendencia_rastreador,
              plano:planos(nome)
            ),
            veiculo:veiculos!sinistros_veiculo_id_fkey(placa, marca, modelo, ano_modelo, valor_fipe)
          ),
          respondido_usuario:profiles!consultas_juridicas_respondido_por_fkey(id, nome),
          decisao_usuario:profiles!consultas_juridicas_decisao_por_fkey(id, nome)
        `)
        .eq('id', id!)
        .maybeSingle();

      if (consulta) return { ...consulta, _source: 'consulta' as const };

      // Try processo
      const { data: processo } = await supabase
        .from('processos')
        .select(`
          *,
          sinistro:sinistros(
            id, protocolo, tipo, status, data_ocorrencia, valor_fipe, valor_orcamento,
            descricao, bo_arquivo_url, resultado_sindicancia, parecer_sindicancia,
            tipo_sindicancia, motivo_sindicancia,
            associado_id, veiculo_id,
            associado:associados!sinistros_associado_id_fkey(
              id, nome, cpf, telefone, email, status, data_adesao, plano_id, pendencia_rastreador,
              plano:planos(nome)
            ),
            veiculo:veiculos!sinistros_veiculo_id_fkey(placa, marca, modelo, ano_modelo, valor_fipe)
          )
        `)
        .eq('id', id!)
        .maybeSingle();

      if (processo) return { ...processo, _source: 'processo' as const, assunto: processo.tipo || '', departamento: '' };
      return null;
    },
    enabled: !!id,
  });

  // ===== Sinistros count =====
  const associadoId = (caso as any)?.sinistro?.associado?.id;
  const { data: sinistrosCount } = useQuery({
    queryKey: ['sinistros-count', associadoId],
    queryFn: async () => {
      const { count } = await supabase.from('sinistros').select('*', { count: 'exact', head: true }).eq('associado_id', associadoId);
      return count || 0;
    },
    enabled: !!associadoId,
  });

  // ===== State =====
  const [activeTab, setActiveTab] = useState('resumo');
  const [parecer, setParecer] = useState('');
  const [parecerFiles, setParecerFiles] = useState<File[]>([]);
  const [editingParecer, setEditingParecer] = useState(false);
  const [decisao, setDecisao] = useState('');
  const [decisaoObs, setDecisaoObs] = useState('');
  const [notificar, setNotificar] = useState(false);
  const [notificarMsg, setNotificarMsg] = useState('');
  const [suspenderVeiculo, setSuspenderVeiculo] = useState(false);
  const [suspenderMotivo, setSuspenderMotivo] = useState('');
  const [acaoModalOpen, setAcaoModalOpen] = useState(false);
  const [fotoZoom, setFotoZoom] = useState<string | null>(null);
  const [advogadoDialogOpen, setAdvogadoDialogOpen] = useState(false);
  const [selectedAdvogado, setSelectedAdvogado] = useState('');

  // ===== Emitir Parecer =====
  const emitirParecer = useMutation({
    mutationFn: async () => {
      if (parecer.length < 100) throw new Error('O parecer deve ter pelo menos 100 caracteres');
      const casoData = caso as any;

      // Upload files
      for (const file of parecerFiles) {
        const ext = file.name.split('.').pop();
        const path = `juridico/${id}/${Date.now()}_${file.name}`;
        await supabase.storage.from('sinistros').upload(path, file);
        const { data: urlData } = supabase.storage.from('sinistros').getPublicUrl(path);
        await supabase.from('caso_juridico_documentos').insert({
          consulta_id: casoData._source === 'consulta' ? id : null,
          processo_id: casoData._source === 'processo' ? id : null,
          titulo: file.name,
          arquivo_url: urlData.publicUrl,
          arquivo_nome: file.name,
          tipo: 'laudo',
          registrado_por: profile?.id,
        });
      }

      if (casoData._source === 'consulta') {
        await supabase.from('consultas_juridicas').update({
          parecer,
          respondido_em: new Date().toISOString(),
          respondido_por: profile?.id,
          status: 'respondida',
        }).eq('id', id!);
      }

      await supabase.from('caso_juridico_historico').insert({
        consulta_id: casoData._source === 'consulta' ? id : null,
        processo_id: casoData._source === 'processo' ? id : null,
        tipo: 'parecer_emitido',
        titulo: 'Parecer jurídico emitido',
        descricao: `Parecer emitido por ${profile?.nome}`,
        usuario_id: profile?.id,
      });
    },
    onSuccess: () => {
      toast.success('Parecer emitido com sucesso');
      queryClient.invalidateQueries({ queryKey: ['caso-detalhe'] });
      setEditingParecer(false);
      setParecerFiles([]);
      // Notificar analista + diretores
      const casoData = caso as any;
      const casoNum = casoData?.assunto || id || '';
      const analistaId = casoData?.solicitante_id;
      notificarParecerEmitido(casoNum, analistaId);
    },
    onError: (err: any) => toast.error(err.message),
  });

  // ===== Registrar Decisão =====
  const registrarDecisao = useMutation({
    mutationFn: async () => {
      if (!decisao) throw new Error('Selecione uma decisão');
      const casoData = caso as any;
      const sinistroId = casoData.sinistro?.id;

      // Update sinistro status based on decision
      const sinistroUpdates: Record<string, 'em_analise' | 'negado' | 'aguardando_analise'> = {
        aprovado: 'em_analise',
        negado: 'negado',
        suspensao_associado: 'negado',
        exclusao_associado: 'negado',
        acao_judicial: 'negado',
        arquivar: 'aguardando_analise',
      };

      if (sinistroId && sinistroUpdates[decisao]) {
        await supabase.from('sinistros').update({ status: sinistroUpdates[decisao] as any }).eq('id', sinistroId);
        await supabase.from('sinistro_historico').insert({
          sinistro_id: sinistroId,
          status_novo: sinistroUpdates[decisao],
          observacao: `Decisão jurídica: ${DECISOES.find(d => d.value === decisao)?.label}. ${decisaoObs}`,
          usuario_id: profile?.id,
          usuario_nome: profile?.nome,
        });
      }

      // Update associado if needed
      if (decisao === 'suspensao_associado' && casoData.sinistro?.associado_id) {
        await supabase.from('associados').update({ status: 'suspenso' }).eq('id', casoData.sinistro.associado_id);
      }
      if (decisao === 'exclusao_associado' && casoData.sinistro?.associado_id) {
        await supabase.from('associados').update({ status: 'cancelado' }).eq('id', casoData.sinistro.associado_id);
      }

      // Update caso status
      if (casoData._source === 'consulta') {
        const casoStatus = decisao === 'acao_judicial' ? 'em_analise' : decisao === 'arquivar' ? 'arquivada' : 'respondida';
        await supabase.from('consultas_juridicas').update({
          decisao,
          decisao_observacoes: decisaoObs,
          decisao_por: profile?.id,
          decisao_em: new Date().toISOString(),
          status: casoStatus,
        }).eq('id', id!);
      }

      // Register in history
      await supabase.from('caso_juridico_historico').insert({
        consulta_id: casoData._source === 'consulta' ? id : null,
        processo_id: casoData._source === 'processo' ? id : null,
        tipo: 'decisao',
        titulo: `Decisão: ${DECISOES.find(d => d.value === decisao)?.label}`,
        descricao: decisaoObs || null,
        usuario_id: profile?.id,
      });
    },
    onSuccess: () => {
      toast.success('Decisão registrada com sucesso');
      queryClient.invalidateQueries({ queryKey: ['caso-detalhe'] });
      // Notificar analista + diretores
      const casoData = caso as any;
      const casoNum = casoData?.assunto || id || '';
      const analistaId = casoData?.solicitante_id;
      const decisaoLabel = DECISOES.find(d => d.value === decisao)?.label || decisao;
      notificarDecisaoRegistrada(casoNum, decisaoLabel, analistaId);

      // Retomar prazo de ressarcimento se aprovado ou arquivado
      const sinId = casoData?.sinistro?.id;
      if (sinId && ['aprovado', 'arquivar'].includes(decisao)) {
        supabase.from('sinistros').update({
          prazo_suspenso: false,
          prazo_suspenso_em: null,
          prazo_motivo_suspensao: null,
        }).eq('id', sinId).then(() => {});
        // Fechar suspensão aberta
        supabase.from('sinistro_suspensoes_prazo')
          .update({ fim: new Date().toISOString() })
          .eq('sinistro_id', sinId)
          .is('fim', null)
          .then(() => {});
      }
    },
    onError: (err: any) => toast.error(err.message),
  });

  // ===== Alterar Prioridade =====
  const alterarPrioridade = useMutation({
    mutationFn: async (novaPrioridade: string) => {
      const casoData = caso as any;
      if (casoData._source === 'consulta') {
        await supabase.from('consultas_juridicas').update({ prioridade: novaPrioridade }).eq('id', id!);
      }
      await supabase.from('caso_juridico_historico').insert({
        consulta_id: casoData._source === 'consulta' ? id : null,
        processo_id: casoData._source === 'processo' ? id : null,
        tipo: 'prioridade_alterada',
        titulo: `Prioridade alterada para ${novaPrioridade}`,
        usuario_id: profile?.id,
      });
    },
    onSuccess: () => {
      toast.success('Prioridade alterada');
      queryClient.invalidateQueries({ queryKey: ['caso-detalhe'] });
    },
  });

  // ===== Atribuir Advogado =====
  const atribuirAdvogado = useMutation({
    mutationFn: async (advogadoId: string) => {
      const casoData = caso as any;
      if (casoData._source === 'consulta') {
        await supabase.from('consultas_juridicas').update({ respondido_por: advogadoId }).eq('id', id!);
      }
      await supabase.from('caso_juridico_historico').insert({
        consulta_id: casoData._source === 'consulta' ? id : null,
        processo_id: casoData._source === 'processo' ? id : null,
        tipo: 'advogado_atribuido',
        titulo: 'Advogado atribuído ao caso',
        usuario_id: profile?.id,
      });
    },
    onSuccess: () => {
      toast.success('Advogado atribuído');
      setAdvogadoDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['caso-detalhe'] });
    },
  });

  // ===== Historico =====
  const sinistroId = (caso as any)?.sinistro?.id;
  const { data: historico = [] } = useQuery({
    queryKey: ['caso-historico', id, sinistroId],
    queryFn: async () => {
      const casoData = caso as any;
      const items: any[] = [];

      // caso_juridico_historico
      const historicoQuery = casoData._source === 'consulta'
        ? supabase.from('caso_juridico_historico').select('*, usuario:profiles!caso_juridico_historico_usuario_id_fkey(nome)').eq('consulta_id', id!)
        : supabase.from('caso_juridico_historico').select('*, usuario:profiles!caso_juridico_historico_usuario_id_fkey(nome)').eq('processo_id', id!);
      const { data: casoHist } = await historicoQuery.order('created_at', { ascending: false });
      (casoHist || []).forEach(h => items.push({ ...h, _type: 'caso' }));

      // sinistro_historico
      if (sinistroId) {
        const { data: sinHist } = await supabase.from('sinistro_historico')
          .select('*, usuario:profiles!sinistro_historico_usuario_id_fkey(nome)')
          .eq('sinistro_id', sinistroId)
          .order('created_at', { ascending: false });
        (sinHist || []).forEach(h => items.push({
          id: h.id, tipo: 'mudanca_status', titulo: `Status: ${h.status_anterior || '?'} → ${h.status_novo}`,
          descricao: h.observacao, usuario: h.usuario, created_at: h.created_at, _type: 'sinistro',
        }));
      }

      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return items;
    },
    enabled: !!caso,
  });

  // ===== Documentos =====
  const { data: sinistroFotos = [] } = useQuery({
    queryKey: ['caso-fotos', sinistroId],
    queryFn: async () => {
      const { data } = await supabase.from('sinistro_fotos').select('*').eq('sinistro_id', sinistroId!);
      return data || [];
    },
    enabled: !!sinistroId,
  });

  const { data: sinistroDocumentos = [] } = useQuery({
    queryKey: ['caso-sin-docs', sinistroId],
    queryFn: async () => {
      const { data } = await supabase.from('sinistro_documentos').select('*').eq('sinistro_id', sinistroId!);
      return data || [];
    },
    enabled: !!sinistroId,
  });

  const { data: vistoriasEvento = [] } = useQuery({
    queryKey: ['caso-vistorias', sinistroId],
    queryFn: async () => {
      const { data } = await supabase.from('vistorias_evento').select('*').eq('sinistro_id', sinistroId!);
      return data || [];
    },
    enabled: !!sinistroId,
  });

  const { data: cotacoesPecas = [] } = useQuery({
    queryKey: ['caso-cotacoes', sinistroId],
    queryFn: async () => {
      const { data } = await supabase.from('evento_cotacoes_pecas').select('*').eq('sinistro_id', sinistroId!);
      return data || [];
    },
    enabled: !!sinistroId,
  });

  const { data: sindicanciaEvidencias = [] } = useQuery({
    queryKey: ['caso-evidencias', sinistroId],
    queryFn: async () => {
      const { data } = await supabase.from('sindicancia_evidencias').select('*').eq('sinistro_id', sinistroId!);
      return data || [];
    },
    enabled: !!sinistroId,
  });

  const { data: casoDocumentos = [] } = useQuery({
    queryKey: ['caso-documentos', id],
    queryFn: async () => {
      const casoData = caso as any;
      const q = casoData._source === 'consulta'
        ? supabase.from('caso_juridico_documentos').select('*').eq('consulta_id', id!)
        : supabase.from('caso_juridico_documentos').select('*').eq('processo_id', id!);
      const { data } = await q.order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!caso,
  });

  if (isLoading) return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-96 w-full" />
    </div>
  );

  if (!caso) return (
    <div className="flex flex-col items-center justify-center py-20">
      <p className="text-muted-foreground">Caso não encontrado</p>
      <Button variant="outline" className="mt-4" onClick={() => navigate('/juridico/casos')}>Voltar</Button>
    </div>
  );

  const casoData = caso as any;
  const sinistro = casoData.sinistro;
  const associado = sinistro?.associado;
  const veiculo = sinistro?.veiculo;
  const tipoBadge = getTipoBadge(casoData.assunto || '', casoData.tipo);
  const hasParecer = !!(casoData.parecer);
  const hasDecisao = !!(casoData.decisao);
  const canEditParecer = hasParecer && (casoData.respondido_por === profile?.id || permissions.isDiretor);
  const diasAberto = differenceInDays(new Date(), new Date(casoData.created_at));

  const historicoIcon = (tipo: string) => {
    const icons: Record<string, any> = {
      abertura: FileText, parecer_emitido: Scale, decisao: Gavel,
      acao_registrada: Clock, mudanca_status: AlertTriangle,
      documento_anexado: Upload, prioridade_alterada: AlertTriangle,
      advogado_atribuido: User,
    };
    const Icon = icons[tipo] || Clock;
    return <Icon className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/juridico/casos')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">Caso #{casoData.numero || casoData.id?.slice(0, 8)}</h1>
              <Badge className={tipoBadge.className}>{tipoBadge.label}</Badge>
              <Badge className={statusBadge[casoData.status] || ''}>{statusLabels[casoData.status] || casoData.status}</Badge>
              <Badge className={prioridadeBadge[casoData.prioridade || 'media'] || ''}>
                {(casoData.prioridade || 'media').charAt(0).toUpperCase() + (casoData.prioridade || 'media').slice(1)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{casoData.assunto}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">Alterar Prioridade</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {['baixa', 'media', 'alta', 'urgente'].map(p => (
                <DropdownMenuItem key={p} onClick={() => alterarPrioridade.mutate(p)}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={() => setAdvogadoDialogOpen(true)}>Atribuir Advogado</Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="parecer">Parecer</TabsTrigger>
          <TabsTrigger value="decisao">Decisão</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
        </TabsList>

        {/* ===== ABA RESUMO ===== */}
        <TabsContent value="resumo" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Informações do Caso */}
            <Card>
              <CardHeader><CardTitle className="text-base">Informações do Caso</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Número</span><span className="font-medium">{casoData.numero || casoData.id?.slice(0, 8)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tipo</span><Badge className={tipoBadge.className}>{tipoBadge.label}</Badge></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Prioridade</span><Badge className={prioridadeBadge[casoData.prioridade || 'media'] || ''}>{casoData.prioridade || 'Média'}</Badge></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Data Abertura</span><span>{format(new Date(casoData.created_at), 'dd/MM/yyyy', { locale: ptBR })}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Advogado</span><span>{casoData.respondido_usuario?.nome || '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge className={statusBadge[casoData.status] || ''}>{statusLabels[casoData.status] || casoData.status}</Badge></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Dias em Aberto</span><span className="font-medium">{diasAberto}d</span></div>
                {casoData.descricao && <div className="pt-2 border-t"><p className="text-muted-foreground text-xs">Descrição</p><p className="mt-1">{casoData.descricao}</p></div>}
              </CardContent>
            </Card>

            {/* Dados do Associado */}
            <Card>
              <CardHeader><CardTitle className="text-base">Dados do Associado</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {associado ? (
                  <>
                    <div className="flex justify-between"><span className="text-muted-foreground">Nome</span><span className="font-medium">{associado.nome}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">CPF</span><span>{associado.cpf}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Telefone</span><span>{associado.telefone}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="truncate max-w-[180px]">{associado.email}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Plano</span><span>{associado.plano?.nome || '-'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Status</span>
                      <Badge className={associado.status === 'ativo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                        {associado.status === 'ativo' ? 'Adimplente' : associado.status}
                      </Badge>
                    </div>
                    {associado.data_adesao && (
                      <div className="flex justify-between"><span className="text-muted-foreground">Tempo como associado</span><span>{differenceInDays(new Date(), new Date(associado.data_adesao))} dias</span></div>
                    )}
                    <div className="flex justify-between"><span className="text-muted-foreground">Eventos anteriores</span>
                      <span className={`font-bold ${(sinistrosCount || 0) > 3 ? 'text-red-600' : ''}`}>{sinistrosCount || 0}</span>
                    </div>
                  </>
                ) : <p className="text-muted-foreground">Sem dados do associado</p>}
              </CardContent>
            </Card>

            {/* Dados do Veículo */}
            <Card>
              <CardHeader><CardTitle className="text-base">Dados do Veículo</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {veiculo ? (
                  <>
                    <div className="flex justify-between"><span className="text-muted-foreground">Placa</span><span className="font-mono font-bold">{veiculo.placa}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Veículo</span><span>{veiculo.marca} {veiculo.modelo} {veiculo.ano_modelo}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Valor FIPE</span><span>{sinistro?.valor_fipe ? `R$ ${Number(sinistro.valor_fipe).toLocaleString('pt-BR')}` : '-'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Rastreador</span>
                      <Badge className={associado?.pendencia_rastreador ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                        {associado?.pendencia_rastreador ? 'Pendente' : 'OK'}
                      </Badge>
                    </div>
                  </>
                ) : <p className="text-muted-foreground">Sem dados do veículo</p>}
              </CardContent>
            </Card>

            {/* Evento Vinculado */}
            <Card>
              <CardHeader><CardTitle className="text-base">Evento Vinculado</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {sinistro ? (
                  <>
                    <div className="flex justify-between"><span className="text-muted-foreground">Protocolo</span>
                      <Link to={`/eventos/sinistros/${sinistro.id}`} className="text-primary hover:underline font-medium">{sinistro.protocolo}</Link>
                    </div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Tipo</span><span>{sinistro.tipo}</span></div>
                    {sinistro.data_ocorrencia && <div className="flex justify-between"><span className="text-muted-foreground">Data</span><span>{format(new Date(sinistro.data_ocorrencia), 'dd/MM/yyyy', { locale: ptBR })}</span></div>}
                    <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge className={statusBadge[sinistro.status] || ''}>{sinistro.status}</Badge></div>
                    {sinistro.valor_fipe && <div className="flex justify-between"><span className="text-muted-foreground">FIPE</span><span>R$ {Number(sinistro.valor_fipe).toLocaleString('pt-BR')}</span></div>}
                    {sinistro.valor_orcamento && <div className="flex justify-between"><span className="text-muted-foreground">Orçamento</span><span>R$ {Number(sinistro.valor_orcamento).toLocaleString('pt-BR')}</span></div>}
                    <Button variant="outline" size="sm" className="w-full mt-2" asChild>
                      <Link to={`/eventos/sinistros/${sinistro.id}`} target="_blank">Ver evento completo</Link>
                    </Button>
                  </>
                ) : <p className="text-muted-foreground">Sem evento vinculado</p>}
              </CardContent>
            </Card>
          </div>

          {/* Sindicância Vinculada */}
          {sinistro?.resultado_sindicancia && (
            <Card>
              <CardHeader><CardTitle className="text-base">Sindicância Vinculada</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Tipo</span><span>{sinistro.tipo_sindicancia || 'Sindicância'}</span></div>
                {sinistro.motivo_sindicancia && <div className="flex justify-between"><span className="text-muted-foreground">Motivo</span><span>{sinistro.motivo_sindicancia}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Resultado</span>
                  <Badge className={sinistro.resultado_sindicancia === 'irregular' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>
                    {sinistro.resultado_sindicancia}
                  </Badge>
                </div>
                {sinistro.parecer_sindicancia && (
                  <p className="text-muted-foreground mt-2 line-clamp-3">{sinistro.parecer_sindicancia}</p>
                )}
                <Button variant="outline" size="sm" className="mt-2" asChild>
                  <Link to={`/eventos/sindicancias/${sinistro.id}`}>Ver sindicância</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== ABA PARECER ===== */}
        <TabsContent value="parecer" className="space-y-4">
          {(!hasParecer || editingParecer) ? (
            <Card>
              <CardHeader><CardTitle className="text-base">Emitir Parecer Jurídico</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Análise Jurídica *</Label>
                  <Textarea
                    placeholder="Escreva a análise formal do caso (mínimo 100 caracteres)..."
                    value={parecer || (editingParecer ? casoData.parecer : '')}
                    onChange={e => setParecer(e.target.value)}
                    rows={10}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{(parecer || '').length}/100 caracteres mínimos</p>
                </div>
                <div>
                  <Label>Documentos (até 5 arquivos)</Label>
                  <Input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={e => {
                      const files = Array.from(e.target.files || []).slice(0, 5);
                      setParecerFiles(files);
                    }}
                    className="mt-1"
                  />
                  {parecerFiles.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {parecerFiles.map((f, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{f.name}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => emitirParecer.mutate()} disabled={emitirParecer.isPending || (parecer || '').length < 100}>
                    {emitirParecer.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    {editingParecer ? 'Salvar Alterações' : 'Emitir Parecer'}
                  </Button>
                  {editingParecer && <Button variant="outline" onClick={() => setEditingParecer(false)}>Cancelar</Button>}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Parecer Jurídico</CardTitle>
                {canEditParecer && <Button variant="outline" size="sm" onClick={() => { setParecer(casoData.parecer); setEditingParecer(true); }}>Editar</Button>}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="whitespace-pre-wrap text-sm">{casoData.parecer}</div>
                {casoData.respondido_em && (
                  <p className="text-xs text-muted-foreground">
                    Emitido em {format(new Date(casoData.respondido_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} por {casoData.respondido_usuario?.nome || 'Desconhecido'}
                  </p>
                )}
                {casoDocumentos.length > 0 && (
                  <div className="space-y-2 pt-2 border-t">
                    <p className="text-sm font-medium">Documentos Anexos</p>
                    {casoDocumentos.map((doc: any) => (
                      <div key={doc.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{doc.titulo || doc.arquivo_nome}</span>
                        </div>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={doc.arquivo_url} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4" /></a>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== ABA DECISÃO ===== */}
        <TabsContent value="decisao" className="space-y-4">
          {!hasParecer ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Scale className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Emita o parecer jurídico antes de registrar a decisão</p>
                <Button variant="outline" className="mt-4" onClick={() => setActiveTab('parecer')}>Ir para Parecer</Button>
              </CardContent>
            </Card>
          ) : hasDecisao ? (
            <Card>
              <CardHeader><CardTitle className="text-base">Decisão Registrada</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Resultado</span>
                  <Badge className="bg-primary text-primary-foreground">{DECISOES.find(d => d.value === casoData.decisao)?.label || casoData.decisao}</Badge>
                </div>
                {casoData.decisao_observacoes && <div><p className="text-muted-foreground text-xs">Observações</p><p className="mt-1">{casoData.decisao_observacoes}</p></div>}
                {casoData.decisao_em && (
                  <p className="text-xs text-muted-foreground">
                    Decidido em {format(new Date(casoData.decisao_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} por {casoData.decisao_usuario?.nome || 'Desconhecido'}
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader><CardTitle className="text-base">Registrar Decisão</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <RadioGroup value={decisao} onValueChange={setDecisao} className="space-y-3">
                  {DECISOES.map(d => {
                    const Icon = d.icon;
                    return (
                      <label key={d.value} className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition ${decisao === d.value ? 'border-primary bg-primary/5' : ''}`}>
                        <RadioGroupItem value={d.value} className="mt-1" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 font-medium">
                            <Icon className="h-4 w-4" />
                            {d.label}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{d.desc}</p>
                        </div>
                      </label>
                    );
                  })}
                </RadioGroup>

                <Separator />

                <div>
                  <Label>Observações</Label>
                  <Textarea value={decisaoObs} onChange={e => setDecisaoObs(e.target.value)} placeholder="Observações adicionais..." rows={3} className="mt-1" />
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <Checkbox checked={notificar} onCheckedChange={v => setNotificar(!!v)} />
                    <div className="flex-1">
                      <Label className="cursor-pointer">Notificar associado?</Label>
                      {notificar && <Textarea value={notificarMsg} onChange={e => setNotificarMsg(e.target.value)} placeholder="Mensagem para o associado..." rows={2} className="mt-2" />}
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Checkbox checked={suspenderVeiculo} onCheckedChange={v => setSuspenderVeiculo(!!v)} />
                    <div className="flex-1">
                      <Label className="cursor-pointer">Aplicar suspensão no veículo?</Label>
                      {suspenderVeiculo && <Input value={suspenderMotivo} onChange={e => setSuspenderMotivo(e.target.value)} placeholder="Motivo da suspensão..." className="mt-2" />}
                    </div>
                  </div>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={!decisao || registrarDecisao.isPending} className="w-full">
                      {registrarDecisao.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Registrar Decisão
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar Decisão</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta decisão é definitiva: <strong>{DECISOES.find(d => d.value === decisao)?.label}</strong>. Deseja continuar?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => registrarDecisao.mutate()}>Confirmar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== ABA HISTÓRICO ===== */}
        <TabsContent value="historico" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Linha do Tempo</h3>
            <Button size="sm" onClick={() => setAcaoModalOpen(true)}>Registrar Ação</Button>
          </div>
          <div className="space-y-3">
            {historico.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum registro no histórico</p>
            ) : historico.map((item: any) => (
              <div key={item.id} className="flex gap-3 p-3 border rounded-lg">
                <div className="mt-0.5">{historicoIcon(item.tipo)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.titulo}</p>
                  {item.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.descricao}</p>}
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    {item.usuario?.nome && <span>{item.usuario.nome}</span>}
                    <span>{format(new Date(item.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ===== ABA DOCUMENTOS ===== */}
        <TabsContent value="documentos" className="space-y-3">
          {/* Fotos Auto Vistoria */}
          <CollapsibleSection title="Fotos da Auto Vistoria" count={sinistroFotos.filter((f: any) => ['foto_dano', 'foto_veiculo', 'foto_documento'].includes(f.tipo)).length}>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {sinistroFotos.filter((f: any) => ['foto_dano', 'foto_veiculo', 'foto_documento'].includes(f.tipo)).map((f: any) => (
                <div key={f.id} className="relative group cursor-pointer" onClick={() => setFotoZoom(f.url)}>
                  <img src={f.url} alt={f.tipo} className="w-full h-24 object-cover rounded border" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
                    <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition" />
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* B.O. */}
          {sinistro?.bo_arquivo_url && (
            <CollapsibleSection title="Boletim de Ocorrência" count={1}>
              <Button variant="outline" size="sm" asChild>
                <a href={sinistro.bo_arquivo_url} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4 mr-2" /> Download B.O.</a>
              </Button>
            </CollapsibleSection>
          )}

          {/* Relato e Áudio */}
          <CollapsibleSection title="Relato e Áudio" count={sinistroDocumentos.filter((d: any) => d.tipo === 'audio_relato').length + (sinistro?.descricao ? 1 : 0)}>
            {sinistro?.descricao && <p className="text-sm mb-2">{sinistro.descricao}</p>}
            {sinistroDocumentos.filter((d: any) => d.tipo === 'audio_relato').map((d: any) => (
              <div key={d.id} className="flex items-center gap-2 p-2 border rounded">
                <Music className="h-4 w-4" />
                <span className="text-sm flex-1">{d.nome || 'Áudio do Relato'}</span>
                <Button variant="ghost" size="sm" asChild><a href={d.arquivo_url} target="_blank"><Download className="h-4 w-4" /></a></Button>
              </div>
            ))}
          </CollapsibleSection>

          {/* Vistoria do Regulador */}
          <CollapsibleSection title="Vistoria do Regulador" count={vistoriasEvento.length + sinistroFotos.filter((f: any) => f.tipo?.startsWith('vistoria')).length}>
            {vistoriasEvento.map((v: any) => (
              <div key={v.id} className="p-2 border rounded text-sm mb-2">
                <p>Vistoria #{v.id.slice(0, 8)} — {v.status}</p>
                {v.observacoes && <p className="text-xs text-muted-foreground">{v.observacoes}</p>}
              </div>
            ))}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
              {sinistroFotos.filter((f: any) => f.tipo?.startsWith('vistoria')).map((f: any) => (
                <div key={f.id} className="cursor-pointer" onClick={() => setFotoZoom(f.url)}>
                  <img src={f.url} alt={f.tipo} className="w-full h-24 object-cover rounded border" />
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* Orçamento */}
          <CollapsibleSection title="Orçamento" count={cotacoesPecas.length}>
            {cotacoesPecas.map((c: any) => (
              <div key={c.id} className="p-2 border rounded text-sm mb-2">
                <div className="flex justify-between">
                  <span>{c.descricao || 'Cotação'}</span>
                  <span className="font-medium">R$ {Number(c.valor_total || 0).toLocaleString('pt-BR')}</span>
                </div>
                {c.status && <Badge variant="outline" className="mt-1">{c.status}</Badge>}
              </div>
            ))}
          </CollapsibleSection>

          {/* Evidências Sindicância */}
          {sindicanciaEvidencias.length > 0 && (
            <CollapsibleSection title="Evidências da Sindicância" count={sindicanciaEvidencias.length}>
              {sindicanciaEvidencias.map((e: any) => (
                <div key={e.id} className="flex items-center justify-between p-2 border rounded mb-2">
                  <div className="flex items-center gap-2">
                    {e.tipo === 'foto' ? <Image className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                    <span className="text-sm">{e.descricao || e.arquivo_nome || 'Evidência'}</span>
                  </div>
                  {e.arquivo_url && (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={e.arquivo_url} target="_blank"><Download className="h-4 w-4" /></a>
                    </Button>
                  )}
                </div>
              ))}
            </CollapsibleSection>
          )}

          {/* Documentos do Advogado */}
          <CollapsibleSection title="Documentos do Advogado" count={casoDocumentos.length}>
            {casoDocumentos.map((doc: any) => (
              <div key={doc.id} className="flex items-center justify-between p-2 border rounded mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="text-sm">{doc.titulo || doc.arquivo_nome}</span>
                    <p className="text-xs text-muted-foreground">{format(new Date(doc.created_at), 'dd/MM/yy', { locale: ptBR })}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <a href={doc.arquivo_url} target="_blank"><Download className="h-4 w-4" /></a>
                </Button>
              </div>
            ))}
          </CollapsibleSection>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <RegistrarAcaoModal
        open={acaoModalOpen}
        onOpenChange={setAcaoModalOpen}
        consultaId={casoData._source === 'consulta' ? id : undefined}
        processoId={casoData._source === 'processo' ? id : undefined}
        casoId={id!}
      />

      {/* Foto zoom dialog */}
      <Dialog open={!!fotoZoom} onOpenChange={() => setFotoZoom(null)}>
        <DialogContent className="max-w-3xl">
          {fotoZoom && <img src={fotoZoom} alt="Foto ampliada" className="w-full rounded" />}
        </DialogContent>
      </Dialog>

      {/* Atribuir Advogado Dialog */}
      <Dialog open={advogadoDialogOpen} onOpenChange={setAdvogadoDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Atribuir Advogado</DialogTitle></DialogHeader>
          <Select value={selectedAdvogado} onValueChange={setSelectedAdvogado}>
            <SelectTrigger><SelectValue placeholder="Selecione um advogado" /></SelectTrigger>
            <SelectContent>
              {advogados.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.nome} {a.oab ? `(OAB ${a.oab})` : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdvogadoDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => atribuirAdvogado.mutate(selectedAdvogado)} disabled={!selectedAdvogado || atribuirAdvogado.isPending}>
              {atribuirAdvogado.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Atribuir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== Collapsible Section Component =====
function CollapsibleSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-3 border rounded-lg hover:bg-muted/50">
          <span className="font-medium text-sm">{title}</span>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{count}</Badge>
            <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
          </div>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="p-3">
        {count === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Nenhum documento</p> : children}
      </CollapsibleContent>
    </Collapsible>
  );
}
