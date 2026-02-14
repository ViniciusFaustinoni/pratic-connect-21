import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Search, ArrowLeft, ExternalLink, Plus, FileText, Image, Video, Mic, Radio, File,
  Loader2, AlertTriangle, CheckCircle, Download, Shield,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { STATUS_SINISTRO_LABELS, STATUS_SINISTRO_COLORS, RESULTADO_SINDICANCIA_LABELS } from '@/types/sinistros';
import type { ResultadoSindicancia, StatusSinistro } from '@/types/sinistros';
import { NovaEvidenciaModal } from '@/components/sinistros/NovaEvidenciaModal';

const RESULTADO_DESCRICAO: Record<ResultadoSindicancia, string> = {
  regular: 'A investigação não encontrou evidências de fraude ou irregularidade. O evento volta para análise e pode ser aprovado normalmente.',
  irregular: 'Fraude comprovada. O evento será negado automaticamente e um caso jurídico será criado para providências legais.',
  carta_cancelamento: 'O associado desistiu e assinou carta de cancelamento de próprio punho. O evento será cancelado.',
  juridico: 'Caso complexo demais para a sindicância resolver. Vai para o departamento jurídico.',
  inconclusivo: 'Não há evidências suficientes nem para aprovar nem para negar. A diretoria decide.',
};

const TIPO_EVIDENCIA_ICON: Record<string, any> = {
  documento: FileText, foto: Image, video: Video, depoimento: Mic,
  laudo_tecnico: FileText, relatorio_rastreador: Radio, pesquisa_externa: Search, outro: File,
};

const TIPO_EVIDENCIA_LABEL: Record<string, string> = {
  documento: 'Documento', foto: 'Foto', video: 'Vídeo', depoimento: 'Depoimento',
  laudo_tecnico: 'Laudo Técnico', relatorio_rastreador: 'Rastreador', pesquisa_externa: 'Pesquisa', outro: 'Outro',
};

export default function SindicanciaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showNovaEvidencia, setShowNovaEvidencia] = useState(false);
  const [resultado, setResultado] = useState<ResultadoSindicancia | ''>('');
  const [relatorio, setRelatorio] = useState('');
  const [showConfirmacao, setShowConfirmacao] = useState(false);

  const { data: sinistro, isLoading } = useQuery({
    queryKey: ['sindicancia-detalhe', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sinistros')
        .select(`
          *, associados:associado_id (id, nome, cpf, telefone, whatsapp, email),
          veiculos:veiculo_id (id, placa, marca, modelo, ano_modelo, cor),
          sindicante:sindicante_id (id, nome),
          analista:analista_id (id, nome)
        `)
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: evidencias = [] } = useQuery({
    queryKey: ['sindicancia-evidencias', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sindicancia_evidencias' as any)
        .select('*, registrado:registrado_por (id, nome)')
        .eq('sinistro_id', id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: historicoEncaminhamento } = useQuery({
    queryKey: ['sindicancia-historico-encaminhamento', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('sinistro_historico')
        .select('*')
        .eq('sinistro_id', id!)
        .or('status_novo.eq.em_sindicancia,status_novo.eq.em_pericia')
        .order('created_at', { ascending: false })
        .limit(1);
      return data?.[0] || null;
    },
    enabled: !!id,
  });

  // Cálculos de prazo
  const hoje = new Date();
  const prazoFim = sinistro?.sindicancia_prazo_fim ? new Date(sinistro.sindicancia_prazo_fim) : null;
  const diasRestantes = prazoFim ? differenceInDays(prazoFim, hoje) : null;
  const isAberta = sinistro && ['em_sindicancia', 'em_pericia'].includes(sinistro.status);
  const isConcluida = !!sinistro?.resultado_sindicancia;

  const progressoPrazo = useMemo(() => {
    if (!sinistro?.sindicancia_prazo_fim) return 0;
    // Buscar data de abertura do histórico
    const dataAbertura = historicoEncaminhamento?.created_at
      ? new Date(historicoEncaminhamento.created_at) : new Date(sinistro.created_at);
    const prazoTotal = differenceInDays(new Date(sinistro.sindicancia_prazo_fim), dataAbertura);
    const diasDecorridos = differenceInDays(hoje, dataAbertura);
    if (prazoTotal <= 0) return 100;
    return Math.min(100, Math.max(0, Math.round((diasDecorridos / prazoTotal) * 100)));
  }, [sinistro, historicoEncaminhamento]);

  // Mutation para concluir sindicância
  const concluirMutation = useMutation({
    mutationFn: async () => {
      if (!resultado) throw new Error('Selecione um resultado');
      if (relatorio.length < 200) throw new Error('Parecer deve ter pelo menos 200 caracteres');

      const statusMap: Record<ResultadoSindicancia, string> = {
        regular: 'em_analise',
        irregular: 'negado',
        carta_cancelamento: 'cancelado',
        juridico: 'suspenso',
        inconclusivo: 'suspenso',
      };
      const novoStatus = statusMap[resultado];

      const updateData: Record<string, any> = {
        status: novoStatus,
        resultado_sindicancia: resultado,
        updated_at: new Date().toISOString(),
      };
      if (resultado === 'irregular') {
        updateData.motivo_negacao = 'fraude_suspeita';
        updateData.justificativa_negacao = relatorio;
      }
      if (resultado === 'inconclusivo') {
        updateData.motivo_suspensao = 'Sindicância inconclusiva — aguardando decisão da diretoria';
      }
      if (resultado === 'juridico') {
        updateData.motivo_suspensao = 'Encaminhado ao jurídico pela sindicância';
      }

      const { error: updateError } = await supabase
        .from('sinistros')
        .update(updateData)
        .eq('id', id!);
      if (updateError) throw updateError;

      await supabase.from('sinistro_historico').insert({
        sinistro_id: id,
        status_novo: novoStatus,
        usuario_id: user?.id,
        observacao: `Sindicância concluída — Resultado: ${RESULTADO_SINDICANCIA_LABELS[resultado]}. ${relatorio}`,
      });

      // Criar caso jurídico para irregular, carta_cancelamento, juridico
      if (['irregular', 'juridico'].includes(resultado)) {
        await supabase.from('processos').insert({
          sinistro_id: id,
          associado_id: (sinistro as any)?.associado_id || undefined,
          tipo: resultado === 'irregular' ? 'sindicancia_fraude' : 'sindicancia_complexa',
          natureza: resultado === 'irregular' ? 'Fraude em sinistro' : 'Caso complexo de sindicância',
          objeto: relatorio.substring(0, 200),
          parte_contraria_nome: (sinistro as any)?.associados?.nome || 'A definir',
          status: 'ativo',
          criado_por: user?.id,
          observacoes: relatorio,
        });
      }
      if (resultado === 'carta_cancelamento') {
        await supabase.from('consultas_juridicas').insert({
          sinistro_id: id,
          associado_id: (sinistro as any)?.associado_id || undefined,
          solicitante_id: user?.id,
          assunto: 'Carta de Cancelamento — Sindicância',
          descricao: `Associado ${(sinistro as any)?.associados?.nome || ''} desistiu do acionamento (protocolo ${sinistro?.protocolo}). Providenciar registro formal.\n\n${relatorio}`,
          prioridade: 'alta',
          departamento: 'eventos',
          status: 'pendente',
        });
      }

      try {
        await supabase.functions.invoke('notificar-sinistro', {
          body: { sinistro_id: id, status: novoStatus },
        });
      } catch {}
    },
    onSuccess: () => {
      toast.success('Sindicância concluída com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['sindicancia-detalhe', id] });
      queryClient.invalidateQueries({ queryKey: ['sindicancias-list'] });
      setShowConfirmacao(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) return <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!sinistro) return <div className="p-8 text-center text-muted-foreground">Sindicância não encontrada</div>;

  const tipoLabel = sinistro.status === 'em_pericia' ? 'Perícia Técnica' : 'Sindicância';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/eventos/sindicancias">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Search className="h-6 w-6 text-rose-600" />
            <h1 className="text-2xl font-bold">{tipoLabel}</h1>
            <Badge className={STATUS_SINISTRO_COLORS[sinistro.status as StatusSinistro]}>
              {STATUS_SINISTRO_LABELS[sinistro.status as StatusSinistro]}
            </Badge>
            {isConcluida && sinistro.resultado_sindicancia && (
              <Badge variant="secondary">
                {RESULTADO_SINDICANCIA_LABELS[sinistro.resultado_sindicancia as ResultadoSindicancia]}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">Evento {sinistro.protocolo}</p>
        </div>
      </div>

      {/* Barra de Prazo */}
      {prazoFim && (
        <div className="space-y-2">
          {diasRestantes !== null && diasRestantes < 0 && isAberta && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg p-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-semibold">PRAZO VENCIDO há {Math.abs(diasRestantes)} dias!</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Prazo:</span>
            <Progress value={progressoPrazo} className="flex-1 h-3"
              indicatorClassName={progressoPrazo >= 100 ? 'bg-destructive' : progressoPrazo >= 75 ? 'bg-amber-500' : 'bg-primary'} />
            <span className="text-sm font-medium">
              {format(prazoFim, 'dd/MM/yyyy')}
              {isAberta && diasRestantes !== null && (
                <span className={`ml-1 ${diasRestantes <= 7 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  ({diasRestantes < 0 ? 'Vencida' : `${diasRestantes}d`})
                </span>
              )}
            </span>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Informações Gerais */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Informações Gerais</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-muted-foreground">Aberta por:</span><br/>{(sinistro as any)?.analista?.nome || '—'}</div>
              <div><span className="text-muted-foreground">Data:</span><br/>{historicoEncaminhamento ? format(new Date(historicoEncaminhamento.created_at), 'dd/MM/yyyy HH:mm') : '—'}</div>
              <div><span className="text-muted-foreground">Responsável:</span><br/>{(sinistro as any)?.sindicante?.nome || '—'}</div>
              <div><span className="text-muted-foreground">Prazo:</span><br/>{prazoFim ? format(prazoFim, 'dd/MM/yyyy') : '—'}</div>
            </div>
            {sinistro.motivo_analise_interna && (
              <div className="pt-2 border-t">
                <span className="text-muted-foreground">Motivo:</span>
                <p className="mt-1">{sinistro.motivo_analise_interna}</p>
              </div>
            )}
            {historicoEncaminhamento?.observacao && (
              <div className="pt-2 border-t">
                <span className="text-muted-foreground">Descrição detalhada:</span>
                <p className="mt-1 whitespace-pre-wrap">{historicoEncaminhamento.observacao}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dados do Evento */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Dados do Evento</CardTitle>
              <Link to={`/eventos/sinistros/${sinistro.id}`} target="_blank">
                <Button variant="outline" size="sm"><ExternalLink className="h-4 w-4 mr-1" /> Ver completo</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-muted-foreground">Protocolo:</span><br/><span className="font-mono">{sinistro.protocolo}</span></div>
              <div><span className="text-muted-foreground">Tipo:</span><br/>{sinistro.tipo}</div>
              <div><span className="text-muted-foreground">Data:</span><br/>{sinistro.data_ocorrencia ? format(new Date(sinistro.data_ocorrencia), 'dd/MM/yyyy') : '—'}</div>
              <div><span className="text-muted-foreground">Status:</span><br/>
                <Badge className={STATUS_SINISTRO_COLORS[sinistro.status as StatusSinistro]}>
                  {STATUS_SINISTRO_LABELS[sinistro.status as StatusSinistro]}
                </Badge>
              </div>
            </div>
            <div className="pt-2 border-t">
              <span className="text-muted-foreground">Associado:</span><br/>
              {(sinistro as any)?.associados?.nome || '—'}
              {(sinistro as any)?.associados?.telefone && (
                <span className="text-muted-foreground ml-2">({(sinistro as any)?.associados?.telefone})</span>
              )}
            </div>
            <div>
              <span className="text-muted-foreground">Veículo:</span><br/>
              {(sinistro as any)?.veiculos?.placa && (
                <span className="font-mono">{(sinistro as any)?.veiculos?.placa}</span>
              )} {(sinistro as any)?.veiculos?.marca} {(sinistro as any)?.veiculos?.modelo}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Evidências */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Evidências ({evidencias.length})</CardTitle>
            {isAberta && (
              <Button size="sm" onClick={() => setShowNovaEvidencia(true)}>
                <Plus className="h-4 w-4 mr-1" /> Nova Evidência
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {evidencias.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">Nenhuma evidência registrada</p>
          ) : (
            <div className="space-y-3">
              {evidencias.map((ev: any) => {
                const Icon = TIPO_EVIDENCIA_ICON[ev.tipo] || File;
                return (
                  <div key={ev.id} className="flex items-start gap-3 p-3 border rounded-lg">
                    <div className="p-2 rounded-lg bg-muted"><Icon className="h-4 w-4" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{TIPO_EVIDENCIA_LABEL[ev.tipo] || ev.tipo}</Badge>
                        <span className="font-medium text-sm">{ev.titulo}</span>
                      </div>
                      {ev.descricao && <p className="text-xs text-muted-foreground mt-1">{ev.descricao}</p>}
                      <p className="text-xs text-muted-foreground mt-1">
                        {ev.registrado?.nome || '—'} · {format(new Date(ev.created_at), "dd/MM/yyyy 'às' HH:mm")}
                      </p>
                    </div>
                    {ev.arquivo_url && (
                      <a href={ev.arquivo_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon"><Download className="h-4 w-4" /></Button>
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resultado — somente leitura se concluída */}
      {isConcluida ? (
        <Card className="border-green-200 bg-green-50/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" /> Resultado da Sindicância
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <span className="text-sm text-muted-foreground">Resultado:</span>
              <p className="font-semibold mt-1">
                {RESULTADO_SINDICANCIA_LABELS[sinistro.resultado_sindicancia as ResultadoSindicancia]}
              </p>
            </div>
            {sinistro.justificativa_negacao && (
              <div>
                <span className="text-sm text-muted-foreground">Parecer:</span>
                <p className="mt-1 whitespace-pre-wrap text-sm">{sinistro.justificativa_negacao}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : isAberta ? (
        <Card className="border-rose-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-rose-600" /> Concluir Sindicância
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <Label className="text-base font-semibold">Resultado *</Label>
              <RadioGroup value={resultado} onValueChange={(v) => setResultado(v as ResultadoSindicancia)}>
                {(Object.entries(RESULTADO_SINDICANCIA_LABELS) as [ResultadoSindicancia, string][]).map(([key, label]) => (
                  <div key={key} className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${resultado === key ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
                    <RadioGroupItem value={key} id={`r-${key}`} className="mt-0.5" />
                    <div className="flex-1">
                      <Label htmlFor={`r-${key}`} className="font-medium cursor-pointer">{label}</Label>
                      <p className="text-xs text-muted-foreground mt-1">{RESULTADO_DESCRICAO[key]}</p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-semibold">Parecer Final *</Label>
              <Textarea
                placeholder="Descreva detalhadamente as conclusões, evidências encontradas e justificativa... (mín. 200 caracteres)"
                value={relatorio}
                onChange={(e) => setRelatorio(e.target.value)}
                rows={6}
                className="resize-none"
              />
              <p className={`text-xs ${relatorio.length < 200 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {relatorio.length}/200 caracteres mínimos
              </p>
            </div>

            <Button
              className="w-full bg-rose-600 hover:bg-rose-700"
              disabled={!resultado || relatorio.length < 200}
              onClick={() => setShowConfirmacao(true)}
            >
              Concluir Sindicância
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Modal de nova evidência */}
      <NovaEvidenciaModal open={showNovaEvidencia} onClose={() => setShowNovaEvidencia(false)} sinistroId={id!} />

      {/* Dialog de confirmação */}
      <AlertDialog open={showConfirmacao} onOpenChange={setShowConfirmacao}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O resultado será registrado permanentemente e as ações automáticas serão executadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => concluirMutation.mutate()}
              className="bg-rose-600 hover:bg-rose-700"
              disabled={concluirMutation.isPending}
            >
              {concluirMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Conclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
