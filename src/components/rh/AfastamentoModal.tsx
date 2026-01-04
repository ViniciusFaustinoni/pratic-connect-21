import { useState, useEffect, useMemo } from 'react';
import { UserMinus, Calendar as CalendarIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useRH } from '@/hooks/useRH';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface AfastamentoModalProps {
  open: boolean;
  onClose: () => void;
  funcionario: {
    id: string;
    nome_completo: string;
  } | null;
}

const tiposAfastamento = [
  { value: 'atestado_medico', label: 'Atestado Médico' },
  { value: 'licenca_maternidade', label: 'Licença Maternidade' },
  { value: 'licenca_paternidade', label: 'Licença Paternidade' },
  { value: 'licenca_casamento', label: 'Licença Casamento' },
  { value: 'licenca_obito', label: 'Licença Óbito' },
  { value: 'licenca_nao_remunerada', label: 'Licença Não Remunerada' },
  { value: 'acidente_trabalho', label: 'Acidente de Trabalho' },
  { value: 'auxilio_doenca', label: 'Auxílio Doença' },
  { value: 'outros', label: 'Outros' },
];

const tiposComCid = ['atestado_medico', 'auxilio_doenca', 'acidente_trabalho'];

export function AfastamentoModal({ open, onClose, funcionario }: AfastamentoModalProps) {
  const { registrarAfastamentoAsync, isRegistrandoAfastamento } = useRH();
  
  const [tipo, setTipo] = useState('');
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();
  const [motivo, setMotivo] = useState('');
  const [cid, setCid] = useState('');
  const [documentoUrl, setDocumentoUrl] = useState('');

  useEffect(() => {
    if (!open) {
      setTipo('');
      setDataInicio(undefined);
      setDataFim(undefined);
      setMotivo('');
      setCid('');
      setDocumentoUrl('');
    }
  }, [open]);

  const diasAfastamento = useMemo(() => {
    if (!dataInicio || !dataFim) return null;
    return differenceInDays(dataFim, dataInicio) + 1;
  }, [dataInicio, dataFim]);

  const mostrarCid = tiposComCid.includes(tipo);

  const handleSubmit = async () => {
    if (!funcionario || !tipo || !dataInicio || !motivo) return;

    try {
      await registrarAfastamentoAsync({
        funcionario_id: funcionario.id,
        tipo,
        data_inicio: format(dataInicio, 'yyyy-MM-dd'),
        data_fim: dataFim ? format(dataFim, 'yyyy-MM-dd') : undefined,
        motivo,
        cid: mostrarCid ? cid : undefined,
        documento_url: documentoUrl || undefined,
      });
      onClose();
    } catch {
      // Erro já tratado no hook
    }
  };

  const canSubmit = funcionario && tipo && dataInicio && motivo;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserMinus className="h-5 w-5" />
            Registrar Afastamento
          </DialogTitle>
          {funcionario && (
            <p className="text-sm text-muted-foreground">
              Funcionário: {funcionario.nome_completo}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de Afastamento *</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {tiposAfastamento.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data Início *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !dataInicio && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataInicio ? format(dataInicio, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataInicio}
                    onSelect={setDataInicio}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Data Fim</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !dataFim && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataFim ? format(dataFim, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataFim}
                    onSelect={setDataFim}
                    disabled={(date) => dataInicio ? date < dataInicio : false}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {diasAfastamento !== null && diasAfastamento > 0 && (
            <p className="text-sm text-muted-foreground">
              Total: {diasAfastamento} {diasAfastamento === 1 ? 'dia' : 'dias'} de afastamento
            </p>
          )}

          {mostrarCid && (
            <div className="space-y-2">
              <Label>CID</Label>
              <Input
                value={cid}
                onChange={(e) => setCid(e.target.value)}
                placeholder="Ex: J11"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Motivo *</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo do afastamento"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>URL do Documento</Label>
            <Input
              value={documentoUrl}
              onChange={(e) => setDocumentoUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!canSubmit || isRegistrandoAfastamento}
          >
            {isRegistrandoAfastamento ? 'Registrando...' : 'Registrar Afastamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
