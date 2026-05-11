import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, Clock, Send, Eye, FileText, MessageCircle, AlertTriangle, Ban, ExternalLink } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { OutroProcessoItem } from '@/hooks/useOutrosProcessos';
import { cn } from '@/lib/utils';

interface Step {
  key: string;
  label: string;
  date: string | null;
  state: 'done' | 'current' | 'pending' | 'failed';
  hint?: string;
}

function buildSteps(item: OutroProcessoItem): Step[] {
  const t = item.troca_status;
  const failed = t === 'reprovada_cadastro' || t === 'reprovada_monitoramento' || t === 'cancelada';
  const reachedCadastro = !!item.aprovado_cadastro_em || ['aguardando_monitoramento','aguardando_vistoria','liberada_para_assinatura','efetivada'].includes(t || '');
  const reachedMon = !!item.aprovado_monitoramento_em || ['liberada_para_assinatura','efetivada'].includes(t || '');
  const reachedVist = t === 'aguardando_vistoria' || ['liberada_para_assinatura','efetivada'].includes(t || '');
  const efetivada = !!item.efetivada_em || t === 'efetivada';

  const mark = (cond: boolean, isCurrent: boolean): Step['state'] =>
    cond ? 'done' : isCurrent ? 'current' : 'pending';

  return [
    { key: 'envio', label: 'Termo enviado ao titular antigo', date: item.termo_enviado_em,
      state: item.termo_enviado_em ? 'done' : (failed ? 'failed' : 'current') },
    { key: 'assinado', label: 'Termo assinado (reconhecimento facial)', date: item.termo_assinado_em,
      state: item.termo_assinado_em ? 'done' : mark(false, !!item.termo_enviado_em && !failed) },
    { key: 'cadastro', label: 'Aprovado pelo Cadastro', date: item.aprovado_cadastro_em,
      state: failed && t === 'reprovada_cadastro' ? 'failed' : mark(reachedCadastro, t === 'aguardando_cadastro') },
    { key: 'monitoramento', label: 'Aprovado pelo Monitoramento', date: item.aprovado_monitoramento_em,
      state: failed && t === 'reprovada_monitoramento' ? 'failed' : mark(reachedMon, t === 'aguardando_monitoramento') },
    { key: 'vistoria', label: 'Vistoria (se exigida)', date: null,
      state: t === 'aguardando_vistoria' ? 'current' : reachedVist ? 'done' : 'pending',
      hint: t === 'aguardando_vistoria' ? 'Aguardando agendamento' : undefined },
    { key: 'efetivada', label: 'Troca efetivada', date: item.efetivada_em,
      state: efetivada ? 'done' : failed ? 'failed' : 'pending' },
  ];
}

function StepIcon({ state }: { state: Step['state'] }) {
  if (state === 'done') return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
  if (state === 'current') return <Clock className="h-5 w-5 text-amber-600 animate-pulse" />;
  if (state === 'failed') return <Ban className="h-5 w-5 text-red-600" />;
  return <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />;
}

interface Props {
  item: OutroProcessoItem | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onResend?: (item: OutroProcessoItem) => void;
  isResending?: boolean;
}

export function TrocaTimelineDrawer({ item, open, onOpenChange, onResend, isResending }: Props) {
  if (!item) return null;
  const steps = buildSteps(item);
  const semEmail = !item.associado_antigo_email;
  const podeReenviar = item.tipo === 'troca_titularidade' && item.solicitacao_troca_id &&
    !item.termo_assinado_em && !!item.termo_enviado_em && !semEmail;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Detalhes da Troca</DialogTitle>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="font-medium">{item.titular_origem_nome} → {item.titular_destino_nome || '—'}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Veículo: <span className="font-mono">{item.veiculo_placa}</span> · {item.veiculo_marca} {item.veiculo_modelo}
            </div>
            <div className="text-xs text-muted-foreground">Cotação: {item.cotacao_numero || '—'}</div>
          </div>

          {semEmail && (
            <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 p-3 text-sm flex gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium text-red-700 dark:text-red-300">Associado antigo sem e-mail</div>
                <div className="text-xs text-red-700/80 dark:text-red-300/80">O termo precisa ser enviado por e-mail. Cadastre um e-mail no titular antigo antes de prosseguir.</div>
              </div>
            </div>
          )}

          {/* Status do termo */}
          <div className="rounded-lg border p-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">Termo de cancelamento</span>
              {item.termo_reenvios_count > 0 && (
                <Badge variant="outline" className="text-[10px]">Reenvios: {item.termo_reenvios_count}</Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              {item.termo_enviado_em ? (
                <div>Enviado em {format(new Date(item.termo_enviado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} ({formatDistanceToNow(new Date(item.termo_enviado_em), { addSuffix: true, locale: ptBR })})</div>
              ) : (<div>Ainda não enviado</div>)}
              {item.termo_assinado_em && (
                <div className="text-emerald-700 dark:text-emerald-300">Assinado em {format(new Date(item.termo_assinado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>
              )}
              {item.termo_whatsapp_status && (
                <div className="flex items-center gap-1.5">
                  <MessageCircle className="h-3 w-3" />
                  WhatsApp: {item.termo_whatsapp_status === 'enviado' ? 'enviado' : item.termo_whatsapp_status === 'falhou' ? 'falhou' : 'sem telefone cadastrado'}
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              {item.termo_url && (
                <Button size="sm" variant="outline" className="h-8" onClick={() => window.open(item.termo_url!, '_blank')}>
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir no Autentique
                </Button>
              )}
              {podeReenviar && onResend && (
                <Button size="sm" variant="outline" className="h-8" disabled={isResending} onClick={() => onResend(item)}>
                  <Send className="h-3.5 w-3.5 mr-1" /> Reenviar termo
                </Button>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Etapas</div>
            <ol className="space-y-3">
              {steps.map((s, idx) => (
                <li key={s.key} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <StepIcon state={s.state} />
                    {idx < steps.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                  </div>
                  <div className="flex-1 pb-3">
                    <div className={cn('text-sm', s.state === 'done' && 'text-foreground', s.state === 'pending' && 'text-muted-foreground')}>
                      {s.label}
                    </div>
                    {s.date && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(s.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                    )}
                    {s.hint && <div className="text-xs text-amber-600 mt-0.5">{s.hint}</div>}
                  </div>
                </li>
              ))}
            </ol>
            {item.motivo_reprovacao && (
              <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 p-3 text-sm">
                <div className="font-medium text-red-700 dark:text-red-300 text-xs uppercase">Motivo da reprovação</div>
                <div className="text-sm text-red-700/90 dark:text-red-300/90 mt-1">{item.motivo_reprovacao}</div>
              </div>
            )}
          </div>

          {item.pendencia_qtd > 0 && (
            <>
              <Separator />
              <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
                <div className="flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-200">
                  <FileText className="h-4 w-4" /> Pendência financeira
                </div>
                <div className="text-xs text-amber-700/90 dark:text-amber-300/90 mt-1">
                  {item.pendencia_qtd} boleto(s) em aberto · R$ {item.pendencia_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
