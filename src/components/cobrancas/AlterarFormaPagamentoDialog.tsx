import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, QrCode, FileText, CreditCard, Copy, Check, ExternalLink, Info } from 'lucide-react';
import { useAlterarFormaPagamento, FormaPagamentoAlteravel } from '@/hooks/useAlterarFormaPagamento';
import { toast } from 'sonner';

interface AlterarFormaPagamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cobrancaId: string;
  formaAtual: string;
  associadoId?: string;
  descricao?: string;
}

const formaInfo: Record<FormaPagamentoAlteravel, { label: string; icon: any; desc: string }> = {
  PIX:         { label: 'PIX',                 icon: QrCode,     desc: 'QR Code e código copia-e-cola, pagamento instantâneo.' },
  BOLETO:      { label: 'Boleto Bancário',     icon: FileText,   desc: 'Linha digitável e PDF, compensa em até 2 dias úteis.' },
  CREDIT_CARD: { label: 'Cartão de Crédito',   icon: CreditCard, desc: 'Link de pagamento seguro do ASAAS para preenchimento do cartão.' },
};

const normalizarFormaAtual = (f: string): FormaPagamentoAlteravel | null => {
  const v = (f || '').toUpperCase();
  if (v === 'PIX' || v === 'BOLETO' || v === 'CREDIT_CARD') return v;
  return null;
};

const labelFormaAtual = (f: string) => {
  const v = (f || '').toUpperCase();
  if (v === 'PIX') return 'PIX';
  if (v === 'BOLETO') return 'Boleto';
  if (v === 'CREDIT_CARD') return 'Cartão de Crédito';
  if (v === 'UNDEFINED') return 'PIX ou Cartão';
  return f || '—';
};

export function AlterarFormaPagamentoDialog({
  open, onOpenChange, cobrancaId, formaAtual, associadoId, descricao,
}: AlterarFormaPagamentoDialogProps) {
  const atualNormalizada = normalizarFormaAtual(formaAtual);
  const [selecionada, setSelecionada] = useState<FormaPagamentoAlteravel>(
    atualNormalizada === 'PIX' ? 'BOLETO' : 'PIX'
  );
  const [resultado, setResultado] = useState<any>(null);
  const [copiado, setCopiado] = useState(false);
  const mutation = useAlterarFormaPagamento();

  useEffect(() => {
    if (open) {
      setResultado(null);
      setCopiado(false);
      setSelecionada(atualNormalizada === 'PIX' ? 'BOLETO' : 'PIX');
    }
  }, [open, atualNormalizada]);

  const handleConfirmar = async () => {
    try {
      const data = await mutation.mutateAsync({ cobrancaId, novaForma: selecionada, associadoId });
      setResultado(data);
    } catch {
      // toast já tratado no hook
    }
  };

  const copiar = async (texto: string, mensagem: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      toast.success(mensagem);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  const opcoesDisponiveis = (Object.keys(formaInfo) as FormaPagamentoAlteravel[])
    .filter((f) => f !== atualNormalizada);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Alterar forma de pagamento</DialogTitle>
          <DialogDescription>
            {descricao || 'Selecione a nova forma de pagamento para esta cobrança.'}
          </DialogDescription>
        </DialogHeader>

        {!resultado ? (
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Forma atual: <span className="font-semibold">{labelFormaAtual(formaAtual)}</span>.
                A alteração só é possível enquanto a cobrança ainda estiver em aberto.
              </AlertDescription>
            </Alert>

            <RadioGroup
              value={selecionada}
              onValueChange={(v) => setSelecionada(v as FormaPagamentoAlteravel)}
              className="space-y-2"
            >
              {opcoesDisponiveis.map((opcao) => {
                const Icon = formaInfo[opcao].icon;
                return (
                  <Label
                    key={opcao}
                    htmlFor={`forma-${opcao}`}
                    className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-accent"
                  >
                    <RadioGroupItem value={opcao} id={`forma-${opcao}`} className="mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">{formaInfo[opcao].label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{formaInfo[opcao].desc}</p>
                    </div>
                  </Label>
                );
              })}
            </RadioGroup>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
                Cancelar
              </Button>
              <Button onClick={handleConfirmar} disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirmar alteração
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <Alert>
              <Check className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Forma de pagamento alterada para <strong>{formaInfo[selecionada].label}</strong>
                {resultado.recriou ? ' (cobrança recriada com mesmo valor e vencimento)' : ''}.
              </AlertDescription>
            </Alert>

            {selecionada === 'PIX' && resultado.pix?.encodedImage && (
              <div className="flex flex-col items-center gap-2">
                <img
                  src={`data:image/png;base64,${resultado.pix.encodedImage}`}
                  alt="QR Code PIX"
                  className="w-48 h-48 border border-border rounded-md"
                />
                {resultado.pix.payload && (
                  <Button
                    variant="outline" size="sm"
                    onClick={() => copiar(resultado.pix.payload, 'Código PIX copiado!')}
                    className="w-full"
                  >
                    {copiado ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                    Copiar código PIX
                  </Button>
                )}
              </div>
            )}

            {selecionada === 'BOLETO' && (
              <div className="space-y-2">
                {resultado.cobranca?.identificationField && (
                  <div className="rounded-md border border-border p-3 bg-muted/30">
                    <p className="text-[10px] uppercase text-muted-foreground mb-1">Linha digitável</p>
                    <p className="text-xs font-mono break-all">{resultado.cobranca.identificationField}</p>
                    <Button
                      variant="outline" size="sm" className="mt-2 w-full"
                      onClick={() => copiar(resultado.cobranca.identificationField, 'Linha digitável copiada!')}
                    >
                      {copiado ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                      Copiar linha digitável
                    </Button>
                  </div>
                )}
                {resultado.bankSlipUrl && (
                  <Button asChild className="w-full">
                    <a href={resultado.bankSlipUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir boleto em PDF
                    </a>
                  </Button>
                )}
              </div>
            )}

            {selecionada === 'CREDIT_CARD' && resultado.invoiceUrl && (
              <Button asChild className="w-full">
                <a href={resultado.invoiceUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir checkout do cartão
                </a>
              </Button>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
                Fechar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
