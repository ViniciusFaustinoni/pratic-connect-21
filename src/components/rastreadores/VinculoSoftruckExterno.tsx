import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Car, User, Building2, MessageCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface VinculoSoftruckExternoProps {
  rastreadorId: string;
  imei?: string | null;
  vehicleId?: string | null;
}

interface Vinculo {
  veiculo?: { placa?: string; marca?: string; modelo?: string; cor?: string; ano?: number; chassi?: string; grupo?: string } | null;
  motorista?: { nome?: string; documento?: string; telefone?: string } | null;
  cliente?: { nome?: string; documento?: string; email?: string; telefone?: string } | null;
  dispositivo?: { imei?: string; modelo?: string } | null;
}

function onlyDigits(s?: string | null) {
  return (s || '').replace(/\D/g, '');
}

function whatsappLink(tel?: string | null) {
  const d = onlyDigits(tel);
  if (!d) return null;
  const withCc = d.startsWith('55') ? d : `55${d}`;
  return `https://wa.me/${withCc}`;
}

export function VinculoSoftruckExterno({ rastreadorId, imei, vehicleId }: VinculoSoftruckExternoProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['softruck-vinculo-externo', rastreadorId, vehicleId, imei],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('softruck-detalhes-vinculo', {
        body: { rastreador_id: rastreadorId, vehicle_id: vehicleId ?? undefined, imei: imei ?? undefined },
      });
      if (error) throw error;
      return data as { success: boolean; found: boolean; vinculo: Vinculo | null };
    },
    enabled: !!rastreadorId,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 rounded-lg border border-dashed">
        <Loader2 className="h-4 w-4 animate-spin" />
        Buscando vínculo na Softruck...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <span>Falha ao consultar a Softruck.</span>
      </div>
    );
  }

  if (!data?.found || !data?.vinculo) return null;

  const { veiculo, motorista, cliente } = data.vinculo;
  const tel = motorista?.telefone || cliente?.telefone;
  const wa = whatsappLink(tel);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <Car className="h-4 w-4" />
          Vínculo na Softruck
        </h3>
        <Badge variant="outline" className="text-[10px] uppercase">externo</Badge>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Este rastreador não está vinculado a um veículo no nosso sistema, mas existe vínculo ativo na plataforma Softruck:
      </p>

      {veiculo && (
        <div className="p-3 rounded-lg bg-muted/40 space-y-1 text-sm">
          {veiculo.placa && (
            <div className="flex justify-between"><span className="text-muted-foreground">Placa:</span><span className="font-semibold">{veiculo.placa}</span></div>
          )}
          {(veiculo.marca || veiculo.modelo) && (
            <div className="flex justify-between"><span className="text-muted-foreground">Veículo:</span><span>{[veiculo.marca, veiculo.modelo, veiculo.ano].filter(Boolean).join(' ')}</span></div>
          )}
          {veiculo.cor && <div className="flex justify-between"><span className="text-muted-foreground">Cor:</span><span>{veiculo.cor}</span></div>}
          {veiculo.chassi && <div className="flex justify-between"><span className="text-muted-foreground">Chassi:</span><span className="font-mono text-xs">{veiculo.chassi}</span></div>}
          {veiculo.grupo && <div className="flex justify-between"><span className="text-muted-foreground">Grupo:</span><span>{veiculo.grupo}</span></div>}
        </div>
      )}

      {motorista?.nome && (
        <div className="p-3 rounded-lg bg-muted/40 space-y-1 text-sm">
          <div className="flex items-center gap-2 font-medium"><User className="h-4 w-4 text-muted-foreground" />{motorista.nome}</div>
          {motorista.documento && <div className="text-xs text-muted-foreground">Doc: {motorista.documento}</div>}
          {motorista.telefone && <div className="text-xs text-muted-foreground">Tel: {motorista.telefone}</div>}
        </div>
      )}

      {cliente?.nome && (
        <div className="p-3 rounded-lg bg-muted/40 space-y-1 text-sm">
          <div className="flex items-center gap-2 font-medium"><Building2 className="h-4 w-4 text-muted-foreground" />{cliente.nome}</div>
          {cliente.documento && <div className="text-xs text-muted-foreground">Doc: {cliente.documento}</div>}
          {cliente.email && <div className="text-xs text-muted-foreground">{cliente.email}</div>}
          {cliente.telefone && <div className="text-xs text-muted-foreground">Tel: {cliente.telefone}</div>}
        </div>
      )}

      {wa && (
        <Button asChild variant="outline" size="sm" className="w-full">
          <a href={wa} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="mr-2 h-4 w-4" />WhatsApp
          </a>
        </Button>
      )}

      <p className="text-[11px] text-muted-foreground italic">
        Dados consultados em tempo real na Softruck — não criam veículo automaticamente. Use "Vincular a Veículo" abaixo para vincular ao cadastro local.
      </p>
    </div>
  );
}
