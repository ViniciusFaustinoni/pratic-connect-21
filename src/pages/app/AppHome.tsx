import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useMyAssociado, useMyVehicles, useMyVehicleWithTracker } from '@/hooks/useMyData';
import { Car, Wifi, WifiOff, Calendar, CreditCard } from 'lucide-react';

const statusConfig: Record<string, { label: string; className: string }> = {
  ativo: { label: 'Ativo', className: 'bg-green-100 text-green-800 border-green-200' },
  inadimplente: { label: 'Inadimplente', className: 'bg-red-100 text-red-800 border-red-200' },
  suspenso: { label: 'Suspenso', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  em_analise: { label: 'Em Análise', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  documentacao_pendente: { label: 'Documentação Pendente', className: 'bg-orange-100 text-orange-800 border-orange-200' },
  aguardando_instalacao: { label: 'Aguardando Instalação', className: 'bg-purple-100 text-purple-800 border-purple-200' },
  cancelado: { label: 'Cancelado', className: 'bg-gray-100 text-gray-800 border-gray-200' },
};

export default function AppHome() {
  const { profile } = useAuth();
  const { data: associado, isLoading: associadoLoading } = useMyAssociado();
  const { data: vehicles, isLoading: vehiclesLoading } = useMyVehicles();
  const { data: tracker, isLoading: trackerLoading } = useMyVehicleWithTracker();
  
  const firstName = profile?.nome?.split(' ')[0] || 'Associado';
  const vehicle = vehicles?.[0];
  const isOnline = tracker?.status === 'instalado' && tracker?.ultima_comunicacao;
  const status = associado?.status || 'em_analise';
  const statusInfo = statusConfig[status] || statusConfig.em_analise;

  // Mock data for next payment (would come from boletos table)
  const nextPayment = {
    value: 189.90,
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  };

  return (
    <div className="space-y-4 p-4">
      {/* Welcome */}
      <div className="flex items-center gap-2">
        <span className="text-2xl">👋</span>
        <h1 className="text-xl font-bold text-foreground">Olá, {firstName}!</h1>
      </div>

      {/* Card 1: Situação */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Situação</p>
          {associadoLoading ? (
            <Skeleton className="mt-2 h-6 w-24" />
          ) : (
            <div className="mt-2">
              <Badge variant="outline" className={statusInfo.className}>
                {statusInfo.label}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card 2: Próximo Vencimento */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Próximo Vencimento</p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {nextPayment.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
              <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>Vence em {nextPayment.dueDate.toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 3: Meu Veículo */}
      <Card className="border-0 shadow-sm">
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Car className="h-6 w-6 text-primary" />
          </div>
          {vehiclesLoading ? (
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
          ) : vehicle ? (
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Meu Veículo</p>
              <p className="text-xl font-bold tracking-wider text-foreground">
                {vehicle.placa}
              </p>
              <p className="text-sm text-muted-foreground">
                {vehicle.marca} {vehicle.modelo}
              </p>
            </div>
          ) : (
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Meu Veículo</p>
              <p className="font-medium text-foreground">Nenhum veículo</p>
              <p className="text-sm text-muted-foreground">
                Veículo não cadastrado
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card 4: Rastreador */}
      <Card className="border-0 shadow-sm">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            {trackerLoading ? (
              <>
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </>
            ) : tracker ? (
              <>
                <div className={`h-3 w-3 rounded-full ${isOnline ? 'animate-pulse bg-green-500' : 'bg-red-500'}`} />
                <div>
                  <p className="text-sm text-muted-foreground">Rastreador</p>
                  <p className={`font-semibold ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                    {isOnline ? 'Online' : 'Offline'}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="h-3 w-3 rounded-full bg-muted" />
                <div>
                  <p className="text-sm text-muted-foreground">Rastreador</p>
                  <p className="font-semibold text-muted-foreground">Não instalado</p>
                </div>
              </>
            )}
          </div>
          {tracker && (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/50">
              {isOnline ? (
                <Wifi className="h-5 w-5 text-green-600" />
              ) : (
                <WifiOff className="h-5 w-5 text-red-600" />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}