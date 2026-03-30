import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, MapPin } from 'lucide-react';
import { useLocaisInstalacaoAdmin, useCreateLocalInstalacao, useToggleLocalInstalacao } from '@/hooks/useLocaisInstalacao';
import { Label } from '@/components/ui/label';

export function GerenciarLocaisInstalacao() {
  const { data: locais, isLoading } = useLocaisInstalacaoAdmin();
  const createLocal = useCreateLocalInstalacao();
  const toggleLocal = useToggleLocalInstalacao();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [novoLabel, setNovoLabel] = useState('');
  const [novoTipo, setNovoTipo] = useState('ambos');

  const handleCreate = () => {
    if (!novoLabel.trim()) return;
    createLocal.mutate({ label: novoLabel.trim(), tipo_veiculo: novoTipo }, {
      onSuccess: () => {
        setDialogOpen(false);
        setNovoLabel('');
        setNovoTipo('ambos');
      },
    });
  };

  const tipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'carro': return 'Carro';
      case 'moto': return 'Moto';
      default: return 'Ambos';
    }
  };

  const tipoColor = (tipo: string) => {
    switch (tipo) {
      case 'carro': return 'bg-blue-100 text-blue-800';
      case 'moto': return 'bg-orange-100 text-orange-800';
      default: return 'bg-green-100 text-green-800';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MapPin className="h-5 w-5" />
          Locais de Instalação
        </CardTitle>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Novo Local
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Carregando...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Local</TableHead>
                <TableHead>Tipo Veículo</TableHead>
                <TableHead>Ordem</TableHead>
                <TableHead className="text-right">Ativo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locais?.map((local) => (
                <TableRow key={local.id} className={!local.ativo ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">{local.label}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={tipoColor(local.tipo_veiculo)}>
                      {tipoLabel(local.tipo_veiculo)}
                    </Badge>
                  </TableCell>
                  <TableCell>{local.ordem}</TableCell>
                  <TableCell className="text-right">
                    <Switch
                      checked={local.ativo}
                      onCheckedChange={(checked) => toggleLocal.mutate({ id: local.id, ativo: checked })}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Local de Instalação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do local</Label>
              <Input
                value={novoLabel}
                onChange={(e) => setNovoLabel(e.target.value)}
                placeholder="Ex: Caixa de fusíveis"
              />
            </div>
            <div>
              <Label>Tipo de veículo</Label>
              <Select value={novoTipo} onValueChange={setNovoTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ambos">Ambos</SelectItem>
                  <SelectItem value="carro">Carro</SelectItem>
                  <SelectItem value="moto">Moto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!novoLabel.trim() || createLocal.isPending}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
