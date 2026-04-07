import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { CheckCircle2, AlertTriangle, Phone, MessageSquare, Mail, Car, Wrench, Clock, ChevronRight } from 'lucide-react';
import { useTratativaDrawer } from '@/hooks/useTratativaDrawer';
import { type VeiculoManutencao } from '@/hooks/useManutencaoRastreadores';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AgendamentoManutencaoForm from './AgendamentoManutencaoForm';
import CardConfirmacaoAgendamento from './CardConfirmacaoAgendamento';
import ResultadoVisitaForm from './ResultadoVisitaForm';
import CardEncerramentoVisita from './CardEncerramentoVisita';

interface TratativaDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  veiculo: VeiculoManutencao | null;
}

const ETAPAS = [
  { key: 'contato', label: 'Contato', icon: Phone },
  { key: 'validacao', label: 'Validação', icon: Car },
  { key: 'decisao', label: 'Decisão', icon: Wrench },
];

function getEtapaIndex(etapa: string) {
  const idx = ETAPAS.findIndex(e => e.key === etapa);
  return idx >= 0 ? idx : (etapa === 'concluido' ? 3 : 0);
}

export default function TratativaDrawer({ open, onOpenChange, veiculo }: TratativaDrawerProps) {
  if (!veiculo) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base">Tratativa de Manutenção</SheetTitle>
          <SheetDescription className="sr-only">Fluxo de tratativa do rastreador</SheetDescription>
        </SheetHeader>
        <DrawerInner veiculo={veiculo} onClose={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

function DrawerInner({ veiculo, onClose }: { veiculo: VeiculoManutencao; onClose: () => void }) {
  const { tratativa, logs, etapaAtual, registrarContato, registrarValidacao, resolverSemVisita, confirmarFalha, confirmarAgendamento, registrarVisita, abrirNovaTratativa } =
    useTratativaDrawer(veiculo.tratativaId);

  const [reagendar, setReagendar] = useState(false);

  // Fetch associado info for confirmation card
  const { data: associadoInfo } = useQuery({
    queryKey: ['associado-info-drawer', tratativa?.associado_id],
    queryFn: async () => {
      if (!tratativa?.associado_id) return null;
      const { data } = await supabase
        .from('associados')
        .select('nome, telefone, logradouro, numero, bairro, cidade, uf')
        .eq('id', tratativa.associado_id)
        .single();
      return data;
    },
    enabled: !!tratativa?.associado_id,
  });

  // Fetch tecnico name
  const tecnicoId = (tratativa as any)?.tecnico_id;
  const { data: tecnicoInfo } = useQuery({
    queryKey: ['tecnico-nome', tecnicoId],
    queryFn: async () => {
      if (!tecnicoId) return null;
      const { data } = await supabase.from('profiles').select('nome').eq('id', tecnicoId).single();
      return data;
    },
    enabled: !!tecnicoId,
  });

  const etapaIndex = getEtapaIndex(etapaAtual);
  const tAny = tratativa as any;
  const isAgendado = tAny?.status === 'agendado';
  const isVisitaRealizada = tAny?.status === 'visita_realizada';
  const isAcompanhamento = tAny?.status === 'acompanhamento';
  const isFinalStatus = isVisitaRealizada || isAcompanhamento;
  const temServico = !!tAny?.servico_id;
  const temResultadoVisita = !!tAny?.visita_resultado;

  const enderecoResumido = tAny?.endereco_tipo === 'cadastro'
    ? [associadoInfo?.logradouro, associadoInfo?.numero, associadoInfo?.bairro, associadoInfo?.cidade].filter(Boolean).join(', ')
    : tAny?.endereco_texto || '—';

  // Fetch visit technician name
  const visitaTecnicoId = tAny?.visita_tecnico_id;
  const { data: visitaTecnicoInfo } = useQuery({
    queryKey: ['tecnico-visita-nome', visitaTecnicoId],
    queryFn: async () => {
      if (!visitaTecnicoId) return null;
      const { data } = await supabase.from('profiles').select('nome').eq('id', visitaTecnicoId).single();
      return data;
    },
    enabled: !!visitaTecnicoId,
  });

  return (
    <div className="flex flex-col gap-4 mt-4">
      {/* Header info */}
      <div className="space-y-1 p-3 rounded-lg bg-muted/50">
        <p className="font-semibold text-sm">{veiculo.associadoNome}</p>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span className="font-mono">{veiculo.placa}</span>
          <span>{veiculo.marca} {veiculo.modelo}</span>
        </div>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>Último ponto: {veiculo.ultimaComunicacao
            ? format(new Date(veiculo.ultimaComunicacao), "dd/MM/yyyy HH:mm", { locale: ptBR })
            : 'Sem dados'}</span>
          <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">
            {veiculo.diasSemPontuar} dias sem pontuar
          </Badge>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-between px-2">
        {ETAPAS.map((etapa, i) => {
          const isDone = i < etapaIndex;
          const isCurrent = i === etapaIndex;
          return (
            <div key={etapa.key} className="flex items-center gap-1">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold
                ${isDone ? 'bg-green-500 text-white' : isCurrent ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {isDone ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`text-xs ${isCurrent ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                {etapa.label}
              </span>
              {i < ETAPAS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground mx-1" />}
            </div>
          );
        })}
      </div>

      <Separator />

      {/* Step content */}
      {etapaAtual === 'contato' && (
        <EtapaContato onSubmit={(d) => registrarContato.mutate(d)} isPending={registrarContato.isPending} />
      )}
      {etapaAtual === 'validacao' && (
        <EtapaValidacao onSubmit={(d) => registrarValidacao.mutate(d)} isPending={registrarValidacao.isPending} />
      )}
      {etapaAtual === 'decisao' && (
        <EtapaDecisao
          onResolverSemVisita={() => resolverSemVisita.mutate()}
          onConfirmarFalha={() => confirmarFalha.mutate()}
          isPending={resolverSemVisita.isPending || confirmarFalha.isPending}
        />
      )}
      {etapaAtual === 'concluido' && isAgendado && !temServico && (
        <AgendamentoManutencaoForm
          associadoId={tratativa!.associado_id}
          onConfirmar={(data) => confirmarAgendamento.mutate(data)}
          isPending={confirmarAgendamento.isPending}
        />
      )}
      {etapaAtual === 'concluido' && isAgendado && temServico && !reagendar && (
        <>
          <CardConfirmacaoAgendamento
            tratativa={tAny}
            tecnicoNome={tecnicoInfo?.nome || 'A definir'}
            associadoNome={associadoInfo?.nome || veiculo.associadoNome}
            associadoTelefone={associadoInfo?.telefone || ''}
            placa={veiculo.placa}
            enderecoResumido={enderecoResumido}
            onReagendar={() => setReagendar(true)}
          />
          {/* Result form if visit not yet registered */}
          {!temResultadoVisita && (
            <ResultadoVisitaForm
              tecnicoAgendadoId={tAny.tecnico_id}
              onSubmit={(data) => registrarVisita.mutate(data)}
              isPending={registrarVisita.isPending}
            />
          )}
          {/* Encerramento card if visit was registered */}
          {temResultadoVisita && (
            <CardEncerramentoVisita
              tratativa={tAny}
              tecnicoNome={visitaTecnicoInfo?.nome || tecnicoInfo?.nome || 'Não identificado'}
              onAbrirNovaTratativa={() => abrirNovaTratativa.mutate()}
            />
          )}
        </>
      )}
      {etapaAtual === 'concluido' && isAgendado && temServico && reagendar && (
        <AgendamentoManutencaoForm
          associadoId={tratativa!.associado_id}
          onConfirmar={(data) => {
            confirmarAgendamento.mutate(data, { onSuccess: () => setReagendar(false) });
          }}
          isPending={confirmarAgendamento.isPending}
          initialData={{
            enderecoTipo: tAny.endereco_tipo || '',
            enderecoTexto: tAny.endereco_texto || '',
            enderecoReferencia: tAny.endereco_referencia || '',
            dataAgendamento: tAny.data_agendamento ? new Date(tAny.data_agendamento) : undefined,
            periodo: tAny.periodo_agendamento || '',
            tecnicoId: tAny.tecnico_id || 'automatico',
            observacoesTecnico: tAny.observacoes_tecnico || '',
          }}
        />
      )}
      {/* Final statuses: visita_realizada or acompanhamento */}
      {etapaAtual === 'concluido' && isFinalStatus && (
        <CardEncerramentoVisita
          tratativa={tAny}
          tecnicoNome={visitaTecnicoInfo?.nome || tecnicoInfo?.nome || 'Não identificado'}
          onAbrirNovaTratativa={isAcompanhamento ? () => abrirNovaTratativa.mutate() : undefined}
        />
      )}
      {etapaAtual === 'concluido' && !isAgendado && !isFinalStatus && (
        <div className="text-center py-6 space-y-2">
          <CheckCircle2 className="h-10 w-10 mx-auto text-green-500" />
          <p className="font-semibold">Tratativa concluída</p>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </div>
      )}

      <Separator />

      {/* History */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Histórico</h4>
        {logs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum registro ainda.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="flex gap-2 text-xs">
                <div className="w-1 rounded bg-primary/30 shrink-0" />
                <div>
                  <p className="text-muted-foreground">
                    {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    {' · '}<span className="font-medium text-foreground">{log.operador_nome}</span>
                  </p>
                  <p className="text-foreground">{formatAcao(log.acao, log.dados)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* =================== ETAPA 1: CONTATO =================== */
function EtapaContato({ onSubmit, isPending }: { onSubmit: (d: { canal: string; dataHora: string; resposta: string }) => void; isPending: boolean }) {
  const [canal, setCanal] = useState('');
  const [dataHora, setDataHora] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [resposta, setResposta] = useState('');

  const canSubmit = canal && resposta.trim().length > 0;

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm">Etapa 1 — Contato inicial</h3>
      <div className="space-y-2">
        <label className="text-xs font-medium">Canal utilizado</label>
        <Select value={canal} onValueChange={setCanal}>
          <SelectTrigger><SelectValue placeholder="Selecione o canal" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="whatsapp"><div className="flex items-center gap-2"><MessageSquare className="h-3 w-3" /> WhatsApp</div></SelectItem>
            <SelectItem value="ligacao"><div className="flex items-center gap-2"><Phone className="h-3 w-3" /> Ligação</div></SelectItem>
            <SelectItem value="sms"><div className="flex items-center gap-2"><Mail className="h-3 w-3" /> SMS</div></SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-medium">Data e hora do contato</label>
        <Input type="datetime-local" value={dataHora} onChange={e => setDataHora(e.target.value)} />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-medium">Resposta do associado <span className="text-destructive">*</span></label>
        <Textarea value={resposta} onChange={e => setResposta(e.target.value)} placeholder="Descreva a resposta do associado..." rows={3} />
      </div>
      <Button className="w-full" disabled={!canSubmit || isPending} onClick={() => onSubmit({ canal, dataHora, resposta })}>
        Avançar para validação
      </Button>
    </div>
  );
}

/* =================== ETAPA 2: VALIDAÇÃO =================== */
function EtapaValidacao({ onSubmit, isPending }: { onSubmit: (d: { situacao: string; dados: Record<string, unknown> }) => void; isPending: boolean }) {
  const [situacao, setSituacao] = useState<'parado' | 'uso_diario' | null>(null);
  const [podeMovimentar, setPodeMovimentar] = useState<'sim' | 'nao' | null>(null);
  const [previsao, setPrevisao] = useState('');
  const [ultimaMov, setUltimaMov] = useState('');
  const [observacao, setObservacao] = useState('');

  const canSubmitParado = situacao === 'parado' && podeMovimentar !== null && (podeMovimentar === 'sim' || previsao);
  const canSubmitDiario = situacao === 'uso_diario' && ultimaMov;
  const canSubmit = canSubmitParado || canSubmitDiario;

  const handleSubmit = () => {
    if (situacao === 'parado') {
      onSubmit({ situacao: 'veiculo_parado', dados: { pode_movimentar: podeMovimentar, previsao_movimentacao: previsao } });
    } else if (situacao === 'uso_diario') {
      onSubmit({ situacao: 'uso_diario', dados: { ultima_movimentacao: ultimaMov, observacao } });
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm">Etapa 2 — Validação do uso</h3>
      <p className="text-xs text-muted-foreground">Qual é a situação atual do veículo?</p>

      <div className="grid grid-cols-2 gap-2">
        <Card
          className={`cursor-pointer transition-all ${situacao === 'parado' ? 'ring-2 ring-primary' : 'hover:bg-muted/50'}`}
          onClick={() => { setSituacao('parado'); setPodeMovimentar(null); }}
        >
          <CardContent className="p-3 text-center space-y-1">
            <Car className="h-6 w-6 mx-auto text-muted-foreground" />
            <p className="text-xs font-semibold">Veículo parado</p>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${situacao === 'uso_diario' ? 'ring-2 ring-primary' : 'hover:bg-muted/50'}`}
          onClick={() => setSituacao('uso_diario')}
        >
          <CardContent className="p-3 text-center space-y-1">
            <Clock className="h-6 w-6 mx-auto text-muted-foreground" />
            <p className="text-xs font-semibold">Uso diário</p>
          </CardContent>
        </Card>
      </div>

      {situacao === 'parado' && (
        <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
          <p className="text-xs font-medium">O associado pode movimentar agora?</p>
          <div className="flex gap-2">
            <Button size="sm" variant={podeMovimentar === 'sim' ? 'default' : 'outline'} onClick={() => setPodeMovimentar('sim')}>Sim</Button>
            <Button size="sm" variant={podeMovimentar === 'nao' ? 'default' : 'outline'} onClick={() => setPodeMovimentar('nao')}>Não</Button>
          </div>
          {podeMovimentar === 'sim' && (
            <div className="p-2 rounded bg-green-50 border border-green-200 text-xs text-green-800">
              Peça ao associado para movimentar. Se pontuar após a movimentação, registre como "Resolvido sem visita".
            </div>
          )}
          {podeMovimentar === 'nao' && (
            <div className="space-y-2">
              <label className="text-xs font-medium">Previsão de movimentação</label>
              <Input type="date" value={previsao} onChange={e => setPrevisao(e.target.value)} />
              <div className="p-2 rounded bg-yellow-50 border border-yellow-200 text-xs text-yellow-800">
                Registre a previsão e acompanhe. Se não pontuar após movimentação, confirme falha abaixo.
              </div>
            </div>
          )}
        </div>
      )}

      {situacao === 'uso_diario' && (
        <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
          <div className="p-2 rounded bg-yellow-50 border border-yellow-200 text-xs text-yellow-800 flex gap-2 items-start">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Segunda validação necessária: confirme com o associado a exata última vez em que o veículo foi movimentado.</span>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium">Última movimentação confirmada <span className="text-destructive">*</span></label>
            <Input type="datetime-local" value={ultimaMov} onChange={e => setUltimaMov(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium">Observação</label>
            <Textarea value={observacao} onChange={e => setObservacao(e.target.value)} rows={2} placeholder="Informações adicionais..." />
          </div>
        </div>
      )}

      {situacao && (
        <Button className="w-full" disabled={!canSubmit || isPending} onClick={handleSubmit}>
          Avançar para decisão
        </Button>
      )}
    </div>
  );
}

/* =================== ETAPA 3: DECISÃO =================== */
function EtapaDecisao({ onResolverSemVisita, onConfirmarFalha, isPending }: {
  onResolverSemVisita: () => void;
  onConfirmarFalha: () => void;
  isPending: boolean;
}) {
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm">Etapa 3 — Decisão</h3>
      <p className="text-xs text-muted-foreground">Defina o desfecho desta tratativa:</p>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button className="w-full bg-green-600 hover:bg-green-700 text-white" disabled={isPending}>
            <CheckCircle2 className="h-4 w-4 mr-2" /> Resolvido sem visita
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar encerramento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja encerrar esta tratativa como "Resolvido sem visita"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onResolverSemVisita} className="bg-green-600 hover:bg-green-700">Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white" disabled={isPending}>
            <Wrench className="h-4 w-4 mr-2" /> Confirmar falha — agendar visita técnica
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar falha do rastreador</AlertDialogTitle>
            <AlertDialogDescription>
              Ao confirmar, a tratativa será marcada como "Agendado" para visita técnica.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmarFalha} className="bg-orange-500 hover:bg-orange-600">Confirmar falha</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* =================== HELPERS =================== */
function formatAcao(acao: string, dados: Record<string, unknown>): string {
  switch (acao) {
    case 'contato_registrado': {
      const canal = dados.canal === 'whatsapp' ? 'WhatsApp' : dados.canal === 'ligacao' ? 'Ligação' : 'SMS';
      return `Contato registrado via ${canal}`;
    }
    case 'situacao_veiculo_parado':
      return `Validação: veículo parado${dados.pode_movimentar === 'sim' ? ' (pode movimentar)' : ' (sem previsão de movimento)'}`;
    case 'situacao_uso_diario':
      return 'Validação: associado declara uso diário';
    case 'resolvido_sem_visita':
      return '✅ Encerrado — resolvido sem visita';
    case 'falha_confirmada_agendar':
      return '🔧 Falha confirmada — visita técnica agendada';
    case 'agendamento_confirmado':
      return `📅 Agendamento confirmado — ${(dados.data as string) || ''} (${dados.periodo || ''})`;
    case 'visita_realizada':
      return `🔧 Visita realizada — ${dados.resultado || ''} (${dados.voltou_pontuar === 'sim' ? 'voltou a pontuar' : dados.voltou_pontuar === 'nao' ? 'não pontuou' : 'aguardando'})`;
    default:
      return acao.replace(/_/g, ' ');
  }
}
