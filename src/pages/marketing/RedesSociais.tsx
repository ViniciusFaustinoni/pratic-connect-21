import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, Facebook, Instagram, Linkedin, Youtube, Twitter,
  Users, Eye, Heart, MessageCircle, RefreshCw, Unlink
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ContaRedesSociaisModal } from '@/components/marketing/ContaRedesSociaisModal';

interface ContaRedeSocial {
  id: string;
  plataforma: 'facebook' | 'instagram' | 'linkedin' | 'youtube' | 'twitter' | 'tiktok';
  nome_conta: string;
  username?: string;
  seguidores: number;
  status: string;
  ultima_sincronizacao?: string;
  created_at: string;
}

interface MetricasRedeSocial {
  id: string;
  conta_id: string;
  periodo: string;
  alcance: number;
  impressoes: number;
  engajamento: number;
  novos_seguidores: number;
  publicacoes: number;
  curtidas: number;
  comentarios: number;
  compartilhamentos: number;
}

const plataformaIcons: Record<string, any> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
  twitter: Twitter,
  tiktok: MessageCircle,
};

const plataformaCores: Record<string, string> = {
  facebook: 'bg-blue-600',
  instagram: 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500',
  linkedin: 'bg-blue-700',
  youtube: 'bg-red-600',
  twitter: 'bg-sky-500',
  tiktok: 'bg-black',
};

const statusConfig: Record<string, { label: string; className: string }> = {
  conectado: { label: 'Conectado', className: 'bg-green-100 text-green-800' },
  desconectado: { label: 'Desconectado', className: 'bg-gray-100 text-gray-800' },
  expirado: { label: 'Token Expirado', className: 'bg-yellow-100 text-yellow-800' },
  erro: { label: 'Erro', className: 'bg-red-100 text-red-800' },
};

export default function RedesSociais() {
  const [showForm, setShowForm] = useState(false);

  const queryClient = useQueryClient();

  const { data: contas, isLoading } = useQuery({
    queryKey: ['redes-sociais-contas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('redes_sociais_contas')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ContaRedeSocial[];
    },
  });

  const { data: metricasMes } = useQuery({
    queryKey: ['redes-sociais-metricas-mes'],
    queryFn: async () => {
      const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const { data, error } = await supabase
        .from('redes_sociais_metricas')
        .select('*')
        .gte('periodo', inicioMes.toISOString().split('T')[0]);
      if (error) throw error;
      return data as MetricasRedeSocial[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('redes_sociais_contas')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['redes-sociais-contas'] });
      toast.success('Conta removida!');
    },
    onError: (error: any) => {
      toast.error('Erro: ' + error.message);
    },
  });

  // Totalizadores
  const totalSeguidores = contas?.reduce((sum, c) => sum + (c.seguidores || 0), 0) || 0;
  const totalAlcance = metricasMes?.reduce((sum, m) => sum + (m.alcance || 0), 0) || 0;
  const totalEngajamento = metricasMes?.reduce((sum, m) => sum + (m.engajamento || 0), 0) || 0;
  const totalPublicacoes = metricasMes?.reduce((sum, m) => sum + (m.publicacoes || 0), 0) || 0;

  // Métricas por conta
  const getMetricasConta = (contaId: string) => {
    const metricas = metricasMes?.filter(m => m.conta_id === contaId) || [];
    return {
      alcance: metricas.reduce((sum, m) => sum + (m.alcance || 0), 0),
      engajamento: metricas.reduce((sum, m) => sum + (m.engajamento || 0), 0),
      novosSeguidores: metricas.reduce((sum, m) => sum + (m.novos_seguidores || 0), 0),
      publicacoes: metricas.reduce((sum, m) => sum + (m.publicacoes || 0), 0),
    };
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Redes Sociais</h1>
          <p className="text-muted-foreground">
            Acompanhe suas métricas de redes sociais
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Conectar Conta
        </Button>
      </div>

      {/* KPIs Consolidados */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Seguidores</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalSeguidores.toLocaleString('pt-BR')}
            </div>
            <p className="text-xs text-muted-foreground">
              em {contas?.length || 0} contas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Alcance (Mês)</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalAlcance.toLocaleString('pt-BR')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Engajamento</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalEngajamento.toLocaleString('pt-BR')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Publicações</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPublicacoes}</div>
            <p className="text-xs text-muted-foreground">este mês</p>
          </CardContent>
        </Card>
      </div>

      {/* Contas Conectadas */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Contas Conectadas</h2>
        
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : contas?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium">Nenhuma conta conectada</p>
              <p className="text-muted-foreground">
                Conecte suas redes sociais para acompanhar métricas
              </p>
              <Button className="mt-4" onClick={() => setShowForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Conectar Conta
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {contas?.map(conta => {
              const Icon = plataformaIcons[conta.plataforma] || Users;
              const metricas = getMetricasConta(conta.id);
              
              return (
                <Card key={conta.id} className="overflow-hidden">
                  <div className={`h-2 ${plataformaCores[conta.plataforma] || 'bg-gray-500'}`} />
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full text-white ${plataformaCores[conta.plataforma] || 'bg-gray-500'}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{conta.nome_conta}</CardTitle>
                          {conta.username && (
                            <CardDescription>@{conta.username}</CardDescription>
                          )}
                        </div>
                      </div>
                      <Badge className={statusConfig[conta.status]?.className}>
                        {statusConfig[conta.status]?.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Seguidores */}
                    <div className="text-center py-2 bg-muted/50 rounded">
                      <p className="text-2xl font-bold">{conta.seguidores.toLocaleString('pt-BR')}</p>
                      <p className="text-xs text-muted-foreground">seguidores</p>
                    </div>

                    {/* Métricas do mês */}
                    <div className="grid grid-cols-2 gap-2 text-center text-sm">
                      <div>
                        <p className="font-medium">{metricas.alcance.toLocaleString('pt-BR')}</p>
                        <p className="text-xs text-muted-foreground">Alcance</p>
                      </div>
                      <div>
                        <p className="font-medium">{metricas.engajamento.toLocaleString('pt-BR')}</p>
                        <p className="text-xs text-muted-foreground">Engajamento</p>
                      </div>
                      <div>
                        <p className="font-medium text-green-600">+{metricas.novosSeguidores}</p>
                        <p className="text-xs text-muted-foreground">Novos</p>
                      </div>
                      <div>
                        <p className="font-medium">{metricas.publicacoes}</p>
                        <p className="text-xs text-muted-foreground">Posts</p>
                      </div>
                    </div>

                    {/* Última sincronização */}
                    {conta.ultima_sincronizacao && (
                      <p className="text-xs text-muted-foreground text-center">
                        Última sync: {format(new Date(conta.ultima_sincronizacao), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </p>
                    )}

                    {/* Ações */}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <RefreshCw className="mr-1 h-3 w-3" />
                        Sincronizar
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => deleteMutation.mutate(conta.id)}
                      >
                        <Unlink className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <ContaRedesSociaisModal
        open={showForm}
        onClose={() => setShowForm(false)}
      />
    </div>
  );
}
