import { useState } from 'react';
import { MapPin, Phone, Car, Clock, Play, Navigation, MessageCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { InstalacaoComRelacoes } from '@/hooks/useInstaladorInstalacoes';

interface InstalacaoCardProps {
  instalacao: InstalacaoComRelacoes;
  onIniciar: () => void;
  loading?: boolean;
}

const PERIODO_LABELS: Record<string, { label: string; icon: string }> = {
  manha: { label: 'Manhã', icon: '🌅' },
  tarde: { label: 'Tarde', icon: '🌤' },
  noite: { label: 'Noite', icon: '🌙' },
};

const STATUS_STYLES: Record<string, string> = {
  agendada: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  em_rota: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  em_andamento: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

export function InstalacaoCard({ instalacao, onIniciar, loading }: InstalacaoCardProps) {
  const [enviandoLocalizacao, setEnviandoLocalizacao] = useState(false);
  
  const periodo = PERIODO_LABELS[instalacao.periodo] || { label: 'Período', icon: '📅' };
  
  const endereco = [
    instalacao.logradouro,
    instalacao.numero,
    instalacao.bairro,
    instalacao.cidade,
    instalacao.uf,
  ].filter(Boolean).join(', ');

  const telefone = instalacao.associados?.whatsapp || instalacao.associados?.telefone;

  // Enviar mensagem via WhatsApp Web
  const handleWhatsApp = () => {
    if (!telefone) return;
    const numero = telefone.replace(/\D/g, '');
    const mensagem = encodeURIComponent(
      `Olá ${instalacao.associados?.nome}, sou o instalador da PRATIC. Estou a caminho para realizar a instalação do rastreador no seu veículo ${instalacao.veiculos?.marca} ${instalacao.veiculos?.modelo} - ${instalacao.veiculos?.placa}.`
    );
    window.open(`https://wa.me/55${numero}?text=${mensagem}`, '_blank');
  };

  // Abrir Google Maps
  const handleMaps = () => {
    if (!endereco) return;
    const enderecoFormatado = encodeURIComponent(endereco);
    window.open(`https://www.google.com/maps/search/?api=1&query=${enderecoFormatado}`, '_blank');
  };

  // Enviar localização nativa via WhatsApp (Evolution API)
  const handleEnviarLocalizacao = async () => {
    if (!telefone) {
      toast.error('Telefone do cliente não informado');
      return;
    }

    // Tentar obter coordenadas do endereço via geocoding (fallback usar endereço textual)
    // Por enquanto, verificar se a instalacao tem campos de coordenadas
    const instalacaoAny = instalacao as any;
    const lat = instalacaoAny.latitude || instalacaoAny.endereco_lat;
    const lng = instalacaoAny.longitude || instalacaoAny.endereco_lng;

    // Se não temos coordenadas, tentar enviar mesmo assim (a edge function pode fazer geocoding)
    // Mas precisamos de pelo menos o endereço

    setEnviandoLocalizacao(true);
    
    try {
      // Se temos coordenadas, usar sendLocation
      if (lat && lng) {
        const { error } = await supabase.functions.invoke('whatsapp-send-location', {
          body: {
            telefone: telefone.replace(/\D/g, ''),
            latitude: lat,
            longitude: lng,
            name: `Instalação - ${instalacao.associados?.nome || 'Cliente'}`,
            address: endereco || 'Endereço de instalação',
            referencia_tipo: 'instalacao',
            referencia_id: instalacao.id,
          },
        });

        if (error) throw error;
        toast.success('📍 Localização enviada ao cliente!');
      } else {
        // Se não temos coordenadas, enviar apenas mensagem com endereço
        const { error } = await supabase.functions.invoke('whatsapp-send-text', {
          body: {
            telefone: telefone.replace(/\D/g, ''),
            mensagem: `📍 *Endereço para Instalação*\n\n${endereco}\n\n🗺️ Ver no Google Maps:\nhttps://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`,
          },
        });

        if (error) throw error;
        toast.success('📍 Endereço enviado ao cliente!');
      }
    } catch (err: any) {
      console.error('[InstalacaoCard] Erro ao enviar localização:', err);
      toast.error(`Erro ao enviar: ${err.message}`);
    } finally {
      setEnviandoLocalizacao(false);
    }
  };

  return (
    <Card className="border-slate-700 bg-slate-800">
      <CardContent className="p-4">
        {/* Header com período e status */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{periodo.icon}</span>
            <span className="text-sm font-medium text-slate-300">{periodo.label}</span>
          </div>
          <Badge variant="outline" className={STATUS_STYLES[instalacao.status] || ''}>
            {instalacao.status === 'agendada' && 'Agendada'}
            {instalacao.status === 'em_rota' && 'Em Rota'}
            {instalacao.status === 'em_andamento' && 'Em Andamento'}
          </Badge>
        </div>

        {/* Nome do associado */}
        <h3 className="mb-2 text-lg font-semibold text-white">
          {instalacao.associados?.nome || 'Associado não informado'}
        </h3>

        {/* Veículo */}
        <div className="mb-2 flex items-center gap-2 text-sm text-slate-400">
          <Car className="h-4 w-4" />
          <span>
            {instalacao.veiculos?.placa} • {instalacao.veiculos?.marca} {instalacao.veiculos?.modelo} {instalacao.veiculos?.ano_modelo}
            {instalacao.veiculos?.cor && ` (${instalacao.veiculos.cor})`}
          </span>
        </div>

        {/* Endereço */}
        <div className="mb-2 flex items-start gap-2 text-sm text-slate-400">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{endereco || 'Endereço não informado'}</span>
        </div>

        {/* Telefone */}
        {telefone && (
          <div className="mb-4 flex items-center gap-2 text-sm text-slate-400">
            <Phone className="h-4 w-4" />
            <span>{telefone}</span>
          </div>
        )}

        {/* Ações */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleWhatsApp}
            disabled={!telefone}
            className="flex-1 border-slate-600 bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            <MessageCircle className="mr-1 h-4 w-4" />
            WhatsApp
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleMaps}
            disabled={!endereco}
            className="flex-1 border-slate-600 bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            <Navigation className="mr-1 h-4 w-4" />
            Maps
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleEnviarLocalizacao}
            disabled={!telefone || !endereco || enviandoLocalizacao}
            className="flex-1 border-blue-600 bg-blue-700/30 text-blue-300 hover:bg-blue-700/50 hover:text-white"
          >
            {enviandoLocalizacao ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <MapPin className="mr-1 h-4 w-4" />
            )}
            {enviandoLocalizacao ? 'Enviando...' : 'Enviar Pin'}
          </Button>
          <Button
            size="sm"
            onClick={onIniciar}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 mt-2"
          >
            <Play className="mr-1 h-4 w-4" />
            {instalacao.status === 'em_andamento' ? 'Continuar' : 'Iniciar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
