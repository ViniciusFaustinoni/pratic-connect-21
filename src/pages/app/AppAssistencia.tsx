import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Phone, 
  Truck, 
  Key, 
  Fuel, 
  Battery, 
  Wrench,
  Clock,
  ChevronRight,
  AlertTriangle,
  MapPin,
  Timer
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useMyChamados } from '@/hooks/useMyData';
import type { Tables } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

type Chamado = Tables<'chamados_assistencia'>;

export default function AppAssistencia() {
  const { data: chamados, isLoading } = useMyChamados();
  const navigate = useNavigate();

  const servicos = [
    { icon: Truck, label: 'Guincho', description: 'Reboque do veículo', tipo: 'guincho' },
    { icon: Key, label: 'Chaveiro', description: 'Abertura de porta', tipo: 'chaveiro' },
    { icon: Fuel, label: 'Pane Seca', description: 'Combustível emergencial', tipo: 'pane_seca' },
    { icon: Battery, label: 'Bateria', description: 'Carga ou troca', tipo: 'bateria' },
    { icon: Wrench, label: 'Pneu', description: 'Troca de pneu', tipo: 'pneu' },
  ];

  const getStatusBadge = (status: Chamado['status']) => {
    switch (status) {
      case 'aberto':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700">Aberto</Badge>;
      case 'em_atendimento':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700">Em Atendimento</Badge>;
      case 'em_deslocamento':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 animate-pulse">Em Deslocamento</Badge>;
      case 'concluido':
        return <Badge variant="outline" className="bg-green-50 text-green-700">Concluído</Badge>;
      case 'cancelado':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700">Cancelado</Badge>;
    }
  };

  // Check if there's an active chamado (not concluded or cancelled)
  const chamadoAtivo = chamados?.find(c => 
    c.status !== 'concluido' && c.status !== 'cancelado'
  );

  const handleServicoClick = (tipo: string) => {
    navigate('/app/assistencia/nova', { state: { tipoServico: tipo } });
  };

  return (
    <div className="space-y-4 p-4 pb-24">
      <div>
        <h1 className="text-xl font-bold text-foreground">Assistência 24h</h1>
        <p className="text-sm text-muted-foreground">
          Solicite serviços de emergência
        </p>
      </div>

      {/* Active Chamado Alert */}
      {chamadoAtivo && (
        <Card className="border-0 shadow-sm bg-gradient-to-r from-blue-50 to-purple-50 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className={cn(
                "rounded-full p-2",
                chamadoAtivo.status === 'em_deslocamento' 
                  ? "bg-purple-100 animate-pulse" 
                  : "bg-blue-100"
              )}>
                {chamadoAtivo.status === 'em_deslocamento' ? (
                  <Truck className="h-5 w-5 text-purple-600" />
                ) : (
                  <Clock className="h-5 w-5 text-blue-600" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-foreground">
                    Chamado #{chamadoAtivo.protocolo}
                  </p>
                  {getStatusBadge(chamadoAtivo.status)}
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {chamadoAtivo.tipo_servico}
                </p>
                
                {/* ETA or status message */}
                {chamadoAtivo.status === 'em_deslocamento' && (
                  <div className="flex items-center gap-2 text-sm text-purple-700 bg-purple-100/50 rounded-lg px-3 py-2">
                    <Timer className="h-4 w-4" />
                    <span className="font-medium">Chegada estimada: ~15 min</span>
                  </div>
                )}
                
                {chamadoAtivo.status === 'em_atendimento' && chamadoAtivo.prestador_nome && (
                  <div className="text-sm text-blue-700 bg-blue-100/50 rounded-lg px-3 py-2">
                    <p className="font-medium">{chamadoAtivo.prestador_nome}</p>
                    {chamadoAtivo.prestador_telefone && (
                      <a 
                        href={`tel:${chamadoAtivo.prestador_telefone}`}
                        className="underline"
                      >
                        {chamadoAtivo.prestador_telefone}
                      </a>
                    )}
                  </div>
                )}
                
                <Link to={`/app/assistencia/${chamadoAtivo.id}`}>
                  <Button variant="outline" size="sm" className="mt-3 w-full">
                    <MapPin className="h-4 w-4 mr-2" />
                    Acompanhar
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Emergency Call Button */}
      <Card className="border-0 bg-destructive text-destructive-foreground shadow-sm">
        <CardContent className="p-4">
          <Button 
            className="w-full bg-white text-destructive hover:bg-white/90"
            size="lg"
            onClick={() => window.open('tel:08001234567')}
          >
            <Phone className="mr-2 h-5 w-5" />
            Ligar Agora - 0800 123 4567
          </Button>
          <p className="mt-2 text-center text-sm opacity-90">
            Atendimento 24 horas, 7 dias por semana
          </p>
        </CardContent>
      </Card>

      {/* Services Grid */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Serviços Disponíveis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {servicos.map((servico) => (
              <button
                key={servico.label}
                className="flex flex-col items-center gap-2 rounded-lg border bg-card p-4 text-center transition-all hover:bg-muted active:scale-95"
                onClick={() => handleServicoClick(servico.tipo)}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <servico.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{servico.label}</p>
                  <p className="text-xs text-muted-foreground">{servico.description}</p>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* My Chamados */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Meus Chamados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !chamados || chamados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="rounded-full bg-muted p-4 mb-3">
                <Clock className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="font-medium text-foreground mb-1">
                Nenhum chamado registrado
              </p>
              <p className="text-sm text-muted-foreground text-center">
                Seus chamados de assistência aparecerão aqui
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {chamados.map((chamado) => (
                <Link key={chamado.id} to={`/app/assistencia/${chamado.id}`}>
                  <div className={cn(
                    "flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted",
                    chamado.status !== 'concluido' && chamado.status !== 'cancelado' && "ring-1 ring-primary/20"
                  )}>
                    <div>
                      <p className="font-medium text-foreground">
                        #{chamado.protocolo}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {chamado.tipo_servico}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(chamado.data_abertura).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(chamado.status)}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* FAB Emergency Button */}
      <Button
        className="fixed bottom-24 right-4 h-14 w-14 rounded-full shadow-lg bg-destructive hover:bg-destructive/90 z-50"
        onClick={() => window.open('tel:08001234567')}
      >
        <AlertTriangle className="h-6 w-6" />
        <span className="sr-only">Emergência</span>
      </Button>
    </div>
  );
}
