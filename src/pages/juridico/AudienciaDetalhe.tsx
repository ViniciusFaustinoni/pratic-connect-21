import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, MapPin, Video, ExternalLink, Clock, User, FileText, Users, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAudiencias, Audiencia } from '@/hooks/useAudiencias';
import { 
  TIPO_AUDIENCIA_LABELS, TIPO_AUDIENCIA_COLORS, STATUS_AUDIENCIA_LABELS, STATUS_AUDIENCIA_COLORS,
  MODALIDADE_AUDIENCIA_LABELS, RESULTADO_AUDIENCIA_LABELS, type ResultadoAudiencia
} from '@/types/juridico';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Calendar as CalendarIcon } from 'lucide-react';

export default function AudienciaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { registrarResultado, isRegistrando } = useAudiencias();

  const { data: audiencia, isLoading } = useQuery({
    queryKey: ['audiencia-detalhe', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('processos_audiencias')
        .select(`
          *,
          processo:processos(id, numero, numero_processo, parte_contraria_nome, tipo, status, objeto, prioridade),
          advogado:advogados(id, nome, oab, oab_estado, telefone, email)
        `)
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as unknown as Audiencia;
    },
    enabled: !!id,
  });

  // Registro de resultado
  const [resultadoTipo, setResultadoTipo] = useState('');
  const [resultadoResumo, setResultadoResumo] = useState('');
  const [resultadoValor, setResultadoValor] = useState('');
  const [resultadoCondicoes, setResultadoCondicoes] = useState('');
  const [resultadoPrazoPagamento, setResultadoPrazoPagamento] = useState<Date | undefined>();
  const [resultadoPrazoRecurso, setResultadoPrazoRecurso] = useState<Date | undefined>();
  const [resultadoNovaData, setResultadoNovaData] = useState<Date | undefined>();
  const [resultadoNovaHora, setResultadoNovaHora] = useState('');
  const [resultadoMotivoAdiamento, setResultadoMotivoAdiamento] = useState('');

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!audiencia) {
    return <div className="text-center py-12"><p className="text-muted-foreground">Audiência não encontrada.</p><Button variant="outline" onClick={() => navigate('/juridico/audiencias')}>Voltar</Button></div>;
  }

  const isPastPending = audiencia.status === 'agendada' && isBefore(parseISO(audiencia.data_hora), new Date());
  const isRegistered = !!audiencia.resultado_tipo;
  const showRegistro = isPastPending || isRegistered;

  const handleRegistrar = async () => {
    if (!resultadoTipo || !resultadoResumo) return;
    await registrarResultado({
      audienciaId: audiencia.id,
      resultado_tipo: resultadoTipo,
      resultado_resumo: resultadoResumo,
      resultado_valor: resultadoValor ? parseFloat(resultadoValor) : undefined,
      resultado_condicoes: resultadoCondicoes || undefined,
      resultado_prazo_pagamento: resultadoPrazoPagamento ? format(resultadoPrazoPagamento, 'yyyy-MM-dd') : undefined,
      resultado_prazo_recurso: resultadoPrazoRecurso ? format(resultadoPrazoRecurso, 'yyyy-MM-dd') : undefined,
      resultado_nova_data: resultadoNovaData ? `${format(resultadoNovaData, 'yyyy-MM-dd')}T${resultadoNovaHora || '09:00'}:00` : undefined,
      resultado_motivo_adiamento: resultadoMotivoAdiamento || undefined,
      processo_id: audiencia.processo_id,
      tipo: audiencia.tipo,
    });
    navigate('/juridico/audiencias');
  };

  const testemunhas = (audiencia.testemunhas_lista || []) as { nome: string; funcao: string; confirmado: boolean }[];
  const documentos = (audiencia.documentos_necessarios || []) as { descricao: string; preparado: boolean }[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/juridico/audiencias')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">Audiência de {TIPO_AUDIENCIA_LABELS[audiencia.tipo as keyof typeof TIPO_AUDIENCIA_LABELS] || audiencia.tipo}</h1>
            <Badge className={TIPO_AUDIENCIA_COLORS[audiencia.tipo as keyof typeof TIPO_AUDIENCIA_COLORS] || ''}>
              {TIPO_AUDIENCIA_LABELS[audiencia.tipo as keyof typeof TIPO_AUDIENCIA_LABELS] || audiencia.tipo}
            </Badge>
            <Badge className={STATUS_AUDIENCIA_COLORS[audiencia.status as keyof typeof STATUS_AUDIENCIA_COLORS] || ''}>
              {STATUS_AUDIENCIA_LABELS[audiencia.status as keyof typeof STATUS_AUDIENCIA_LABELS] || audiencia.status}
            </Badge>
          </div>
          <p className="text-muted-foreground flex items-center gap-2 mt-1">
            <Clock className="h-4 w-4" />
            {format(parseISO(audiencia.data_hora), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            {audiencia.processo && (
              <>
                {' — '}
                <button onClick={() => navigate(`/juridico/processos/${audiencia.processo!.id}`)} className="text-primary hover:underline">
                  Processo {audiencia.processo.numero || audiencia.processo.numero_processo}
                </button>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Informações da Audiência */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Informações da Audiência</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Modalidade:</span><p className="font-medium">{MODALIDADE_AUDIENCIA_LABELS[audiencia.modalidade as keyof typeof MODALIDADE_AUDIENCIA_LABELS] || 'Presencial'}</p></div>
              {audiencia.advogado && <div><span className="text-muted-foreground">Advogado:</span><p className="font-medium">{audiencia.advogado.nome}{audiencia.advogado.oab ? ` (OAB ${audiencia.advogado.oab_estado}/${audiencia.advogado.oab})` : ''}</p></div>}
              {audiencia.juiz_orgao && <div><span className="text-muted-foreground">Juiz / Órgão:</span><p className="font-medium">{audiencia.juiz_orgao}</p></div>}
            </div>
            {(audiencia.forum || audiencia.local) && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium flex items-center gap-2"><MapPin className="h-4 w-4" /> Local</p>
                <p className="text-sm">{audiencia.forum}{audiencia.vara ? ` — ${audiencia.vara}` : ''}{audiencia.sala ? ` — Sala ${audiencia.sala}` : ''}</p>
                {audiencia.endereco_completo && <p className="text-xs text-muted-foreground mt-1">{audiencia.endereco_completo}</p>}
              </div>
            )}
            {audiencia.link_videoconferencia && (
              <a href={audiencia.link_videoconferencia} target="_blank" rel="noopener" className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm">
                <Video className="h-4 w-4" /> Entrar na Videoconferência <ExternalLink className="h-4 w-4" />
              </a>
            )}
            {audiencia.pauta && <div><p className="text-sm text-muted-foreground">Pauta:</p><p className="text-sm">{audiencia.pauta}</p></div>}
          </CardContent>
        </Card>

        {/* Processo vinculado */}
        {audiencia.processo && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Processo Vinculado</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Número:</span><p className="font-medium">{audiencia.processo.numero || audiencia.processo.numero_processo}</p></div>
                <div><span className="text-muted-foreground">Tipo:</span><p className="font-medium">{audiencia.processo.tipo}</p></div>
                <div><span className="text-muted-foreground">Partes:</span><p className="font-medium">Pratic x {audiencia.processo.parte_contraria_nome}</p></div>
                <div><span className="text-muted-foreground">Status:</span><p className="font-medium">{audiencia.processo.status}</p></div>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate(`/juridico/processos/${audiencia.processo!.id}`)}>
                Ver processo completo <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Preparação */}
        {(testemunhas.length > 0 || documentos.length > 0) && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Preparação</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {testemunhas.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Testemunhas</p>
                  <div className="space-y-1">
                    {testemunhas.map((t, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm p-2 rounded bg-muted">
                        <CheckCircle className={`h-4 w-4 ${t.confirmado ? 'text-green-500' : 'text-muted-foreground'}`} />
                        <span className="font-medium">{t.nome}</span>
                        <span className="text-muted-foreground">— {t.funcao}</span>
                        <Badge variant="outline" className="ml-auto text-xs">{t.confirmado ? 'Confirmado' : 'Pendente'}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {documentos.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Documentos Necessários</p>
                  <div className="space-y-1">
                    {documentos.map((d, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm p-2 rounded bg-muted">
                        <CheckCircle className={`h-4 w-4 ${d.preparado ? 'text-green-500' : 'text-muted-foreground'}`} />
                        <span>{d.descricao}</span>
                        <Badge variant="outline" className="ml-auto text-xs">{d.preparado ? 'Pronto' : 'Pendente'}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {audiencia.processo && (
                <Button variant="outline" size="sm" onClick={() => navigate(`/juridico/processos/${audiencia.processo!.id}`)}>
                  <FileText className="h-4 w-4 mr-2" /> Ver documentos do processo
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Registro da Audiência */}
        {showRegistro && (
          <Card className={isPastPending && !isRegistered ? 'border-red-300 lg:col-span-2' : 'lg:col-span-2'}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {isRegistered ? <CheckCircle className="h-5 w-5 text-green-500" /> : <AlertTriangle className="h-5 w-5 text-red-500" />}
                {isRegistered ? 'Resultado Registrado' : 'Registrar Resultado da Audiência'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isRegistered ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-muted-foreground">Resultado:</span><p className="font-medium">{RESULTADO_AUDIENCIA_LABELS[audiencia.resultado_tipo as ResultadoAudiencia] || audiencia.resultado_tipo}</p></div>
                    {audiencia.resultado_valor && <div><span className="text-muted-foreground">Valor:</span><p className="font-medium">R$ {Number(audiencia.resultado_valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>}
                    {audiencia.registrado_em && <div><span className="text-muted-foreground">Registrado em:</span><p className="font-medium">{format(parseISO(audiencia.registrado_em), 'dd/MM/yyyy HH:mm')}</p></div>}
                  </div>
                  {audiencia.resultado_resumo && (
                    <div><span className="text-sm text-muted-foreground">Resumo:</span><p className="text-sm mt-1 p-3 bg-muted rounded">{audiencia.resultado_resumo}</p></div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>O que aconteceu? *</Label>
                    <Select value={resultadoTipo} onValueChange={setResultadoTipo}>
                      <SelectTrigger><SelectValue placeholder="Selecione o resultado" /></SelectTrigger>
                      <SelectContent>
                        {(Object.entries(RESULTADO_AUDIENCIA_LABELS) as [string, string][]).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Campos condicionais */}
                  {resultadoTipo === 'acordo' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Valor do acordo</Label><Input type="number" placeholder="0,00" value={resultadoValor} onChange={(e) => setResultadoValor(e.target.value)} /></div>
                      <div className="space-y-2"><Label>Condições</Label><Input placeholder="Condições do acordo" value={resultadoCondicoes} onChange={(e) => setResultadoCondicoes(e.target.value)} /></div>
                    </div>
                  )}

                  {resultadoTipo === 'sentenca' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Valor da condenação</Label><Input type="number" placeholder="0,00" value={resultadoValor} onChange={(e) => setResultadoValor(e.target.value)} /></div>
                      <div className="space-y-2">
                        <Label>Prazo para recurso</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !resultadoPrazoRecurso && 'text-muted-foreground')}>
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {resultadoPrazoRecurso ? format(resultadoPrazoRecurso, 'dd/MM/yyyy') : 'Selecione'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={resultadoPrazoRecurso} onSelect={setResultadoPrazoRecurso} locale={ptBR} /></PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  )}

                  {(resultadoTipo === 'nova_audiencia' || resultadoTipo === 'adiada') && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nova data</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !resultadoNovaData && 'text-muted-foreground')}>
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {resultadoNovaData ? format(resultadoNovaData, 'dd/MM/yyyy') : 'Selecione'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={resultadoNovaData} onSelect={setResultadoNovaData} locale={ptBR} /></PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-2"><Label>Hora</Label><Input type="time" value={resultadoNovaHora} onChange={(e) => setResultadoNovaHora(e.target.value)} /></div>
                      {resultadoTipo === 'adiada' && (
                        <div className="col-span-2 space-y-2"><Label>Motivo do adiamento</Label><Input value={resultadoMotivoAdiamento} onChange={(e) => setResultadoMotivoAdiamento(e.target.value)} /></div>
                      )}
                    </div>
                  )}

                  {resultadoTipo === 'nao_compareceu' && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm font-medium text-red-800 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> GRAVE — Não comparecimento será registrado para responsabilização</p>
                      <div className="mt-2 space-y-2"><Label>Motivo</Label><Input value={resultadoMotivoAdiamento} onChange={(e) => setResultadoMotivoAdiamento(e.target.value)} placeholder="Explique o motivo do não comparecimento" /></div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Resumo detalhado *</Label>
                    <Textarea rows={4} placeholder="Descreva o que aconteceu na audiência..." value={resultadoResumo} onChange={(e) => setResultadoResumo(e.target.value)} />
                  </div>

                  <Button onClick={handleRegistrar} disabled={!resultadoTipo || !resultadoResumo || isRegistrando} className="w-full">
                    {isRegistrando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Registrar Resultado
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
