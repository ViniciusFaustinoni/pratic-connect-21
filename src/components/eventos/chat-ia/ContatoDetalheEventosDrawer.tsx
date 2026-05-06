import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  PhoneCall,
  PowerOff,
  Loader2,
  Car,
  MapPin,
  Activity,
  AlertTriangle,
  LifeBuoy,
  Eye,
  ExternalLink,
  Radio,
  Clock,
} from 'lucide-react';
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
import { useVeiculosDoAssociado } from '@/hooks/useAssociados';
import { VeiculoDetalhesModal } from '@/components/cadastro/VeiculoDetalhesModal';
import NovoSinistroModal from '@/components/eventos/NovoSinistroModal';
import { NovoChamadoModal } from '@/components/assistencia/NovoChamadoModal';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  telefone: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nomeContato: string | null;
  avatarUrl: string | null;
}

const MENSAGEM_ENCERRAMENTO_DEFAULT =
  'Foi um prazer atendê-lo(a)! 🤝 Caso precise de algo mais, é só nos chamar por aqui — estamos sempre à disposição.\n\nEquipe PRATIC';

function formatComunicacao(ts: string | null | undefined): { label: string; online: boolean } {
  if (!ts) return { label: 'sem dados', online: false };
  const diff = Date.now() - new Date(ts).getTime();
  const online = diff < 1000 * 60 * 10; // 10min = online
  return {
    label: formatDistanceToNow(new Date(ts), { addSuffix: true, locale: ptBR }),
    online,
  };
}

export function ContatoDetalheEventosDrawer({
  telefone,
  open,
  onOpenChange,
  nomeContato,
  avatarUrl,
}: Props) {
  const [mensagemEncerramento, setMensagemEncerramento] = useState(MENSAGEM_ENCERRAMENTO_DEFAULT);
  const [encerrando, setEncerrando] = useState(false);
  const [veiculoDetalhesId, setVeiculoDetalhesId] = useState<string | null>(null);
  const [novoSinistroOpen, setNovoSinistroOpen] = useState(false);
  const [novoChamadoOpen, setNovoChamadoOpen] = useState(false);
  const { pausa, ativa, pausarPorEncerramento } = useIaPausa(telefone);

  const telLimpo = telefone?.replace(/\D/g, '') ?? '';

  const { data: associado, isLoading: loadingAssoc } = useQuery({
    queryKey: ['contato-associado', telLimpo],
    enabled: open && !!telLimpo,
    staleTime: 60_000,
    queryFn: async () => {
      const variacoes = [telLimpo];
      if (telLimpo.startsWith('55')) variacoes.push(telLimpo.slice(2));
      else variacoes.push(`55${telLimpo}`);

      const { data, error } = await supabase
        .from('associados')
        .select('id, nome, telefone, whatsapp, avatar_url, status, email')
        .or(
          variacoes
            .flatMap((v) => [`telefone.ilike.%${v}%`, `whatsapp.ilike.%${v}%`])
            .join(',')
        )
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const associadoId = associado?.id;

  const { data: veiculos, isLoading: loadingVeiculos } = useVeiculosDoAssociado(
    open && associadoId ? associadoId : undefined
  );

  const { data: sinistros, isLoading: loadingSinistros } = useQuery({
    queryKey: ['contato-eventos-sinistros', associadoId],
    enabled: open && !!associadoId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sinistros')
        .select('id, protocolo, tipo, status, data_ocorrencia, created_at, veiculo_id')
        .eq('associado_id', associadoId!)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

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
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Detalhes do contato — Eventos</SheetTitle>
          <SheetDescription>
            Informações úteis para acionamento de eventos e assistência.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Cabeçalho */}
          <div className="flex items-center gap-3">
            <UserAvatar
              src={associado?.avatar_url || avatarUrl}
              name={associado?.nome || nomeContato}
              size="lg"
            />
            <div className="min-w-0">
              <p className="font-semibold truncate">
                {associado?.nome || nomeContato || 'Contato'}
              </p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <PhoneCall className="h-3 w-3" /> {telefone}
              </p>
              {associado?.status && (
                <Badge variant="secondary" className="mt-1 text-[10px]">
                  {associado.status}
                </Badge>
              )}
            </div>
          </div>

          {ativa && pausa && (
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
              <strong>IA pausada</strong> até{' '}
              {new Date(pausa.pausada_ate).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              ({pausa.motivo === 'intervencao_humana' ? 'intervenção humana' : 'encerramento'})
            </div>
          )}

          <Separator />

          {/* Carregando associado */}
          {loadingAssoc ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !associado ? (
            <p className="text-xs text-muted-foreground">
              Nenhum associado vinculado a este telefone. As ações abaixo estão indisponíveis.
            </p>
          ) : (
            <>
              {/* Ações principais */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="default"
                  size="sm"
                  className="w-full"
                  onClick={() => setNovoSinistroOpen(true)}
                >
                  <AlertTriangle className="h-4 w-4 mr-1" /> Abrir evento
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => setNovoChamadoOpen(true)}
                >
                  <LifeBuoy className="h-4 w-4 mr-1" /> Abrir chamado
                </Button>
              </div>

              {associado.email && (
                <p className="text-xs text-muted-foreground truncate">
                  <span className="font-medium">Email:</span> {associado.email}
                </p>
              )}

              <Separator />

              {/* Veículos */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold flex items-center gap-1">
                    <Car className="h-4 w-4" /> Veículos
                    {veiculos && (
                      <Badge variant="outline" className="ml-1 text-[10px]">
                        {veiculos.length}
                      </Badge>
                    )}
                  </p>
                </div>

                {loadingVeiculos ? (
                  <div className="flex justify-center py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : !veiculos || veiculos.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum veículo cadastrado.</p>
                ) : (
                  <div className="space-y-2">
                    {veiculos.map((v: any) => {
                      const r = v.rastreador;
                      const com = formatComunicacao(r?.ultima_comunicacao);
                      return (
                        <div
                          key={v.id}
                          className="rounded-md border border-border bg-muted/30 p-3 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-mono text-sm font-semibold truncate">
                                {v.placa || '—'}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {[v.marca, v.modelo].filter(Boolean).join(' ')}{' '}
                                {v.ano_modelo ? `· ${v.ano_modelo}` : ''}{' '}
                                {v.cor ? `· ${v.cor}` : ''}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className="text-[10px] shrink-0"
                            >
                              {v.status || '—'}
                            </Badge>
                          </div>

                          {/* Rastreador */}
                          {r ? (
                            <div className="space-y-1 text-xs">
                              <div className="flex items-center gap-2">
                                <Radio
                                  className={`h-3 w-3 ${
                                    com.online ? 'text-green-600' : 'text-muted-foreground'
                                  }`}
                                />
                                <span className="font-medium">
                                  {r.codigo || r.numero_serie || r.imei || 'Rastreador'}
                                </span>
                                <Badge
                                  variant={com.online ? 'default' : 'secondary'}
                                  className="text-[10px] py-0 px-1.5"
                                >
                                  {com.online ? 'online' : 'offline'}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>Última comunicação: {com.label}</span>
                              </div>
                              {r.ultima_posicao_lat != null &&
                                r.ultima_posicao_lng != null && (
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    <a
                                      href={`https://www.google.com/maps?q=${r.ultima_posicao_lat},${r.ultima_posicao_lng}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary hover:underline truncate"
                                    >
                                      {Number(r.ultima_posicao_lat).toFixed(5)},{' '}
                                      {Number(r.ultima_posicao_lng).toFixed(5)}
                                    </a>
                                  </div>
                                )}
                              <div className="flex items-center gap-3 text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Activity className="h-3 w-3" />
                                  {r.ultima_velocidade != null
                                    ? `${Math.round(Number(r.ultima_velocidade))} km/h`
                                    : '—'}
                                </span>
                                <span>
                                  Ignição:{' '}
                                  <span
                                    className={
                                      r.ultima_ignicao
                                        ? 'text-green-600 font-medium'
                                        : 'text-muted-foreground'
                                    }
                                  >
                                    {r.ultima_ignicao ? 'ligada' : 'desligada'}
                                  </span>
                                </span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Sem rastreador vinculado.
                            </p>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full h-7 text-xs"
                            onClick={() => setVeiculoDetalhesId(v.id)}
                          >
                            <Eye className="h-3 w-3 mr-1" /> Ver detalhes do veículo
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <Separator />

              {/* Eventos */}
              <div className="space-y-2">
                <p className="text-sm font-semibold flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" /> Eventos recentes
                  {sinistros && (
                    <Badge variant="outline" className="ml-1 text-[10px]">
                      {sinistros.length}
                    </Badge>
                  )}
                </p>
                {loadingSinistros ? (
                  <div className="flex justify-center py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : !sinistros || sinistros.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum evento registrado.</p>
                ) : (
                  <div className="space-y-1.5">
                    {sinistros.map((s) => (
                      <a
                        key={s.id}
                        href={`/eventos/sinistros/${s.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 p-2 text-xs hover:bg-muted transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="font-mono font-semibold truncate">{s.protocolo}</p>
                          <p className="text-muted-foreground truncate">
                            {s.tipo}{' '}
                            {s.data_ocorrencia &&
                              `· ${new Date(s.data_ocorrencia).toLocaleDateString('pt-BR')}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge variant="outline" className="text-[10px]">
                            {s.status}
                          </Badge>
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <Separator />

          {/* Encerrar atendimento */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Encerrar atendimento</p>
            <p className="text-xs text-muted-foreground">
              Envia uma mensagem amigável de encerramento e a IA volta a responder em{' '}
              <strong>1 minuto</strong>.
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

      {/* Modais sobre o drawer (mesma tela) */}
      <VeiculoDetalhesModal
        open={!!veiculoDetalhesId}
        onClose={() => setVeiculoDetalhesId(null)}
        veiculoId={veiculoDetalhesId}
      />
      <NovoSinistroModal
        open={novoSinistroOpen}
        onClose={() => setNovoSinistroOpen(false)}
      />
      <NovoChamadoModal
        open={novoChamadoOpen}
        onClose={() => setNovoChamadoOpen(false)}
      />
    </Sheet>
  );
}
