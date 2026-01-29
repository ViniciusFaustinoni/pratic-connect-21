import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Plug, 
  CreditCard, 
  MessageCircle, 
  Navigation, 
  Check, 
  X, 
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface IntegracaoStatus {
  nome: string;
  slug: string;
  icone: React.ReactNode;
  status: 'conectado' | 'desconectado' | 'configurar';
  descricao: string;
}

export function IntegracoesStatusCard() {
  const navigate = useNavigate();

  // Verificar ASAAS
  const { data: asaasConfig, isLoading: loadingAsaas } = useQuery({
    queryKey: ['asaas-config-status'],
    queryFn: async () => {
      const { data } = await supabase
        .from('asaas_config')
        .select('chave, valor')
        .eq('chave', 'api_key')
        .maybeSingle();
      return data;
    },
  });

  // Verificar WhatsApp (via configurações)
  const { data: evolutionConfig, isLoading: loadingEvolution } = useQuery({
    queryKey: ['evolution-config-status'],
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'evolution_api_key')
        .maybeSingle();
      return data?.valor ? true : false;
    },
  });

  // Verificar Sascar
  const { data: sascarConfig, isLoading: loadingSascar } = useQuery({
    queryKey: ['sascar-config-status'],
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'sascar_api_key')
        .maybeSingle();
      return data?.valor ? true : false;
    },
  });

  const isLoading = loadingAsaas || loadingEvolution || loadingSascar;

  const integracoes: IntegracaoStatus[] = [
    {
      nome: 'ASAAS',
      slug: 'asaas',
      icone: <CreditCard className="h-5 w-5" />,
      status: asaasConfig?.valor ? 'conectado' : 'desconectado',
      descricao: 'Gateway de pagamentos e cobranças',
    },
    {
      nome: 'WhatsApp (Evolution API)',
      slug: 'whatsapp',
      icone: <MessageCircle className="h-5 w-5" />,
      status: evolutionConfig ? 'conectado' : 'configurar',
      descricao: 'Comunicação via WhatsApp',
    },
    {
      nome: 'Sascar',
      slug: 'sascar',
      icone: <Navigation className="h-5 w-5" />,
      status: sascarConfig ? 'conectado' : 'configurar',
      descricao: 'Integração de rastreadores',
    },
  ];

  const getStatusBadge = (status: IntegracaoStatus['status']) => {
    switch (status) {
      case 'conectado':
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            <Check className="h-3 w-3 mr-1" />
            Conectado
          </Badge>
        );
      case 'desconectado':
        return (
          <Badge variant="destructive">
            <X className="h-3 w-3 mr-1" />
            Desconectado
          </Badge>
        );
      case 'configurar':
        return (
          <Badge variant="secondary">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Configurar
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5" />
            Integrações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const conectados = integracoes.filter((i) => i.status === 'conectado').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-5 w-5" />
              Integrações
            </CardTitle>
            <CardDescription>
              {conectados}/{integracoes.length} serviços conectados
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/configuracoes/integracoes')}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Gerenciar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {integracoes.map((integracao) => (
          <div
            key={integracao.slug}
            className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                {integracao.icone}
              </div>
              <div>
                <p className="font-medium">{integracao.nome}</p>
                <p className="text-xs text-muted-foreground">{integracao.descricao}</p>
              </div>
            </div>
            {getStatusBadge(integracao.status)}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
