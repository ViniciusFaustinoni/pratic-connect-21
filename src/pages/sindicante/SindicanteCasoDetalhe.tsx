import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, ArrowLeft, Plus, FileText, MapPin, Car, User, Clock, AlertTriangle, Play, Send, ChevronRight, Image, Video, Download, Paperclip, Calendar, Search as SearchIcon, CheckCircle2 } from 'lucide-react';
import { format, differenceInDays, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { 
  STATUS_SINDICANCIA_LABELS, STATUS_SINDICANCIA_COLORS, 
  TIPO_DILIGENCIA_LABELS, CONCLUSAO_LAUDO_LABELS, RECOMENDACAO_LABELS, MOTIVOS_PADRONIZADOS,
  type StatusSindicancia, type TipoDiligencia, type ConclusaoLaudo, type RecomendacaoLaudo 
} from '@/types/sindicancia';
import { RegistrarDiligenciaModal } from '@/components/sindicante/RegistrarDiligenciaModal';
import { EmitirLaudoModal } from '@/components/sindicante/EmitirLaudoModal';
import { SolicitarInfoModal } from '@/components/sindicante/SolicitarInfoModal';
import { ComparacaoPosicoes } from '@/components/sinistros/ComparacaoPosicoes';
import { buscarFotosComUrls } from '@/services/uploadFotoSinistro';

export default function SindicanteCasoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [sindicancia, setSindicancia] = useState<any>(null);
  const [diligencias, setDiligencias] = useState<any[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<any[]>([]);
  const [evidencias, setEvidencias] = useState<Record<string, any[]>>({});
  const [fotos, setFotos] = useState<any[]>([]);
  const [documentos, setDocumentos] = useState<any[]>([]);
  const [vistoriaEvento, setVistoriaEvento] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [iniciando, setIniciando] = useState(false);
  const [showDiligencia, setShowDiligencia] = useState(false);
  const [showLaudo, setShowLaudo] = useState(false);
  const [showSolicitacao, setShowSolicitacao] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);

  const fetchData = async () => {
    if (!id) return;

    const [sindRes, dilRes, solRes] = await Promise.all([
      supabase
        .from('sindicancias')
        .select(`*, sinistros(
          protocolo, numero, tipo, subtipo, data_evento, local_evento, descricao,
          latitude, longitude, rastreador_lat_momento, rastreador_lng_momento,
          associado:associados(nome, cpf, telefone),
          veiculo:veiculos(marca, modelo, ano_modelo, placa, cor, valor_fipe)
        )`)
        .eq('id', id)
        .single(),
      supabase
        .from('sindicancia_diligencias')
        .select('*')
        .eq('sindicancia_id', id)
        .order('data_diligencia', { ascending: false }),
      supabase
        .from('sindicancia_solicitacoes')
        .select('*')
        .eq('sindicancia_id', id)
        .order('solicitado_em', { ascending: false }),
    ]);

    if (sindRes.data) {
      setSindicancia(sindRes.data);
      const sinistroId = sindRes.data.sinistro_id;
      
      // Buscar evidências do evento em paralelo
      const [fotosRes, docsRes, vistoriaRes] = await Promise.all([
        buscarFotosComUrls(sinistroId).catch(() => []),
        supabase.from('sinistro_documentos').select('*').eq('sinistro_id', sinistroId).order('created_at'),
        supabase.from('vistorias_evento').select('*').eq('sinistro_id', sinistroId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);

      setFotos(fotosRes || []);
      setDocumentos(docsRes.data || []);
      setVistoriaEvento(vistoriaRes.data || null);
    }
    if (dilRes.data) {
      setDiligencias(dilRes.data);
      // Buscar evidências de cada diligência
      const dilIds = dilRes.data.map(d => d.id);
      if (dilIds.length > 0) {
        const { data: evids } = await supabase
          .from('sindicancia_evidencias')
          .select('*')
          .in('diligencia_id', dilIds);
        
        const grouped: Record<string, any[]> = {};
        evids?.forEach(e => {
          if (!grouped[e.diligencia_id]) grouped[e.diligencia_id] = [];
          grouped[e.diligencia_id].push(e);
        });
        setEvidencias(grouped);
      }
    }
    if (solRes.data) setSolicitacoes(solRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [id]);

  const handleIniciarInvestigacao = async () => {
    if (!sindicancia?.id) return;
    setIniciando(true);
    const { error } = await supabase
      .from('sindicancias')
      .update({ status: 'em_andamento' })
      .eq('id', sindicancia.id)
      .eq('status', 'atribuido');
    
    if (error) {
      toast.error('Erro ao iniciar investigação');
    } else {
      toast.success('Investigação iniciada!');
      fetchData();
    }
    setIniciando(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!sindicancia) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Caso não encontrado.</p>
        <Button variant="ghost" onClick={() => navigate('/sindicante')} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  const status = sindicancia.status as StatusSindicancia;
  const sinistro = sindicancia.sinistros as any;
  const veiculo = sinistro?.veiculo;
  const associado = sinistro?.associado;
  const diasRestantes = sindicancia.data_limite ? differenceInDays(new Date(sindicancia.data_limite), new Date()) : null;
  const prazoVencido = sindicancia.data_limite && isPast(new Date(sindicancia.data_limite));
  const totalDias = sindicancia.data_limite && sindicancia.created_at
    ? differenceInDays(new Date(sindicancia.data_limite), new Date(sindicancia.created_at))
    : 30;
  const diasCorridos = sindicancia.created_at
    ? differenceInDays(new Date(), new Date(sindicancia.created_at))
    : 0;
  const progressPrazo = totalDias > 0 ? Math.min(100, (diasCorridos / totalDias) * 100) : 0;
  const prazoCor = diasRestantes === null ? 'text-muted-foreground' 
    : diasRestantes > 10 ? 'text-green-600' 
    : diasRestantes > 5 ? 'text-yellow-600' 
    : 'text-destructive';
  const progressCor = diasRestantes === null ? '' 
    : diasRestantes > 10 ? '[&>div]:bg-green-500' 
    : diasRestantes > 5 ? '[&>div]:bg-yellow-500' 
    : '[&>div]:bg-destructive';

  const podeRegistrar = ['em_andamento'].includes(status);
  const podeEmitirLaudo = status === 'em_andamento' && diligencias.length > 0;
  const isAtribuido = status === 'atribuido';
  const isLaudoEmitido = ['laudo_emitido', 'encerrado'].includes(status);

  const boletim = documentos.find(d => d.tipo === 'boletim_ocorrencia');

  const getMotivoLabel = (value: string) => {
    const m = MOTIVOS_PADRONIZADOS.find(m => m.value === value);
    return m ? m.label : value;
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Header */}
      <div>
        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
          <Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => navigate('/sindicante')}>
            Meus Casos
          </Button>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium text-foreground">{sindicancia.numero}</span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold">{sindicancia.numero}</h1>
          <Badge className={STATUS_SINDICANCIA_COLORS[status]} variant="secondary">
            {STATUS_SINDICANCIA_LABELS[status]}
          </Badge>
          {prazoVencido && !['encerrado', 'cancelado'].includes(status) && (
            <Badge variant="destructive" className="animate-pulse">PRAZO VENCIDO</Badge>
          )}
        </div>

        <p className="text-sm text-muted-foreground mt-1">
          Evento #{sinistro?.protocolo || sinistro?.numero || '—'} — {sinistro?.tipo || ''}
        </p>

        {/* Barra de prazo */}
        {sindicancia.data_limite && (
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Prazo: {format(new Date(sindicancia.data_limite), 'dd/MM/yyyy')}</span>
              <span className={`font-semibold ${prazoCor}`}>
                {diasRestantes !== null ? (diasRestantes <= 0 ? 'Vencido!' : `${diasRestantes} dias restantes`) : ''}
              </span>
            </div>
            <Progress value={progressPrazo} className={`h-2 ${progressCor}`} />
          </div>
        )}
      </div>

      {/* Layout 2 colunas */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* COLUNA ESQUERDA */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dados do Evento */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> Dados do Evento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <div><span className="text-muted-foreground">Tipo:</span> <span className="font-medium">{sinistro?.tipo || '—'}</span></div>
                <div><span className="text-muted-foreground">Data/Hora:</span> <span className="font-medium">{sinistro?.data_evento ? format(new Date(sinistro.data_evento), 'dd/MM/yyyy HH:mm') : '—'}</span></div>
                <div className="sm:col-span-2"><span className="text-muted-foreground">Local:</span> <span className="font-medium">{sinistro?.local_evento || '—'}</span></div>
                <div className="sm:col-span-2"><span className="text-muted-foreground">Descrição:</span> <p className="font-medium mt-1">{sinistro?.descricao || '—'}</p></div>
              </div>

              {veiculo && (
                <div className="mt-4 pt-3 border-t">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><Car className="h-3 w-3" /> VEÍCULO</p>
                  <div className="grid gap-2 sm:grid-cols-2 text-sm">
                    <div><span className="text-muted-foreground">Marca/Modelo:</span> <span className="font-medium">{veiculo.marca} {veiculo.modelo}</span></div>
                    <div><span className="text-muted-foreground">Ano:</span> <span className="font-medium">{veiculo.ano_modelo || '—'}</span></div>
                    <div><span className="text-muted-foreground">Placa:</span> <span className="font-medium">{veiculo.placa || '—'}</span></div>
                    <div><span className="text-muted-foreground">Cor:</span> <span className="font-medium">{veiculo.cor || '—'}</span></div>
                    {veiculo.valor_fipe && (
                      <div><span className="text-muted-foreground">Valor FIPE:</span> <span className="font-medium">R$ {Number(veiculo.valor_fipe).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                    )}
                  </div>
                </div>
              )}

              {associado && (
                <div className="mt-4 pt-3 border-t">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><User className="h-3 w-3" /> ASSOCIADO</p>
                  <div className="grid gap-2 sm:grid-cols-2 text-sm">
                    <div><span className="text-muted-foreground">Nome:</span> <span className="font-medium">{associado.nome}</span></div>
                    <div><span className="text-muted-foreground">CPF:</span> <span className="font-medium">{associado.cpf || '—'}</span></div>
                    <div><span className="text-muted-foreground">Telefone:</span> <span className="font-medium">{associado.telefone || '—'}</span></div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Motivo da Sindicância */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <SearchIcon className="h-4 w-4" /> Motivo da Sindicância
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {sindicancia.motivos_padronizados?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {(sindicancia.motivos_padronizados as string[]).map((m: string) => (
                    <Badge key={m} variant="secondary" className="text-xs">{getMotivoLabel(m)}</Badge>
                  ))}
                </div>
              )}
              <p className="text-sm">{sindicancia.motivo || sindicancia.descricao || '—'}</p>
            </CardContent>
          </Card>

          {/* Evidências do Evento */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Image className="h-4 w-4" /> Evidências do Evento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Fotos da auto vistoria */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">📸 Fotos da Auto Vistoria</p>
                {fotos.length > 0 ? (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {fotos.map(f => (
                      <button key={f.id} onClick={() => setFotoAmpliada(f.url_assinada)} className="aspect-square rounded-md overflow-hidden border hover:ring-2 ring-primary transition-all">
                        <img src={f.url_assinada || ''} alt={f.tipo} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Não disponível</p>
                )}
              </div>

              {/* B.O. */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">📄 Boletim de Ocorrência</p>
                {boletim ? (
                  <Button variant="outline" size="sm" asChild>
                    <a href={boletim.url || boletim.storage_path} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-1" /> Baixar B.O.
                    </a>
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">Não disponível</p>
                )}
              </div>

              {/* Vistoria do regulador */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">🔍 Vistoria do Regulador</p>
                {vistoriaEvento ? (
                  <div className="space-y-2">
                    {vistoriaEvento.observacoes && (
                      <p className="text-sm bg-muted p-3 rounded-md">{vistoriaEvento.observacoes}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Não disponível</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Mapa de comparação */}
          <ComparacaoPosicoes
            latitudeInformada={sinistro?.latitude}
            longitudeInformada={sinistro?.longitude}
            rastreadorLat={sinistro?.rastreador_lat_momento}
            rastreadorLng={sinistro?.rastreador_lng_momento}
            localOcorrencia={sinistro?.local_evento}
          />

          {/* Diligências */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Diligências Realizadas ({diligencias.length})</CardTitle>
              {podeRegistrar && (
                <Button size="sm" onClick={() => setShowDiligencia(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Registrar Diligência
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {diligencias.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p>Nenhuma diligência registrada.</p>
                  <p className="text-xs mt-1">Clique em "+ Registrar Diligência" para começar a investigação.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {diligencias.map(d => (
                    <div key={d.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{TIPO_DILIGENCIA_LABELS[d.tipo as TipoDiligencia] || d.tipo}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(d.data_diligencia), 'dd/MM/yyyy')}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm">{d.descricao}</p>
                      {d.resultado && (
                        <div>
                          <span className="text-xs font-semibold text-muted-foreground">Resultado:</span>
                          <p className="text-sm">{d.resultado}</p>
                        </div>
                      )}
                      {d.local && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {d.local}
                        </p>
                      )}
                      {/* Evidências da diligência */}
                      {evidencias[d.id]?.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Paperclip className="h-3 w-3" />
                          {evidencias[d.id].length} evidência(s) anexada(s)
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card Laudo Emitido (somente leitura, visível após emissão) */}
          {isLaudoEmitido && sindicancia.laudo_conclusao && (
            <Card className="border-green-200 dark:border-green-800">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Laudo Emitido
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="text-xs text-muted-foreground">Conclusão:</span>
                  <div className="mt-1">
                    <Badge className={
                      sindicancia.laudo_conclusao === 'regular' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                      sindicancia.laudo_conclusao === 'irregular_comprovada' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                      sindicancia.laudo_conclusao === 'irregular_suspeita' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
                      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }>
                      {CONCLUSAO_LAUDO_LABELS[sindicancia.laudo_conclusao as ConclusaoLaudo] || sindicancia.laudo_conclusao}
                    </Badge>
                  </div>
                </div>
                {sindicancia.laudo_resumo && (
                  <div>
                    <span className="text-xs text-muted-foreground">Resumo Executivo:</span>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{sindicancia.laudo_resumo}</p>
                  </div>
                )}
                {sindicancia.laudo_irregularidades && (
                  <div>
                    <span className="text-xs text-muted-foreground">Irregularidades:</span>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{sindicancia.laudo_irregularidades}</p>
                  </div>
                )}
                {sindicancia.laudo_recomendacao && (
                  <div>
                    <span className="text-xs text-muted-foreground">Recomendação:</span>
                    <p className="text-sm mt-1 font-medium">
                      {RECOMENDACAO_LABELS[sindicancia.laudo_recomendacao as RecomendacaoLaudo] || sindicancia.laudo_recomendacao}
                    </p>
                  </div>
                )}
                {sindicancia.laudo_arquivo_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={sindicancia.laudo_arquivo_url} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-1" /> Baixar Laudo PDF
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Solicitações */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Solicitações ao Analista ({solicitacoes.length})</CardTitle>
              {(podeRegistrar || isAtribuido) && (
                <Button size="sm" variant="outline" onClick={() => setShowSolicitacao(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Nova Solicitação
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {solicitacoes.length === 0 ? (
                <p className="text-center py-6 text-muted-foreground text-sm">Nenhuma solicitação registrada.</p>
              ) : (
                <div className="space-y-3">
                  {solicitacoes.map(s => (
                    <div key={s.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={s.status === 'respondida' ? 'default' : 'outline'} className={s.status === 'pendente' ? 'bg-yellow-100 text-yellow-800' : ''}>
                          {s.status === 'pendente' ? 'Pendente' : s.status === 'respondida' ? 'Respondida' : 'Cancelada'}
                        </Badge>
                        <Badge variant="secondary">{s.tipo}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(s.solicitado_em), 'dd/MM/yyyy')}
                        </span>
                      </div>
                      <p className="text-sm">{s.descricao}</p>
                      {s.resposta && (
                        <div className="p-3 bg-muted rounded-md">
                          <span className="text-xs text-muted-foreground">Resposta:</span>
                          <p className="text-sm mt-1">{s.resposta}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* COLUNA DIREITA */}
        <div className="space-y-6">
          {/* Ações */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLaudoEmitido ? (
                <div className="space-y-3 text-center">
                  <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                    <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                      Laudo emitido em {sindicancia.data_laudo ? format(new Date(sindicancia.data_laudo), 'dd/MM/yyyy') : '—'}
                    </p>
                    {sindicancia.laudo_conclusao && (
                      <Badge className={
                        sindicancia.laudo_conclusao === 'regular' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                        sindicancia.laudo_conclusao === 'irregular_comprovada' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                        sindicancia.laudo_conclusao === 'irregular_suspeita' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
                        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }>
                        {CONCLUSAO_LAUDO_LABELS[sindicancia.laudo_conclusao as ConclusaoLaudo] || sindicancia.laudo_conclusao}
                      </Badge>
                    )}
                    <p className="text-xs text-muted-foreground">Aguardando decisão do analista</p>
                  </div>
                </div>
              ) : (
                <>
                  {isAtribuido && (
                    <Button 
                      className="w-full bg-green-600 hover:bg-green-700 text-white" 
                      onClick={handleIniciarInvestigacao}
                      disabled={iniciando}
                    >
                      {iniciando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                      Iniciar Investigação
                    </Button>
                  )}

                  <Button 
                    className="w-full" 
                    onClick={() => setShowDiligencia(true)}
                    disabled={isAtribuido}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Registrar Diligência
                  </Button>

                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={() => setShowSolicitacao(true)}
                  >
                    <Send className="h-4 w-4 mr-1" /> Solicitar Informação
                  </Button>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Button 
                            variant="destructive" 
                            className="w-full" 
                            onClick={() => setShowLaudo(true)}
                            disabled={!podeEmitirLaudo}
                          >
                            <FileText className="h-4 w-4 mr-1" /> Emitir Laudo
                          </Button>
                        </div>
                      </TooltipTrigger>
                      {!podeEmitirLaudo && (
                        <TooltipContent>
                          <p>{status !== 'em_andamento' ? 'Inicie a investigação primeiro' : 'Registre pelo menos 1 diligência antes de emitir o laudo'}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  // Build timeline entries
                  ...(sindicancia.created_at ? [{ date: sindicancia.created_at, text: 'Sindicância aberta', icon: '📅' }] : []),
                  ...(sindicancia.data_atribuicao ? [{ date: sindicancia.data_atribuicao, text: 'Caso atribuído', icon: '📋' }] : []),
                  ...diligencias.map(d => ({ date: d.data_diligencia || d.created_at, text: `Diligência: ${TIPO_DILIGENCIA_LABELS[d.tipo as TipoDiligencia] || d.tipo}`, icon: '🔍' })),
                  ...solicitacoes.flatMap(s => [
                    { date: s.solicitado_em, text: 'Solicitação enviada', icon: '📨' },
                    ...(s.respondido_em ? [{ date: s.respondido_em, text: 'Solicitação respondida', icon: '✅' }] : []),
                  ]),
                  ...(sindicancia.data_laudo ? [{ date: sindicancia.data_laudo, text: `Laudo emitido — ${CONCLUSAO_LAUDO_LABELS[sindicancia.laudo_conclusao as keyof typeof CONCLUSAO_LAUDO_LABELS] || ''}`, icon: '📝' }] : []),
                ]
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .map((entry, i) => (
                    <div key={i} className="flex gap-3 text-sm">
                      <span className="shrink-0 text-xs text-muted-foreground w-16">
                        {format(new Date(entry.date), 'dd/MM HH:mm', { locale: ptBR })}
                      </span>
                      <span>{entry.icon}</span>
                      <span className="text-muted-foreground">{entry.text}</span>
                    </div>
                  ))}

                {diligencias.length === 0 && solicitacoes.length === 0 && !sindicancia.data_laudo && (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhuma atividade ainda.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Informações do Prazo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" /> Informações do Prazo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data de abertura:</span>
                <span className="font-medium">{format(new Date(sindicancia.created_at), 'dd/MM/yyyy')}</span>
              </div>
              {sindicancia.data_limite && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data limite:</span>
                  <span className="font-medium">{format(new Date(sindicancia.data_limite), 'dd/MM/yyyy')}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dias corridos:</span>
                <span className="font-medium">{diasCorridos} dias</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dias restantes:</span>
                <span className={`font-bold ${prazoCor}`}>
                  {diasRestantes !== null ? (diasRestantes <= 0 ? 'Vencido!' : `${diasRestantes} dias`) : '—'}
                </span>
              </div>
              <div className="pt-2">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Progresso</span>
                  <span>{Math.round(progressPrazo)}%</span>
                </div>
                <Progress value={progressPrazo} className={`h-2 ${progressCor}`} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Foto ampliada */}
      <Dialog open={!!fotoAmpliada} onOpenChange={() => setFotoAmpliada(null)}>
        <DialogContent className="max-w-3xl p-2">
          {fotoAmpliada && <img src={fotoAmpliada} alt="Foto ampliada" className="w-full rounded-md" />}
        </DialogContent>
      </Dialog>

      {/* Modais */}
      {showDiligencia && (
        <RegistrarDiligenciaModal
          sindicanciaId={sindicancia.id}
          sinistroId={sindicancia.sinistro_id}
          open={showDiligencia}
          onOpenChange={setShowDiligencia}
          onSuccess={fetchData}
        />
      )}
      {showLaudo && (
        <EmitirLaudoModal
          sindicanciaId={sindicancia.id}
          sinistroId={sindicancia.sinistro_id}
          open={showLaudo}
          onOpenChange={setShowLaudo}
          onSuccess={fetchData}
        />
      )}
      {showSolicitacao && (
        <SolicitarInfoModal
          sindicanciaId={sindicancia.id}
          open={showSolicitacao}
          onOpenChange={setShowSolicitacao}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}
