import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMyAssociado } from '@/hooks/useMyData';
import { ArrowLeft, Phone, ChevronRight, Inbox } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const tiposAssistencia: Record<string, string> = {
  reboque: 'Reboque/Guincho',
  chaveiro: 'Chaveiro',
  troca_pneu: 'Troca de Pneu',
  pane_seca: 'Falta de Combustível',
  bateria: 'Bateria',
  outro: 'Outros',
};

const getStatusBadge = (status: string) => {
  const config: Record<string, { label: string; className: string }> = {
    aberto: { label: 'Aberto', className: 'bg-yellow-100 text-yellow-800' },
    aguardando_prestador: { label: 'Aguardando', className: 'bg-orange-100 text-orange-800' },
    prestador_despachado: { label: 'Despachado', className: 'bg-blue-100 text-blue-800' },
    prestador_a_caminho: { label: 'A Caminho', className: 'bg-purple-100 text-purple-800' },
    em_atendimento: { label: 'Em Atendimento', className: 'bg-indigo-100 text-indigo-800' },
    concluido: { label: 'Concluído', className: 'bg-green-100 text-green-800' },
    cancelado_associado: { label: 'Cancelado', className: 'bg-red-100 text-red-800' },
    cancelado_sistema: { label: 'Cancelado', className: 'bg-red-100 text-red-800' },
  };
  return config[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
};

export default function HistoricoChamados() {
  const navigate = useNavigate();
  const { data: associado } = useMyAssociado();

  const { data: chamados, isLoading } = useQuery({
    queryKey: ['meus-chamados-historico', associado?.id],
    queryFn: async () => {
      if (!associado?.id) return [];
      const { data, error } = await supabase
        .from('chamados_assistencia')
        .select(`
          id, protocolo, tipo_servico, status, data_abertura,
          veiculo:veiculos(placa, marca, modelo)
        `)
        .eq('associado_id', associado.id)
        .order('data_abertura', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!associado?.id,
  });

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/assistencia')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Meus Chamados</h1>
      </div>

      <div className="flex-1 p-4 pb-24 space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : chamados && chamados.length > 0 ? (
          <div className="space-y-3">
            {chamados.map((chamado) => {
              const statusInfo = getStatusBadge(chamado.status);
              const veiculo = chamado.veiculo as { placa: string; marca: string; modelo: string } | null;
              
              return (
                <Card
                  key={chamado.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/app/assistencia/${chamado.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-full bg-primary/10 mt-0.5">
                          <Phone className="h-4 w-4 text-primary" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium text-sm">{chamado.protocolo}</p>
                          <p className="text-sm text-muted-foreground">
                            {tiposAssistencia[chamado.tipo_servico] || chamado.tipo_servico}
                          </p>
                          {veiculo && (
                            <p className="text-xs text-muted-foreground">
                              {veiculo.marca} {veiculo.modelo} - {veiculo.placa}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(chamado.data_abertura), "dd 'de' MMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Inbox className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-lg">Nenhum chamado</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Você ainda não solicitou nenhuma assistência
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => navigate('/app/assistencia')}
            >
              Solicitar assistência
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
