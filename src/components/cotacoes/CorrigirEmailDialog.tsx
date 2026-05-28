import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Loader2, MailCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { CorrigirEmailEventDetail } from '@/lib/ui/toastErroEdge';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Provider global de correção de e-mail.
 *
 * Escuta o CustomEvent `corrigir-email:abrir` (disparado pelo `toastErroEdge`
 * quando o backend devolve `code: EMAIL_INVALIDO`), abre o modal, atualiza
 * `cotacoes.email_solicitante` / `contratos.cliente_email` /
 * `associados.email` e re-executa a ação original via `detail.onRetry`.
 *
 * Mount único em `App.tsx`.
 */
export function CorrigirEmailProvider() {
  const [detail, setDetail] = useState<CorrigirEmailEventDetail | null>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<CorrigirEmailEventDetail>;
      if (!ce.detail) return;
      setDetail(ce.detail);
      setEmail(ce.detail.emailAtual || '');
    };
    window.addEventListener('corrigir-email:abrir', handler);
    return () => window.removeEventListener('corrigir-email:abrir', handler);
  }, []);

  const close = () => {
    if (loading) return;
    setDetail(null);
    setEmail('');
  };

  const handleConfirmar = async () => {
    if (!detail) return;
    const novoEmail = email.trim();
    if (!EMAIL_REGEX.test(novoEmail)) {
      toast.error('E-mail inválido — use o formato nome@dominio.com');
      return;
    }
    setLoading(true);
    try {
      // 1. Atualizar nas 3 tabelas envolvidas (só onde o id existe).
      const updates: Promise<unknown>[] = [];
      if (detail.cotacaoId) {
        updates.push(
          Promise.resolve(
            supabase.from('cotacoes').update({ email_solicitante: novoEmail }).eq('id', detail.cotacaoId),
          ),
        );
      }
      if (detail.contratoId) {
        updates.push(
          Promise.resolve(
            supabase.from('contratos').update({ cliente_email: novoEmail }).eq('id', detail.contratoId),
          ),
        );
      }
      if (detail.associadoId) {
        updates.push(
          Promise.resolve(
            supabase.from('associados').update({ email: novoEmail }).eq('id', detail.associadoId),
          ),
        );
      }
      await Promise.all(updates);

      // 2. Reprocessar a ação original (gerar contrato / criar autentique / etc.)
      if (detail.onRetry) {
        await detail.onRetry();
      }

      toast.success('E-mail corrigido e ação reprocessada com sucesso!');
      setDetail(null);
      setEmail('');
    } catch (err: any) {
      console.error('[CorrigirEmailDialog] erro ao reprocessar:', err);
      toast.error(
        `Não foi possível reprocessar: ${err?.message || 'erro desconhecido'}. Corrija manualmente e tente de novo.`,
      );
    } finally {
      setLoading(false);
    }
  };

  const isOpen = !!detail;

  return (
    <Dialog open={isOpen} onOpenChange={(o) => (!o ? close() : null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MailCheck className="h-5 w-5 text-primary" />
            Corrigir e-mail e reprocessar
          </DialogTitle>
          <DialogDescription>
            O Autentique rejeitou o envio porque o e-mail informado é inválido.
            Corrija abaixo — a ação será reprocesada automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <div className="font-medium text-destructive">E-mail inválido detectado</div>
              <div className="text-muted-foreground break-all">
                {detail?.emailAtual || '(vazio)'}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="novo-email">Novo e-mail *</Label>
            <Input
              id="novo-email"
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@dominio.com"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Será atualizado na cotação, no contrato e no cadastro do associado
              (quando aplicável) e em seguida a ação "{detail?.contexto}" é reprocesada.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={loading || !email.trim()}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Corrigir e reprocessar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
