import { Calendar as CalendarIcon, Info, AlertCircle, Wallet } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { differenceInDays, differenceInMonths, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

interface SolicitarFeriasModalProps {
  open: boolean;
  onClose: () => void;
  funcionarioId?: string | null;
}

export function SolicitarFeriasModal({ open, onClose, funcionarioId }: SolicitarFeriasModalProps) {
  const queryClient = useQueryClient();
  
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();
  const [diasAbono, setDiasAbono] = useState(0);
  const [adiantamento13, setAdiantamento13] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState<string | null>(funcionarioId || null);
  const [funcionarioOpen, setFuncionarioOpen] = useState(false);

  useEffect(() => {
    if (funcionarioId) {
      setFuncionarioSelecionado(funcionarioId);
    }
  }, [funcionarioId]);

  useEffect(() => {
    if (!open) {
      setDataInicio(undefined);
      setDataFim(undefined);
      setDiasAbono(0);
      setAdiantamento13(false);
      setObservacoes('');
      if (!funcionarioId) {
        setFuncionarioSelecionado(null);
      }
    }
  }, [open, funcionarioId]);

  const { data: funcionarios } = useQuery({
    queryKey: ['funcionarios-ferias-select'],
    queryFn: async () => {
      const { data } = await supabase
        .from('funcionarios')
        .select('id, nome_completo, data_admissao')
        .eq('status', 'ativo')
        .order('nome_completo');
      return data || [];
    },
    enabled: open && !funcionarioId
  });

  const { data: funcionarioInfo } = useQuery({
    queryKey: ['funcionario-ferias-info', funcionarioSelecionado],
    queryFn: async () => {
      const { data } = await supabase
        .from('funcionarios')
        .select('id, nome_completo, data_admissao, salario_atual')
        .eq('id', funcionarioSelecionado)
        .single();
      return data;
    },
    enabled: !!funcionarioSelecionado
  });

  const { data: feriasAnteriores } = useQuery({
    queryKey: ['ferias-funcionario', funcionarioSelecionado],
    queryFn: async () => {
      const { data } = await supabase
        .from('ferias')
        .select('dias_gozados, dias_abono, periodo_aquisitivo_inicio, periodo_aquisitivo_fim')
        .eq('funcionario_id', funcionarioSelecionado)
        .in('status', ['aprovada', 'em_gozo', 'concluida']);
      return data || [];
    },
    enabled: !!funcionarioSelecionado
  });

  const diasFerias = useMemo(() => {
    if (!dataInicio || !dataFim) return 0;
    return differenceInDays(dataFim, dataInicio) + 1;
  }, [dataInicio, dataFim]);

  const periodoAquisitivo = useMemo(() => {
    if (!funcionarioInfo?.data_admissao) return null;
    const admissao = parseISO(funcionarioInfo.data_admissao);
    const hoje = new Date();
    const mesesTrabalhados = differenceInMonths(hoje, admissao);
    const anosCompletos = Math.floor(mesesTrabalhados / 12);
    
    if (anosCompletos < 1) return null;
    
    const inicio = new Date(admissao);
    inicio.setFullYear(admissao.getFullYear() + anosCompletos - 1);
    
    const fim = new Date(inicio);
    fim.setFullYear(inicio.getFullYear() + 1);
    fim.setDate(fim.getDate() - 1);
    
    return { inicio, fim };
  }, [funcionarioInfo]);

  const diasJaGozados = useMemo(() => {
    if (!feriasAnteriores || !periodoAquisitivo) return 0;
    
    return feriasAnteriores
      .filter(f => {
        const periodoInicio = parseISO(f.periodo_aquisitivo_inicio);
        return periodoInicio.getTime() === periodoAquisitivo.inicio.getTime();
      })
      .reduce((acc, f) => acc + (f.dias_gozados || 0), 0);
  }, [feriasAnteriores, periodoAquisitivo]);

  const saldoDias = 30 - diasJaGozados;

  // Cálculo prévia de valores
  const previaValores = useMemo(() => {
    const salario = funcionarioInfo?.salario_atual || 0;
    if (!salario || diasFerias <= 0) return null;
    
    const salarioDia = salario / 30;
    const valorFerias = salarioDia * diasFerias;
    const tercoFerias = valorFerias / 3;
    const valorAbono = diasAbono > 0 ? (salarioDia * diasAbono) + (salarioDia * diasAbono / 3) : 0;
    const adiantamento13Valor = adiantamento13 ? salario / 2 : 0;
    
    return {
      valorFerias,
      tercoFerias,
      valorAbono,
      adiantamento13Valor,
      totalBruto: valorFerias + tercoFerias + valorAbono + adiantamento13Valor
    };
  }, [funcionarioInfo?.salario_atual, diasFerias, diasAbono, adiantamento13]);

  const validacoes = useMemo(() => {
    const erros: string[] = [];
    const avisos: string[] = [];

    if (diasFerias > 0 && diasFerias < 5) {
      erros.push('Mínimo de 5 dias por período de férias');
    }
    if (diasFerias > 30) {
      erros.push('Máximo de 30 dias por período');
    }
    if (diasFerias > saldoDias) {
      erros.push(`Saldo insuficiente. Disponível: ${saldoDias} dias`);
    }
    if (dataInicio && dataInicio <= new Date()) {
      erros.push('Data de início deve ser futura');
    }
    if (dataInicio && dataFim && dataFim < dataInicio) {
      erros.push('Data fim deve ser após data início');
    }
    if (diasAbono > 10) {
      erros.push('Abono pecuniário máximo de 10 dias');
    }
    if (diasAbono > diasFerias / 3) {
      avisos.push('Abono não pode exceder 1/3 das férias');
    }

    return { erros, avisos, valido: erros.length === 0 && diasFerias >= 5 };
  }, [diasFerias, saldoDias, dataInicio, dataFim, diasAbono]);

  const solicitarFerias = useMutation({
    mutationFn: async () => {
      if (!funcionarioSelecionado || !dataInicio || !dataFim || !periodoAquisitivo) {
        throw new Error('Dados incompletos');
      }

      const { data, error } = await supabase
        .from('ferias')
        .insert({
          funcionario_id: funcionarioSelecionado,
          periodo_aquisitivo_inicio: format(periodoAquisitivo.inicio, 'yyyy-MM-dd'),
          periodo_aquisitivo_fim: format(periodoAquisitivo.fim, 'yyyy-MM-dd'),
          data_inicio: format(dataInicio, 'yyyy-MM-dd'),
          data_fim: format(dataFim, 'yyyy-MM-dd'),
          dias_gozados: diasFerias,
          dias_abono: diasAbono,
          adiantamento_13: adiantamento13,
          status: 'solicitada',
          observacoes: observacoes || null
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Férias solicitadas com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['ferias'] });
      onClose();
    },
    onError: (error) => {
      toast.error('Erro ao solicitar férias: ' + error.message);
    }
  });

  const funcionarioSelecionadoNome = funcionarioId 
    ? funcionarioInfo?.nome_completo 
    : funcionarios?.find(f => f.id === funcionarioSelecionado)?.nome_completo;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Solicitar Férias
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info Box */}
          {funcionarioSelecionado && periodoAquisitivo && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <div className="font-medium">{funcionarioSelecionadoNome}</div>
                <div className="text-muted-foreground">
                  Período aquisitivo: {format(periodoAquisitivo.inicio, 'dd/MM/yyyy')} a {format(periodoAquisitivo.fim, 'dd/MM/yyyy')}
                </div>
                <div className="text-muted-foreground">
                  Saldo disponível: <span className="font-medium text-foreground">{saldoDias} dias</span>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Seleção de Funcionário */}
          {!funcionarioId && (
            <div className="space-y-2">
              <Label>Funcionário</Label>
              <Popover open={funcionarioOpen} onOpenChange={setFuncionarioOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    {funcionarioSelecionadoNome || 'Selecione o funcionário...'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar funcionário..." />
                    <CommandList>
                      <CommandEmpty>Nenhum funcionário encontrado.</CommandEmpty>
                      <CommandGroup>
                        {funcionarios?.map((func) => (
                          <CommandItem
                            key={func.id}
                            value={func.nome_completo}
                            onSelect={() => {
                              setFuncionarioSelecionado(func.id);
                              setFuncionarioOpen(false);
                            }}
                          >
                            {func.nome_completo}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Data Início */}
          <div className="space-y-2">
            <Label>Data Início</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dataInicio && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataInicio}
                  onSelect={setDataInicio}
                  locale={ptBR}
                  disabled={(date) => date <= new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Data Fim */}
          <div className="space-y-2">
            <Label>Data Fim</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dataFim && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataFim ? format(dataFim, "dd/MM/yyyy") : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataFim}
                  onSelect={setDataFim}
                  locale={ptBR}
                  disabled={(date) => dataInicio ? date < dataInicio : date <= new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Info Dias */}
          {diasFerias > 0 && (
            <div className="text-sm text-muted-foreground text-center py-2 bg-muted rounded-md">
              Total: <span className="font-medium text-foreground">{diasFerias} dias</span> de férias
            </div>
          )}

          {/* Prévia de Valores */}
          {previaValores && previaValores.totalBruto > 0 && (
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-medium text-sm">
                <Wallet className="h-4 w-4" />
                Prévia de Valores (Bruto)
              </div>
              <div className="text-xs space-y-1 text-green-600 dark:text-green-400">
                <div className="flex justify-between">
                  <span>Férias ({diasFerias} dias)</span>
                  <span>{formatCurrency(previaValores.valorFerias)}</span>
                </div>
                <div className="flex justify-between">
                  <span>+ 1/3 Constitucional</span>
                  <span>{formatCurrency(previaValores.tercoFerias)}</span>
                </div>
                {previaValores.valorAbono > 0 && (
                  <div className="flex justify-between">
                    <span>+ Abono Pecuniário ({diasAbono}d + 1/3)</span>
                    <span>{formatCurrency(previaValores.valorAbono)}</span>
                  </div>
                )}
                {previaValores.adiantamento13Valor > 0 && (
                  <div className="flex justify-between">
                    <span>+ Adiantamento 13º (50%)</span>
                    <span>{formatCurrency(previaValores.adiantamento13Valor)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t border-green-300 dark:border-green-700 font-medium">
                  <span>Total Bruto</span>
                  <span>{formatCurrency(previaValores.totalBruto)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Dias Abono */}
          <div className="space-y-2">
            <Label>Dias de Abono Pecuniário (0-10)</Label>
            <Input
              type="number"
              min={0}
              max={10}
              value={diasAbono}
              onChange={(e) => setDiasAbono(Math.min(10, Math.max(0, parseInt(e.target.value) || 0)))}
            />
            <p className="text-xs text-muted-foreground">
              Converter até 1/3 das férias em dinheiro
            </p>
          </div>

          {/* Adiantamento 13º */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="adiantamento13"
              checked={adiantamento13}
              onCheckedChange={(checked) => setAdiantamento13(checked === true)}
            />
            <Label htmlFor="adiantamento13" className="text-sm cursor-pointer">
              Adiantar 1ª parcela do 13º salário
            </Label>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações adicionais..."
              rows={3}
            />
          </div>

          {/* Validações */}
          {validacoes.erros.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside text-sm">
                  {validacoes.erros.map((erro, i) => (
                    <li key={i}>{erro}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {validacoes.avisos.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside text-sm">
                  {validacoes.avisos.map((aviso, i) => (
                    <li key={i}>{aviso}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => solicitarFerias.mutate()}
            disabled={!validacoes.valido || !funcionarioSelecionado || solicitarFerias.isPending}
          >
            {solicitarFerias.isPending ? 'Solicitando...' : 'Solicitar Férias'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
