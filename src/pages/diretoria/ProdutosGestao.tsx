import { useState } from 'react';
import { Package, Plus, Edit, DollarSign, Shield, Users, Star, MoreVertical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ProdutoFormModal } from '@/components/diretoria';

const tipoVeiculoConfig: Record<string, { label: string; class: string }> = {
  carro: { label: 'Carro', class: 'bg-blue-100 text-blue-800' },
  moto: { label: 'Moto', class: 'bg-orange-100 text-orange-800' },
  caminhao: { label: 'Caminhão', class: 'bg-gray-100 text-gray-800' },
  van: { label: 'Van', class: 'bg-purple-100 text-purple-800' },
  utilitario: { label: 'Utilitário', class: 'bg-green-100 text-green-800' },
};

const usoConfig: Record<string, { label: string; class: string }> = {
  particular: { label: 'Particular', class: 'bg-green-100 text-green-800' },
  aplicativo: { label: 'Aplicativo', class: 'bg-yellow-100 text-yellow-800' },
  comercial: { label: 'Comercial', class: 'bg-blue-100 text-blue-800' },
  taxi: { label: 'Táxi', class: 'bg-purple-100 text-purple-800' },
  frota: { label: 'Frota', class: 'bg-gray-100 text-gray-800' },
};

export default function ProdutosGestao() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [produtoEdit, setProdutoEdit] = useState<any>(null);

  const { data: planos, isLoading } = useQuery({
    queryKey: ['planos-gestao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planos')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data;
    }
  });

  const { data: coberturasPorPlano } = useQuery({
    queryKey: ['planos-coberturas-count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planos_coberturas')
        .select('plano_id');
      if (error) throw error;
      
      const contagem: Record<string, number> = {};
      data?.forEach(pc => {
        contagem[pc.plano_id] = (contagem[pc.plano_id] || 0) + 1;
      });
      return contagem;
    }
  });

  // Buscar preços via plano_preco_map → tabelas_preco_mensalidade
  const { data: precosPorPlano } = useQuery({
    queryKey: ['planos-precos-info'],
    queryFn: async () => {
      // Get all mappings
      const { data: mappings, error: mapError } = await supabase
        .from('plano_preco_map')
        .select('plano_id, linha_slug');
      if (mapError) throw mapError;

      // Get all active price rows
      const { data: precos, error: precoError } = await supabase
        .from('tabelas_preco_mensalidade')
        .select('linha_slug, fipe_min, fipe_max')
        .eq('is_active', true);
      if (precoError) throw precoError;

      // Group price info by linha_slug
      const porLinha: Record<string, { count: number; minFipe: number; maxFipe: number }> = {};
      precos?.forEach(p => {
        const slug = p.linha_slug || '';
        if (!porLinha[slug]) {
          porLinha[slug] = { count: 0, minFipe: Infinity, maxFipe: 0 };
        }
        porLinha[slug].count++;
        porLinha[slug].minFipe = Math.min(porLinha[slug].minFipe, Number(p.fipe_min));
        porLinha[slug].maxFipe = Math.max(porLinha[slug].maxFipe, Number(p.fipe_max));
      });

      // Map back to plano_id
      const info: Record<string, { count: number; minFipe: number; maxFipe: number }> = {};
      mappings?.forEach(m => {
        const linhaInfo = porLinha[m.linha_slug];
        if (linhaInfo) {
          info[m.plano_id] = linhaInfo;
        }
      });

      return info;
    }
  });

  const { data: estatisticas } = useQuery({
    queryKey: ['planos-estatisticas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('associados')
        .select('plano_id')
        .eq('status', 'ativo');
      if (error) throw error;
      
      const contagem: Record<string, number> = {};
      data?.forEach(a => {
        if (a.plano_id) {
          contagem[a.plano_id] = (contagem[a.plano_id] || 0) + 1;
        }
      });
      return contagem;
    }
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('planos')
        .update({ ativo })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planos-gestao'] });
      toast.success('Status atualizado!');
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    }
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Gestão de Produtos</h1>
        </div>
        <Button onClick={() => { setProdutoEdit(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Produto
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {planos?.map(plano => {
          const tipoConfig = tipoVeiculoConfig[plano.tipo_veiculo || ''] || { label: plano.tipo_veiculo, class: 'bg-gray-100 text-gray-800' };
          const usoConfigItem = usoConfig[plano.uso || ''] || { label: plano.uso, class: 'bg-gray-100 text-gray-800' };
          const coberturasCount = coberturasPorPlano?.[plano.id] || 0;
          const precosInfo = precosPorPlano?.[plano.id];
          const associadosCount = estatisticas?.[plano.id] || 0;

          return (
            <Card key={plano.id} className={`relative ${!plano.ativo ? 'opacity-60' : ''}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    {plano.destaque && (
                      <Badge className="bg-yellow-100 text-yellow-800 mb-1">
                        <Star className="h-3 w-3 mr-1" />
                        Destaque
                      </Badge>
                    )}
                    <p className="text-xs text-muted-foreground">{plano.codigo}</p>
                    <CardTitle className="text-lg">{plano.nome}</CardTitle>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setProdutoEdit(plano); setModalOpen(true); }}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/diretoria/produtos/${plano.id}?tab=precos`)}>
                        <DollarSign className="h-4 w-4 mr-2" />
                        Preços
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/diretoria/produtos/${plano.id}?tab=coberturas`)}>
                        <Shield className="h-4 w-4 mr-2" />
                        Coberturas
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {plano.tipo_veiculo && (
                    <Badge variant="secondary" className={tipoConfig.class}>
                      {tipoConfig.label}
                    </Badge>
                  )}
                  {plano.uso && (
                    <Badge variant="secondary" className={usoConfigItem.class}>
                      {usoConfigItem.label}
                    </Badge>
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  {precosInfo && precosInfo.minFipe !== Infinity && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Faixa FIPE:</span>
                      <span className="font-medium">
                        {formatCurrency(precosInfo.minFipe)} a {formatCurrency(precosInfo.maxFipe)}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      Coberturas:
                    </span>
                    <span className="font-medium">{coberturasCount} inclusas</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      Faixas de preço:
                    </span>
                    <span className="font-medium">{precosInfo?.count || 0}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Associados:
                    </span>
                    <span className="font-medium">{associadosCount} ativos</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm text-muted-foreground">Ativo</span>
                  <Switch
                    checked={plano.ativo}
                    onCheckedChange={(checked) => toggleAtivo.mutate({ id: plano.id, ativo: checked })}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {planos?.length === 0 && (
        <Card className="p-12 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhum produto cadastrado</h3>
          <p className="text-muted-foreground mb-4">
            Comece criando seu primeiro plano de proteção.
          </p>
        <Button onClick={() => { setProdutoEdit(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Produto
        </Button>
      </Card>
    )}

    <ProdutoFormModal
      open={modalOpen}
      onClose={() => setModalOpen(false)}
      produto={produtoEdit}
    />
  </div>
);
}
