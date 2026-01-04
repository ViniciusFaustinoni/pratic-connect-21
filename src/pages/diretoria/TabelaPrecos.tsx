import { useState, useMemo } from 'react';
import { DollarSign, Plus, Upload, Download, Edit, History, Trash2, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FaixaPrecoModal } from '@/components/diretoria';

interface TabelaPrecoComPlano {
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
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  ativo: boolean;
  plano: {
    codigo: string;
    nome: string;
  } | null;
}

export default function TabelaPrecos() {
  const [planoSelecionado, setPlanoSelecionado] = useState<string>('all');
  const [apenasVigentes, setApenasVigentes] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [faixaEdit, setFaixaEdit] = useState<TabelaPrecoComPlano | null>(null);
  const [planoIdParaModal, setPlanoIdParaModal] = useState<string>('');

  const { data: precos, isLoading } = useQuery({
    queryKey: ['tabela-precos', planoSelecionado, apenasVigentes],
    queryFn: async () => {
      let query = supabase
        .from('tabelas_preco')
        .select(`
          *,
          plano:planos(codigo, nome)
        `)
        .order('plano_id')
        .order('fipe_de');
      
      if (planoSelecionado && planoSelecionado !== 'all') {
        query = query.eq('plano_id', planoSelecionado);
      }
      
      if (apenasVigentes) {
        query = query.eq('ativo', true);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as TabelaPrecoComPlano[];
    }
  });

  const { data: planos } = useQuery({
    queryKey: ['planos-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planos')
        .select('id, codigo, nome')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data;
    }
  });

  const precosAgrupados = useMemo(() => {
    if (!precos) return {};
    return precos.reduce((acc, preco) => {
      const planoId = preco.plano_id;
      if (!acc[planoId]) {
        acc[planoId] = {
          plano: preco.plano,
          itens: []
        };
      }
      acc[planoId].itens.push(preco);
      return acc;
    }, {} as Record<string, { plano: { codigo: string; nome: string } | null; itens: TabelaPrecoComPlano[] }>);
  }, [precos]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DollarSign className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Tabela de Preços</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Importar
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button 
            onClick={() => { 
              if (planoSelecionado && planoSelecionado !== 'all') {
                setPlanoIdParaModal(planoSelecionado);
                setFaixaEdit(null);
                setModalOpen(true);
              } else if (planos?.length) {
                setPlanoIdParaModal(planos[0].id);
                setFaixaEdit(null);
                setModalOpen(true);
              }
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Faixa
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Label>Filtros:</Label>
            </div>
            
            <div className="flex items-center gap-2">
              <Label htmlFor="plano-select" className="text-sm text-muted-foreground">Produto:</Label>
              <Select value={planoSelecionado} onValueChange={setPlanoSelecionado}>
                <SelectTrigger id="plano-select" className="w-[200px]">
                  <SelectValue placeholder="Todos os produtos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os produtos</SelectItem>
                  {planos?.map(plano => (
                    <SelectItem key={plano.id} value={plano.id}>
                      {plano.codigo} - {plano.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="apenas-vigentes"
                checked={apenasVigentes}
                onCheckedChange={setApenasVigentes}
              />
              <Label htmlFor="apenas-vigentes" className="text-sm">Apenas vigentes</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-64" />
          </CardContent>
        </Card>
      ) : Object.keys(precosAgrupados).length > 0 ? (
        Object.entries(precosAgrupados).map(([planoId, { plano, itens }]) => (
          <Card key={planoId}>
            <CardHeader className="py-3 bg-muted/50">
              <CardTitle className="text-base font-medium">
                {plano?.codigo} - {plano?.nome}
                <Badge variant="secondary" className="ml-2">{itens.length} faixas</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Faixa FIPE</TableHead>
                    <TableHead>Valor Cota</TableHead>
                    <TableHead>Taxa Admin</TableHead>
                    <TableHead>Rastreamento</TableHead>
                    <TableHead>Assistência</TableHead>
                    <TableHead>Taxa App</TableHead>
                    <TableHead>Taxa Comercial</TableHead>
                    <TableHead>Vigência</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[120px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((preco) => (
                    <TableRow key={preco.id} className={!preco.ativo ? 'opacity-60' : ''}>
                      <TableCell className="font-medium">
                        {formatCurrency(preco.fipe_de)} - {formatCurrency(preco.fipe_ate)}
                      </TableCell>
                      <TableCell className="font-semibold text-primary">
                        {formatCurrency(preco.valor_cota)}
                      </TableCell>
                      <TableCell>
                        {preco.taxa_administrativa ? formatCurrency(preco.taxa_administrativa) : '-'}
                      </TableCell>
                      <TableCell>
                        {preco.valor_rastreamento ? formatCurrency(preco.valor_rastreamento) : '-'}
                      </TableCell>
                      <TableCell>
                        {preco.valor_assistencia ? formatCurrency(preco.valor_assistencia) : '-'}
                      </TableCell>
                      <TableCell>
                        {preco.taxa_aplicativo ? formatCurrency(preco.taxa_aplicativo) : '-'}
                      </TableCell>
                      <TableCell>
                        {preco.taxa_comercial ? formatCurrency(preco.taxa_comercial) : '-'}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {formatDate(preco.vigencia_inicio)}
                          {preco.vigencia_fim ? ` - ${formatDate(preco.vigencia_fim)}` : ' - Sem fim'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={preco.ativo ? 'default' : 'secondary'}>
                          {preco.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => {
                              setPlanoIdParaModal(preco.plano_id);
                              setFaixaEdit(preco);
                              setModalOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <History className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      ) : (
        <Card className="p-12 text-center">
          <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhuma faixa de preço encontrada</h3>
          <p className="text-muted-foreground mb-4">
            {planoSelecionado !== 'all' ? 'Não há faixas de preço para este produto.' : 'Comece criando sua primeira faixa de preço.'}
          </p>
        <Button 
          onClick={() => {
            if (planos?.length) {
              setPlanoIdParaModal(planos[0].id);
              setFaixaEdit(null);
              setModalOpen(true);
            }
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Faixa
        </Button>
      </Card>
    )}

    <FaixaPrecoModal
      open={modalOpen}
      onClose={() => setModalOpen(false)}
      planoId={planoIdParaModal}
      faixa={faixaEdit}
    />
  </div>
);
}
