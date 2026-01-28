import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface RegistrarPontoModalProps {
  open: boolean;
  onClose: () => void;
}

const tiposDia = [
  { value: 'normal', label: 'Normal' },
  { value: 'feriado', label: 'Feriado' },
  { value: 'folga', label: 'Folga' },
  { value: 'falta', label: 'Falta' },
  { value: 'atestado', label: 'Atestado' },
  { value: 'ferias', label: 'Férias' },
];

export function RegistrarPontoModal({ open, onClose }: RegistrarPontoModalProps) {
  const queryClient = useQueryClient();
  const [funcionarioId, setFuncionarioId] = useState('');
  const [funcionarioOpen, setFuncionarioOpen] = useState(false);
  const [data, setData] = useState<Date | undefined>(new Date());
  const [dataOpen, setDataOpen] = useState(false);
  const [entrada1, setEntrada1] = useState('');
  const [saida1, setSaida1] = useState('');
  const [entrada2, setEntrada2] = useState('');
  const [saida2, setSaida2] = useState('');
  const [tipoDia, setTipoDia] = useState('normal');
  const [justificativa, setJustificativa] = useState('');

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

  const mutation = useMutation({
    mutationFn: async () => {
      if (!funcionarioId || !data) throw new Error('Selecione o funcionário e a data');

      const { error } = await supabase
        .from('ponto_registros')
        .insert({
          funcionario_id: funcionarioId,
          data: format(data, 'yyyy-MM-dd'),
          entrada_1: entrada1 || null,
          saida_1: saida1 || null,
          entrada_2: entrada2 || null,
          saida_2: saida2 || null,
          tipo_dia: tipoDia,
          justificativa: justificativa || null,
          status: 'pendente'
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ponto-registros'] });
      toast.success('Registro de ponto criado com sucesso!');
      handleClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao criar registro');
    }
  });

  const handleClose = () => {
    setFuncionarioId('');
    setData(new Date());
    setEntrada1('');
    setSaida1('');
    setEntrada2('');
    setSaida2('');
    setTipoDia('normal');
    setJustificativa('');
    onClose();
  };

  const selectedFuncionario = funcionarios?.find(f => f.id === funcionarioId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Ponto</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Funcionário */}
          <div className="space-y-2">
            <Label>Funcionário *</Label>
            <Popover open={funcionarioOpen} onOpenChange={setFuncionarioOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                >
                  {selectedFuncionario?.nome_completo || "Selecione..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Buscar funcionário..." />
                  <CommandList>
                    <CommandEmpty>Nenhum encontrado.</CommandEmpty>
                    <CommandGroup>
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

          {/* Data */}
          <div className="space-y-2">
            <Label>Data *</Label>
            <Popover open={dataOpen} onOpenChange={setDataOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {data ? format(data, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione a data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={data}
                  onSelect={(d) => { setData(d); setDataOpen(false); }}
                  locale={ptBR}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Tipo do Dia */}
          <div className="space-y-2">
            <Label>Tipo do Dia</Label>
            <Select value={tipoDia} onValueChange={setTipoDia}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tiposDia.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Horários */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Entrada 1</Label>
              <Input 
                type="time" 
                value={entrada1} 
                onChange={(e) => setEntrada1(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label>Saída 1</Label>
              <Input 
                type="time" 
                value={saida1} 
                onChange={(e) => setSaida1(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label>Entrada 2</Label>
              <Input 
                type="time" 
                value={entrada2} 
                onChange={(e) => setEntrada2(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label>Saída 2</Label>
              <Input 
                type="time" 
                value={saida2} 
                onChange={(e) => setSaida2(e.target.value)} 
              />
            </div>
          </div>

          {/* Justificativa */}
          <div className="space-y-2">
            <Label>Justificativa</Label>
            <Textarea
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Observações ou justificativa..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !funcionarioId}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
