import { useState, useEffect } from 'react';
import { Phone, MessageSquare, Smartphone, Mail } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { CalendarIcon } from 'lucide-react';

interface RegistrarContatoModalProps {
  open: boolean;
  onClose: () => void;
  associadoId: string;
  cobrancaId?: string;
}

type TipoContato = 'ligacao' | 'whatsapp' | 'sms' | 'email';

const tiposContato = [
  { value: 'ligacao', label: 'Ligação', icon: Phone },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { value: 'sms', label: 'SMS', icon: Smartphone },
  { value: 'email', label: 'E-mail', icon: Mail },
] as const;

const resultadosPorTipo: Record<TipoContato, { value: string; label: string }[]> = {
  ligacao: [
    { value: 'atendeu', label: 'Atendeu' },
    { value: 'nao_atendeu', label: 'Não Atendeu' },
    { value: 'ocupado', label: 'Ocupado' },
    { value: 'caixa_postal', label: 'Caixa Postal' },
    { value: 'numero_invalido', label: 'Número Inválido' },
    { value: 'recado', label: 'Deixou Recado' },
  ],
  whatsapp: [
    { value: 'enviado', label: 'Enviado' },
    { value: 'entregue', label: 'Entregue' },
    { value: 'lido', label: 'Lido' },
    { value: 'respondido', label: 'Respondido' },
    { value: 'numero_invalido', label: 'Número Inválido' },
  ],
  sms: [
    { value: 'enviado', label: 'Enviado' },
    { value: 'entregue', label: 'Entregue' },
    { value: 'lido', label: 'Lido' },
    { value: 'respondido', label: 'Respondido' },
    { value: 'numero_invalido', label: 'Número Inválido' },
  ],
  email: [
    { value: 'enviado', label: 'Enviado' },
    { value: 'entregue', label: 'Entregue' },
    { value: 'lido', label: 'Lido' },
    { value: 'respondido', label: 'Respondido' },
    { value: 'erro', label: 'Erro no Envio' },
  ],
};

const resultadosPositivos = ['atendeu', 'respondido', 'lido'];

const resultadosConversacao = [
  { value: 'promessa_pagamento', label: 'Promessa de Pagamento' },
  { value: 'negou_divida', label: 'Negou Dívida' },
  { value: 'pediu_acordo', label: 'Pediu Acordo' },
  { value: 'sem_condicoes', label: 'Sem Condições de Pagar' },
];

export function RegistrarContatoModal({ open, onClose, associadoId, cobrancaId }: RegistrarContatoModalProps) {
  const queryClient = useQueryClient();
  
  const [tipo, setTipo] = useState<TipoContato>('ligacao');
  const [resultado, setResultado] = useState('');
  const [resultadoConversacao, setResultadoConversacao] = useState('');
  const [observacao, setObservacao] = useState('');
  const [promessaData, setPromessaData] = useState<Date>();
  const [promessaValor, setPromessaValor] = useState('');
  const [duracaoSegundos, setDuracaoSegundos] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setTipo('ligacao');
      setResultado('');
      setResultadoConversacao('');
      setObservacao('');
      setPromessaData(undefined);
      setPromessaValor('');
      setDuracaoSegundos('');
    }
  }, [open]);

  // Reset resultado when tipo changes
  useEffect(() => {
    setResultado('');
    setResultadoConversacao('');
  }, [tipo]);

  // Reset conversacao when resultado changes
  useEffect(() => {
    if (!resultadosPositivos.includes(resultado)) {
      setResultadoConversacao('');
    }
  }, [resultado]);

  const registrarMutation = useMutation({
    mutationFn: async () => {
      const user = await supabase.auth.getUser();
      
      const finalResultado = resultadoConversacao || resultado;
      
      const { data, error } = await supabase
        .from('cobranca_contatos')
        .insert({
          associado_id: associadoId,
          cobranca_id: cobrancaId || null,
          tipo,
          resultado: finalResultado,
          observacao: observacao || null,
          promessa_data: promessaData ? format(promessaData, 'yyyy-MM-dd') : null,
          promessa_valor: promessaValor ? parseFloat(promessaValor) : null,
          atendente_id: user.data.user?.id,
          duracao_segundos: duracaoSegundos ? parseInt(duracaoSegundos) : null
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Contato registrado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['contatos-cobranca'] });
      onClose();
    },
    onError: (error) => {
      console.error('Erro ao registrar contato:', error);
      toast.error('Erro ao registrar contato');
    }
  });

  const handleSubmit = () => {
    if (!resultado) {
      toast.error('Selecione um resultado');
      return;
    }
    registrarMutation.mutate();
  };

  const showConversacao = resultadosPositivos.includes(resultado);
  const showPromessa = resultadoConversacao === 'promessa_pagamento';
  const showDuracao = tipo === 'ligacao';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar Contato de Cobrança</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Tipo de Contato */}
          <div className="space-y-3">
            <Label>Tipo de Contato</Label>
            <RadioGroup
              value={tipo}
              onValueChange={(v) => setTipo(v as TipoContato)}
              className="grid grid-cols-4 gap-2"
            >
              {tiposContato.map((t) => (
                <div key={t.value}>
                  <RadioGroupItem
                    value={t.value}
                    id={t.value}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={t.value}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 cursor-pointer",
                      "hover:bg-accent hover:text-accent-foreground",
                      "peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
                    )}
                  >
                    <t.icon className="h-5 w-5 mb-1" />
                    <span className="text-xs">{t.label}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Resultado */}
          <div className="space-y-2">
            <Label>Resultado</Label>
            <Select value={resultado} onValueChange={setResultado}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o resultado" />
              </SelectTrigger>
              <SelectContent>
                {resultadosPorTipo[tipo].map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Resultado da Conversa (se atendeu/respondido) */}
          {showConversacao && (
            <div className="space-y-2">
              <Label>Resultado da Conversa</Label>
              <Select value={resultadoConversacao} onValueChange={setResultadoConversacao}>
                <SelectTrigger>
                  <SelectValue placeholder="Como foi a conversa?" />
                </SelectTrigger>
                <SelectContent>
                  {resultadosConversacao.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Promessa de Pagamento */}
          {showPromessa && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Prometida</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !promessaData && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {promessaData ? format(promessaData, "dd/MM/yyyy") : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={promessaData}
                      onSelect={setPromessaData}
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Valor Prometido (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={promessaValor}
                  onChange={(e) => setPromessaValor(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Duração (se ligação) */}
          {showDuracao && (
            <div className="space-y-2">
              <Label>Duração (segundos)</Label>
              <Input
                type="number"
                min="0"
                placeholder="Ex: 120"
                value={duracaoSegundos}
                onChange={(e) => setDuracaoSegundos(e.target.value)}
              />
            </div>
          )}

          {/* Observação */}
          <div className="space-y-2">
            <Label>Observação</Label>
            <Textarea
              placeholder="Descreva detalhes do contato..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={registrarMutation.isPending}>
            {registrarMutation.isPending ? 'Registrando...' : 'Registrar Contato'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
