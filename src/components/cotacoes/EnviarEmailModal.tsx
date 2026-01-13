import { useState } from 'react';
import { Mail, Send, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { CotacaoWithRelations } from '@/hooks/useCotacoes';

interface EnviarEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cotacao: CotacaoWithRelations;
  onSuccess?: () => void;
}

const formatCurrency = (value: number | null | undefined) => {
  if (!value) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export function EnviarEmailModal({
  open,
  onOpenChange,
  cotacao,
  onSuccess,
}: EnviarEmailModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState(cotacao.leads?.email || '');
  const [assunto, setAssunto] = useState(
    `Sua Cotação #${cotacao.numero} - PRATIC Proteção Veicular`
  );

  const conteudoInicial = `
<p>Olá ${cotacao.leads?.nome?.split(' ')[0] || 'Cliente'},</p>

<p>Segue sua cotação de número <strong>#${cotacao.numero}</strong> para proteção veicular:</p>

<p><strong>Veículo:</strong> ${cotacao.veiculo_marca || ''} ${cotacao.veiculo_modelo || ''} ${cotacao.veiculo_ano || ''}<br>
<strong>Valor FIPE:</strong> ${formatCurrency(cotacao.valor_fipe)}</p>

<p><strong>Plano:</strong> ${cotacao.planos?.nome || 'Proteção Veicular'}<br>
<strong>Taxa de Adesão:</strong> ${formatCurrency(cotacao.valor_adesao)}<br>
<strong>Mensalidade:</strong> ${formatCurrency(cotacao.valor_total_mensal)}</p>

<p>Esta cotação é válida por 7 dias. Guarde o número <strong>#${cotacao.numero}</strong> para referência.</p>

<p>Ficou com alguma dúvida? Entre em contato conosco informando o número da cotação!</p>

<p>Atenciosamente,<br>
Equipe PRATIC Proteção Veicular</p>
  `.trim();

  const [conteudo, setConteudo] = useState(conteudoInicial);

  const handleEnviar = async () => {
    if (!email) {
      toast.error('Informe o email do destinatário');
      return;
    }

    if (!email.includes('@')) {
      toast.error('Email inválido');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          template: 'generico',
          to: email,
          data: {
            assunto,
            titulo: `Cotação ${cotacao.numero}`,
            conteudo,
          },
        },
      });

      if (error) throw error;

      // Atualizar email_enviado_em na cotação
      await supabase
        .from('cotacoes')
        .update({ email_enviado_em: new Date().toISOString() })
        .eq('id', cotacao.id);

      toast.success('Email enviado com sucesso!');
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Erro ao enviar email:', error);
      toast.error(error.message || 'Erro ao enviar email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Enviar Cotação por Email
          </DialogTitle>
          <DialogDescription>
            Envie a cotação {cotacao.numero} para o cliente por email.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email do destinatário *</Label>
            <Input
              id="email"
              type="email"
              placeholder="cliente@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="assunto">Assunto</Label>
            <Input
              id="assunto"
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="conteudo">Mensagem</Label>
            <Textarea
              id="conteudo"
              value={conteudo.replace(/<[^>]*>/g, '').replace(/\n{3,}/g, '\n\n')}
              onChange={(e) => setConteudo(e.target.value.split('\n').map(line => `<p>${line}</p>`).join(''))}
              rows={10}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              O email será enviado com formatação HTML.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleEnviar} disabled={isLoading || !email}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Enviar Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
