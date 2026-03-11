import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRegioes, useCreateRegiao, useUpdateRegiao, useDeleteRegiao, useToggleRegiaoStatus, Regiao, RegiaoInput } from '@/hooks/useRegioes';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Edit, Trash2, MapPin, Loader2, X, Search, Building2, ShieldCheck, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

// Map region codes to slugs used in tabelas_preco_mensalidade
const REGION_CODE_TO_SLUG: Record<string, string> = {
  'RJ': 'rj',
  'LAGOS': 'lagos',
  'SP': 'sp',
};

function useRegionPriceCounts() {
  return useQuery({
    queryKey: ['region-price-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tabelas_preco_mensalidade')
        .select('regiao, linha_slug')
        .eq('is_active', true);

      if (error) throw error;

      // Group by region -> set of linha_slugs + count
      const map: Record<string, { total: number; linhas: Set<string> }> = {};
      data?.forEach((row) => {
        if (!map[row.regiao]) map[row.regiao] = { total: 0, linhas: new Set() };
        map[row.regiao].total++;
        if (row.linha_slug) map[row.regiao].linhas.add(row.linha_slug);
      });

      return map;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function RegioesConfig() {
  const { isDiretor, isDesenvolvedor } = usePermissions();
  const podeEditar = isDiretor || isDesenvolvedor;
  
  const { data: regioes, isLoading } = useRegioes();
  const { data: priceCounts } = useRegionPriceCounts();
  const updateRegiao = useUpdateRegiao();
  const deleteRegiao = useDeleteRegiao();
  const toggleStatus = useToggleRegiaoStatus();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingRegiao, setEditingRegiao] = useState<Regiao | null>(null);
  const [deletingRegiao, setDeletingRegiao] = useState<Regiao | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form state
  const [formData, setFormData] = useState<RegiaoInput>({
    codigo: '',
    nome: '',
    descricao: '',
    cidades: [],
    multiplicador_preco: 1.00,
    ativa: true,
    ordem: 0,
    exigir_titularidade_comprovante: false,
  });
  const [novaCidade, setNovaCidade] = useState('');

  const resetForm = () => {
    setFormData({
      codigo: '',
      nome: '',
      descricao: '',
      cidades: [],
      multiplicador_preco: 1.00,
      ativa: true,
      ordem: 0,
      exigir_titularidade_comprovante: false,
    });
    setNovaCidade('');
    setEditingRegiao(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (regiao: Regiao) => {
    setEditingRegiao(regiao);
    setFormData({
      codigo: regiao.codigo,
      nome: regiao.nome,
      descricao: regiao.descricao || '',
      cidades: regiao.cidades || [],
      multiplicador_preco: regiao.multiplicador_preco,
      ativa: regiao.ativa,
      ordem: regiao.ordem,
      exigir_titularidade_comprovante: regiao.exigir_titularidade_comprovante ?? false,
    });
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (regiao: Regiao) => {
    setDeletingRegiao(regiao);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingRegiao) {
      await updateRegiao.mutateAsync({ id: editingRegiao.id, ...formData });
    } else {
      await createRegiao.mutateAsync(formData);
    }
    
    setIsDialogOpen(false);
    resetForm();
  };

  const handleDelete = async () => {
    if (deletingRegiao) {
      await deleteRegiao.mutateAsync(deletingRegiao.id);
      setIsDeleteDialogOpen(false);
      setDeletingRegiao(null);
    }
  };

  const handleAddCidade = () => {
    if (novaCidade.trim() && !formData.cidades?.includes(novaCidade.trim())) {
      setFormData(prev => ({
        ...prev,
        cidades: [...(prev.cidades || []), novaCidade.trim()],
      }));
      setNovaCidade('');
    }
  };

  const handleRemoveCidade = (cidade: string) => {
    setFormData(prev => ({
      ...prev,
      cidades: prev.cidades?.filter(c => c !== cidade) || [],
    }));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCidade();
    }
  };

  const filteredRegioes = regioes?.filter(r => 
    r.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.cidades?.some(c => c.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Configuração de Regiões</CardTitle>
                <CardDescription>
                  Gerencie as regiões de atuação e seus multiplicadores de preço
                </CardDescription>
              </div>
            </div>
            {podeEditar && (
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Região
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, código ou cidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-center">Cidades</TableHead>
                  <TableHead className="text-center">Multiplicador</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  {podeEditar && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegioes?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={podeEditar ? 6 : 5} className="text-center py-8 text-muted-foreground">
                      Nenhuma região encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRegioes?.map((regiao) => (
                    <TableRow key={regiao.id}>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {regiao.codigo}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{regiao.nome}</p>
                          {regiao.descricao && (
                            <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                              {regiao.descricao}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">
                          <Building2 className="h-3 w-3 mr-1" />
                          {regiao.cidades?.length || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={cn(
                          "font-mono font-medium",
                          regiao.multiplicador_preco > 1 && "text-red-600",
                          regiao.multiplicador_preco < 1 && "text-green-600"
                        )}>
                          {(regiao.multiplicador_preco * 100).toFixed(0)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {podeEditar ? (
                          <Switch
                            checked={regiao.ativa}
                            onCheckedChange={(checked) => 
                              toggleStatus.mutate({ id: regiao.id, ativa: checked })
                            }
                          />
                        ) : (
                          <Badge variant={regiao.ativa ? 'default' : 'secondary'}>
                            {regiao.ativa ? 'Ativa' : 'Inativa'}
                          </Badge>
                        )}
                      </TableCell>
                      {podeEditar && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(regiao)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDeleteDialog(regiao)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRegiao ? 'Editar Região' : 'Nova Região'}
            </DialogTitle>
            <DialogDescription>
              {editingRegiao 
                ? 'Atualize as informações da região abaixo'
                : 'Preencha as informações para criar uma nova região'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="codigo">Código *</Label>
                <Input
                  id="codigo"
                  placeholder="Ex: RJ, SP, LAGOS"
                  value={formData.codigo}
                  onChange={(e) => setFormData(prev => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="multiplicador">Multiplicador de Preço</Label>
                <div className="relative">
                  <Input
                    id="multiplicador"
                    type="number"
                    step="0.01"
                    min="0"
                    max="9.99"
                    placeholder="1.00"
                    value={formData.multiplicador_preco}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      multiplicador_preco: parseFloat(e.target.value) || 1 
                    }))}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    = {((formData.multiplicador_preco || 1) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                placeholder="Ex: Rio de Janeiro - Capital e Metropolitana"
                value={formData.nome}
                onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                placeholder="Descrição opcional da região..."
                value={formData.descricao || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ordem">Ordem de exibição</Label>
                <Input
                  id="ordem"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={formData.ordem}
                  onChange={(e) => setFormData(prev => ({ ...prev, ordem: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch
                  id="ativa"
                  checked={formData.ativa}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, ativa: checked }))}
                />
                <Label htmlFor="ativa">Região ativa</Label>
              </div>
            </div>

            {/* Cidades */}
            <div className="space-y-2">
              <Label>Cidades ({formData.cidades?.length || 0})</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Digite o nome da cidade e pressione Enter"
                  value={novaCidade}
                  onChange={(e) => setNovaCidade(e.target.value)}
                  onKeyPress={handleKeyPress}
                />
                <Button type="button" variant="secondary" onClick={handleAddCidade}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {formData.cidades && formData.cidades.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-md max-h-32 overflow-y-auto">
                  {formData.cidades.map((cidade) => (
                    <Badge key={cidade} variant="secondary" className="gap-1">
                      {cidade}
                      <button
                        type="button"
                        onClick={() => handleRemoveCidade(cidade)}
                        className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Separator className="my-2" />

            {/* Verificação de Titularidade */}
            <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="exigir_titularidade" className="text-base font-medium cursor-pointer">
                      Verificação de Titularidade do Comprovante
                    </Label>
                    <Switch
                      id="exigir_titularidade"
                      checked={formData.exigir_titularidade_comprovante}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, exigir_titularidade_comprovante: checked }))}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formData.exigir_titularidade_comprovante
                      ? 'O nome no comprovante de residência deve corresponder ao nome na CNH do cliente.'
                      : 'O comprovante de residência pode estar em nome de terceiros (cônjuge, familiares, etc).'}
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={createRegiao.isPending || updateRegiao.isPending}
              >
                {(createRegiao.isPending || updateRegiao.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editingRegiao ? 'Salvar Alterações' : 'Criar Região'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Região</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a região <strong>{deletingRegiao?.nome}</strong>?
              <br /><br />
              Esta ação não pode ser desfeita e irá remover todos os vínculos desta região com planos e benefícios.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRegiao.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
