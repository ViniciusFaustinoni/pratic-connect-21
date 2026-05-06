import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, PhoneCall, PowerOff, Loader2 } from 'lucide-react';
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
  const navigate = useNavigate();
  const [mensagemEncerramento, setMensagemEncerramento] = useState(MENSAGEM_ENCERRAMENTO_DEFAULT);
  const [encerrando, setEncerrando] = useState(false);
  const { pausa, ativa, pausarPorEncerramento } = useIaPausa(telefone);

  const telLimpo = telefone?.replace(/\D/g, '') ?? '';

  const { data: associado, isLoading } = useQuery({
    queryKey: ['contato-associado', telLimpo],
    enabled: open && !!telLimpo,
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
      return data as {
        id: string;
        nome: string | null;
        telefone: string | null;
        whatsapp: string | null;
        avatar_url: string | null;
        status: string | null;
        email: string | null;
      } | null;
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
          ) : associado ? (
            <div className="space-y-2 text-sm">
              {associado.email && (
                <div className="truncate"><span className="text-muted-foreground">Email:</span> {associado.email}</div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={() => navigate(`/cadastro/associados/${associado.id}`)}
              >
                <ExternalLink className="h-4 w-4 mr-2" /> Abrir cadastro completo
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhum associado vinculado a este telefone.</p>
          )}

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
    </Sheet>
  );
}
