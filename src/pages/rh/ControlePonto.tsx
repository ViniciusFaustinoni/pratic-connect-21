import { Clock, Calendar, ChevronLeft, ChevronRight, Check, X, Edit, Plus, User, ChevronsUpDown, ClipboardList } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { RegistrarPontoModal } from '@/components/rh/RegistrarPontoModal';

interface PontoRegistro {
  id: string;
  funcionario_id: string;
  data: string;
  entrada_1: string | null;
  saida_1: string | null;
  entrada_2: string | null;
  saida_2: string | null;
  tipo_dia: string;
  horas_trabalhadas: string | null;
  horas_extras: string | null;
  status: string;
  justificativa: string | null;
  funcionario?: {
    nome_completo: string;
    foto_url: string | null;
  };
}

const tipoDiaConfig: Record<string, { label: string; className: string }> = {
  normal: { label: 'Normal', className: '' },
  feriado: { label: 'Feriado', className: 'bg-blue-100 text-blue-800' },
  folga: { label: 'Folga', className: 'bg-gray-100 text-gray-800' },
  falta: { label: 'Falta', className: 'bg-red-100 text-red-800' },
  atestado: { label: 'Atestado', className: 'bg-yellow-100 text-yellow-800' },
  ferias: { label: 'Férias', className: 'bg-green-100 text-green-800' },
};

const statusConfig: Record<string, { label: string; className: string }> = {
  pendente: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800' },
  aprovado: { label: 'Aprovado', className: 'bg-green-100 text-green-800' },
  rejeitado: { label: 'Rejeitado', className: 'bg-red-100 text-red-800' },
};

const meses = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function ControlePonto() {
  const queryClient = useQueryClient();
  const [funcionarioId, setFuncionarioId] = useState<string | null>(null);
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState('todos');
  const [funcionarioOpen, setFuncionarioOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [registrarPontoOpen, setRegistrarPontoOpen] = useState(false);
  const [editingRegistro, setEditingRegistro] = useState<PontoRegistro | null>(null);

  // Form state for editing
  const [formData, setFormData] = useState({
    entrada_1: '',
    saida_1: '',
    entrada_2: '',
    saida_2: '',
    tipo_dia: 'normal',
    justificativa: ''
  });

  const { data: funcionarios } = useQuery({
    queryKey: ['funcionarios-combobox'],
    queryFn: async () => {
      const { data } = await supabase
        .from('funcionarios')
        .select('id, nome_completo')
        .eq('status', 'ativo')
        .order('nome_completo');
      return data || [];
    }
  });

  const { data: registros, isLoading } = useQuery({
    queryKey: ['ponto-registros', funcionarioId, mes, ano, statusFilter],
    queryFn: async () => {
      const inicioMes = `${ano}-${String(mes).padStart(2, '0')}-01`;
      const ultimoDia = new Date(ano, mes, 0).getDate();
      const fimMes = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

      let query = supabase
        .from('ponto_registros')
        .select(`
          *,
          funcionario:funcionarios(nome_completo, foto_url)
        `)
        .gte('data', inicioMes)
        .lte('data', fimMes)
        .order('data', { ascending: false });

      if (funcionarioId) {
        query = query.eq('funcionario_id', funcionarioId);
      }

      if (statusFilter !== 'todos') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PontoRegistro[];
    }
  });

  const resumo = useMemo(() => {
    if (!registros) return null;

    const diasTrabalhados = registros.filter(r => r.tipo_dia === 'normal' && r.entrada_1).length;
    
    let totalMinutosTrabalhados = 0;
    let totalMinutosExtras = 0;

    registros.forEach(r => {
      if (r.horas_trabalhadas) {
        const [h, m] = r.horas_trabalhadas.split(':').map(Number);
        totalMinutosTrabalhados += (h * 60) + (m || 0);
      }
      if (r.horas_extras) {
        const [h, m] = r.horas_extras.split(':').map(Number);
        totalMinutosExtras += (h * 60) + (m || 0);
      }
    });

    const horasTrabalhadas = `${Math.floor(totalMinutosTrabalhados / 60)}h ${totalMinutosTrabalhados % 60}min`;
    const horasExtras = `${Math.floor(totalMinutosExtras / 60)}h ${totalMinutosExtras % 60}min`;
    const faltas = registros.filter(r => r.tipo_dia === 'falta').length;

    return { diasTrabalhados, horasTrabalhadas, horasExtras, faltas };
  }, [registros]);

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<PontoRegistro> }) => {
      const { error } = await supabase
        .from('ponto_registros')
        .update(data.updates)
        .eq('id', data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ponto-registros'] });
      toast.success('Registro atualizado!');
      setIsModalOpen(false);
      setEditingRegistro(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao atualizar registro');
    }
  });

  const aprovarMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ponto_registros')
        .update({ status: 'aprovado' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ponto-registros'] });
      toast.success('Ponto aprovado!');
    }
  });

  const handlePrevMonth = () => {
    if (mes === 1) {
      setMes(12);
      setAno(ano - 1);
    } else {
      setMes(mes - 1);
    }
  };

  const handleNextMonth = () => {
    if (mes === 12) {
      setMes(1);
      setAno(ano + 1);
    } else {
      setMes(mes + 1);
    }
  };

  const handleEdit = (registro: PontoRegistro) => {
    setEditingRegistro(registro);
    setFormData({
      entrada_1: registro.entrada_1 || '',
      saida_1: registro.saida_1 || '',
      entrada_2: registro.entrada_2 || '',
      saida_2: registro.saida_2 || '',
      tipo_dia: registro.tipo_dia || 'normal',
      justificativa: registro.justificativa || ''
    });
    setIsModalOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingRegistro) return;

    updateMutation.mutate({
      id: editingRegistro.id,
      updates: {
        entrada_1: formData.entrada_1 || null,
        saida_1: formData.saida_1 || null,
        entrada_2: formData.entrada_2 || null,
        saida_2: formData.saida_2 || null,
        tipo_dia: formData.tipo_dia,
        justificativa: formData.justificativa || null
      }
    });
  };

  const selectedFuncionario = funcionarios?.find(f => f.id === funcionarioId);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">Controle de Ponto</h1>
        </div>
        <Button onClick={() => setRegistrarPontoOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Registrar Ponto
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Combobox Funcionário */}
            <div className="w-72">
              <Popover open={funcionarioOpen} onOpenChange={setFuncionarioOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal"
                  >
                    <User className="h-4 w-4 mr-2 shrink-0 opacity-50" />
                    {selectedFuncionario?.nome_completo || "Todos os funcionários"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0">
                  <Command>
                    <CommandInput placeholder="Buscar funcionário..." />
                    <CommandList>
                      <CommandEmpty>Nenhum funcionário encontrado.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value=""
                          onSelect={() => {
                            setFuncionarioId(null);
                            setFuncionarioOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              !funcionarioId ? "opacity-100" : "opacity-0"
                            )}
                          />
                          Todos os funcionários
                        </CommandItem>
                        {funcionarios?.map((func) => (
                          <CommandItem
                            key={func.id}
                            value={func.nome_completo}
                            onSelect={() => {
                              setFuncionarioId(func.id);
                              setFuncionarioOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                funcionarioId === func.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {func.nome_completo}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Navegação do Mês */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2 px-4 py-2 border rounded-md min-w-[180px] justify-center">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{meses[mes - 1]} {ano}</span>
              </div>
              <Button variant="outline" size="icon" onClick={handleNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Filtro Status */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="rejeitado">Rejeitado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Resumo do Mês */}
      {funcionarioId && resumo && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Dias Trabalhados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{resumo.diasTrabalhados}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Horas Trabalhadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{resumo.horasTrabalhadas}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Horas Extras
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{resumo.horasExtras}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Faltas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{resumo.faltas}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabela de Registros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Registros de Ponto
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !registros?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum registro de ponto encontrado para este período.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  {!funcionarioId && <TableHead>Funcionário</TableHead>}
                  <TableHead>Tipo</TableHead>
                  <TableHead>Entrada 1</TableHead>
                  <TableHead>Saída 1</TableHead>
                  <TableHead>Entrada 2</TableHead>
                  <TableHead>Saída 2</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registros.map((registro) => {
                  const tipoDia = tipoDiaConfig[registro.tipo_dia] || tipoDiaConfig.normal;
                  const status = statusConfig[registro.status] || statusConfig.pendente;

                  return (
                    <TableRow key={registro.id}>
                      <TableCell className="font-medium">
                        {format(parseISO(registro.data), 'dd/MM/yyyy (EEE)', { locale: ptBR })}
                      </TableCell>
                      {!funcionarioId && (
                        <TableCell>{registro.funcionario?.nome_completo}</TableCell>
                      )}
                      <TableCell>
                        {tipoDia.className ? (
                          <Badge className={tipoDia.className}>{tipoDia.label}</Badge>
                        ) : (
                          tipoDia.label
                        )}
                      </TableCell>
                      <TableCell>{registro.entrada_1 || '-'}</TableCell>
                      <TableCell>{registro.saida_1 || '-'}</TableCell>
                      <TableCell>{registro.entrada_2 || '-'}</TableCell>
                      <TableCell>{registro.saida_2 || '-'}</TableCell>
                      <TableCell className="font-medium">
                        {registro.horas_trabalhadas || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={status.className}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(registro)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {registro.status === 'pendente' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => aprovarMutation.mutate(registro.id)}
                              disabled={aprovarMutation.isPending}
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
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

      {/* Modal Editar Ponto */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Registro de Ponto</DialogTitle>
          </DialogHeader>

          {editingRegistro && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground">Data</p>
                <p className="font-medium">
                  {format(parseISO(editingRegistro.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="entrada_1">Entrada 1</Label>
                  <Input
                    id="entrada_1"
                    type="time"
                    value={formData.entrada_1}
                    onChange={(e) => setFormData({ ...formData, entrada_1: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="saida_1">Saída 1</Label>
                  <Input
                    id="saida_1"
                    type="time"
                    value={formData.saida_1}
                    onChange={(e) => setFormData({ ...formData, saida_1: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="entrada_2">Entrada 2</Label>
                  <Input
                    id="entrada_2"
                    type="time"
                    value={formData.entrada_2}
                    onChange={(e) => setFormData({ ...formData, entrada_2: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="saida_2">Saída 2</Label>
                  <Input
                    id="saida_2"
                    type="time"
                    value={formData.saida_2}
                    onChange={(e) => setFormData({ ...formData, saida_2: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tipo_dia">Tipo do Dia</Label>
                <Select
                  value={formData.tipo_dia}
                  onValueChange={(value) => setFormData({ ...formData, tipo_dia: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(tipoDiaConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="justificativa">Justificativa</Label>
                <Textarea
                  id="justificativa"
                  placeholder="Justificativa para alteração..."
                  value={formData.justificativa}
                  onChange={(e) => setFormData({ ...formData, justificativa: e.target.value })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Registrar Ponto */}
      <RegistrarPontoModal 
        open={registrarPontoOpen} 
        onClose={() => setRegistrarPontoOpen(false)} 
      />
    </div>
  );
}
