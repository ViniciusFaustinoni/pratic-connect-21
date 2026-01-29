import { useState } from 'react';
import { Send, MapPin, Copy, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

interface EnviarLinkPrestadorButtonProps {
  chamadoId: string;
  protocolo: string;
  prestadorNome?: string;
  prestadorTelefone?: string;
  origemLat?: number | null;
  origemLng?: number | null;
  origemEndereco?: string;
  rastreadorLat?: number | null;
  rastreadorLng?: number | null;
  tipoServico?: string;
}

const TIPO_LABELS: Record<string, string> = {
  reboque: 'Reboque/Guincho',
  guincho: 'Reboque/Guincho',
  chaveiro: 'Chaveiro',
  troca_pneu: 'Troca de Pneu',
  pane_seca: 'Pane Seca',
  bateria: 'Bateria',
  outros: 'Outros',
};

export function EnviarLinkPrestadorButton({
  chamadoId,
  protocolo,
  prestadorNome,
  prestadorTelefone,
  origemLat,
  origemLng,
  origemEndereco,
  rastreadorLat,
  rastreadorLng,
  tipoServico,
}: EnviarLinkPrestadorButtonProps) {
  const [open, setOpen] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // Usar posição do rastreador se disponível, senão usar origem
  const lat = rastreadorLat ?? origemLat;
  const lng = rastreadorLng ?? origemLng;

  // Link para tracking público (se implementado)
  const baseUrl = window.location.origin;
  const linkTracking = `${baseUrl}/tracking/assistencia/${chamadoId}`;

  // Link direto do Google Maps
  const linkGoogleMaps = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : null;

  // Montar mensagem para WhatsApp
  const mensagem = `🚨 *CHAMADO DE ASSISTÊNCIA*

📋 *Protocolo:* ${protocolo}
🔧 *Tipo:* ${TIPO_LABELS[tipoServico || ''] || tipoServico || 'Assistência'}

📍 *Localização:*
${origemEndereco || 'Endereço não informado'}

🗺️ *Ver no Mapa:*
${linkGoogleMaps || 'Link não disponível'}

${rastreadorLat && rastreadorLng ? '📡 *Posição via rastreador (tempo real)*' : '📍 *Posição informada pelo associado*'}

Por favor, dirija-se ao local o mais rápido possível.`;

  const handleEnviarWhatsApp = () => {
    if (!prestadorTelefone) {
      toast.error('Telefone do prestador não informado');
      return;
    }

    const telefoneFormatado = prestadorTelefone.replace(/\D/g, '');
    const mensagemCodificada = encodeURIComponent(mensagem);
    
    window.open(`https://wa.me/55${telefoneFormatado}?text=${mensagemCodificada}`, '_blank');
    toast.success('WhatsApp aberto!');
    setOpen(false);
  };

  const handleCopiarLink = async () => {
    const textoCopiar = linkGoogleMaps || linkTracking;
    try {
      await navigator.clipboard.writeText(textoCopiar);
      setCopiado(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error('Erro ao copiar link');
    }
  };

  const handleAbrirMapa = () => {
    if (linkGoogleMaps) {
      window.open(linkGoogleMaps, '_blank');
    }
  };

  if (!lat || !lng) {
    return (
      <Button variant="outline" size="sm" disabled>
        <MapPin className="h-4 w-4 mr-2" />
        Sem localização
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" className="bg-green-500 hover:bg-green-600">
          <Send className="h-4 w-4 mr-2" />
          Enviar Localização
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-green-500" />
            Enviar Localização
          </DialogTitle>
          <DialogDescription>
            Compartilhe a localização do veículo com o prestador
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Info do prestador */}
          {prestadorNome && (
            <div>
              <Label className="text-muted-foreground">Prestador</Label>
              <p className="font-medium">{prestadorNome}</p>
              {prestadorTelefone && (
                <p className="text-sm text-muted-foreground">{prestadorTelefone}</p>
              )}
            </div>
          )}

          {/* Tipo de posição */}
          <div>
            <Label className="text-muted-foreground">Fonte da Localização</Label>
            <div className="mt-1">
              {rastreadorLat && rastreadorLng ? (
                <Badge className="bg-green-500">📡 Via Rastreador</Badge>
              ) : (
                <Badge variant="secondary">📍 Informada pelo Associado</Badge>
              )}
            </div>
          </div>

          {/* Link */}
          <div>
            <Label className="text-muted-foreground">Link do Mapa</Label>
            <div className="flex items-center gap-2 mt-1">
              <code className="flex-1 text-xs bg-muted p-2 rounded truncate">
                {linkGoogleMaps}
              </code>
              <Button variant="outline" size="icon" onClick={handleCopiarLink}>
                {copiado ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="icon" onClick={handleAbrirMapa}>
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Preview da mensagem */}
          <div>
            <Label className="text-muted-foreground">Preview da Mensagem</Label>
            <div className="mt-1 text-xs bg-muted p-3 rounded-lg whitespace-pre-wrap max-h-40 overflow-y-auto">
              {mensagem}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            className="bg-green-500 hover:bg-green-600"
            onClick={handleEnviarWhatsApp}
            disabled={!prestadorTelefone}
          >
            <Send className="h-4 w-4 mr-2" />
            Enviar via WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
