import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PermissionGate } from '@/components/PermissionGate';
import { useVistoriadorCidades, VistoriadorCidade } from '@/hooks/useVistoriadorCidades';
import { useVistoriadoresPrestadores } from '@/hooks/useVistoriadoresPrestadores';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { Map, Plus, Pencil, Trash2, Info } from 'lucide-react';
import { toast } from 'sonner';

const UF_LIST = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

interface CidadeAgrupada {
  cidade: string;
  uf: string;
  registros: VistoriadorCidade[];
}

export default function RegioesAtendimento() {
  const { data: vinculos = [], isLoading, vincular, desvincular } = useVistoriadorCidades();
  const { data: prestadores = [] } = useVistoriadoresPrestadores();

  // Vistoriadores comuns (profiles com role instalador_vistoriador)
  const { data: vistoriadoresComuns = [] } = useQuery({
    queryKey: ['vistoriadores-comuns-profiles'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('user_roles')
        .select('user_id, profiles:user_id(id, nome)')
        .eq('role', 'instalador_vistoriador');
      if (error) throw error;
      return (data || [])
        .filter((r: any) => r.profiles?.nome)
        .map((r: any) => ({ id: r.profiles.id, nome: r.profiles.nome }));
    },
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCidade, setEditingCidade] = useState<CidadeAgrupada | null>(null);
  const [removeCidade, setRemoveCidade] = useState<CidadeAgrupada | null>(null);

  // Form state
  const [formCidade, setFormCidade] = useState('');
  const [formUf, setFormUf] = useState('');
  const [formTipo, setFormTipo] = useState<'comum' | 'prestador'>('comum');
  const [formSelecionados, setFormSelecionados] = useState<string[]>([]);

  // Agrupar vínculos por cidade+uf
  const agrupados = useMemo((): CidadeAgrupada[] => {
    const map: Record<string, CidadeAgrupada> = {};
    vinculos.forEach((v: VistoriadorCidade) => {
      const key = `${v.cidade}|${v.uf}`;
      if (!map[key]) {
        map[key] = { cidade: v.cidade, uf: v.uf, registros: [] };
      }
      map[key].registros.push(v);
    });
    return Object.values(map).sort((a, b) => a.cidade.localeCompare(b.cidade));
  }, [vinculos]);

  const getNomeVistoriador = (reg: VistoriadorCidade): string => {
    if (reg.tipo_vistoriador === 'prestador') {
      const p = prestadores.find((pr: any) => pr.id === reg.vistoriador_prestador_id);
      return p?.nome || 'Prestador desconhecido';
    }
    const c = vistoriadoresComuns.find((vc: any) => vc.id === reg.vistoriador_comum_id);
    return c?.nome || 'Vistoriador desconhecido';
  };

  const openAdd = () => {
    setEditingCidade(null);
    setFormCidade('');
    setFormUf('');
    setFormTipo('comum');
    setFormSelecionados([]);
    setModalOpen(true);
  };

  const openEdit = (grupo: CidadeAgrupada) => {
    setEditingCidade(grupo);
    setFormCidade(grupo.cidade);
    setFormUf(grupo.uf);
    const tipo = grupo.registros[0]?.tipo_vistoriador || 'comum';
    setFormTipo(tipo);
    setFormSelecionados(
      grupo.registros.map(r =>
        r.tipo_vistoriador === 'comum' ? r.vistoriador_comum_id! : r.vistoriador_prestador_id!
      )
    );
    setModalOpen(true);
  };

  const handleTipoChange = (tipo: 'comum' | 'prestador') => {
    setFormTipo(tipo);
    setFormSelecionados([]);
  };

  const toggleSelecionado = (id: string) => {
    setFormSelecionados(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const listaOpcoes = formTipo === 'comum'
    ? vistoriadoresComuns
    : prestadores.filter((p: any) => p.ativo);

  const handleSave = async () => {
    if (!formCidade.trim()) return toast.error('Informe a cidade');
    if (!formUf) return toast.error('Selecione o estado');
    if (formSelecionados.length === 0) return toast.error('Selecione ao menos um vistoriador');

    try {
      // Se editando, remover vínculos antigos primeiro
      if (editingCidade) {
        for (const reg of editingCidade.registros) {
          await desvincular.mutateAsync(reg.id);
        }
      }

      // Criar novos vínculos
      for (const id of formSelecionados) {
        await vincular.mutateAsync({
          cidade: formCidade.trim(),
          uf: formUf,
          tipo_vistoriador: formTipo,
          vistoriador_comum_id: formTipo === 'comum' ? id : null,
          vistoriador_prestador_id: formTipo === 'prestador' ? id : null,
        });
      }

      setModalOpen(false);
      toast.success(editingCidade ? 'Região atualizada' : 'Região adicionada');
    } catch {
      toast.error('Erro ao salvar região');
    }
  };

  const handleRemove = async () => {
    if (!removeCidade) return;
    try {
      for (const reg of removeCidade.registros) {
        await desvincular.mutateAsync(reg.id);
      }
      setRemoveCidade(null);
      toast.success('Região removida');
    } catch {
      toast.error('Erro ao remover região');
    }
  };

  return (
    <PermissionGate
      permission={['isDiretor', 'isAdminMaster', 'isCoordenadorMonitoramento']}
      mode="any"
      fallback={
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Acesso restrito.</p>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link to="/">Home</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link to="/monitoramento/dashboard">Monitoramento</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink className="text-muted-foreground">Configurações</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Regiões</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Regiões de Atendimento</h1>
            <p className="text-muted-foreground">Configure quais vistoriadores atendem cada cidade</p>
          </div>
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Região
          </Button>
        </div>

        {/* Banner informativo */}
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-800 dark:text-blue-300">
            Instalações agendadas em cidades sem vistoriador cadastrado serão sinalizadas como{' '}
            <strong>Fora de Cobertura</strong> e precisarão de atribuição manual a um Vistoriador Prestador.
          </p>
        </div>

        {/* Tabela ou estado vazio */}
        <Card className="border-border bg-card">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Carregando...</div>
            ) : agrupados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <Map className="h-12 w-12 text-muted-foreground/50" />
                <p className="text-muted-foreground">Nenhuma região cadastrada ainda</p>
                <Button onClick={openAdd}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Região
                </Button>
              </div>
            ) : (
              <TooltipProvider>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cidade</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Tipo de Cobertura</TableHead>
                      <TableHead>Vistoriadores</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agrupados.map((grupo) => {
                      const tipos = [...new Set(grupo.registros.map(r => r.tipo_vistoriador))];
                      const nomes = grupo.registros.map(r => getNomeVistoriador(r));
                      const nomesVisiveis = nomes.slice(0, 2);
                      const nomesExtras = nomes.slice(2);

                      return (
                        <TableRow key={`${grupo.cidade}|${grupo.uf}`}>
                          <TableCell className="font-medium">{grupo.cidade}</TableCell>
                          <TableCell>{grupo.uf}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {tipos.map(t => (
                                <Badge
                                  key={t}
                                  className={
                                    t === 'comum'
                                      ? 'bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-400'
                                      : 'bg-orange-500/15 text-orange-700 border-orange-500/30 dark:text-orange-400'
                                  }
                                >
                                  {t === 'comum' ? 'Comum' : 'Prestador'}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {nomesVisiveis.join(', ')}
                              {nomesExtras.length > 0 && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="ml-1 text-primary cursor-default">
                                      +{nomesExtras.length} outros
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="space-y-1">
                                      {nomesExtras.map((n, i) => (
                                        <p key={i}>{n}</p>
                                      ))}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(grupo)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setRemoveCidade(grupo)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TooltipProvider>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal Adicionar / Editar */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCidade ? 'Editar Região' : 'Adicionar Região'}</DialogTitle>
            <DialogDescription>
              {editingCidade
                ? 'Atualize os dados da região de atendimento'
                : 'Configure uma nova região e vincule vistoriadores'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da cidade</Label>
              <Input
                placeholder="Ex: São Paulo"
                value={formCidade}
                onChange={e => setFormCidade(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Estado (UF)</Label>
              <Select value={formUf} onValueChange={setFormUf}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o estado" />
                </SelectTrigger>
                <SelectContent>
                  {UF_LIST.map(uf => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de vistoriador</Label>
              <Select value={formTipo} onValueChange={(v) => handleTipoChange(v as 'comum' | 'prestador')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comum">Comum</SelectItem>
                  <SelectItem value="prestador">Prestador</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Vistoriadores</Label>
              {listaOpcoes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum vistoriador {formTipo === 'comum' ? 'comum' : 'prestador'} cadastrado.
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-2 border rounded-md p-3">
                  {listaOpcoes.map((v: any) => (
                    <div key={v.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`vist-${v.id}`}
                        checked={formSelecionados.includes(v.id)}
                        onCheckedChange={() => toggleSelecionado(v.id)}
                      />
                      <label htmlFor={`vist-${v.id}`} className="text-sm cursor-pointer">
                        {v.nome}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={vincular.isPending || desvincular.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de remoção */}
      <AlertDialog open={!!removeCidade} onOpenChange={() => setRemoveCidade(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover região</AlertDialogTitle>
            <AlertDialogDescription>
              Remover esta região irá desassociar os vistoriadores desta cidade. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove}>Confirmar Remoção</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PermissionGate>
  );
}
