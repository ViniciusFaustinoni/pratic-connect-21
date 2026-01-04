import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, Calendar as CalendarIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRH } from '@/hooks/useRH';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { CurrencyInput } from '@/components/inputs/MaskedInputs';

interface MovimentacaoModalProps {
  open: boolean;
  onClose: () => void;
  funcionario: {
    id: string;
    nome_completo: string;
    cargo_id: string | null;
    cargo?: { nome: string } | null;
    departamento_id: string | null;
    departamento?: { nome: string } | null;
    salario_atual: number | null;
  } | null;
}

const tiposMovimentacao = [
  { value: 'promocao', label: 'Promoção' },
  { value: 'merito', label: 'Mérito' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'reajuste', label: 'Reajuste Salarial' },
];

const formatCurrency = (value: number | null) => {
  if (value === null) return 'Não informado';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export function MovimentacaoModal({ open, onClose, funcionario }: MovimentacaoModalProps) {
  const { registrarMovimentacaoAsync, isRegistrandoMovimentacao } = useRH();
  
  const [tipo, setTipo] = useState('');
  const [novoCargoId, setNovoCargoId] = useState<string>('');
  const [novoDepartamentoId, setNovoDepartamentoId] = useState<string>('');
  const [novoSalario, setNovoSalario] = useState<number | undefined>();
  const [dataVigencia, setDataVigencia] = useState<Date | undefined>();
  const [motivo, setMotivo] = useState('');

  const { data: cargos } = useQuery({
    queryKey: ['cargos-movimentacao'],
    queryFn: async () => {
      const { data } = await supabase.from('cargos').select('id, nome').eq('ativo', true).order('nome');
      return data;
    },
    enabled: open
  });

  const { data: departamentos } = useQuery({
    queryKey: ['departamentos-movimentacao'],
    queryFn: async () => {
      const { data } = await supabase.from('departamentos').select('id, nome').eq('ativo', true).order('nome');
      return data;
    },
    enabled: open
  });

  useEffect(() => {
    if (!open) {
      setTipo('');
      setNovoCargoId('');
      setNovoDepartamentoId('');
      setNovoSalario(undefined);
      setDataVigencia(undefined);
      setMotivo('');
    }
  }, [open]);

  const percentualReajuste = useMemo(() => {
    if (!funcionario?.salario_atual || !novoSalario) return null;
    const percentual = ((novoSalario - funcionario.salario_atual) / funcionario.salario_atual) * 100;
    return percentual.toFixed(2);
  }, [funcionario?.salario_atual, novoSalario]);

  const mostrarCargo = ['promocao', 'transferencia'].includes(tipo);
  const mostrarDepartamento = tipo === 'transferencia';
  const mostrarSalario = ['promocao', 'merito', 'reajuste'].includes(tipo);

  const handleSubmit = async () => {
    if (!funcionario || !tipo || !dataVigencia) return;

    try {
      await registrarMovimentacaoAsync({
        funcionario_id: funcionario.id,
        tipo,
        cargo_novo_id: mostrarCargo && novoCargoId ? novoCargoId : undefined,
        departamento_novo_id: mostrarDepartamento && novoDepartamentoId ? novoDepartamentoId : undefined,
        salario_novo: mostrarSalario && novoSalario ? novoSalario : undefined,
        data_vigencia: format(dataVigencia, 'yyyy-MM-dd'),
        motivo: motivo || undefined,
      });
      onClose();
    } catch {
      // Erro já tratado no hook
    }
  };

  const canSubmit = funcionario && tipo && dataVigencia;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Registrar Movimentação
          </DialogTitle>
        </DialogHeader>

        {funcionario && (
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <p className="font-medium mb-2">{funcionario.nome_completo}</p>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Cargo:</span>
                  <p>{funcionario.cargo?.nome || 'Não informado'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Departamento:</span>
                  <p>{funcionario.departamento?.nome || 'Não informado'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Salário:</span>
                  <p>{formatCurrency(funcionario.salario_atual)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de Movimentação *</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {tiposMovimentacao.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {mostrarCargo && (
            <div className="space-y-2">
              <Label>Novo Cargo</Label>
              <Select value={novoCargoId} onValueChange={setNovoCargoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cargo" />
                </SelectTrigger>
                <SelectContent>
                  {cargos?.map((cargo) => (
                    <SelectItem key={cargo.id} value={cargo.id}>
                      {cargo.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {mostrarDepartamento && (
            <div className="space-y-2">
              <Label>Novo Departamento</Label>
              <Select value={novoDepartamentoId} onValueChange={setNovoDepartamentoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o departamento" />
                </SelectTrigger>
                <SelectContent>
                  {departamentos?.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {mostrarSalario && (
            <div className="space-y-2">
              <Label>Novo Salário</Label>
              <CurrencyInput
                value={novoSalario}
                onChange={setNovoSalario}
                placeholder="R$ 0,00"
              />
              {percentualReajuste !== null && (
                <Badge 
                  variant={parseFloat(percentualReajuste) >= 0 ? 'default' : 'destructive'}
                  className="mt-1"
                >
                  Reajuste de {percentualReajuste}%
                </Badge>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Data de Vigência *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !dataVigencia && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataVigencia ? format(dataVigencia, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataVigencia}
                  onSelect={setDataVigencia}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Motivo</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo da movimentação"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!canSubmit || isRegistrandoMovimentacao}
          >
            {isRegistrandoMovimentacao ? 'Registrando...' : 'Registrar Movimentação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
