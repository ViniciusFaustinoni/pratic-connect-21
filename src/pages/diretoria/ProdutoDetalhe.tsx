import { useState } from 'react';
import { ArrowLeft, Package, Shield, DollarSign, BarChart3, Edit, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  VincularCoberturaModal, 
  FaixaPrecoModal, 
  ProdutoFormModal,
  EditarCoberturaVinculadaModal 
} from '@/components/diretoria';

interface PlanoCobertura {
  id: string;
  plano_id: string;
  cobertura_id: string;
  percentual_cobertura: number | null;
  valor_limite: number | null;
  franquia_percentual: number | null;
  franquia_valor: number | null;
  carencia_dias: number | null;
  obrigatoria: boolean | null;
  cobertura: {
    id: string;
    nome: string;
    descricao: string | null;
    tipo: string;
    percentual_cobertura: number | null;
    carencia_dias: number | null;
  } | null;
}

interface TabelaPreco {
  id: string;
  plano_id: string;
  fipe_de: number;
  fipe_ate: number;
  valor_cota: number;
  taxa_administrativa: number | null;
  valor_rastreamento: number | null;
  valor_assistencia: number | null;
  taxa_aplicativo: number | null;
  taxa_comercial: number | null;
  valor_adesao?: number | null;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  ativo: boolean;
}

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

const tipoCoberturaConfig: Record<string, { label: string; class: string }> = {
  colisao: { label: 'Colisão', class: 'bg-red-100 text-red-800' },
  roubo_furto: { label: 'Roubo/Furto', class: 'bg-orange-100 text-orange-800' },
  incendio: { label: 'Incêndio', class: 'bg-yellow-100 text-yellow-800' },
  terceiros: { label: 'Terceiros', class: 'bg-blue-100 text-blue-800' },
  vidros: { label: 'Vidros', class: 'bg-cyan-100 text-cyan-800' },
  assistencia: { label: 'Assistência', class: 'bg-green-100 text-green-800' },
  outros: { label: 'Outros', class: 'bg-gray-100 text-gray-800' },
};

export default function ProdutoDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const defaultTab = searchParams.get('tab') || 'informacoes';

  // Estados dos modais
  const [modalCoberturaOpen, setModalCoberturaOpen] = useState(false);
  const [modalEditCoberturaOpen, setModalEditCoberturaOpen] = useState(false);
  const [modalFaixaOpen, setModalFaixaOpen] = useState(false);
  const [modalProdutoOpen, setModalProdutoOpen] = useState(false);
  const [faixaEdit, setFaixaEdit] = useState<TabelaPreco | null>(null);
  const [coberturaEdit, setCoberturaEdit] = useState<PlanoCobertura | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ tipo: 'cobertura' | 'preco'; id: string; nome: string } | null>(null);

  const { data: plano, isLoading: loadingPlano } = useQuery({
    queryKey: ['plano', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planos')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  const { data: coberturas, isLoading: loadingCoberturas } = useQuery({
    queryKey: ['plano-coberturas', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planos_coberturas')
        .select(`
          *,
          cobertura:coberturas(*)
        `)
        .eq('plano_id', id);
      if (error) throw error;
      return data as PlanoCobertura[];
    },
    enabled: !!id
  });

  const { data: precos, isLoading: loadingPrecos } = useQuery({
    queryKey: ['plano-precos', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tabelas_preco')
        .select('*')
        .eq('plano_id', id)
        .eq('ativo', true)
        .order('fipe_de');
      if (error) throw error;
      return data as TabelaPreco[];
    },
    enabled: !!id
  });

  const { data: estatisticas } = useQuery({
    queryKey: ['plano-stats', id],
    queryFn: async () => {
      const mesAtual = new Date();
      const inicioMes = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), 1);
      
      const [associadosResult, sinistrosResult, receitaResult] = await Promise.all([
        supabase.from('associados').select('*', { count: 'exact', head: true }).eq('plano_id', id).eq('status', 'ativo'),
        supabase.from('sinistros').select('valor_indenizacao').in('status', ['aprovado', 'indenizado']),
        supabase.from('cobrancas').select('valor_pago, associado_id').eq('status', 'pago').gte('data_pagamento', inicioMes.toISOString().split('T')[0])
      ]);

      const { data: associadosPlano } = await supabase
        .from('associados')
        .select('id')
        .eq('plano_id', id);
      
      const associadoIds = new Set(associadosPlano?.map(a => a.id) || []);
      const receitaFiltrada = receitaResult.data?.filter(r => associadoIds.has(r.associado_id)).reduce((sum, r) => sum + (r.valor_pago || 0), 0) || 0;
      const totalSinistros = sinistrosResult.data?.reduce((sum, s) => sum + (s.valor_indenizacao || 0), 0) || 0;

      return {
        associadosAtivos: associadosResult.count || 0,
        totalSinistros,
        receitaMes: receitaFiltrada,
        sinistralidade: receitaFiltrada > 0 ? (totalSinistros / receitaFiltrada) * 100 : 0
      };
    },
    enabled: !!id
  });

  const toggleAtivo = useMutation({
    mutationFn: async (ativo: boolean) => {
      const { error } = await supabase
        .from('planos')
        .update({ ativo })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plano', id] });
      toast.success('Status atualizado!');
    }
  });

  // Mutation para remover cobertura
  const removerCobertura = useMutation({
    mutationFn: async (coberturaId: string) => {
      const { error } = await supabase
        .from('planos_coberturas')
        .delete()
        .eq('id', coberturaId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Cobertura removida!');
      queryClient.invalidateQueries({ queryKey: ['plano-coberturas', id] });
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover: ' + error.message);
    }
  });

  // Mutation para remover faixa de preço
  const removerPreco = useMutation({
    mutationFn: async (precoId: string) => {
      const { error } = await supabase
        .from('tabelas_preco')
        .delete()
        .eq('id', precoId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Faixa de preço removida!');
      queryClient.invalidateQueries({ queryKey: ['plano-precos', id] });
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover: ' + error.message);
    }
  });

  const handleConfirmDelete = () => {
    if (!itemToDelete) return;
    if (itemToDelete.tipo === 'cobertura') {
      removerCobertura.mutate(itemToDelete.id);
    } else {
      removerPreco.mutate(itemToDelete.id);
    }
  };

  const handleEditCobertura = (pc: PlanoCobertura) => {
    setCoberturaEdit(pc);
    setModalEditCoberturaOpen(true);
  };

  const handleDeleteCobertura = (pc: PlanoCobertura) => {
    setItemToDelete({ 
      tipo: 'cobertura', 
      id: pc.id, 
      nome: pc.cobertura?.nome || 'Cobertura' 
    });
    setDeleteConfirmOpen(true);
  };

  const handleEditPreco = (preco: TabelaPreco) => {
    setFaixaEdit(preco);
    setModalFaixaOpen(true);
  };

  const handleDeletePreco = (preco: TabelaPreco) => {
    setItemToDelete({ 
      tipo: 'preco', 
      id: preco.id, 
      nome: `${formatCurrency(preco.fipe_de)} - ${formatCurrency(preco.fipe_ate)}` 
    });
    setDeleteConfirmOpen(true);
  };

  const handleNovaFaixa = () => {
    setFaixaEdit(null);
    setModalFaixaOpen(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (loadingPlano) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!plano) {
    return (
      <div className="text-center py-12">
        <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">Produto não encontrado</h3>
        <Button variant="link" onClick={() => navigate('/diretoria/produtos')}>
          Voltar para lista
        </Button>
      </div>
    );
  }

  const tipoConfig = tipoVeiculoConfig[plano.tipo_veiculo || ''] || { label: plano.tipo_veiculo, class: 'bg-gray-100 text-gray-800' };
  const usoConfigItem = usoConfig[plano.uso || ''] || { label: plano.uso, class: 'bg-gray-100 text-gray-800' };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/diretoria/produtos')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <p className="text-sm text-muted-foreground">{plano.codigo}</p>
            <h1 className="text-2xl font-bold">{plano.nome}</h1>
          </div>
          <div className="flex gap-2 ml-4">
            {plano.tipo_veiculo && (
              <Badge className={tipoConfig.class}>{tipoConfig.label}</Badge>
            )}
            {plano.uso && (
              <Badge className={usoConfigItem.class}>{usoConfigItem.label}</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Ativo</span>
            <Switch
              checked={plano.ativo}
              onCheckedChange={(checked) => toggleAtivo.mutate(checked)}
            />
          </div>
          <Button onClick={() => setModalProdutoOpen(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="informacoes">
            <Package className="h-4 w-4 mr-2" />
            Informações
          </TabsTrigger>
          <TabsTrigger value="coberturas">
            <Shield className="h-4 w-4 mr-2" />
            Coberturas
          </TabsTrigger>
          <TabsTrigger value="precos">
            <DollarSign className="h-4 w-4 mr-2" />
            Tabela de Preços
          </TabsTrigger>
          <TabsTrigger value="estatisticas">
            <BarChart3 className="h-4 w-4 mr-2" />
            Estatísticas
          </TabsTrigger>
        </TabsList>

        {/* Tab Informações */}
        <TabsContent value="informacoes">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Dados Básicos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Código</p>
                    <p className="font-medium">{plano.codigo}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Nome</p>
                    <p className="font-medium">{plano.nome}</p>
                  </div>
                </div>
                {plano.descricao && (
                  <div>
                    <p className="text-sm text-muted-foreground">Descrição</p>
                    <p className="font-medium">{plano.descricao}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Configurações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Tipo Veículo</p>
                    <Badge className={tipoConfig.class}>{tipoConfig.label || '-'}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Uso</p>
                    <Badge className={usoConfigItem.class}>{usoConfigItem.label || '-'}</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">FIPE Mínima</p>
                    <p className="font-medium">{plano.fipe_minima ? formatCurrency(plano.fipe_minima) : '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">FIPE Máxima</p>
                    <p className="font-medium">{plano.fipe_maxima ? formatCurrency(plano.fipe_maxima) : '-'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Ano Fabricação Mín.</p>
                    <p className="font-medium">{plano.ano_fabricacao_minimo || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Ano Fabricação Máx.</p>
                    <p className="font-medium">{plano.ano_fabricacao_maximo || '-'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab Coberturas */}
        <TabsContent value="coberturas">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Coberturas Vinculadas</CardTitle>
              <Button size="sm" onClick={() => setModalCoberturaOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Cobertura
              </Button>
            </CardHeader>
            <CardContent>
              {loadingCoberturas ? (
                <Skeleton className="h-32" />
              ) : coberturas && coberturas.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>% Cobertura</TableHead>
                      <TableHead>Franquia</TableHead>
                      <TableHead>Carência</TableHead>
                      <TableHead>Obrigatória</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coberturas.map((pc) => {
                      const tipoCobertura = tipoCoberturaConfig[pc.cobertura?.tipo || ''] || { label: pc.cobertura?.tipo, class: 'bg-gray-100 text-gray-800' };
                      return (
                        <TableRow key={pc.id}>
                          <TableCell className="font-medium">{pc.cobertura?.nome}</TableCell>
                          <TableCell>
                            <Badge className={tipoCobertura.class}>{tipoCobertura.label}</Badge>
                          </TableCell>
                          <TableCell>{pc.percentual_cobertura || pc.cobertura?.percentual_cobertura || 100}%</TableCell>
                          <TableCell>
                            {pc.franquia_valor ? formatCurrency(pc.franquia_valor) : 
                             pc.franquia_percentual ? `${pc.franquia_percentual}%` : '-'}
                          </TableCell>
                          <TableCell>{pc.carencia_dias || pc.cobertura?.carencia_dias || 0} dias</TableCell>
                          <TableCell>
                            <Badge variant={pc.obrigatoria ? 'default' : 'secondary'}>
                              {pc.obrigatoria ? 'Sim' : 'Não'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => handleEditCobertura(pc)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-destructive"
                                onClick={() => handleDeleteCobertura(pc)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma cobertura vinculada</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Preços */}
        <TabsContent value="precos">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Faixas de Preço</CardTitle>
              <Button size="sm" onClick={handleNovaFaixa}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Faixa
              </Button>
            </CardHeader>
            <CardContent>
              {loadingPrecos ? (
                <Skeleton className="h-32" />
              ) : precos && precos.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Faixa FIPE</TableHead>
                      <TableHead>Valor Cota</TableHead>
                      <TableHead>Taxa Admin</TableHead>
                      <TableHead>Rastreamento</TableHead>
                      <TableHead>Assistência</TableHead>
                      <TableHead>Taxa App</TableHead>
                      <TableHead>Vigência</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {precos.map((preco) => (
                      <TableRow key={preco.id}>
                        <TableCell className="font-medium">
                          {formatCurrency(preco.fipe_de)} - {formatCurrency(preco.fipe_ate)}
                        </TableCell>
                        <TableCell>{formatCurrency(preco.valor_cota)}</TableCell>
                        <TableCell>{preco.taxa_administrativa ? formatCurrency(preco.taxa_administrativa) : '-'}</TableCell>
                        <TableCell>{preco.valor_rastreamento ? formatCurrency(preco.valor_rastreamento) : '-'}</TableCell>
                        <TableCell>{preco.valor_assistencia ? formatCurrency(preco.valor_assistencia) : '-'}</TableCell>
                        <TableCell>{preco.taxa_aplicativo ? formatCurrency(preco.taxa_aplicativo) : '-'}</TableCell>
                        <TableCell>
                          {preco.vigencia_inicio ? new Date(preco.vigencia_inicio).toLocaleDateString('pt-BR') : '-'}
                          {preco.vigencia_fim ? ` - ${new Date(preco.vigencia_fim).toLocaleDateString('pt-BR')}` : ''}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => handleEditPreco(preco)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive"
                              onClick={() => handleDeletePreco(preco)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma faixa de preço cadastrada</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Estatísticas */}
        <TabsContent value="estatisticas">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Associados Ativos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{estatisticas?.associadosAtivos || 0}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Receita Mensal</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-600">
                  {formatCurrency(estatisticas?.receitaMes || 0)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Sinistros</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-red-600">
                  {formatCurrency(estatisticas?.totalSinistros || 0)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Sinistralidade</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${(estatisticas?.sinistralidade || 0) > 70 ? 'text-red-600' : (estatisticas?.sinistralidade || 0) > 50 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {(estatisticas?.sinistralidade || 0).toFixed(1)}%
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modais */}
      <VincularCoberturaModal
        open={modalCoberturaOpen}
        onClose={() => setModalCoberturaOpen(false)}
        planoId={id || ''}
      />

      <EditarCoberturaVinculadaModal
        open={modalEditCoberturaOpen}
        onClose={() => {
          setModalEditCoberturaOpen(false);
          setCoberturaEdit(null);
        }}
        cobertura={coberturaEdit}
        planoId={id || ''}
      />

      <FaixaPrecoModal
        open={modalFaixaOpen}
        onClose={() => {
          setModalFaixaOpen(false);
          setFaixaEdit(null);
        }}
        planoId={id || ''}
        faixa={faixaEdit}
      />

      <ProdutoFormModal
        open={modalProdutoOpen}
        onClose={() => setModalProdutoOpen(false)}
        produto={plano}
      />

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {itemToDelete?.tipo === 'cobertura' ? 'a cobertura' : 'a faixa de preço'}{' '}
              <strong>{itemToDelete?.nome}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
