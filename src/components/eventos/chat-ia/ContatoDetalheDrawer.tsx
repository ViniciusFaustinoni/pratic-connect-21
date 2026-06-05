import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, PhoneCall, PowerOff, Loader2, FileText, Clock } from 'lucide-react';
import { useContatoRegistroAtendimento, type EventoImportante } from '@/hooks/useContatoRegistroAtendimento';
import { AssociadoFichaCompletaDialog } from '@/components/servicos-campo/AssociadoFichaCompletaDialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { UserAvatar } from '@/components/UserAvatar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useIaPausa } from '@/hooks/useIaPausa';

interface Props {
  telefone: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nomeContato: string | null;
  avatarUrl: string | null;
}

const MENSAGEM_ENCERRAMENTO_DEFAULT =
  'Foi um prazer atendê-lo(a)! 🤝 Caso precise de algo mais, é só nos chamar por aqui — estamos sempre à disposição.\n\nEquipe PRATIC';

export function ContatoDetalheDrawer({ telefone, open, onOpenChange, nomeContato, avatarUrl }: Props) {
  const [mensagemEncerramento, setMensagemEncerramento] = useState(MENSAGEM_ENCERRAMENTO_DEFAULT);
  const [encerrando, setEncerrando] = useState(false);
  const [fichaOpen, setFichaOpen] = useState(false);
  const { pausa, ativa, pausarPorEncerramento } = useIaPausa(telefone);
  const { resumo, resumoAtualizadoEm, eventos, isLoading: registroLoading } =
    useContatoRegistroAtendimento(open ? telefone : null);

  const telLimpo = telefone?.replace(/\D/g, '') ?? '';

  const variantes = (() => {
    if (!telLimpo) return [] as string[];
    const set = new Set<string>([telLimpo]);
    if (telLimpo.startsWith('55') && telLimpo.length >= 12) set.add(telLimpo.slice(2));
    else if (telLimpo.length >= 10) set.add(`55${telLimpo}`);
    return Array.from(set);
  })();

  const normNome = (n: string | null | undefined) =>
    (n || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\.+$/, '')
      .replace(/\s+/g, ' ')
      .trim();

  const { data: candidatos = [], isLoading } = useQuery({
    queryKey: ['contato-associados', variantes],
    enabled: open && variantes.length > 0,
    queryFn: async () => {
      // Match exato por telefone OU whatsapp — sem ilike %…% (que pegaria números
      // que apenas contêm os mesmos dígitos). Pode haver MAIS DE UM cadastro
      // legitimamente vinculado ao mesmo número (familiares).
      const orParts = variantes
        .flatMap((v) => [`telefone.eq.${v}`, `whatsapp.eq.${v}`])
        .join(',');
      const { data, error } = await supabase
        .from('associados')
        .select('id, nome, telefone, whatsapp, avatar_url, status, email')
        .or(orParts)
        .limit(20);
      if (error) throw error;
      const seen = new Set<string>();
      return ((data ?? []) as any[]).filter((a) => {
        if (seen.has(a.id)) return false;
        seen.add(a.id);
        return true;
      }) as Array<{
        id: string;
        nome: string | null;
        telefone: string | null;
        whatsapp: string | null;
        avatar_url: string | null;
        status: string | null;
        email: string | null;
      }>;
    },
  });

  // Desambiguação: quando houver mais de um, prefere o associado cujo nome bate
  // (exato ou prefixo) com o nome que veio da conversa (push_name).
  const associado = (() => {
    if (candidatos.length === 0) return null;
    if (candidatos.length === 1) return candidatos[0];
    const alvo = normNome(nomeContato);
    if (alvo) {
      const exato = candidatos.find((c) => normNome(c.nome) === alvo);
      if (exato) return exato;
      const prefixo = candidatos.find((c) => {
        const n = normNome(c.nome);
        return !!n && (n.startsWith(alvo) || alvo.startsWith(n));
      });
      if (prefixo) return prefixo;
    }
    return null; // ambiguidade não resolvida
  })();

  const ambiguo = candidatos.length > 1 && !associado;
  const [fichaAssocId, setFichaAssocId] = useState<string | undefined>(undefined);

  const handleEncerrar = async () => {
    if (!telefone) return;
    if (!mensagemEncerramento.trim()) {
      toast.error('Digite a mensagem de encerramento.');
      return;
    }
    setEncerrando(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-send-text', {
        body: { telefone, mensagem: mensagemEncerramento.trim() },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao enviar');
      await pausarPorEncerramento();
      toast.success('Atendimento encerrado. IA será reativada em 1 minuto.');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Erro ao encerrar: ${err.message}`);
    } finally {
      setEncerrando(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Detalhes do contato</SheetTitle>
          <SheetDescription>Informações e ações sobre este atendimento.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-3">
            <UserAvatar src={associado?.avatar_url || avatarUrl} name={associado?.nome || nomeContato} size="lg" />
            <div className="min-w-0">
              <p className="font-semibold truncate">{associado?.nome || nomeContato || 'Contato'}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <PhoneCall className="h-3 w-3" /> {telefone}
              </p>
              {associado?.status && (
                <Badge variant="secondary" className="mt-1 text-[10px]">{associado.status}</Badge>
              )}
            </div>
          </div>

          {ativa && pausa && (
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
              <strong>IA pausada</strong> até{' '}
              {new Date(pausa.pausada_ate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}{' '}
              ({pausa.motivo === 'intervencao_humana' ? 'intervenção humana' : 'encerramento'})
            </div>
          )}

          <Separator />

          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : ambiguo ? (
            <div className="space-y-2 text-sm">
              <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
                <strong>Mais de um cadastro vinculado a este telefone.</strong>{' '}
                Selecione qual cadastro abrir.
              </div>
              <ul className="space-y-1.5">
                {candidatos.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded border p-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.nome || 'Sem nome'}</p>
                      {c.status && (
                        <Badge variant="secondary" className="mt-0.5 text-[10px]">{c.status}</Badge>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setFichaAssocId(c.id); setFichaOpen(true); }}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" /> Abrir
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : associado ? (
            <div className="space-y-2 text-sm">
              {associado.email && (
                <div className="truncate"><span className="text-muted-foreground">Email:</span> {associado.email}</div>
              )}
              <Button
                variant="default"
                size="sm"
                className="w-full mt-2"
                onClick={() => { setFichaAssocId(associado.id); setFichaOpen(true); }}
              >
                <ExternalLink className="h-4 w-4 mr-2" /> Abrir cadastro completo
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhum associado vinculado a este telefone.</p>
          )}

          <Separator />

          {/* Resumo do atendimento */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Resumo do atendimento</p>
            </div>
            {registroLoading ? (
              <div className="h-10 rounded bg-muted/40 animate-pulse" />
            ) : resumo && resumo.trim() ? (
              <div className="space-y-1">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{resumo}</p>
                {resumoAtualizadoEm && (
                  <p className="text-[10px] text-muted-foreground">
                    Atualizado em {formatarDataHoraBR(resumoAtualizadoEm)}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs italic text-muted-foreground">Sem resumo ainda.</p>
            )}
          </div>

          <Separator />

          {/* Eventos importantes */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Eventos importantes</p>
            </div>
            {registroLoading ? (
              <div className="space-y-1.5">
                <div className="h-4 rounded bg-muted/40 animate-pulse" />
                <div className="h-4 rounded bg-muted/40 animate-pulse w-3/4" />
              </div>
            ) : eventos.length === 0 ? (
              <p className="text-xs italic text-muted-foreground">Nenhum evento registrado ainda.</p>
            ) : (
              <ul className="space-y-1.5">
                {eventos.map((ev) => (
                  <EventoLinha key={ev.id} evento={ev} />
                ))}
              </ul>
            )}
          </div>

          <Separator />


          <div className="space-y-2">
            <p className="text-sm font-medium">Encerrar atendimento</p>
            <p className="text-xs text-muted-foreground">
              Envia uma mensagem amigável de encerramento e a IA volta a responder em <strong>1 minuto</strong>.
            </p>
            <Textarea
              value={mensagemEncerramento}
              onChange={(e) => setMensagemEncerramento(e.target.value)}
              rows={5}
              className="text-sm"
            />
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleEncerrar}
              disabled={encerrando}
            >
              {encerrando ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <PowerOff className="h-4 w-4 mr-2" />
              )}
              Encerrar atendimento
            </Button>
          </div>
        </div>
      </SheetContent>
      <AssociadoFichaCompletaDialog
        associadoId={associado?.id}
        open={fichaOpen}
        onOpenChange={setFichaOpen}
      />
    </Sheet>
  );
}

const TZ_BRT = 'America/Sao_Paulo';

function formatarDataHoraBR(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: TZ_BRT,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isMesmoDiaBR(iso: string): boolean {
  const fmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ_BRT, day: '2-digit', month: '2-digit', year: 'numeric' });
  return fmt.format(new Date(iso)) === fmt.format(new Date());
}

function EventoLinha({ evento }: { evento: EventoImportante }) {
  const hojeBR = isMesmoDiaBR(evento.ocorrido_em);
  const data = new Date(evento.ocorrido_em);
  const horaBR = data.toLocaleTimeString('pt-BR', { timeZone: TZ_BRT, hour: '2-digit', minute: '2-digit' });
  const dataBR = data.toLocaleDateString('pt-BR', { timeZone: TZ_BRT, day: '2-digit', month: '2-digit' });
  return (
    <li className="flex gap-2 text-xs leading-snug">
      <span className="shrink-0 font-mono text-muted-foreground tabular-nums">
        {hojeBR ? horaBR : `${dataBR} ${horaBR}`}
      </span>
      <span className="text-muted-foreground">·</span>
      <span className="flex-1">{evento.descricao}</span>
    </li>
  );
}

