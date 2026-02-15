import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import { supabase } from '@/integrations/supabase/client';
import { PRIORIDADE_LABELS, PrioridadePrazo, TIPO_PRAZO_LABELS, TipoPrazo } from '@/types/juridico';

interface NovoPrazoModalProps {
  open: boolean;
  onClose: () => void;
  processoId?: string;
}

export function NovoPrazoModal({ open, onClose, processoId }: NovoPrazoModalProps) {
  const queryClient = useQueryClient();

  const [descricao, setDescricao] = useState('');
  const [tipo, setTipo] = useState<TipoPrazo>('judicial');
  const [dataInicio, setDataInicio] = useState<Date>(new Date());
  const [prazoDias, setPrazoDias] = useState<number | ''>('');
  const [dataFim, setDataFim] = useState<Date | null>(null);
  const [horaVencimento, setHoraVencimento] = useState('');
  const [prioridade, setPrioridade] = useState<PrioridadePrazo>('normal');
  const [processoSelecionado, setProcessoSelecionado] = useState(processoId || '');
  const [advogadoId, setAdvogadoId] = useState('');
  const [lembreteAtivo, setLembreteAtivo] = useState(true);
  const [observacoes, setObservacoes] = useState('');
  const [buscaProcesso, setBuscaProcesso] = useState('');

  // Processos for search
  const { data: processos = [] } = useQuery({
    queryKey: ['processos-search', buscaProcesso],
    queryFn: async () => {
      let query = supabase.from('processos').select('id, numero, numero_processo, parte_contraria_nome').eq('status', 'ativo').order('numero', { ascending: false }).limit(20);
      if (buscaProcesso) {
        query = query.or(`numero.ilike.%${buscaProcesso}%,numero_processo.ilike.%${buscaProcesso}%,parte_contraria_nome.ilike.%${buscaProcesso}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !processoId,
  });

  // Advogados
  const { data: advogados = [] } = useQuery({
    queryKey: ['advogados-ativos-select'],
    queryFn: async () => {
      const { data, error } = await supabase.from('advogados').select('id, nome, oab').eq('ativo', true).order('nome');
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (prazoDias && typeof prazoDias === 'number' && prazoDias > 0) {
      setDataFim(addDays(dataInicio, prazoDias));
    }
  }, [prazoDias, dataInicio]);

  const handleDataFimChange = (newDate: Date | undefined) => {
    if (newDate) { setDataFim(newDate); setPrazoDias(''); }
  };

  const handleClose = () => {
    setDescricao(''); setTipo('judicial'); setDataInicio(new Date()); setPrazoDias('');
    setDataFim(null); setHoraVencimento(''); setPrioridade('normal');
    setProcessoSelecionado(processoId || ''); setAdvogadoId('');
    setLembreteAtivo(true); setObservacoes(''); setBuscaProcesso('');
    onClose();
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!dataFim) throw new Error('Data de vencimento é obrigatória');
      const pid = processoSelecionado || processoId;
      const insertData = {
        processo_id: pid || '00000000-0000-0000-0000-000000000000',
        descricao,
        tipo,
        data_inicio: format(dataInicio, 'yyyy-MM-dd'),
        data_fim: format(dataFim, 'yyyy-MM-dd'),
        prioridade,
        status: 'pendente' as const,
        lembrete_ativo: lembreteAtivo,
        lembrete_dias: [7, 3, 1],
        ...(advogadoId ? { responsavel_id: advogadoId } : {}),
        ...(horaVencimento ? { hora_vencimento: horaVencimento } : {}),
      };

      const { data, error } = await supabase.from('processos_prazos').insert([insertData]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Prazo criado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['prazos-controle'] });
      queryClient.invalidateQueries({ queryKey: ['processos_prazos'] });
      queryClient.invalidateQueries({ queryKey: ['juridico-stats'] });
      handleClose();
    },
    onError: (error) => { toast.error('Erro ao criar prazo: ' + error.message); },
  });

  const isValid = descricao.trim().length >= 5 && dataFim !== null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Novo Prazo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tipo */}
          <div className="space-y-2">
            <Label>Tipo *</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoPrazo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_PRAZO_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Prazo para contestação" />
          </div>

          {/* Processo vinculado */}
          {!processoId && (
            <div className="space-y-2">
              <Label>Processo vinculado {tipo === 'judicial' ? '*' : '(opcional)'}</Label>
              <Select value={processoSelecionado} onValueChange={setProcessoSelecionado}>
                <SelectTrigger><SelectValue placeholder="Selecione um processo" /></SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <Input placeholder="Buscar processo..." value={buscaProcesso} onChange={(e) => setBuscaProcesso(e.target.value)} className="mb-2" />
                  </div>
                  {processos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.numero} — {p.parte_contraria_nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Advogado responsável */}
          <div className="space-y-2">
            <Label>Advogado responsável</Label>
            <Select value={advogadoId} onValueChange={setAdvogadoId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {advogados.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.nome} {a.oab ? `(OAB ${a.oab})` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data de Início */}
          <div className="space-y-2">
            <Label>Data de Início</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <Calendar className="mr-2 h-4 w-4" />
                  {format(dataInicio, 'dd/MM/yyyy', { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent mode="single" selected={dataInicio} onSelect={(d) => d && setDataInicio(d)} locale={ptBR} className="pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          {/* Dias ou Data de Vencimento */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Dias para prazo</Label>
              <Input type="number" min={1} value={prazoDias} onChange={(e) => setPrazoDias(e.target.value ? Number(e.target.value) : '')} placeholder="Ex: 15" />
            </div>
            <div className="space-y-2">
              <Label>Ou data específica *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !dataFim && 'text-muted-foreground')}>
                    <Calendar className="mr-2 h-4 w-4" />
                    {dataFim ? format(dataFim, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent mode="single" selected={dataFim || undefined} onSelect={handleDataFimChange} locale={ptBR} disabled={(date) => date < new Date()} className="pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Hora de vencimento */}
          <div className="space-y-2">
            <Label>Hora de vencimento (opcional)</Label>
            <Input type="time" value={horaVencimento} onChange={(e) => setHoraVencimento(e.target.value)} />
          </div>

          {/* Prioridade */}
          <div className="space-y-2">
            <Label>Prioridade</Label>
            <Select value={prioridade} onValueChange={(v) => setPrioridade(v as PrioridadePrazo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PRIORIDADE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lembrete */}
          <div className="flex items-center gap-2">
            <Checkbox id="lembrete" checked={lembreteAtivo} onCheckedChange={(v) => setLembreteAtivo(!!v)} />
            <Label htmlFor="lembrete" className="cursor-pointer">Lembrete automático (7, 3 e 1 dia antes)</Label>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Observações adicionais..." rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={() => createMutation.mutate()} disabled={!isValid || createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar Prazo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
