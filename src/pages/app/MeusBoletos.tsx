import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, AlertCircle, CheckCircle, Clock, ChevronRight, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useMinhasCobrancas } from '@/hooks/useCobrancas';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
  aguardando_pagamento: { label: 'Pendente', variant: 'secondary', icon: Clock },
  pago: { label: 'Pago', variant: 'default', icon: CheckCircle },
  vencido: { label: 'Vencido', variant: 'destructive', icon: AlertCircle },
  cancelado: { label: 'Cancelado', variant: 'outline', icon: FileText },
};

const tipoLabels: Record<string, string> = {
  mensalidade: 'Mensalidade',
  adesao: 'Adesão',
  taxa_instalacao: 'Taxa de Instalação',
  taxa_vistoria: 'Taxa de Vistoria',
  participacao_sinistro: 'Participação Sinistro',
  avulso: 'Avulso',
};

export default function MeusBoletos() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('pendentes');
  const { data: cobrancas, isLoading } = useMinhasCobrancas();

  const pendentes = cobrancas?.filter(c => c.status === 'aguardando_pagamento' || c.status === 'vencido') || [];
  const pagas = cobrancas?.filter(c => c.status === 'pago') || [];

  const proximoVencimento = pendentes
    .filter(c => c.status === 'aguardando_pagamento')
    .sort((a, b) => new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime())[0];

  const totalEmAberto = pendentes.reduce((acc, c) => acc + (Number(c.valor_final) || 0), 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStatus = (cobranca: any) => {
    if (cobranca.status === 'pago') return 'pago';
    if (cobranca.status === 'cancelado') return 'cancelado';
    if (isPast(new Date(cobranca.data_vencimento)) && !isToday(new Date(cobranca.data_vencimento))) {
      return 'vencido';
    }
    return 'aguardando_pagamento';
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Boletos</h1>
        <p className="text-sm text-muted-foreground">Gerencie suas mensalidades</p>
      </div>

      {/* Card Resumo */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total em aberto</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(totalEmAberto)}</p>
            </div>
            {proximoVencimento && (
              <div className="text-right space-y-1">
                <p className="text-xs text-muted-foreground">Próximo vencimento</p>
                <div className="flex items-center gap-1 text-sm font-medium">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(proximoVencimento.data_vencimento), "dd/MM", { locale: ptBR })}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pendentes" className="gap-2">
            <Clock className="h-4 w-4" />
            Pendentes ({pendentes.length})
          </TabsTrigger>
          <TabsTrigger value="pagos" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Pagos ({pagas.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes" className="mt-4 space-y-3">
          {pendentes.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-2" />
                <p className="font-medium">Tudo em dia!</p>
                <p className="text-sm text-muted-foreground">Você não tem boletos pendentes.</p>
              </CardContent>
            </Card>
          ) : (
            pendentes.map(cobranca => {
              const status = getStatus(cobranca);
              const config = statusConfig[status];
              const StatusIcon = config.icon;

              return (
                <Card 
                  key={cobranca.id} 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/app/boletos/${cobranca.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${status === 'vencido' ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                          <StatusIcon className={`h-5 w-5 ${status === 'vencido' ? 'text-destructive' : 'text-primary'}`} />
                        </div>
                        <div>
                          <p className="font-medium">{tipoLabels[cobranca.tipo] || cobranca.tipo}</p>
                          <p className="text-sm text-muted-foreground">
                            Venc: {format(new Date(cobranca.data_vencimento), "dd/MM/yyyy")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="font-bold">{formatCurrency(Number(cobranca.valor_final))}</p>
                          <Badge variant={config.variant} className="text-xs">
                            {config.label}
                          </Badge>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="pagos" className="mt-4 space-y-3">
          {pagas.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="font-medium">Nenhum boleto pago</p>
                <p className="text-sm text-muted-foreground">Seus boletos pagos aparecerão aqui.</p>
              </CardContent>
            </Card>
          ) : (
            pagas.map(cobranca => (
              <Card 
                key={cobranca.id} 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate(`/app/boletos/${cobranca.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-green-500/10">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      </div>
                      <div>
                        <p className="font-medium">{tipoLabels[cobranca.tipo] || cobranca.tipo}</p>
                        <p className="text-sm text-muted-foreground">
                          Pago em {format(new Date(cobranca.data_pagamento!), "dd/MM/yyyy")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="font-bold text-green-600">{formatCurrency(Number(cobranca.valor_pago))}</p>
                        <Badge variant="default" className="text-xs bg-green-500">
                          Pago
                        </Badge>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
