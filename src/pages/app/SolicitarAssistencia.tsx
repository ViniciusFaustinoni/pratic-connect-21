import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMyAssociado } from '@/hooks/useMyData';
import {
  ArrowLeft, Truck, Key, Circle, Fuel, Battery,
  HelpCircle, Phone, ChevronRight, AlertCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const tiposAssistencia = [
  { id: 'reboque', icon: Truck, label: 'Reboque/Guincho', descricao: 'Veículo não anda, precisa de guincho' },
  { id: 'chaveiro', icon: Key, label: 'Chaveiro', descricao: 'Chave trancada, perdida ou quebrada' },
  { id: 'troca_pneu', icon: Circle, label: 'Troca de Pneu', descricao: 'Pneu furado, troca no local' },
  { id: 'pane_seca', icon: Fuel, label: 'Falta de Combustível', descricao: 'Ficou sem gasolina/etanol' },
  { id: 'bateria', icon: Battery, label: 'Bateria', descricao: 'Bateria descarregada, carga ou troca' },
  { id: 'outro', icon: HelpCircle, label: 'Outros', descricao: 'Outro tipo de assistência' },
];

const getStatusBadge = (status: string) => {
  const config: Record<string, { label: string; className: string }> = {
    aberto: { label: 'Aberto', className: 'bg-yellow-100 text-yellow-800' },
    aguardando_prestador: { label: 'Aguardando', className: 'bg-orange-100 text-orange-800' },
    prestador_despachado: { label: 'Despachado', className: 'bg-blue-100 text-blue-800' },
    prestador_a_caminho: { label: 'A Caminho', className: 'bg-purple-100 text-purple-800' },
    em_atendimento: { label: 'Em Atendimento', className: 'bg-indigo-100 text-indigo-800' },
  };
  return config[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
};

const getTipoLabel = (tipoId: string) => {
  const tipo = tiposAssistencia.find(t => t.id === tipoId);
  return tipo?.label || tipoId;
};

export default function SolicitarAssistencia() {
  const navigate = useNavigate();
  const { data: associado } = useMyAssociado();

  const { data: chamadoAberto } = useQuery({
    queryKey: ['meu-chamado-aberto', associado?.id],
    queryFn: async () => {
      if (!associado?.id) return null;
      const { data, error } = await supabase
        .from('chamados_assistencia')
        .select('id, protocolo, status, tipo_servico')
        .eq('associado_id', associado.id)
        .in('status', ['aberto', 'aguardando_prestador', 'prestador_despachado', 'prestador_a_caminho', 'em_atendimento'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!associado?.id,
  });

  const handleTipoClick = (tipoId: string) => {
    navigate('/app/assistencia/nova', { state: { tipoServico: tipoId } });
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/home')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Assistência 24h</h1>
      </div>

      <div className="flex-1 p-4 pb-24 space-y-6">
        {/* Alerta de Chamado Aberto */}
        {chamadoAberto && (
          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-yellow-100">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-yellow-800">Você já tem um chamado em aberto</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    {chamadoAberto.protocolo} - {getTipoLabel(chamadoAberto.tipo_servico)}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={getStatusBadge(chamadoAberto.status).className}>
                      {getStatusBadge(chamadoAberto.status).label}
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 border-yellow-300 text-yellow-800 hover:bg-yellow-100"
                    onClick={() => navigate(`/app/assistencia/${chamadoAberto.id}`)}
                  >
                    Ver meu chamado
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lista de Tipos de Assistência */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">O que aconteceu?</h2>
          
          <div className="space-y-3">
            {tiposAssistencia.map((tipo) => {
              const Icon = tipo.icon;
              return (
                <Card
                  key={tipo.id}
                  className={cn(
                    "cursor-pointer transition-all",
                    "hover:bg-muted active:scale-[0.98]",
                    chamadoAberto && "opacity-50 pointer-events-none"
                  )}
                  onClick={() => !chamadoAberto && handleTipoClick(tipo.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-full bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{tipo.label}</p>
                        <p className="text-sm text-muted-foreground">{tipo.descricao}</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Separador */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-sm text-muted-foreground">ou</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Card Ligar para Central */}
        <a href="tel:08001234567" className="block">
          <Card className="bg-green-50 border-green-200 hover:bg-green-100 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-green-100">
                  <Phone className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-green-800">Ligar para central</p>
                  <p className="text-lg font-semibold text-green-700">0800 123 4567</p>
                  <p className="text-xs text-green-600">Atendimento 24h</p>
                </div>
                <ChevronRight className="h-5 w-5 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </a>

        {/* Aviso */}
        <p className="text-xs text-muted-foreground text-center">
          Assistência disponível 24 horas, 7 dias por semana
        </p>
      </div>
    </div>
  );
}
