import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Settings } from 'lucide-react';
import { useComissoesConfig } from '@/hooks/useComissoesConfig';
import { PermissionGate } from '@/components/PermissionGate';
import type { ComissaoConfig, ComissaoConfigFormData, TipoVendedor, BaseCalculo } from '@/types/comissoes';

const TIPO_VENDEDOR_LABELS: Record<TipoVendedor, string> = {
  todos: 'Todos',
  vendedor_clt: 'CLT',
  vendedor_externo: 'Externo',
};

const BASE_CALCULO_LABELS: Record<BaseCalculo, string> = {
  valor_adesao: 'Adesão',
  valor_mensal: 'Mensalidade',
  ambos: 'Adesão + Mensal',
};

export default function ComissoesConfig() {
  const { configs, isLoading, createConfig, updateConfig, deleteConfig, toggleAtivo } = useComissoesConfig();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ComissaoConfig | null>(null);
  const [formData, setFormData] = useState<ComissaoConfigFormData>({
    nome: '',
    tipo_vendedor: 'todos',
    base_calculo: 'valor_adesao',
    tipo_calculo: 'percentual_fixo',
    percentual_base: 0,
    bonus_meta_atingida: 0,
    bonus_meta_superada: 0,
    valor_minimo: 0,
    valor_maximo: null,
    ativo: true,
  });

  const handleOpenDialog = (config?: ComissaoConfig) => {
    if (config) {
      setEditingConfig(config);
      setFormData({
        nome: config.nome,
        tipo_vendedor: config.tipo_vendedor,
        base_calculo: config.base_calculo,
        tipo_calculo: config.tipo_calculo,
        percentual_base: config.percentual_base,
        bonus_meta_atingida: config.bonus_meta_atingida || 0,
        bonus_meta_superada: config.bonus_meta_superada || 0,
        valor_minimo: config.valor_minimo || 0,
        valor_maximo: config.valor_maximo,
        ativo: config.ativo,
      });
    } else {
      setEditingConfig(null);
      setFormData({
        nome: '',
        tipo_vendedor: 'todos',
        base_calculo: 'valor_adesao',
        tipo_calculo: 'percentual_fixo',
        percentual_base: 0,
        bonus_meta_atingida: 0,
        bonus_meta_superada: 0,
        valor_minimo: 0,
        valor_maximo: null,
        ativo: true,
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (editingConfig) {
      await updateConfig.mutateAsync({ id: editingConfig.id, ...formData });
    } else {
      await createConfig.mutateAsync(formData);
    }
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta regra?')) {
      await deleteConfig.mutateAsync(id);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Configuração de Comissões
          </h1>
          <p className="text-muted-foreground">
            Defina as regras de comissionamento por tipo de vendedor
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Regra
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingConfig ? 'Editar Regra' : 'Nova Regra de Comissão'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome da Regra</Label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: CLT Padrão"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Vendedor</Label>
                  <Select
                    value={formData.tipo_vendedor}
                    onValueChange={(v) => setFormData({ ...formData, tipo_vendedor: v as TipoVendedor })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="vendedor_clt">CLT</SelectItem>
                      <SelectItem value="vendedor_externo">Externo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Base de Cálculo</Label>
                  <Select
                    value={formData.base_calculo}
                    onValueChange={(v) => setFormData({ ...formData, base_calculo: v as BaseCalculo })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="valor_adesao">Valor de Adesão</SelectItem>
                      <SelectItem value="valor_mensal">Mensalidade</SelectItem>
                      <SelectItem value="ambos">Adesão + Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Percentual Base (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.percentual_base}
                  onChange={(e) => setFormData({ ...formData, percentual_base: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Bônus Meta 100% (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.bonus_meta_atingida}
                    onChange={(e) => setFormData({ ...formData, bonus_meta_atingida: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Bônus Meta 120% (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.bonus_meta_superada}
                    onChange={(e) => setFormData({ ...formData, bonus_meta_superada: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor Mínimo (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.valor_minimo}
                    onChange={(e) => setFormData({ ...formData, valor_minimo: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Valor Máximo (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.valor_maximo || ''}
                    onChange={(e) => setFormData({ ...formData, valor_maximo: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="Sem limite"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.ativo}
                  onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                />
                <Label>Regra ativa</Label>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={!formData.nome || createConfig.isPending || updateConfig.isPending}>
                  {editingConfig ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regras Configuradas</CardTitle>
          <CardDescription>
            As regras são aplicadas automaticamente ao ativar contratos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : configs?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma regra configurada. Crie uma nova regra para começar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Base</TableHead>
                  <TableHead className="text-right">Percentual</TableHead>
                  <TableHead className="text-right">Bônus Meta</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs?.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell className="font-medium">{config.nome}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {TIPO_VENDEDOR_LABELS[config.tipo_vendedor]}
                      </Badge>
                    </TableCell>
                    <TableCell>{BASE_CALCULO_LABELS[config.base_calculo]}</TableCell>
                    <TableCell className="text-right font-mono">
                      {config.percentual_base}%
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {config.bonus_meta_atingida}% / {config.bonus_meta_superada}%
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={config.ativo}
                        onCheckedChange={(checked) => toggleAtivo.mutate({ id: config.id, ativo: checked })}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(config)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleDelete(config.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
