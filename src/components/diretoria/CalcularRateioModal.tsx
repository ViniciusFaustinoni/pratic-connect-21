import { useState, useEffect } from 'react';
import { Calculator, AlertTriangle, Calendar } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { useDiretoria } from '@/hooks/useDiretoria';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CalcularRateioModalProps {
  open: boolean;
  onClose: () => void;
}

const meses = [
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

const anos = ['2024', '2025', '2026'];

export function CalcularRateioModal({ open, onClose }: CalcularRateioModalProps) {
  const hoje = new Date();
  const [mes, setMes] = useState<string>(String(hoje.getMonth() + 1));
  const [ano, setAno] = useState<string>(String(hoje.getFullYear()));
  
  const { calcularRateio, isCalculandoRateio } = useDiretoria();

  useEffect(() => {
    if (open) {
      setMes(String(hoje.getMonth() + 1));
      setAno(String(hoje.getFullYear()));
    }
  }, [open]);

  // Verificar rateio existente
  const { data: rateioExistente } = useQuery({
    queryKey: ['rateio-existente', mes, ano],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rateios')
        .select('id, status')
        .eq('mes', parseInt(mes))
        .eq('ano', parseInt(ano))
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const formatMesAno = () => {
    const date = new Date(parseInt(ano), parseInt(mes) - 1);
    return format(date, "MMMM 'de' yyyy", { locale: ptBR });
  };

  const handleCalcular = () => {
    calcularRateio({ mes: parseInt(mes), ano: parseInt(ano) });
    onClose();
  };

  const podeCalcular = !rateioExistente || rateioExistente.status === 'calculado';
  const isAprovado = rateioExistente?.status === 'aprovado';
  const isAplicado = rateioExistente?.status === 'aplicado';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Calcular Rateio
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Mês</Label>
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {meses.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ano</Label>
              <Select value={ano} onValueChange={setAno}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {anos.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Calendar className="h-4 w-4" />
              Período selecionado
            </div>
            <p className="font-medium capitalize">{formatMesAno()}</p>
          </div>

          {rateioExistente && (
            <Alert variant={isAprovado || isAplicado ? 'destructive' : 'default'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {isAplicado ? (
                  'Rateio já foi aplicado. Não é possível recalcular.'
                ) : isAprovado ? (
                  'Rateio já foi aprovado. Não é possível recalcular.'
                ) : (
                  'Já existe um rateio calculado para este período. Deseja recalcular?'
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleCalcular} 
            disabled={isCalculandoRateio || !podeCalcular}
          >
            <Calculator className="h-4 w-4 mr-2" />
            {isCalculandoRateio ? 'Calculando...' : rateioExistente && podeCalcular ? 'Recalcular' : 'Calcular'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
