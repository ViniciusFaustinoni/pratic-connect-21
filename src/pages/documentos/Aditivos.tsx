import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAditivos, useDeleteAditivo, type RegraAditivo } from '@/hooks/useAditivos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Edit, Trash2, Car, DollarSign, Shield, MapPin, Truck, Smartphone, GlassWater, Fuel, ShieldCheck, Clock, Wrench, FileText, Hammer, Flame, Star, Tag, Radio, RefreshCw, Eye, UserCheck } from 'lucide-react';

const REGRA_LABELS: Record<string, { label: string; icon: typeof Car }> = {
  veiculo_0km: { label: '0KM', icon: Car },
  fipe_acima_de: { label: 'FIPE acima', icon: DollarSign },
  veiculo_blindado: { label: 'Blindado', icon: Shield },
  rastreador_obrigatorio: { label: 'Rastreador', icon: MapPin },
  rastreador_movel: { label: 'Rastreador Móvel', icon: Truck },
  veiculo_aplicativo: { label: 'Aplicativo', icon: Smartphone },
  beneficio_vidros: { label: 'Vidros', icon: GlassWater },
  beneficio_kit_gas: { label: 'Kit Gás', icon: Fuel },
  beneficio_danos_terceiros: { label: 'Terceiros', icon: ShieldCheck },
  beneficio_carro_reserva: { label: 'Carro Reserva', icon: Car },
  beneficio_reboque_excedente: { label: 'Reboque', icon: Wrench },
  beneficio_carencia_zero: { label: 'Carência Zero', icon: Clock },
  evento_vidros: { label: 'Evento Vidros', icon: GlassWater },
  evento_sub_rogacao: { label: 'Sub-Rogação', icon: FileText },
  evento_aprovacao_conserto: { label: 'Aprov. Conserto', icon: Hammer },
  evento_incendio: { label: 'Incêndio', icon: Flame },
  grupo_raridades_especial: { label: 'Raridades/Especial', icon: Star },
  categoria_depreciacao: { label: 'Depreciação', icon: Tag },
  rastreador_terceiros: { label: 'Rastr. Terceiros', icon: Radio },
  opcao_atualizacao_fipe: { label: 'Atual. FIPE', icon: RefreshCw },
  vistoria_reativacao: { label: 'Reativação', icon: Eye },
  anuencia_proprietario: { label: 'Anuência Prop.', icon: UserCheck },
};

export default function Aditivos() {
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtroAtivo = filtroStatus === 'todos' ? null : filtroStatus === 'ativo';
  const { data: aditivos = [], isLoading } = useAditivos(filtroAtivo);
  const deleteMutation = useDeleteAditivo();

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Aditivos</h1>
          <p className="text-muted-foreground">Gerencie os termos aditivos e suas regras de anexação automática</p>
        </div>
        <Button asChild>
          <Link to="/documentos/aditivos/novo"><Plus className="mr-2 h-4 w-4" />Novo Aditivo</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Lista de Aditivos</CardTitle>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="inativo">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : aditivos.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Nenhum aditivo encontrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Regras</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ordem</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aditivos.map((aditivo) => {
                  const regras = (aditivo.regras || []) as RegraAditivo[];
                  const regrasAtivas = regras.filter(r => r.ativo);
                  return (
                    <TableRow key={aditivo.id}>
                      <TableCell className="font-medium">{aditivo.nome}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {regrasAtivas.length === 0 && (
                            <Badge variant="outline">Manual</Badge>
                          )}
                          {regrasAtivas.map((r) => {
                            const info = REGRA_LABELS[r.tipo];
                            const Icon = info?.icon || Car;
                            return (
                              <Badge key={r.tipo} variant="secondary" className="gap-1">
                                <Icon className="h-3 w-3" />
                                {info?.label || r.tipo}
                              </Badge>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={aditivo.ativo ? 'default' : 'outline'}>
                          {aditivo.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>{aditivo.ordem}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" asChild>
                            <Link to={`/documentos/aditivos/${aditivo.id}`}>
                              <Edit className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(aditivo.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir aditivo?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
