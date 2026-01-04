import { useState, useMemo } from 'react';
import { BarChart3, Calendar, MousePointer, Users, DollarSign, Target } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { useMarketing } from '@/hooks/useMarketing';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface RegistrarMetricasModalProps {
  open: boolean;
  onClose: () => void;
  campanhaId: string;
}

export function RegistrarMetricasModal({ open, onClose, campanhaId }: RegistrarMetricasModalProps) {
  const [data, setData] = useState<Date>(new Date());
  const [impressoes, setImpressoes] = useState('');
  const [cliques, setCliques] = useState('');
  const [leads, setLeads] = useState('');
  const [conversoes, setConversoes] = useState('');
  const [valorGasto, setValorGasto] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { registrarMetricas } = useMarketing();

  const calculos = useMemo(() => {
    const imp = parseFloat(impressoes) || 0;
    const cli = parseFloat(cliques) || 0;
    const lea = parseFloat(leads) || 0;
    const con = parseFloat(conversoes) || 0;
    const val = parseFloat(valorGasto) || 0;

    return {
      ctr: imp > 0 ? (cli / imp * 100).toFixed(2) : '0.00',
      cpl: lea > 0 ? (val / lea).toFixed(2) : '0.00',
      cpa: con > 0 ? (val / con).toFixed(2) : '0.00',
      taxaConversao: lea > 0 ? (con / lea * 100).toFixed(2) : '0.00'
    };
  }, [impressoes, cliques, leads, conversoes, valorGasto]);

  const handleSubmit = () => {
    setIsSubmitting(true);
    registrarMetricas({
      campanha_id: campanhaId,
      data: format(data, 'yyyy-MM-dd'),
      impressoes: parseFloat(impressoes) || 0,
      cliques: parseFloat(cliques) || 0,
      leads: parseFloat(leads) || 0,
      conversoes: parseFloat(conversoes) || 0,
      valor_gasto: parseFloat(valorGasto) || 0
    }, {
      onSuccess: () => {
        resetForm();
        onClose();
      },
      onSettled: () => {
        setIsSubmitting(false);
      }
    });
  };

  const resetForm = () => {
    setData(new Date());
    setImpressoes('');
    setCliques('');
    setLeads('');
    setConversoes('');
    setValorGasto('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Registrar Métricas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Data */}
          <div className="space-y-2">
            <Label>Data</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !data && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {data ? format(data, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={data}
                  onSelect={(d) => d && setData(d)}
                  disabled={(date) => date > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Campos numéricos em grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <BarChart3 className="h-3 w-3" />
                Impressões
              </Label>
              <Input
                type="number"
                min="0"
                value={impressoes}
                onChange={(e) => setImpressoes(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <MousePointer className="h-3 w-3" />
                Cliques
              </Label>
              <Input
                type="number"
                min="0"
                value={cliques}
                onChange={(e) => setCliques(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                Leads
              </Label>
              <Input
                type="number"
                min="0"
                value={leads}
                onChange={(e) => setLeads(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Target className="h-3 w-3" />
                Conversões
              </Label>
              <Input
                type="number"
                min="0"
                value={conversoes}
                onChange={(e) => setConversoes(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          {/* Valor Gasto */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Valor Gasto (R$)
            </Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={valorGasto}
              onChange={(e) => setValorGasto(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {/* Preview Cálculos */}
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <p className="text-sm font-medium mb-3">Métricas Calculadas</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CTR:</span>
                  <span className="font-medium">{calculos.ctr}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CPL:</span>
                  <span className="font-medium">R$ {calculos.cpl}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CPA:</span>
                  <span className="font-medium">R$ {calculos.cpa}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taxa Conv.:</span>
                  <span className="font-medium">{calculos.taxaConversao}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Registrando...' : 'Registrar Métricas'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
