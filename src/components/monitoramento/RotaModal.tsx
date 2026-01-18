import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DndContext,
  DragEndEvent,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  X,
  Eye,
  Wrench,
  MapPin,
  Clock,
  Zap,
  User,
  AlertTriangle,
  Loader2,
  Check,
  Calendar,
  Route,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useInstaladores,
  useInstalacoesDisponiveis,
  useCreateRota,
  useUpdateRota,
  useAddInstalacaoToRota,
  type RotaWithRelations,
} from '@/hooks/useRotas';
import { useVistoriasDisponiveis } from '@/hooks/useVistorias';

// Tipos
interface TarefaDisponivel {
  id: string;
  tipo: 'instalacao' | 'vistoria';
  horarioPreferencial?: string;
  periodo?: 'manha' | 'tarde';
  cliente: string;
  telefone?: string;
  endereco: string;
  cidade?: string;
  bairro?: string;
  veiculoInfo?: string;
}

interface ProfissionalComCapacidade {
  id: string;
  nome: string;
  capacidadeDia: number;
  tarefasAtribuidas: number;
  disponivel: number;
}

interface RotaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rota?: RotaWithRelations | null;
  data: Date;
  onSave?: () => void;
}

const REGIOES_DISPONIVEIS = [
  'Centro',
  'Zona Sul',
  'Zona Norte',
  'Zona Oeste',
  'Interior',
  'Litoral',
];

const CAPACIDADE_DIARIA = 6; // Tarefas máximas por profissional/dia

// Componente de item sortável
function SortableTarefaItem({
  tarefa,
  index,
  onRemove,
}: {
  tarefa: TarefaDisponivel;
  index: number;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tarefa.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Calcular horário baseado na posição (30min deslocamento + 1h30 por tarefa)
  const calcularHorario = (idx: number) => {
    const inicioMinutos = 8 * 60 + 30; // 08:30
    const minutosDecorridos = idx * 90; // 1h30 por tarefa
    const totalMinutos = inicioMinutos + minutosDecorridos;
    const horas = Math.floor(totalMinutos / 60);
    const minutos = totalMinutos % 60;
    return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-lg border bg-card p-3 shadow-sm transition-shadow',
        isDragging && 'shadow-lg ring-2 ring-primary'
      )}
    >
      <div className="flex items-start gap-3">
        <button
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab touch-none text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              #{index + 1}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {calcularHorario(index)}
            </Badge>
            {tarefa.tipo === 'vistoria' ? (
              <Eye className="h-4 w-4 text-blue-500" />
            ) : (
              <Wrench className="h-4 w-4 text-amber-500" />
            )}
            <span className="text-sm font-medium capitalize">{tarefa.tipo}</span>
          </div>
          <p className="text-sm font-medium">{tarefa.cliente}</p>
          <p className="text-xs text-muted-foreground">{tarefa.endereco}</p>
          {tarefa.veiculoInfo && (
            <p className="text-xs text-muted-foreground">{tarefa.veiculoInfo}</p>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(tarefa.id)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function RotaModal({
  open,
  onOpenChange,
  rota,
  data,
  onSave,
}: RotaModalProps) {
  // Estados
  const [profissionalId, setProfissionalId] = useState<string>('');
  const [regioesSelecionadas, setRegioesSelecionadas] = useState<string[]>([]);
  const [tarefasSelecionadasIds, setTarefasSelecionadasIds] = useState<Set<string>>(new Set());
  const [tarefasOrdenadas, setTarefasOrdenadas] = useState<TarefaDisponivel[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Hooks de dados
  const { data: instaladores = [], isLoading: loadingInstaladores } = useInstaladores();
  const { data: instalacoesDisponiveis = [], isLoading: loadingInstalacoes } =
    useInstalacoesDisponiveis(data);
  const { data: vistoriasDisponiveis = [], isLoading: loadingVistorias } =
    useVistoriasDisponiveis(data);

  // Mutations
  const createRota = useCreateRota();
  const updateRota = useUpdateRota();
  const addInstalacao = useAddInstalacaoToRota();

  // Sensores para drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const isEditing = !!rota;

  // Reset ao abrir/fechar modal
  useEffect(() => {
    if (open) {
      if (rota) {
        // Modo edição
        setProfissionalId(rota.instalador_id || '');
        setRegioesSelecionadas(rota.regiao ? [rota.regiao] : []);
        // Converter instalações existentes para tarefas
        const tarefas: TarefaDisponivel[] = (rota.instalacoes || []).map((inst) => ({
          id: inst.id,
          tipo: 'instalacao' as const,
          periodo: inst.periodo as 'manha' | 'tarde',
          cliente: inst.associados?.nome || 'Cliente',
          endereco: `${inst.cidade || ''} ${inst.bairro || ''}`.trim() || 'Endereço não informado',
          cidade: inst.cidade || undefined,
          bairro: inst.bairro || undefined,
          veiculoInfo: inst.veiculos
            ? `${inst.veiculos.marca} ${inst.veiculos.modelo} - ${inst.veiculos.placa}`
            : undefined,
        }));
        setTarefasOrdenadas(tarefas);
        setTarefasSelecionadasIds(new Set(tarefas.map((t) => t.id)));
      } else {
        // Modo criação
        setProfissionalId('');
        setRegioesSelecionadas([]);
        setTarefasSelecionadasIds(new Set());
        setTarefasOrdenadas([]);
      }
    }
  }, [open, rota]);

  // Combinar instalações e vistorias em lista unificada
  const tarefasDisponiveis = useMemo<TarefaDisponivel[]>(() => {
    const instalacoes: TarefaDisponivel[] = instalacoesDisponiveis.map((inst) => ({
      id: inst.id,
      tipo: 'instalacao',
      periodo: inst.periodo as 'manha' | 'tarde',
      horarioPreferencial: inst.periodo === 'manha' ? '09:00' : '14:00',
      cliente: inst.associados?.nome || 'Cliente',
      telefone: inst.associados?.telefone,
      endereco: `${inst.cidade || ''} ${inst.bairro || ''}`.trim() || 'Endereço não informado',
      cidade: inst.cidade || undefined,
      bairro: inst.bairro || undefined,
      veiculoInfo: inst.veiculos
        ? `${inst.veiculos.marca} ${inst.veiculos.modelo} - ${inst.veiculos.placa}`
        : undefined,
    }));

    const vistorias: TarefaDisponivel[] = vistoriasDisponiveis.map((vist: any) => ({
      id: vist.id,
      tipo: 'vistoria',
      horarioPreferencial: '09:00',
      cliente: vist.associado?.nome || vist.veiculo?.associado?.nome || 'Cliente',
      telefone: vist.associado?.telefone || vist.veiculo?.associado?.telefone,
      endereco: 'Endereço a confirmar',
      veiculoInfo: vist.veiculo
        ? `${vist.veiculo.marca} ${vist.veiculo.modelo} - ${vist.veiculo.placa}`
        : undefined,
    }));

    return [...instalacoes, ...vistorias];
  }, [instalacoesDisponiveis, vistoriasDisponiveis]);

  // Filtrar tarefas por região (se selecionada)
  const tarefasFiltradas = useMemo(() => {
    if (regioesSelecionadas.length === 0) return tarefasDisponiveis;
    return tarefasDisponiveis.filter((t) => {
      // Se a tarefa não tem cidade/bairro, mostra para todas as regiões
      if (!t.cidade && !t.bairro) return true;
      // Lógica simplificada - na prática, mapearia cidade/bairro para região
      return true;
    });
  }, [tarefasDisponiveis, regioesSelecionadas]);

  // Tarefas não selecionadas (disponíveis para adicionar)
  const tarefasNaoSelecionadas = useMemo(() => {
    return tarefasFiltradas.filter((t) => !tarefasSelecionadasIds.has(t.id));
  }, [tarefasFiltradas, tarefasSelecionadasIds]);

  // Calcular capacidade do profissional
  const capacidadeProfissional = useMemo<ProfissionalComCapacidade | null>(() => {
    if (!profissionalId) return null;

    const profissional = instaladores.find((i) => i.id === profissionalId);
    if (!profissional) return null;

    const tarefasAtribuidas = tarefasOrdenadas.length;
    return {
      id: profissional.id,
      nome: profissional.nome,
      capacidadeDia: CAPACIDADE_DIARIA,
      tarefasAtribuidas,
      disponivel: Math.max(0, CAPACIDADE_DIARIA - tarefasAtribuidas),
    };
  }, [profissionalId, instaladores, tarefasOrdenadas]);

  // Resumo
  const resumo = useMemo(() => {
    const totalTarefas = tarefasOrdenadas.length;
    const tempoEstimado = 30 + totalTarefas * 90; // 30min deslocamento inicial + 1h30 por tarefa
    const horas = Math.floor(tempoEstimado / 60);
    const minutos = tempoEstimado % 60;
    const kmEstimado = totalTarefas * 12; // 12km médio por tarefa

    return {
      totalTarefas,
      tempoFormatado: `${horas}h${minutos > 0 ? minutos.toString().padStart(2, '0') : ''}`,
      kmEstimado,
    };
  }, [tarefasOrdenadas]);

  // Handlers
  const handleToggleTarefa = (tarefa: TarefaDisponivel) => {
    const newSet = new Set(tarefasSelecionadasIds);
    if (newSet.has(tarefa.id)) {
      newSet.delete(tarefa.id);
      setTarefasOrdenadas((prev) => prev.filter((t) => t.id !== tarefa.id));
    } else {
      newSet.add(tarefa.id);
      setTarefasOrdenadas((prev) => [...prev, tarefa]);
    }
    setTarefasSelecionadasIds(newSet);
  };

  const handleRemoveTarefa = (id: string) => {
    const newSet = new Set(tarefasSelecionadasIds);
    newSet.delete(id);
    setTarefasSelecionadasIds(newSet);
    setTarefasOrdenadas((prev) => prev.filter((t) => t.id !== id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = tarefasOrdenadas.findIndex((t) => t.id === active.id);
    const newIndex = tarefasOrdenadas.findIndex((t) => t.id === over.id);
    setTarefasOrdenadas(arrayMove(tarefasOrdenadas, oldIndex, newIndex));
  };

  const handleOtimizarOrdem = () => {
    // Mock: ordenar por cidade/bairro (na prática usaria API de rotas)
    const ordenadas = [...tarefasOrdenadas].sort((a, b) => {
      const cidadeA = a.cidade || '';
      const cidadeB = b.cidade || '';
      if (cidadeA !== cidadeB) return cidadeA.localeCompare(cidadeB);
      const bairroA = a.bairro || '';
      const bairroB = b.bairro || '';
      return bairroA.localeCompare(bairroB);
    });
    setTarefasOrdenadas(ordenadas);
    toast.success('Ordem otimizada por proximidade geográfica');
  };

  const handleToggleRegiao = (regiao: string) => {
    setRegioesSelecionadas((prev) =>
      prev.includes(regiao) ? prev.filter((r) => r !== regiao) : [...prev, regiao]
    );
  };

  const handleSave = async () => {
    if (!profissionalId) {
      toast.error('Selecione um profissional');
      return;
    }

    if (tarefasOrdenadas.length === 0) {
      toast.error('Adicione pelo menos uma tarefa');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditing && rota) {
        // Atualizar rota existente
        await updateRota.mutateAsync({
          id: rota.id,
          instalador_id: profissionalId,
          regiao: regioesSelecionadas[0] || null,
        });

        // Adicionar novas instalações
        const novasInstalacoes = tarefasOrdenadas.filter(
          (t) => t.tipo === 'instalacao' && !rota.instalacoes?.find((i) => i.id === t.id)
        );

        for (const inst of novasInstalacoes) {
          await addInstalacao.mutateAsync({ rotaId: rota.id, instalacaoId: inst.id });
        }

        toast.success('Rota atualizada com sucesso!');
      } else {
        // Criar nova rota
        const novaRota = await createRota.mutateAsync({
          data_rota: format(data, 'yyyy-MM-dd'),
          instalador_id: profissionalId,
          regiao: regioesSelecionadas[0] || null,
        });

        // Adicionar instalações à rota
        const instalacoesSelecionadas = tarefasOrdenadas.filter(
          (t) => t.tipo === 'instalacao'
        );

        for (const inst of instalacoesSelecionadas) {
          await addInstalacao.mutateAsync({
            rotaId: novaRota.id,
            instalacaoId: inst.id,
          });
        }

        toast.success('Rota criada com sucesso!');
      }

      onSave?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar rota:', error);
      toast.error('Erro ao salvar rota');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = loadingInstaladores || loadingInstalacoes || loadingVistorias;

  // Formatar data
  const dataFormatada = format(data, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const dataCapitalizada = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="h-5 w-5" />
            {isEditing ? `Editar Rota ${rota?.codigo}` : 'Nova Rota'}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {dataCapitalizada}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <div className="grid h-full gap-6 md:grid-cols-2">
            {/* Coluna Esquerda - Configuração */}
            <div className="space-y-6 overflow-y-auto pr-2">
              {/* Seção: Profissional */}
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 font-semibold">
                  <User className="h-4 w-4" />
                  Profissional
                </h3>

                <Select
                  value={profissionalId}
                  onValueChange={setProfissionalId}
                  disabled={loadingInstaladores}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o profissional" />
                  </SelectTrigger>
                  <SelectContent>
                    {instaladores.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id}>
                        {inst.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {capacidadeProfissional && (
                  <Card>
                    <CardContent className="p-3">
                      <div className="grid grid-cols-3 gap-2 text-center text-sm">
                        <div>
                          <p className="text-muted-foreground">Capacidade</p>
                          <p className="font-semibold">
                            {capacidadeProfissional.capacidadeDia} tarefas
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Atribuídas</p>
                          <p className="font-semibold">
                            {capacidadeProfissional.tarefasAtribuidas}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Disponível</p>
                          <p
                            className={cn(
                              'font-semibold',
                              capacidadeProfissional.disponivel > 0
                                ? 'text-green-600'
                                : 'text-amber-600'
                            )}
                          >
                            {capacidadeProfissional.disponivel}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              <Separator />

              {/* Seção: Regiões */}
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 font-semibold">
                  <MapPin className="h-4 w-4" />
                  Regiões
                </h3>

                <div className="grid grid-cols-2 gap-2">
                  {REGIOES_DISPONIVEIS.map((regiao) => (
                    <div key={regiao} className="flex items-center space-x-2">
                      <Checkbox
                        id={`regiao-${regiao}`}
                        checked={regioesSelecionadas.includes(regiao)}
                        onCheckedChange={() => handleToggleRegiao(regiao)}
                      />
                      <Label
                        htmlFor={`regiao-${regiao}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {regiao}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Resumo */}
              <Card className="bg-muted/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Resumo da Rota</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total de tarefas:</span>
                    <span className="font-semibold">{resumo.totalTarefas}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tempo estimado:</span>
                    <span className="font-semibold">{resumo.tempoFormatado}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Km estimado:</span>
                    <span className="font-semibold">{resumo.kmEstimado} km</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Coluna Direita - Tarefas */}
            <div className="flex flex-col space-y-4 overflow-hidden">
              {/* Tarefas Disponíveis */}
              <div className="space-y-2">
                <h3 className="flex items-center gap-2 font-semibold text-sm">
                  <Clock className="h-4 w-4" />
                  Tarefas Disponíveis
                  <Badge variant="secondary" className="ml-auto">
                    {tarefasNaoSelecionadas.length}
                  </Badge>
                </h3>

                <ScrollArea className="h-40 rounded-md border">
                  {isLoading ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : tarefasNaoSelecionadas.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-4 text-center text-muted-foreground">
                      <Check className="h-6 w-6 mb-2" />
                      <p className="text-sm">Todas as tarefas foram atribuídas</p>
                    </div>
                  ) : (
                    <div className="space-y-1 p-2">
                      {tarefasNaoSelecionadas.map((tarefa) => (
                        <div
                          key={tarefa.id}
                          className="flex items-center gap-2 rounded-md border p-2 hover:bg-accent cursor-pointer"
                          onClick={() => handleToggleTarefa(tarefa)}
                        >
                          <Checkbox
                            checked={tarefasSelecionadasIds.has(tarefa.id)}
                            onCheckedChange={() => handleToggleTarefa(tarefa)}
                          />
                          <Badge variant="outline" className="text-xs">
                            {tarefa.horarioPreferencial || tarefa.periodo}
                          </Badge>
                          {tarefa.tipo === 'vistoria' ? (
                            <Eye className="h-4 w-4 text-blue-500" />
                          ) : (
                            <Wrench className="h-4 w-4 text-amber-500" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{tarefa.cliente}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {tarefa.endereco}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>

              <Separator />

              {/* Tarefas da Rota */}
              <div className="flex-1 flex flex-col min-h-0 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-semibold text-sm">
                    <Route className="h-4 w-4" />
                    Tarefas da Rota
                    <Badge variant="default" className="ml-2">
                      {tarefasOrdenadas.length}
                    </Badge>
                  </h3>
                  {tarefasOrdenadas.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={handleOtimizarOrdem}
                    >
                      <Zap className="h-4 w-4" />
                      Otimizar Ordem
                    </Button>
                  )}
                </div>

                <ScrollArea className="flex-1 rounded-md border">
                  {tarefasOrdenadas.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                      <AlertTriangle className="h-8 w-8 mb-2" />
                      <p className="text-sm font-medium">Nenhuma tarefa selecionada</p>
                      <p className="text-xs">
                        Selecione tarefas da lista acima para adicionar à rota
                      </p>
                    </div>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={tarefasOrdenadas.map((t) => t.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2 p-2">
                          {tarefasOrdenadas.map((tarefa, index) => (
                            <SortableTarefaItem
                              key={tarefa.id}
                              tarefa={tarefa}
                              index={index}
                              onRemove={handleRemoveTarefa}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </ScrollArea>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSubmitting || !profissionalId || tarefasOrdenadas.length === 0}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? 'Salvar Rota' : 'Criar Rota'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
