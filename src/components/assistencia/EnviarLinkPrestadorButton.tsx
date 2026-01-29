import { useState } from 'react';
import { Send, MapPin, Copy, Check, ExternalLink, Loader2, Navigation } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';

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
  const [enviandoEvolution, setEnviandoEvolution] = useState(false);
  const [enviandoPin, setEnviandoPin] = useState(false);

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

  // Enviar PIN de localização nativo via Evolution API
  const handleEnviarPinLocation = async () => {
    if (!prestadorTelefone || !lat || !lng) {
      toast.error('Dados insuficientes para enviar localização');
      return;
    }

    setEnviandoPin(true);
    
    try {
      const telefoneFormatado = prestadorTelefone.replace(/\D/g, '');
      
      // 1. Enviar PIN de localização nativo
      const { error: locationError } = await supabase.functions.invoke('whatsapp-send-location', {
        body: {
          telefone: telefoneFormatado,
          latitude: lat,
          longitude: lng,
          name: `Chamado #${protocolo}`,
          address: origemEndereco || 'Localização do veículo',
          referencia_tipo: 'chamado_assistencia',
          referencia_id: chamadoId,
        },
      });

      if (locationError) throw locationError;

      // 2. Enviar mensagem de texto complementar (sem o link do Maps)
      const mensagemSemMaps = `🚨 *CHAMADO DE ASSISTÊNCIA*

📋 *Protocolo:* ${protocolo}
🔧 *Tipo:* ${TIPO_LABELS[tipoServico || ''] || tipoServico || 'Assistência'}

📍 *Localização:*
${origemEndereco || 'Endereço não informado'}

${rastreadorLat && rastreadorLng ? '📡 *Posição via rastreador (tempo real)*' : '📍 *Posição informada pelo associado*'}

Por favor, dirija-se ao local o mais rápido possível.`;

      await supabase.functions.invoke('whatsapp-send-text', {
        body: {
          telefone: telefoneFormatado,
          mensagem: mensagemSemMaps,
        },
      });

      toast.success('📍 Localização enviada com pin nativo!');
      setOpen(false);
    } catch (err: any) {
      console.error('[EnviarLinkPrestadorButton] Erro ao enviar pin:', err);
      toast.error(`Erro ao enviar: ${err.message}`);
    } finally {
      setEnviandoPin(false);
    }
  };

  // Enviar via Evolution API (envio direto sem abrir wa.me)
  const handleEnviarViaEvolution = async () => {
    if (!prestadorTelefone) {
      toast.error('Telefone do prestador não informado');
      return;
    }

    setEnviandoEvolution(true);
    
    try {
      const telefoneFormatado = prestadorTelefone.replace(/\D/g, '');
      
      const { data, error } = await supabase.functions.invoke('whatsapp-send-text', {
        body: {
          telefone: telefoneFormatado,
          mensagem: mensagem,
        },
      });

      if (error) throw error;
      
      if (data?.success === false) {
        throw new Error(data.error || 'Erro ao enviar mensagem');
      }

      toast.success('✅ Mensagem enviada diretamente via WhatsApp!');
      setOpen(false);
    } catch (err: any) {
      console.error('[EnviarLinkPrestadorButton] Erro Evolution:', err);
      toast.error(`Erro ao enviar: ${err.message}`);
    } finally {
      setEnviandoEvolution(false);
    }
  };

  // Abrir WhatsApp Web (fallback)
  const handleEnviarWhatsAppWeb = () => {
    if (!prestadorTelefone) {
      toast.error('Telefone do prestador não informado');
      return;
    }

    const telefoneFormatado = prestadorTelefone.replace(/\D/g, '');
    const mensagemCodificada = encodeURIComponent(mensagem);
    
    window.open(`https://wa.me/55${telefoneFormatado}?text=${mensagemCodificada}`, '_blank');
    toast.success('WhatsApp Web aberto!');
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
            variant="secondary"
            onClick={handleEnviarWhatsAppWeb}
            disabled={!prestadorTelefone}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Abrir WhatsApp Web
          </Button>
          <Button
            className="bg-blue-500 hover:bg-blue-600"
            onClick={handleEnviarPinLocation}
            disabled={!prestadorTelefone || !lat || !lng || enviandoPin}
          >
            {enviandoPin ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4 mr-2" />
            )}
            {enviandoPin ? 'Enviando...' : 'Enviar Pin 📍'}
          </Button>
          <Button
            className="bg-green-500 hover:bg-green-600"
            onClick={handleEnviarViaEvolution}
            disabled={!prestadorTelefone || enviandoEvolution}
          >
            {enviandoEvolution ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {enviandoEvolution ? 'Enviando...' : 'Enviar Texto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
