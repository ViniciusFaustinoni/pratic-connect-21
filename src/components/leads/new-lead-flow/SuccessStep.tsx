import { useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, MessageCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface SuccessStepProps {
  leadId: string | null;
  token: string | null;
  telefone: string;
  onClose: () => void;
}

export function SuccessStep({ leadId, token, telefone, onClose }: SuccessStepProps) {
  const [copied, setCopied] = useState(false);
  
  const publicUrl = token ? `${window.location.origin}/q/${token}` : null;

  const handleCopy = async () => {
    if (!publicUrl) return;
    
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Erro ao copiar link');
    }
  };

  const handleWhatsApp = () => {
    if (!telefone) return;
    
    const phoneNumber = telefone.replace(/\D/g, '');
    const message = publicUrl 
      ? `Olá! Segue o link para você completar sua cotação de proteção veicular:\n\n${publicUrl}`
      : 'Olá! Obrigado pelo interesse em nossa proteção veicular. Em breve entraremos em contato.';
    
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
            O lead foi adicionado ao seu funil de vendas
          </p>
        </div>
      </div>

      {/* Link Público */}
      {publicUrl && (
        <div className="space-y-3 bg-secondary/30 rounded-lg p-4">
          <p className="text-sm font-medium">Link de Cotação Pública:</p>
          <div className="flex gap-2">
            <Input 
              value={publicUrl} 
              readOnly 
              className="flex-1 font-mono text-sm"
            />
            <Button variant="outline" size="icon" onClick={handleCopy}>
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <Button variant="outline" size="icon" asChild>
              <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Envie este link para o cliente completar a cotação
          </p>
        </div>
      )}

      {/* Ações */}
      <div className="flex flex-col gap-3">
        {telefone && (
          <Button 
            variant="default" 
            className="w-full bg-green-600 hover:bg-green-700"
            onClick={handleWhatsApp}
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Enviar via WhatsApp
          </Button>
        )}
        
        <Button variant="outline" className="w-full" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </div>
  );
}
