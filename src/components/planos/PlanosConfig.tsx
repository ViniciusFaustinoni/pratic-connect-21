import { useState } from 'react';
import { usePlanosAdmin, useCreatePlano, useUpdatePlano, useDeletePlano, useTogglePlanoStatus, PlanoInput, PlanoComRegioes } from '@/hooks/usePlanosAdmin';
import { useRegioes } from '@/hooks/useRegioes';
import { usePermissions } from '@/hooks/usePermissions';
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
import { Plus, Edit, Trash2, Loader2, X, Search, FileText, MapPin, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const LINHAS_PLANO = [
  { value: 'select', label: 'Linha Select' },
  { value: 'select-one', label: 'Linha Select One' },
  { value: 'especial', label: 'Linha Especial' },
  { value: 'lancamento', label: 'Linha Lançamento' },
  { value: 'advanced', label: 'Linha Advanced' },
];

interface PlanoFormData extends PlanoInput {
  regioes: string[];
  novaCobertura?: string;
}

export function PlanosConfig() {
  const { isDiretor, isDesenvolvedor } = usePermissions();
  const podeEditar = isDiretor || isDesenvolvedor;
  
  const { data: planos, isLoading } = usePlanosAdmin();
  const { data: regioes } = useRegioes();
  const createPlano = useCreatePlano();
  const updatePlano = useUpdatePlano();
  const deletePlano = useDeletePlano();
  const toggleStatus = useTogglePlanoStatus();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingPlano, setEditingPlano] = useState<PlanoComRegioes | null>(null);
  const [deletingPlano, setDeletingPlano] = useState<PlanoComRegioes | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [novaCobertura, setNovaCobertura] = useState('');
  
  const [formData, setFormData] = useState<PlanoFormData>({
    codigo: '',
    nome: '',
    descricao: '',
    linha: 'select',
    cobertura_fipe: 100,
    ano_minimo: 2005,
    coberturas: [],
    valor_adesao: 0,
    destaque: false,
    ativo: true,
    ordem: 100,
    regioes: [],
  });

  const resetForm = () => {
    setFormData({
      codigo: '',
      nome: '',
      descricao: '',
      linha: 'select',
      cobertura_fipe: 100,
      ano_minimo: 2005,
      coberturas: [],
      valor_adesao: 0,
      destaque: false,
      ativo: true,
      ordem: 100,
      regioes: [],
    });
    setNovaCobertura('');
    setEditingPlano(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (plano: PlanoComRegioes) => {
    setEditingPlano(plano);
    setFormData({
      codigo: plano.codigo,
      nome: plano.nome,
      descricao: plano.descricao || '',
      linha: plano.linha || 'select',
      cobertura_fipe: plano.cobertura_fipe || 100,
      ano_minimo: plano.ano_minimo || 2005,
      coberturas: plano.coberturas || [],
      valor_adesao: plano.valor_adesao,
      destaque: plano.destaque || false,
      ativo: plano.ativo,
      ordem: plano.ordem || 100,
      regioes: plano.planos_regioes?.map(pr => pr.regiao_id) || [],
    });
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (plano: PlanoComRegioes) => {
    setDeletingPlano(plano);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { regioes: regioesIds, ...planoData } = formData;
    
    if (editingPlano) {
      await updatePlano.mutateAsync({ 
        id: editingPlano.id, 
        ...planoData,
        regioes: regioesIds,
      });
    } else {
      await createPlano.mutateAsync({ 
        ...planoData, 
        regioes: regioesIds,
      });
    }
    
    setIsDialogOpen(false);
    resetForm();
  };

  const handleDelete = async () => {
    if (deletingPlano) {
      await deletePlano.mutateAsync(deletingPlano.id);
      setIsDeleteDialogOpen(false);
      setDeletingPlano(null);
    }
  };

  const handleAddCobertura = () => {
    if (novaCobertura.trim() && !formData.coberturas?.includes(novaCobertura.trim())) {
      setFormData(prev => ({
        ...prev,
        coberturas: [...(prev.coberturas || []), novaCobertura.trim()],
      }));
      setNovaCobertura('');
    }
  };

  const handleRemoveCobertura = (cobertura: string) => {
    setFormData(prev => ({
      ...prev,
      coberturas: prev.coberturas?.filter(c => c !== cobertura) || [],
    }));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCobertura();
    }
  };

  const toggleRegiao = (regiaoId: string) => {
    setFormData(prev => ({
      ...prev,
      regioes: prev.regioes.includes(regiaoId)
        ? prev.regioes.filter(id => id !== regiaoId)
        : [...prev.regioes, regiaoId],
    }));
  };

  const filteredPlanos = planos?.filter(p => 
    p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.linha?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (value: number) => 
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Configuração de Planos</CardTitle>
                <CardDescription>
                  Gerencie os planos de proteção veicular e suas regiões
                </CardDescription>
              </div>
            </div>
            {podeEditar && (
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Plano
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, código ou linha..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plano</TableHead>
                  <TableHead>Linha</TableHead>
                  <TableHead className="text-center">Cobertura FIPE</TableHead>
                  <TableHead className="text-center">Regiões</TableHead>
                  <TableHead className="text-right">Adesão</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  {podeEditar && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPlanos?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={podeEditar ? 7 : 6} className="text-center py-8 text-muted-foreground">
                      Nenhum plano encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPlanos?.map((plano) => (
                    <TableRow key={plano.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {plano.destaque && (
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          )}
                          <div>
                            <p className="font-medium">{plano.nome}</p>
                            <Badge variant="outline" className="font-mono text-xs">
                              {plano.codigo}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {LINHAS_PLANO.find(l => l.value === plano.linha)?.label || plano.linha}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium">{plano.cobertura_fipe || 100}%</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">
                          <MapPin className="h-3 w-3 mr-1" />
                          {plano.planos_regioes?.length || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(plano.valor_adesao)}
                      </TableCell>
                      <TableCell className="text-center">
                        {podeEditar ? (
                          <Switch
                            checked={plano.ativo}
                            onCheckedChange={(checked) => 
                              toggleStatus.mutate({ id: plano.id, ativo: checked })
                            }
                          />
                        ) : (
                          <Badge variant={plano.ativo ? 'default' : 'secondary'}>
                            {plano.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        )}
                      </TableCell>
                      {podeEditar && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(plano)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDeleteDialog(plano)}
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPlano ? 'Editar Plano' : 'Novo Plano'}
            </DialogTitle>
            <DialogDescription>
              {editingPlano 
                ? 'Atualize as informações do plano abaixo'
                : 'Preencha as informações para criar um novo plano'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Identificação */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="codigo">Código *</Label>
                <Input
                  id="codigo"
                  placeholder="Ex: SELECT_BASIC"
                  value={formData.codigo}
                  onChange={(e) => setFormData(prev => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
                  required
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  placeholder="Ex: Select Basic"
                  value={formData.nome}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                placeholder="Descrição do plano..."
                value={formData.descricao || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                rows={2}
              />
            </div>

            {/* Configurações */}
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="linha">Linha</Label>
                <Select 
                  value={formData.linha || 'select'}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, linha: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LINHAS_PLANO.map(linha => (
                      <SelectItem key={linha.value} value={linha.value}>
                        {linha.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cobertura_fipe">Cobertura FIPE (%)</Label>
                <Input
                  id="cobertura_fipe"
                  type="number"
                  min="0"
                  max="120"
                  value={formData.cobertura_fipe}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    cobertura_fipe: parseInt(e.target.value) || 100 
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ano_minimo">Ano Mínimo</Label>
                <Input
                  id="ano_minimo"
                  type="number"
                  min="1990"
                  max={new Date().getFullYear() + 1}
                  value={formData.ano_minimo}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    ano_minimo: parseInt(e.target.value) || 2005 
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valor_adesao">Valor Adesão (R$)</Label>
                <Input
                  id="valor_adesao"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.valor_adesao}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    valor_adesao: parseFloat(e.target.value) || 0 
                  }))}
                />
              </div>
            </div>

            {/* Coberturas */}
            <div className="space-y-2">
              <Label>Coberturas ({formData.coberturas?.length || 0})</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Digite a cobertura e pressione Enter"
                  value={novaCobertura}
                  onChange={(e) => setNovaCobertura(e.target.value)}
                  onKeyPress={handleKeyPress}
                />
                <Button type="button" variant="secondary" onClick={handleAddCobertura}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {formData.coberturas && formData.coberturas.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-md max-h-32 overflow-y-auto">
                  {formData.coberturas.map((cobertura) => (
                    <Badge key={cobertura} variant="secondary" className="gap-1">
                      {cobertura}
                      <button
                        type="button"
                        onClick={() => handleRemoveCobertura(cobertura)}
                        className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Regiões */}
            <div className="space-y-2">
              <Label>Regiões Disponíveis ({formData.regioes.length})</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3 bg-muted/50 rounded-md max-h-40 overflow-y-auto">
                {regioes?.filter(r => r.ativa).map(regiao => (
                  <div key={regiao.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`regiao-${regiao.id}`}
                      checked={formData.regioes.includes(regiao.id)}
                      onCheckedChange={() => toggleRegiao(regiao.id)}
                    />
                    <label
                      htmlFor={`regiao-${regiao.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {regiao.nome}
                      <span className="text-muted-foreground ml-1">({regiao.codigo})</span>
                    </label>
                  </div>
                ))}
              </div>
              {(!regioes || regioes.filter(r => r.ativa).length === 0) && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma região ativa encontrada. Configure regiões primeiro.
                </p>
              )}
            </div>

            {/* Opções */}
            <div className="grid grid-cols-3 gap-4">
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
              <div className="flex items-center gap-3 pt-6">
                <Switch
                  id="destaque"
                  checked={formData.destaque}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, destaque: checked }))}
                />
                <Label htmlFor="destaque" className="flex items-center gap-1">
                  <Star className="h-4 w-4" />
                  Destacar plano
                </Label>
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch
                  id="ativo"
                  checked={formData.ativo}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, ativo: checked }))}
                />
                <Label htmlFor="ativo">Plano ativo</Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={createPlano.isPending || updatePlano.isPending}
              >
                {(createPlano.isPending || updatePlano.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editingPlano ? 'Salvar Alterações' : 'Criar Plano'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Plano</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o plano <strong>{deletingPlano?.nome}</strong>?
              <br /><br />
              Esta ação não pode ser desfeita e irá remover todos os vínculos deste plano com regiões.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePlano.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
