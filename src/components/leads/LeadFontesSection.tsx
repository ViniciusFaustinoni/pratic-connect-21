import { useState } from 'react';
import { Database, Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useLeadFontes, useCreateLeadFonte, useUpdateLeadFonte, useDeleteLeadFonte } from '@/hooks/useLeadFontes';
import { useVendedores } from '@/hooks/useVendedores';
import { ETAPA_LABELS, type EtapaLead, type LeadFonte } from '@/types/database';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function LeadFontesSection() {
  const { data: fontes, isLoading } = useLeadFontes();
  const { data: vendedores } = useVendedores();
  const createFonte = useCreateLeadFonte();
  const updateFonte = useUpdateLeadFonte();
  const deleteFonte = useDeleteLeadFonte();

  const [isOpen, setIsOpen] = useState(false);
  const [editingFonte, setEditingFonte] = useState<LeadFonte | null>(null);
  const [formData, setFormData] = useState({
    codigo: '',
    nome: '',
    descricao: '',
    vendedor_padrao_id: '',
    etapa_inicial: 'novo' as EtapaLead,
  });

  const resetForm = () => {
    setFormData({
      codigo: '',
      nome: '',
      descricao: '',
      vendedor_padrao_id: '',
      etapa_inicial: 'novo',
    });
    setEditingFonte(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsOpen(true);
  };

  const handleOpenEdit = (fonte: LeadFonte) => {
    setEditingFonte(fonte);
    setFormData({
      codigo: fonte.codigo,
      nome: fonte.nome,
      descricao: fonte.descricao || '',
      vendedor_padrao_id: fonte.vendedor_padrao_id || '',
      etapa_inicial: fonte.etapa_inicial,
    });
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    resetForm();
  };

  const handleSubmit = async () => {
    if (!formData.codigo.trim() || !formData.nome.trim()) {
      toast.error('Código e nome são obrigatórios');
      return;
    }

    // Validate codigo format (slug)
    if (!/^[a-z0-9_-]+$/.test(formData.codigo)) {
      toast.error('Código deve conter apenas letras minúsculas, números, hífens e underscores');
      return;
    }

    try {
      if (editingFonte) {
        await updateFonte.mutateAsync({
          id: editingFonte.id,
          codigo: formData.codigo,
          nome: formData.nome,
          descricao: formData.descricao || undefined,
          vendedor_padrao_id: formData.vendedor_padrao_id || null,
          etapa_inicial: formData.etapa_inicial,
        });
        toast.success('Fonte atualizada com sucesso');
      } else {
        await createFonte.mutateAsync({
          codigo: formData.codigo,
          nome: formData.nome,
          descricao: formData.descricao || undefined,
          vendedor_padrao_id: formData.vendedor_padrao_id || undefined,
          etapa_inicial: formData.etapa_inicial,
        });
        toast.success('Fonte criada com sucesso');
      }
      handleClose();
    } catch (error: any) {
      if (error.message?.includes('duplicate key')) {
        toast.error('Já existe uma fonte com este código');
      } else {
        toast.error('Erro ao salvar fonte');
      }
    }
  };

  const handleToggleActive = async (fonte: LeadFonte) => {
    try {
      await updateFonte.mutateAsync({
        id: fonte.id,
        ativa: !fonte.ativa,
      });
      toast.success(fonte.ativa ? 'Fonte desativada' : 'Fonte ativada');
    } catch (error) {
      toast.error('Erro ao alterar status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta fonte?')) return;
    
    try {
      await deleteFonte.mutateAsync(id);
      toast.success('Fonte excluída com sucesso');
    } catch (error) {
      toast.error('Erro ao excluir fonte');
    }
  };

  const getVendedorNome = (id?: string) => {
    if (!id) return '-';
    const vendedor = vendedores?.find(v => v.user_id === id);
    return vendedor?.nome || '-';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Fontes de Lead
            </CardTitle>
            <CardDescription>
              Configure origens de leads para rastreamento e atribuição automática
            </CardDescription>
          </div>
          <Button onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Fonte
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">Carregando...</div>
        ) : fontes?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma fonte de lead cadastrada
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Vendedor Padrão</TableHead>
                <TableHead>Etapa Inicial</TableHead>
                <TableHead>Total Leads</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fontes?.map((fonte) => (
                <TableRow key={fonte.id}>
                  <TableCell className="font-mono text-sm">{fonte.codigo}</TableCell>
                  <TableCell className="font-medium">{fonte.nome}</TableCell>
                  <TableCell>{getVendedorNome(fonte.vendedor_padrao_id)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {ETAPA_LABELS[fonte.etapa_inicial]}
                    </Badge>
                  </TableCell>
                  <TableCell>{fonte.total_leads}</TableCell>
                  <TableCell>
                    <Badge variant={fonte.ativa ? 'default' : 'secondary'}>
                      {fonte.ativa ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleActive(fonte)}
                        title={fonte.ativa ? 'Desativar' : 'Ativar'}
                      >
                        {fonte.ativa ? (
                          <ToggleRight className="h-4 w-4" />
                        ) : (
                          <ToggleLeft className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(fonte)}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(fonte.id)}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingFonte ? 'Editar Fonte' : 'Nova Fonte de Lead'}
              </DialogTitle>
              <DialogDescription>
                {editingFonte
                  ? 'Atualize as informações da fonte de lead'
                  : 'Configure uma nova origem para receber leads via API'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="codigo">Código *</Label>
                  <Input
                    id="codigo"
                    placeholder="ex: fb_ads_maio"
                    value={formData.codigo}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Apenas letras minúsculas, números, hífens e underscores
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome *</Label>
                  <Input
                    id="nome"
                    placeholder="ex: Facebook Ads - Maio 2025"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  placeholder="Descrição opcional da fonte..."
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vendedor">Vendedor Padrão</Label>
                  <Select
                    value={formData.vendedor_padrao_id}
                    onValueChange={(value) => setFormData({ ...formData, vendedor_padrao_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhum</SelectItem>
                      {vendedores?.map((v) => (
                        <SelectItem key={v.user_id} value={v.user_id}>
                          {v.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="etapa">Etapa Inicial</Label>
                  <Select
                    value={formData.etapa_inicial}
                    onValueChange={(value) => setFormData({ ...formData, etapa_inicial: value as EtapaLead })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ETAPA_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={createFonte.isPending || updateFonte.isPending}
              >
                {createFonte.isPending || updateFonte.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}