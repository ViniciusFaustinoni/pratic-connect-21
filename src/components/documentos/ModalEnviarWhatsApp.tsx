import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { useEnviarWhatsApp } from '@/hooks/useEnviarWhatsApp';
import {
  MessageSquare,
  Send,
  Loader2,
  ExternalLink,
  FileText,
  Phone,
} from 'lucide-react';

interface ModalEnviarWhatsAppProps {
  open: boolean;
  onClose: () => void;
  nomeDocumento: string;
  pdfBytes: Uint8Array;
  associado?: {
    nome: string;
    telefone?: string;
    whatsapp?: string;
  };
  onSuccess?: () => void;
}

export function ModalEnviarWhatsApp({
  open,
  onClose,
  nomeDocumento,
  pdfBytes,
  associado,
  onSuccess,
}: ModalEnviarWhatsAppProps) {
  const { enviarDocumento, abrirWhatsAppWeb, arrayBufferToBase64, enviando } =
    useEnviarWhatsApp();

  const [telefone, setTelefone] = useState('');
  const [mensagem, setMensagem] = useState('');

  // Pré-preencher
  useEffect(() => {
    if (associado && open) {
      setTelefone(associado.whatsapp || associado.telefone || '');
      setMensagem(
        `Olá ${associado.nome.split(' ')[0]}! 👋\n\n` +
          `Segue o documento "${nomeDocumento}" conforme solicitado.\n\n` +
          `Qualquer dúvida, estamos à disposição.\n\n` +
          `Atenciosamente,\n` +
          `PRATICCAR`
      );
    }
  }, [associado, nomeDocumento, open]);

  // Formatar telefone enquanto digita
  const handleTelefoneChange = (value: string) => {
    const numeros = value.replace(/\D/g, '');
    let formatado = numeros;

    if (numeros.length <= 2) {
      formatado = numeros;
    } else if (numeros.length <= 7) {
      formatado = `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`;
    } else if (numeros.length <= 11) {
      formatado = `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`;
    } else {
      formatado = `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7, 11)}`;
    }

    setTelefone(formatado);
  };

  // Enviar via API
  const handleEnviarAPI = async () => {
    if (!telefone) {
      return;
    }

    const pdfBase64 = arrayBufferToBase64(pdfBytes);

    const resultado = await enviarDocumento({
      telefone,
      nomeDocumento,
      pdfBase64,
      mensagem,
    });

    if (resultado.success) {
      onSuccess?.();
      onClose();
    }
  };

  // Abrir WhatsApp Web (fallback)
  const handleAbrirWhatsAppWeb = () => {
    abrirWhatsAppWeb(telefone, mensagem);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-600" />
            Enviar por WhatsApp
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Info do Documento */}
          <Card className="bg-muted/50">
            <CardContent className="flex items-center gap-3 p-3">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Documento
                </p>
                <p className="text-sm font-semibold">{nomeDocumento}</p>
              </div>
            </CardContent>
          </Card>

          {/* Telefone */}
          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone / WhatsApp *</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="telefone"
                placeholder="(11) 99999-9999"
                value={telefone}
                onChange={(e) => handleTelefoneChange(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Mensagem */}
          <div className="space-y-2">
            <Label htmlFor="mensagem">Mensagem</Label>
            <Textarea
              id="mensagem"
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Mensagem que acompanhará o documento..."
              rows={5}
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={handleAbrirWhatsAppWeb}
            disabled={!telefone}
            className="w-full sm:w-auto"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Abrir WhatsApp Web
          </Button>

          <Button
            onClick={handleEnviarAPI}
            disabled={enviando || !telefone}
            className="w-full bg-green-600 hover:bg-green-700 sm:w-auto"
          >
            {enviando ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Enviar via API
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
