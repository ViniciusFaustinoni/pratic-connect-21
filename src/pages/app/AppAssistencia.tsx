import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Phone, 
  Truck, 
  Key, 
  Fuel, 
  Battery, 
  Wrench,
  Clock,
  ChevronRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface Chamado {
  id: string;
  protocolo: string;
  tipo: string;
  status: 'aberto' | 'em_atendimento' | 'concluido';
  dataAbertura: Date;
}

export default function AppAssistencia() {
  // Mock data
  const chamados: Chamado[] = [];

  const servicos = [
    { icon: Truck, label: 'Guincho', description: 'Reboque do veículo' },
    { icon: Key, label: 'Chaveiro', description: 'Abertura de porta' },
    { icon: Fuel, label: 'Pane Seca', description: 'Combustível emergencial' },
    { icon: Battery, label: 'Bateria', description: 'Carga ou troca' },
    { icon: Wrench, label: 'Pneu', description: 'Troca de pneu' },
  ];

  const getStatusBadge = (status: Chamado['status']) => {
    switch (status) {
      case 'aberto':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700">Aberto</Badge>;
      case 'em_atendimento':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700">Em Atendimento</Badge>;
      case 'concluido':
        return <Badge variant="outline" className="bg-green-50 text-green-700">Concluído</Badge>;
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">Assistência 24h</h1>
        <p className="text-sm text-muted-foreground">
          Solicite serviços de emergência
        </p>
      </div>

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
                className="flex flex-col items-center gap-2 rounded-lg border bg-card p-4 text-center transition-colors hover:bg-muted"
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

      {/* Active Chamados */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Meus Chamados</CardTitle>
        </CardHeader>
        <CardContent>
          {chamados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Clock className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                Nenhum chamado em aberto
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {chamados.map((chamado) => (
                <Link key={chamado.id} to={`/app/assistencia/${chamado.id}`}>
                  <div className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted">
                    <div>
                      <p className="font-medium text-foreground">
                        #{chamado.protocolo}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {chamado.tipo}
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
    </div>
  );
}
