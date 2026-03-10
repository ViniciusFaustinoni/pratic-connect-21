import { useState, useMemo, useRef } from 'react';
import { DollarSign, Plus, Upload, Download, Edit, History, Trash2, Filter, Loader2 } from 'lucide-react';
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
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function TabelaPrecosTab() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [linhaSelecionada, setLinhaSelecionada] = useState<string>('all');
  const [regiaoSelecionada, setRegiaoSelecionada] = useState<string>('all');
  const [planoSelecionado, setPlanoSelecionado] = useState<string>('all');
  const [apenasVigentes, setApenasVigentes] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [faixaEdit, setFaixaEdit] = useState<any>(null);
  const [planoIdParaModal, setPlanoIdParaModal] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [historicoModalOpen, setHistoricoModalOpen] = useState(false);
  const [historicoFaixaId, setHistoricoFaixaId] = useState<string | null>(null);
  const [groupPages, setGroupPages] = useState<Record<string, number>>({});

  // Fetch price rows
  const { data: precos, isLoading } = useQuery({
    queryKey: ['tabela-precos-gc', linhaSelecionada, regiaoSelecionada, apenasVigentes],
    queryFn: async () => {
      let query = supabase
        .from('tabelas_preco_mensalidade')
        .select('*')
        .order('linha_slug')
        .order('fipe_min');
      if (linhaSelecionada !== 'all') query = query.eq('linha_slug', linhaSelecionada);
      if (regiaoSelecionada !== 'all') query = query.eq('regiao', regiaoSelecionada);
      if (apenasVigentes) query = query.eq('is_active', true);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch plans for filter
  const { data: planos } = useQuery({
    queryKey: ['planos-select-gc'],
    queryFn: async () => {
      const { data } = await supabase.from('planos').select('id, codigo, nome').eq('ativo', true).order('nome');
      return data || [];
    },
  });

  // Fetch plano_preco_map to create lookup
  const { data: linhaParaPlanos } = useQuery({
    queryKey: ['linha-planos-lookup'],
    queryFn: async () => {
      const { data } = await supabase.from('plano_preco_map').select('linha_slug, plano_id, planos(nome)');
      const lookup: Record<string, string[]> = {};
      data?.forEach((m: any) => {
        if (!lookup[m.linha_slug]) lookup[m.linha_slug] = [];
        if (m.planos?.nome && !lookup[m.linha_slug].includes(m.planos.nome)) {
          lookup[m.linha_slug].push(m.planos.nome);
        }
      });
      return lookup;
    },
  });

  // Filter by plan - get the linhas for selected plan
  const linhasDoPlano = useMemo(() => {
    if (planoSelecionado === 'all' || !linhaParaPlanos) return null;
    const planoNome = planos?.find(p => p.id === planoSelecionado)?.nome;
    if (!planoNome) return null;
    return Object.entries(linhaParaPlanos)
      .filter(([, nomes]) => nomes.includes(planoNome))
      .map(([slug]) => slug);
  }, [planoSelecionado, linhaParaPlanos, planos]);

  const filteredPrecos = useMemo(() => {
    if (!precos) return [];
    if (!linhasDoPlano) return precos;
    return precos.filter(p => linhasDoPlano.includes(p.linha_slug || ''));
  }, [precos, linhasDoPlano]);

  const linhasUnicas = useMemo(() => {
    if (!precos) return [];
    return Array.from(new Set(precos.map(p => p.linha_slug).filter(Boolean))).sort() as string[];
  }, [precos]);

  const regioesUnicas = useMemo(() => {
    if (!precos) return [];
    return Array.from(new Set(precos.map(p => p.regiao).filter(Boolean))).sort() as string[];
  }, [precos]);

  const deletarFaixa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tabelas_preco_mensalidade').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Faixa excluída!');
      queryClient.invalidateQueries({ queryKey: ['tabela-precos-gc'] });
      setDeleteConfirm(null);
    },
  });

  // Group by linha_slug
  const agrupados = useMemo(() => {
    return filteredPrecos.reduce((acc, p) => {
      const key = p.linha_slug || 'sem-linha';
      if (!acc[key]) acc[key] = [];
      acc[key].push(p);
      return acc;
    }, {} as Record<string, any[]>);
  }, [filteredPrecos]);

  const handleExportar = () => {
    if (!filteredPrecos.length) { toast.warning('Nenhum dado'); return; }
    const csv = [
      ['Linha', 'Região', 'Combustível', 'Tipo Uso', 'FIPE Min', 'FIPE Max', 'Valor Mensal', 'Valor Deságio', 'Ativo'].join(';'),
      ...filteredPrecos.map(p => [
        p.linha_slug || '', p.regiao || '', p.combustivel_tipo || '', p.tipo_uso || '',
        p.fipe_min, p.fipe_max, p.valor_mensal, p.valor_desagio || '', p.is_active ? 'Sim' : 'Não',
      ].join(';'))
    ].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tabela-precos-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    toast.success('Exportado!');
  };

  const handleImportar = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const lines = (e.target?.result as string).split('\n').filter(l => l.trim());
        if (lines.length < 2) { toast.error('Arquivo vazio'); return; }
        let importados = 0, erros = 0;
        for (const line of lines.slice(1)) {
          const cols = line.split(';');
          if (cols.length < 7) { erros++; continue; }
          const { error } = await supabase.from('tabelas_preco_mensalidade').insert({
            linha_slug: cols[0].trim() || null, regiao: cols[1].trim() || null,
            combustivel_tipo: cols[2].trim() || null, tipo_uso: cols[3].trim() || null,
            fipe_min: parseFloat(cols[4]) || 0, fipe_max: parseFloat(cols[5]) || 0,
            valor_mensal: parseFloat(cols[6]) || 0, valor_desagio: cols[7] ? parseFloat(cols[7]) : null,
            is_active: cols[8]?.toLowerCase().includes('sim') ?? true,
          });
          if (error) erros++; else importados++;
        }
        queryClient.invalidateQueries({ queryKey: ['tabela-precos-gc'] });
        toast.success(`${importados} importados, ${erros} erros`);
      } catch { toast.error('Erro ao processar'); }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{filteredPrecos.length} faixas</Badge>
        </div>
        <div className="flex gap-2">
          <input type="file" ref={fileInputRef} accept=".csv" onChange={handleImportar} className="hidden" />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5 mr-1.5" /> Importar
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportar}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Exportar
          </Button>
          <Button size="sm" onClick={() => {
            if (planos?.length) { setPlanoIdParaModal(planos[0].id); setFaixaEdit(null); setModalOpen(true); }
          }}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Nova Faixa
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-card p-3">
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Label className="text-xs">Filtros:</Label>
        </div>
        <Select value={planoSelecionado} onValueChange={setPlanoSelecionado}>
          <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="Plano" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os planos</SelectItem>
            {planos?.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={linhaSelecionada} onValueChange={setLinhaSelecionada}>
          <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Linha" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as linhas</SelectItem>
            {linhasUnicas.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={regiaoSelecionada} onValueChange={setRegiaoSelecionada}>
          <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="Região" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {regioesUnicas.map(r => <SelectItem key={r} value={r}>{r.toUpperCase()}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5">
          <Switch id="vigentes-gc" checked={apenasVigentes} onCheckedChange={setApenasVigentes} />
          <Label htmlFor="vigentes-gc" className="text-xs">Ativos</Label>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : Object.keys(agrupados).length > 0 ? (
        Object.entries(agrupados).map(([linhaSlug, itens]) => {
          const perPage = 30;
          const page = groupPages[linhaSlug] || 0;
          const totalPages = Math.max(1, Math.ceil(itens.length / perPage));
          const safePage = Math.min(page, totalPages - 1);
          const paged = itens.slice(safePage * perPage, (safePage + 1) * perPage);
          const setPage = (p: number) => setGroupPages(prev => ({ ...prev, [linhaSlug]: p }));

          return (
          <div key={linhaSlug} className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{linhaSlug === 'sem-linha' ? 'Sem linha' : linhaSlug}</span>
                <Badge variant="secondary" className="text-xs">{itens.length}</Badge>
              </div>
              {linhaParaPlanos?.[linhaSlug] && (
                <div className="flex gap-1">
                  {linhaParaPlanos[linhaSlug].map(nome => (
                    <Badge key={nome} variant="outline" className="text-xs">{nome}</Badge>
                  ))}
                </div>
              )}
            </div>
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
                {paged.map((p: any) => (
                  <TableRow key={p.id} className={!p.is_active ? 'opacity-50' : ''}>
                    <TableCell className="text-xs font-medium">
                      {formatCurrency(p.fipe_min)} – {formatCurrency(p.fipe_max)}
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{p.regiao?.toUpperCase() || '-'}</Badge></TableCell>
                    <TableCell className="text-xs">{p.combustivel_tipo || '-'}</TableCell>
                    <TableCell className="text-xs">{p.tipo_uso || '-'}</TableCell>
                    <TableCell className="font-semibold text-primary text-xs">{formatCurrency(p.valor_mensal)}</TableCell>
                    <TableCell className="text-xs">{p.valor_desagio ? formatCurrency(p.valor_desagio) : '-'}</TableCell>
                    <TableCell>
                      <Badge variant={p.is_active ? 'default' : 'secondary'} className="text-xs">
                        {p.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => { setFaixaEdit(p); setPlanoIdParaModal(''); setModalOpen(true); }}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => { setHistoricoFaixaId(p.id); setHistoricoModalOpen(true); }}>
                          <History className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                          onClick={() => setDeleteConfirm(p.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {itens.length > perPage && (
              <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/20">
                <p className="text-xs text-muted-foreground">
                  Página {safePage + 1} de {totalPages} · {itens.length} faixas
                </p>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" className="h-7 text-xs" disabled={safePage === 0}
                    onClick={() => setPage(safePage - 1)}>
                    ← Anterior
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs" disabled={safePage >= totalPages - 1}
                    onClick={() => setPage(safePage + 1)}>
                    Próximo →
                  </Button>
                </div>
              </div>
            )}
          </div>
          );
        })
      ) : (
        <div className="rounded-xl border bg-card p-12 text-center">
          <DollarSign className="h-8 w-8 mx-auto text-muted-foreground mb-3 opacity-30" />
          <p className="text-sm text-muted-foreground">Nenhuma faixa de preço encontrada</p>
        </div>
      )}

      <FaixaPrecoModal open={modalOpen} onClose={() => setModalOpen(false)} planoId={planoIdParaModal} faixa={faixaEdit} />
      <HistoricoPrecoModal open={historicoModalOpen} onClose={() => setHistoricoModalOpen(false)} faixaId={historicoFaixaId} />

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && deletarFaixa.mutate(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletarFaixa.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
