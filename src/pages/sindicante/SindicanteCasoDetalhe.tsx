import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, ArrowLeft, Plus, FileText, MapPin, Car, User, Clock, AlertTriangle } from 'lucide-react';
import { format, differenceInDays, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  STATUS_SINDICANCIA_LABELS, STATUS_SINDICANCIA_COLORS, 
  TIPO_DILIGENCIA_LABELS, CONCLUSAO_LAUDO_LABELS,
  type StatusSindicancia, type TipoDiligencia 
} from '@/types/sindicancia';
import { RegistrarDiligenciaModal } from '@/components/sindicante/RegistrarDiligenciaModal';
import { EmitirLaudoModal } from '@/components/sindicante/EmitirLaudoModal';
import { SolicitarInfoModal } from '@/components/sindicante/SolicitarInfoModal';

export default function SindicanteCasoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [sindicancia, setSindicancia] = useState<any>(null);
  const [diligencias, setDiligencias] = useState<any[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDiligencia, setShowDiligencia] = useState(false);
  const [showLaudo, setShowLaudo] = useState(false);
  const [showSolicitacao, setShowSolicitacao] = useState(false);

  const fetchData = async () => {
    if (!id) return;

    const [sindRes, dilRes, solRes] = await Promise.all([
      supabase
        .from('sindicancias')
        .select('*, sinistros(numero, tipo, subtipo, data_evento, local_evento, descricao, latitude, longitude)')
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

    if (sindRes.data) setSindicancia(sindRes.data);
    if (dilRes.data) setDiligencias(dilRes.data);
    if (solRes.data) setSolicitacoes(solRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [id]);

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
  const podeRegistrar = ['atribuido', 'em_andamento'].includes(status);
  const podeEmitirLaudo = ['atribuido', 'em_andamento'].includes(status) && !sindicancia.laudo_conclusao;
  const sinistro = sindicancia.sinistros;
  const prazoVencido = sindicancia.data_limite && isPast(new Date(sindicancia.data_limite));
  const diasRestantes = sindicancia.data_limite ? differenceInDays(new Date(sindicancia.data_limite), new Date()) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate('/sindicante')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold">{sindicancia.numero}</h1>
            <Badge className={STATUS_SINDICANCIA_COLORS[status]} variant="secondary">
              {STATUS_SINDICANCIA_LABELS[status]}
            </Badge>
            {prazoVencido && status !== 'encerrado' && status !== 'cancelado' && (
              <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" /> Prazo vencido</Badge>
            )}
          </div>
          {diasRestantes !== null && !prazoVencido && (
            <p className="text-sm text-muted-foreground mt-1">
              <Clock className="h-3 w-3 inline mr-1" />
              {diasRestantes} dias restantes (até {format(new Date(sindicancia.data_limite), "dd/MM/yyyy")})
            </p>
          )}
        </div>
      </div>

      <Tabs defaultValue="evento" className="w-full">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
          <TabsTrigger value="evento">Dados do Evento</TabsTrigger>
          <TabsTrigger value="diligencias">
            Diligências ({diligencias.length})
          </TabsTrigger>
          <TabsTrigger value="laudo">Laudo</TabsTrigger>
          <TabsTrigger value="solicitacoes">
            Solicitações ({solicitacoes.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab: Dados do Evento */}
        <TabsContent value="evento" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> Informações do Evento
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div><span className="text-sm text-muted-foreground">Evento:</span> <span className="font-medium">{sinistro?.numero || '—'}</span></div>
              <div><span className="text-sm text-muted-foreground">Tipo:</span> <span className="font-medium">{sinistro?.tipo || '—'}</span></div>
              <div><span className="text-sm text-muted-foreground">Subtipo:</span> <span className="font-medium">{sinistro?.subtipo || '—'}</span></div>
              <div><span className="text-sm text-muted-foreground">Data:</span> <span className="font-medium">{sinistro?.data_evento ? format(new Date(sinistro.data_evento), "dd/MM/yyyy HH:mm") : '—'}</span></div>
              <div className="sm:col-span-2"><span className="text-sm text-muted-foreground">Local:</span> <span className="font-medium">{sinistro?.local_evento || '—'}</span></div>
              <div className="sm:col-span-2"><span className="text-sm text-muted-foreground">Descrição:</span> <p className="font-medium mt-1">{sinistro?.descricao || '—'}</p></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileSearch className="h-4 w-4" /> Motivo da Sindicância
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p>{sindicancia.motivo}</p>
              {sindicancia.motivos_padronizados?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {sindicancia.motivos_padronizados.map((m: string) => (
                    <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
                  ))}
                </div>
              )}
              {sindicancia.descricao && (
                <p className="mt-3 text-sm text-muted-foreground">{sindicancia.descricao}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Diligências */}
        <TabsContent value="diligencias" className="space-y-4">
          {podeRegistrar && (
            <div className="flex justify-end">
              <Button onClick={() => setShowDiligencia(true)}>
                <Plus className="h-4 w-4 mr-1" /> Registrar Diligência
              </Button>
            </div>
          )}

          {diligencias.length === 0 ? (
            <Card>
              <CardContent className="text-center py-10 text-muted-foreground">
                Nenhuma diligência registrada.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {diligencias.map(d => (
                <Card key={d.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{TIPO_DILIGENCIA_LABELS[d.tipo as TipoDiligencia] || d.tipo}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(d.data_diligencia), "dd/MM/yyyy")}
                          </span>
                        </div>
                        <p className="mt-2 text-sm">{d.descricao}</p>
                        {d.resultado && (
                          <div className="mt-2">
                            <span className="text-xs text-muted-foreground">Resultado:</span>
                            <p className="text-sm">{d.resultado}</p>
                          </div>
                        )}
                        {d.local && (
                          <p className="text-xs text-muted-foreground mt-1">
                            <MapPin className="h-3 w-3 inline mr-1" />{d.local}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab: Laudo */}
        <TabsContent value="laudo" className="space-y-4">
          {sindicancia.laudo_conclusao ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Laudo Emitido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div><span className="text-sm text-muted-foreground">Conclusão:</span> <Badge>{CONCLUSAO_LAUDO_LABELS[sindicancia.laudo_conclusao as keyof typeof CONCLUSAO_LAUDO_LABELS] || sindicancia.laudo_conclusao}</Badge></div>
                <div><span className="text-sm text-muted-foreground">Resumo:</span><p className="mt-1">{sindicancia.laudo_resumo}</p></div>
                {sindicancia.laudo_irregularidades && (
                  <div><span className="text-sm text-muted-foreground">Irregularidades:</span><p className="mt-1">{sindicancia.laudo_irregularidades}</p></div>
                )}
                <div><span className="text-sm text-muted-foreground">Recomendação:</span> <span className="font-medium">{sindicancia.laudo_recomendacao}</span></div>
                {sindicancia.laudo_arquivo_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={sindicancia.laudo_arquivo_url} target="_blank" rel="noopener noreferrer">
                      <FileText className="h-4 w-4 mr-1" /> Ver PDF do Laudo
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : podeEmitirLaudo ? (
            <Card>
              <CardContent className="text-center py-10">
                <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-40" />
                <p className="text-muted-foreground mb-4">Laudo ainda não emitido.</p>
                <Button onClick={() => setShowLaudo(true)}>
                  <FileText className="h-4 w-4 mr-1" /> Emitir Laudo
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-10 text-muted-foreground">
                Laudo não disponível neste status.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Solicitações */}
        <TabsContent value="solicitacoes" className="space-y-4">
          {podeRegistrar && (
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setShowSolicitacao(true)}>
                <Plus className="h-4 w-4 mr-1" /> Solicitar Informação
              </Button>
            </div>
          )}

          {solicitacoes.length === 0 ? (
            <Card>
              <CardContent className="text-center py-10 text-muted-foreground">
                Nenhuma solicitação registrada.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {solicitacoes.map(s => (
                <Card key={s.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={s.status === 'respondida' ? 'default' : 'outline'}>
                        {s.status === 'pendente' ? 'Pendente' : s.status === 'respondida' ? 'Respondida' : 'Cancelada'}
                      </Badge>
                      <Badge variant="secondary">{s.tipo}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(s.solicitado_em), "dd/MM/yyyy")}
                      </span>
                    </div>
                    <p className="text-sm">{s.descricao}</p>
                    {s.resposta && (
                      <div className="mt-2 p-3 bg-muted rounded-md">
                        <span className="text-xs text-muted-foreground">Resposta:</span>
                        <p className="text-sm mt-1">{s.resposta}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modais */}
      {showDiligencia && (
        <RegistrarDiligenciaModal
          sindicanciaId={sindicancia.id}
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

// Fix missing import
function FileSearch(props: any) {
  return <FileText {...props} />;
}
