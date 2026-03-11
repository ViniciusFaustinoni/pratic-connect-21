import { useState } from 'react';
import { useBeneficiosAdicionais, useCreateBeneficio, useUpdateBeneficio, useDeleteBeneficio, useToggleBeneficioStatus, BeneficioInput, BeneficioComRegioes, CATEGORIAS_BENEFICIO } from '@/hooks/useBeneficiosAdmin';
import { useRegioes } from '@/hooks/useRegioes';
import { usePermissions } from '@/hooks/usePermissions';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Edit, Trash2, Loader2, Search, Gift, MapPin, Users, AlertTriangle } from 'lucide-react';

interface BeneficioFormData extends BeneficioInput {
  regioes: { id: string; preco_regional?: number }[];
}

export function BeneficiosAdicionaisConfig() {
  const { isDiretor, isDesenvolvedor } = usePermissions();
  const podeEditar = isDiretor || isDesenvolvedor;
  
  const { data: beneficios, isLoading } = useBeneficiosAdicionais();
  const { data: regioes } = useRegioes();
  const createBeneficio = useCreateBeneficio();
  const updateBeneficio = useUpdateBeneficio();
  const deleteBeneficio = useDeleteBeneficio();
  const toggleStatus = useToggleBeneficioStatus();

  // Count active associates per benefit
  const { data: associadosCounts } = useQuery({
    queryKey: ['associados-por-beneficio-adicional'],
    queryFn: async () => {
      const { data } = await supabase
        .from('associados_beneficios_adicionais')
        .select('beneficio_adicional_id')
        .eq('ativo', true);
      const counts: Record<string, number> = {};
      data?.forEach(a => {
        counts[a.beneficio_adicional_id] = (counts[a.beneficio_adicional_id] || 0) + 1;
      });
      return counts;
    },
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingBeneficio, setEditingBeneficio] = useState<BeneficioComRegioes | null>(null);
  const [deletingBeneficio, setDeletingBeneficio] = useState<BeneficioComRegioes | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategoria, setFilterCategoria] = useState<string>('');
  
  const [formData, setFormData] = useState<BeneficioFormData>({
    codigo: '',
    nome: '',
    descricao: '',
    categoria: 'protecao',
    preco: 0,
    ativo: true,
    ordem: 0,
    regioes: [],
  });

  const resetForm = () => {
    setFormData({
      codigo: '',
      nome: '',
      descricao: '',
      categoria: 'protecao',
      preco: 0,
      ativo: true,
      ordem: 0,
      regioes: [],
    });
    setEditingBeneficio(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (beneficio: BeneficioComRegioes) => {
    setEditingBeneficio(beneficio);
    setFormData({
      codigo: beneficio.codigo,
      nome: beneficio.nome,
      descricao: beneficio.descricao || '',
      categoria: beneficio.categoria,
      preco: beneficio.preco,
      ativo: beneficio.ativo ?? true,
      ordem: beneficio.ordem || 0,
      regioes: beneficio.beneficios_regioes?.map(br => ({
        id: br.regiao_id,
        preco_regional: br.preco_regional || undefined,
      })) || [],
    });
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (beneficio: BeneficioComRegioes) => {
    setDeletingBeneficio(beneficio);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingBeneficio) {
      await updateBeneficio.mutateAsync({ 
        id: editingBeneficio.id, 
        ...formData,
      });
    } else {
      await createBeneficio.mutateAsync(formData);
    }
    
    setIsDialogOpen(false);
    resetForm();
  };

  const handleDelete = async () => {
    if (deletingBeneficio) {
      await deleteBeneficio.mutateAsync(deletingBeneficio.id);
      setIsDeleteDialogOpen(false);
      setDeletingBeneficio(null);
    }
  };

  const toggleRegiao = (regiaoId: string) => {
    setFormData(prev => {
      const exists = prev.regioes.find(r => r.id === regiaoId);
      if (exists) {
        return {
          ...prev,
          regioes: prev.regioes.filter(r => r.id !== regiaoId),
        };
      }
      return {
        ...prev,
        regioes: [...prev.regioes, { id: regiaoId }],
      };
    });
  };

  const filteredBeneficios = beneficios?.filter(b => {
    const matchesSearch = b.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.codigo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategoria = !filterCategoria || b.categoria === filterCategoria;
    return matchesSearch && matchesCategoria;
  });

  const formatCurrency = (value: number) => 
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const getCategoriaLabel = (value: string) => 
    CATEGORIAS_BENEFICIO.find(c => c.value === value)?.label || value;

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
                <Gift className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Benefícios Adicionais</CardTitle>
                <CardDescription>
                  Gerencie os benefícios adicionais disponíveis nos planos
                </CardDescription>
              </div>
            </div>
            {podeEditar && (
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Benefício
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterCategoria} onValueChange={setFilterCategoria}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Todas categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas categorias</SelectItem>
                {CATEGORIAS_BENEFICIO.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Benefício</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Linhas</TableHead>
                  <TableHead className="text-center">Regiões</TableHead>
                  <TableHead className="text-center">Associados</TableHead>
                  <TableHead className="text-right">Preço Base</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  {podeEditar && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBeneficios?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={podeEditar ? 8 : 7} className="text-center py-8 text-muted-foreground">
                      Nenhum benefício encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBeneficios?.map((beneficio) => (
                    <TableRow key={beneficio.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{beneficio.nome}</p>
                          <Badge variant="outline" className="font-mono text-xs">
                            {beneficio.codigo}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {getCategoriaLabel(beneficio.categoria)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {(beneficio as any).linhas_permitidas?.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {((beneficio as any).linhas_permitidas as string[]).map((slug: string) => (
                              <Badge key={slug} variant="outline" className="text-xs">
                                {slug}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Todas</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">
                          <MapPin className="h-3 w-3 mr-1" />
                          {beneficio.beneficios_regioes?.length || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(beneficio.preco)}
                      </TableCell>
                      <TableCell className="text-center">
                        {podeEditar ? (
                          <Switch
                            checked={beneficio.ativo ?? true}
                            onCheckedChange={(checked) => 
                              toggleStatus.mutate({ id: beneficio.id, ativo: checked })
                            }
                          />
                        ) : (
                          <Badge variant={beneficio.ativo ? 'default' : 'secondary'}>
                            {beneficio.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        )}
                      </TableCell>
                      {podeEditar && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(beneficio)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDeleteDialog(beneficio)}
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
              {editingBeneficio ? 'Editar Benefício' : 'Novo Benefício'}
            </DialogTitle>
            <DialogDescription>
              {editingBeneficio 
                ? 'Atualize as informações do benefício abaixo'
                : 'Preencha as informações para criar um novo benefício'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="codigo">Código *</Label>
                <Input
                  id="codigo"
                  placeholder="Ex: VIDROS"
                  value={formData.codigo}
                  onChange={(e) => setFormData(prev => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoria">Categoria *</Label>
                <Select 
                  value={formData.categoria}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, categoria: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_BENEFICIO.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                placeholder="Ex: Proteção de Vidros"
                value={formData.nome}
                onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                placeholder="Descrição do benefício..."
                value={formData.descricao || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="preco">Preço Base (R$) *</Label>
                <Input
                  id="preco"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.preco}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    preco: parseFloat(e.target.value) || 0 
                  }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ordem">Ordem de exibição</Label>
                <Input
                  id="ordem"
                  type="number"
                  min="0"
                  value={formData.ordem}
                  onChange={(e) => setFormData(prev => ({ ...prev, ordem: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            {/* Regiões */}
            <div className="space-y-2">
              <Label>Regiões Disponíveis ({formData.regioes.length})</Label>
              <div className="grid grid-cols-2 gap-3 p-3 bg-muted/50 rounded-md max-h-40 overflow-y-auto">
                {regioes?.filter(r => r.ativa).map(regiao => (
                  <div key={regiao.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`beneficio-regiao-${regiao.id}`}
                      checked={formData.regioes.some(r => r.id === regiao.id)}
                      onCheckedChange={() => toggleRegiao(regiao.id)}
                    />
                    <label
                      htmlFor={`beneficio-regiao-${regiao.id}`}
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      {regiao.nome}
                      <span className="text-muted-foreground ml-1">({regiao.codigo})</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="beneficio-ativo"
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, ativo: checked }))}
              />
              <Label htmlFor="beneficio-ativo">Benefício ativo</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={createBeneficio.isPending || updateBeneficio.isPending}
              >
                {(createBeneficio.isPending || updateBeneficio.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editingBeneficio ? 'Salvar Alterações' : 'Criar Benefício'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Benefício</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o benefício <strong>{deletingBeneficio?.nome}</strong>?
              <br /><br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteBeneficio.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
