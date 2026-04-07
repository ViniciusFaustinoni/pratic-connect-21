import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Home, Building2, MapPin, CalendarIcon, Loader2 } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useInstaladores } from '@/hooks/useInstaladores';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export interface AgendamentoFormData {
  enderecoTipo: string;
  enderecoTexto: string;
  enderecoReferencia: string;
  dataAgendamento: Date;
  periodo: string;
  tecnicoId: string | null;
  observacoesTecnico: string;
}

interface AgendamentoManutencaoFormProps {
  associadoId: string;
  onConfirmar: (data: AgendamentoFormData) => void;
  isPending: boolean;
  initialData?: Partial<AgendamentoFormData>;
}

const PERIODOS = [
  { value: 'manha', label: 'Manhã', desc: '08h–12h' },
  { value: 'tarde', label: 'Tarde', desc: '13h–17h' },
  { value: 'integral', label: 'Integral', desc: '08h–17h' },
];

export default function AgendamentoManutencaoForm({ associadoId, onConfirmar, isPending, initialData }: AgendamentoManutencaoFormProps) {
  const [enderecoTipo, setEnderecoTipo] = useState(initialData?.enderecoTipo || '');
  const [enderecoTexto, setEnderecoTexto] = useState(initialData?.enderecoTexto || '');
  const [enderecoReferencia, setEnderecoReferencia] = useState(initialData?.enderecoReferencia || '');
  const [dataAgendamento, setDataAgendamento] = useState<Date | undefined>(initialData?.dataAgendamento);
  const [periodo, setPeriodo] = useState(initialData?.periodo || '');
  const [tecnicoId, setTecnicoId] = useState<string>(initialData?.tecnicoId || 'automatico');
  const [observacoesTecnico, setObservacoesTecnico] = useState(initialData?.observacoesTecnico || '');

  const { data: instaladores } = useInstaladores();

  const { data: associado } = useQuery({
    queryKey: ['associado-endereco', associadoId],
    queryFn: async () => {
      const { data } = await supabase
        .from('associados')
        .select('logradouro, numero, bairro, cidade, uf, cep, complemento, nome, telefone')
        .eq('id', associadoId)
        .single();
      return data;
    },
    enabled: !!associadoId,
  });

  const enderecoCadastro = associado
    ? [associado.logradouro, associado.numero, associado.bairro, associado.cidade, associado.uf].filter(Boolean).join(', ')
    : '';

  const minDate = addDays(new Date(), 1);
  const canSubmit = enderecoTipo && dataAgendamento && periodo;

  const handleSubmit = () => {
    if (!canSubmit || !dataAgendamento) return;
    onConfirmar({
      enderecoTipo,
      enderecoTexto: enderecoTipo === 'cadastro' ? enderecoCadastro : enderecoTexto,
      enderecoReferencia,
      dataAgendamento,
      periodo,
      tecnicoId: tecnicoId === 'automatico' ? null : tecnicoId,
      observacoesTecnico,
    });
  };

  return (
    <div className="space-y-5">
      <h3 className="font-semibold text-sm">Agendar visita técnica</h3>

      {/* Local da visita */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Onde o técnico deve comparecer?</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: 'cadastro', label: 'Endereço de cadastro', icon: Home },
            { key: 'trabalho', label: 'Endereço de trabalho', icon: Building2 },
            { key: 'outro', label: 'Outro endereço', icon: MapPin },
          ].map(opt => (
            <Card
              key={opt.key}
              className={cn('cursor-pointer transition-all', enderecoTipo === opt.key ? 'ring-2 ring-primary' : 'hover:bg-muted/50')}
              onClick={() => setEnderecoTipo(opt.key)}
            >
              <CardContent className="p-3 text-center space-y-1">
                <opt.icon className="h-5 w-5 mx-auto text-muted-foreground" />
                <p className="text-[10px] font-medium leading-tight">{opt.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {enderecoTipo === 'cadastro' && enderecoCadastro && (
          <div className="p-2 rounded bg-muted/50 text-xs text-muted-foreground">{enderecoCadastro}</div>
        )}
        {(enderecoTipo === 'trabalho' || enderecoTipo === 'outro') && (
          <Input
            placeholder={enderecoTipo === 'trabalho' ? 'Endereço de trabalho do associado' : 'Digite o endereço informado pelo associado'}
            value={enderecoTexto}
            onChange={e => setEnderecoTexto(e.target.value)}
          />
        )}
        {enderecoTipo && (
          <Input
            placeholder="Referência / complemento (opcional)"
            value={enderecoReferencia}
            onChange={e => setEnderecoReferencia(e.target.value)}
          />
        )}
      </div>

      {/* Data e período */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data e período</label>
        <div className="flex gap-2 items-start">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn('w-[180px] justify-start text-left font-normal', !dataAgendamento && 'text-muted-foreground')}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dataAgendamento ? format(dataAgendamento, 'dd/MM/yyyy') : 'Selecionar data'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dataAgendamento}
                onSelect={setDataAgendamento}
                disabled={(date) => date < minDate}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex gap-2">
          {PERIODOS.map(p => (
            <Button
              key={p.value}
              size="sm"
              variant={periodo === p.value ? 'default' : 'outline'}
              onClick={() => setPeriodo(p.value)}
              className="text-xs"
            >
              {p.label} <span className="ml-1 text-[10px] opacity-70">({p.desc})</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Técnico */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Técnico responsável</label>
        <Select value={tecnicoId} onValueChange={setTecnicoId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o técnico" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="automatico">Atribuição automática</SelectItem>
            {(instaladores || []).map((inst: any) => (
              <SelectItem key={inst.id} value={inst.id}>{inst.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Observações */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Observações para o técnico</label>
        <Textarea
          value={observacoesTecnico}
          onChange={e => setObservacoesTecnico(e.target.value)}
          placeholder="Ex: portão automático, cachorro no quintal, ligar antes de chegar..."
          rows={3}
        />
      </div>

      {/* Botão confirmar */}
      <Button className="w-full" disabled={!canSubmit || isPending} onClick={handleSubmit}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Confirmar agendamento
      </Button>
    </div>
  );
}
