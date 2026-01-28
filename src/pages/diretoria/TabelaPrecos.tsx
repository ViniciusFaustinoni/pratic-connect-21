import { useState, useMemo, useRef } from 'react';
import { DollarSign, Plus, Upload, Download, Edit, History, Trash2, Filter, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FaixaPrecoModal, HistoricoPrecoModal } from '@/components/diretoria';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [planoSelecionado, setPlanoSelecionado] = useState<string>('all');
  const [apenasVigentes, setApenasVigentes] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [faixaEdit, setFaixaEdit] = useState<TabelaPrecoComPlano | null>(null);
  const [planoIdParaModal, setPlanoIdParaModal] = useState<string>('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [historicoModalOpen, setHistoricoModalOpen] = useState(false);
  const [historicoFaixaId, setHistoricoFaixaId] = useState<string | null>(null);

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

  const deletarFaixaMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tabelas_preco')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Faixa de preço excluída!');
      queryClient.invalidateQueries({ queryKey: ['tabela-precos'] });
      setDeleteConfirm(null);
    },
    onError: (error) => {
      console.error('Erro ao excluir:', error);
      toast.error('Erro ao excluir faixa de preço');
    },
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

  const handleExportar = () => {
    if (!precos?.length) {
      toast.warning('Nenhum dado para exportar');
      return;
    }
    
    const csv = [
      ['Plano', 'FIPE De', 'FIPE Até', 'Valor Cota', 'Taxa Admin', 'Rastreamento', 'Assistência', 'Taxa App', 'Taxa Comercial', 'Vigência Início', 'Vigência Fim', 'Ativo'].join(';'),
      ...precos.map(p => [
        p.plano?.nome || '',
        p.fipe_de,
        p.fipe_ate,
        p.valor_cota,
        p.taxa_administrativa || '',
        p.valor_rastreamento || '',
        p.valor_assistencia || '',
        p.taxa_aplicativo || '',
        p.taxa_comercial || '',
        p.vigencia_inicio || '',
        p.vigencia_fim || '',
        p.ativo ? 'Sim' : 'Não'
      ].join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tabela-precos-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Tabela exportada!');
  };

  const handleImportar = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const lines = content.split('\n').filter(l => l.trim());
        
        if (lines.length < 2) {
          toast.error('Arquivo vazio ou inválido');
          return;
        }
        
        // Pular cabeçalho
        const dataLines = lines.slice(1);
        let importados = 0;
        let erros = 0;
        
        for (const line of dataLines) {
          const cols = line.split(';');
          if (cols.length < 4) {
            erros++;
            continue;
          }
          
          // Buscar plano pelo nome
          const planoNome = cols[0].trim();
          const plano = planos?.find(p => p.nome === planoNome);
          
          if (!plano) {
            erros++;
            continue;
          }
          
          const { error } = await supabase
            .from('tabelas_preco')
            .insert({
              plano_id: plano.id,
              fipe_de: parseFloat(cols[1]) || 0,
              fipe_ate: parseFloat(cols[2]) || 0,
              valor_cota: parseFloat(cols[3]) || 0,
              taxa_administrativa: cols[4] ? parseFloat(cols[4]) : null,
              valor_rastreamento: cols[5] ? parseFloat(cols[5]) : null,
              valor_assistencia: cols[6] ? parseFloat(cols[6]) : null,
              taxa_aplicativo: cols[7] ? parseFloat(cols[7]) : null,
              taxa_comercial: cols[8] ? parseFloat(cols[8]) : null,
              vigencia_inicio: cols[9] || null,
              vigencia_fim: cols[10] || null,
              ativo: cols[11]?.toLowerCase().includes('sim') ?? true,
            });
          
          if (error) {
            erros++;
          } else {
            importados++;
          }
        }
        
        queryClient.invalidateQueries({ queryKey: ['tabela-precos'] });
        toast.success(`Importação concluída: ${importados} registros importados, ${erros} erros`);
      } catch (error) {
        console.error('Erro na importação:', error);
        toast.error('Erro ao processar arquivo');
      }
    };
    reader.readAsText(file);
    
    // Limpar input para permitir reimportar mesmo arquivo
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
          <input
            type="file"
            ref={fileInputRef}
            accept=".csv"
            onChange={handleImportar}
            className="hidden"
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Importar
          </Button>
          <Button variant="outline" onClick={handleExportar}>
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
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => {
                              setHistoricoFaixaId(preco.id);
                              setHistoricoModalOpen(true);
                            }}
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive"
                            onClick={() => setDeleteConfirm(preco.id)}
                          >
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

      {/* Modal de Edição/Criação */}
      <FaixaPrecoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        planoId={planoIdParaModal}
        faixa={faixaEdit}
      />

      {/* Modal de Histórico */}
      <HistoricoPrecoModal
        open={historicoModalOpen}
        onClose={() => setHistoricoModalOpen(false)}
        faixaId={historicoFaixaId}
      />

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta faixa de preço? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteConfirm && deletarFaixaMutation.mutate(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletarFaixaMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
