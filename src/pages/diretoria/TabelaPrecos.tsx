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

interface FaixaMensalidade {
  id: string;
  linha_slug: string | null;
  regiao: string | null;
  combustivel_tipo: string | null;
  tipo_uso: string | null;
  fipe_min: number;
  fipe_max: number;
  valor_mensal: number;
  valor_desagio: number | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export default function TabelaPrecos() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [linhaSelecionada, setLinhaSelecionada] = useState<string>('all');
  const [regiaoSelecionada, setRegiaoSelecionada] = useState<string>('all');
  const [apenasVigentes, setApenasVigentes] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [faixaEdit, setFaixaEdit] = useState<FaixaMensalidade | null>(null);
  const [planoIdParaModal, setPlanoIdParaModal] = useState<string>('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [historicoModalOpen, setHistoricoModalOpen] = useState(false);
  const [historicoFaixaId, setHistoricoFaixaId] = useState<string | null>(null);

  // Buscar faixas de preço da nova tabela
  const { data: precos, isLoading } = useQuery({
    queryKey: ['tabela-precos-mensalidade', linhaSelecionada, regiaoSelecionada, apenasVigentes],
    queryFn: async () => {
      let query = supabase
        .from('tabelas_preco_mensalidade')
        .select('*')
        .order('linha_slug')
        .order('fipe_min');
      
      if (linhaSelecionada && linhaSelecionada !== 'all') {
        query = query.eq('linha_slug', linhaSelecionada);
      }

      if (regiaoSelecionada && regiaoSelecionada !== 'all') {
        query = query.eq('regiao', regiaoSelecionada);
      }
      
      if (apenasVigentes) {
        query = query.eq('is_active', true);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as FaixaMensalidade[];
    }
  });

  // Buscar planos para o modal (mapear plano → linha)
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

  // Linhas únicas para filtro
  const linhasUnicas = useMemo(() => {
    if (!precos) return [];
    const slugs = new Set(precos.map(p => p.linha_slug).filter(Boolean));
    return Array.from(slugs).sort() as string[];
  }, [precos]);

  // Regiões únicas para filtro
  const regioesUnicas = useMemo(() => {
    if (!precos) return [];
    const regioes = new Set(precos.map(p => p.regiao).filter(Boolean));
    return Array.from(regioes).sort() as string[];
  }, [precos]);

  const deletarFaixaMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tabelas_preco_mensalidade')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Faixa de preço excluída!');
      queryClient.invalidateQueries({ queryKey: ['tabela-precos-mensalidade'] });
      queryClient.invalidateQueries({ queryKey: ['tabelas_preco_mensalidade'] });
      setDeleteConfirm(null);
    },
    onError: (error) => {
      console.error('Erro ao excluir:', error);
      toast.error('Erro ao excluir faixa de preço');
    },
  });

  // Agrupar por linha_slug
  const precosAgrupados = useMemo(() => {
    if (!precos) return {};
    return precos.reduce((acc, preco) => {
      const key = preco.linha_slug || 'sem-linha';
      if (!acc[key]) {
        acc[key] = {
          linha_slug: preco.linha_slug,
          itens: []
        };
      }
      acc[key].itens.push(preco);
      return acc;
    }, {} as Record<string, { linha_slug: string | null; itens: FaixaMensalidade[] }>);
  }, [precos]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handleExportar = () => {
    if (!precos?.length) {
      toast.warning('Nenhum dado para exportar');
      return;
    }
    
    const csv = [
      ['Linha', 'Região', 'Combustível', 'Tipo Uso', 'FIPE Min', 'FIPE Max', 'Valor Mensal', 'Valor Deságio', 'Ativo'].join(';'),
      ...precos.map(p => [
        p.linha_slug || '',
        p.regiao || '',
        p.combustivel_tipo || '',
        p.tipo_uso || '',
        p.fipe_min,
        p.fipe_max,
        p.valor_mensal,
        p.valor_desagio || '',
        p.is_active ? 'Sim' : 'Não'
      ].join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tabela-precos-mensalidade-${format(new Date(), 'yyyy-MM-dd')}.csv`;
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
        
        const dataLines = lines.slice(1);
        let importados = 0;
        let erros = 0;
        
        for (const line of dataLines) {
          const cols = line.split(';');
          if (cols.length < 7) {
            erros++;
            continue;
          }
          
          const { error } = await supabase
            .from('tabelas_preco_mensalidade')
            .insert({
              linha_slug: cols[0].trim() || null,
              regiao: cols[1].trim() || null,
              combustivel_tipo: cols[2].trim() || null,
              tipo_uso: cols[3].trim() || null,
              fipe_min: parseFloat(cols[4]) || 0,
              fipe_max: parseFloat(cols[5]) || 0,
              valor_mensal: parseFloat(cols[6]) || 0,
              valor_desagio: cols[7] ? parseFloat(cols[7]) : null,
              is_active: cols[8]?.toLowerCase().includes('sim') ?? true,
            });
          
          if (error) {
            erros++;
          } else {
            importados++;
          }
        }
        
        queryClient.invalidateQueries({ queryKey: ['tabela-precos-mensalidade'] });
        queryClient.invalidateQueries({ queryKey: ['tabelas_preco_mensalidade'] });
        toast.success(`Importação concluída: ${importados} registros importados, ${erros} erros`);
      } catch (error) {
        console.error('Erro na importação:', error);
        toast.error('Erro ao processar arquivo');
      }
    };
    reader.readAsText(file);
    
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
          {precos && (
            <Badge variant="secondary">{precos.length} faixas</Badge>
          )}
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
              <Label htmlFor="linha-select" className="text-sm text-muted-foreground">Linha:</Label>
              <Select value={linhaSelecionada} onValueChange={setLinhaSelecionada}>
                <SelectTrigger id="linha-select" className="w-[180px]">
                  <SelectValue placeholder="Todas as linhas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as linhas</SelectItem>
                  {linhasUnicas.map(slug => (
                    <SelectItem key={slug} value={slug}>
                      {slug}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Label htmlFor="regiao-select" className="text-sm text-muted-foreground">Região:</Label>
              <Select value={regiaoSelecionada} onValueChange={setRegiaoSelecionada}>
                <SelectTrigger id="regiao-select" className="w-[140px]">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {regioesUnicas.map(r => (
                    <SelectItem key={r} value={r}>
                      {r.toUpperCase()}
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
              <Label htmlFor="apenas-vigentes" className="text-sm">Apenas ativos</Label>
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
        Object.entries(precosAgrupados).map(([key, { linha_slug, itens }]) => (
          <Card key={key}>
            <CardHeader className="py-3 bg-muted/50">
              <CardTitle className="text-base font-medium">
                {linha_slug || 'Sem linha'}
                <Badge variant="secondary" className="ml-2">{itens.length} faixas</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Faixa FIPE</TableHead>
                    <TableHead>Região</TableHead>
                    <TableHead>Combustível</TableHead>
                    <TableHead>Tipo Uso</TableHead>
                    <TableHead>Valor Mensal</TableHead>
                    <TableHead>Valor Deságio</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((preco) => (
                    <TableRow key={preco.id} className={!preco.is_active ? 'opacity-60' : ''}>
                      <TableCell className="font-medium">
                        {formatCurrency(preco.fipe_min)} - {formatCurrency(preco.fipe_max)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{preco.regiao?.toUpperCase() || '-'}</Badge>
                      </TableCell>
                      <TableCell>
                        {preco.combustivel_tipo || <span className="text-muted-foreground text-xs">NULL</span>}
                      </TableCell>
                      <TableCell>{preco.tipo_uso || '-'}</TableCell>
                      <TableCell className="font-semibold text-primary">
                        {formatCurrency(preco.valor_mensal)}
                      </TableCell>
                      <TableCell>
                        {preco.valor_desagio ? formatCurrency(preco.valor_desagio) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={preco.is_active ? 'default' : 'secondary'}>
                          {preco.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => {
                              setFaixaEdit(preco);
                              setPlanoIdParaModal('');
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
            Comece criando sua primeira faixa de preço.
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
