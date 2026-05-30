import { CheckCircle2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SuccessStepProps {
  leadId: string | null;
  telefone: string;
  onClose: () => void;
}

export function SuccessStep({ leadId, telefone, onClose }: SuccessStepProps) {
  const handleWhatsApp = () => {
    if (!telefone) return;
    const phoneNumber = telefone.replace(/\D/g, '');
    const message = 'Olá! Obrigado pelo interesse em nossa proteção veicular. Em breve entraremos em contato.';
    const whatsappUrl = `https://wa.me/55${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="py-8 space-y-6">
      <div className="flex flex-col items-center gap-4">
        <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>
        <div className="text-center">
          <h3 className="text-xl font-bold text-green-700 dark:text-green-300">
            Lead Criado com Sucesso!
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            O lead foi adicionado ao seu funil de vendas. Crie uma cotação para enviar o link ao cliente.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {telefone && (
          <Button
            variant="default"
            className="w-full bg-green-600 hover:bg-green-700"
            onClick={handleWhatsApp}
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Enviar mensagem no WhatsApp
          </Button>
        )}

        <Button variant="outline" className="w-full" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </div>
  );
}
