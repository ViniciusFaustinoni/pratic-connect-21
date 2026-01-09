import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Car, 
  Search, 
  Loader2, 
  CheckCircle, 
  XCircle,
  Edit,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFipe } from '@/hooks/useFipe';
import { toast } from 'sonner';

interface VeiculoEncontrado {
  placa: string;
  marca: string;
  modelo: string;
  ano: string;
  cor?: string;
  combustivel?: string;
  codigoFipe?: string;
  valorFipe?: number;
}

interface EtapaConsultaFipeProps {
  placa: string;
  setPlaca: (placa: string) => void;
  veiculoEncontrado: VeiculoEncontrado | null;
  setVeiculoEncontrado: (veiculo: VeiculoEncontrado | null) => void;
  onNext: () => void;
  onManualEntry: () => void;
}

const formatPlaca = (value: string): string => {
  const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 7) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}`;
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export function EtapaConsultaFipe({
  placa,
  setPlaca,
  veiculoEncontrado,
  setVeiculoEncontrado,
  onNext,
  onManualEntry,
}: EtapaConsultaFipeProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { getByPlaca } = useFipe();

  const handlePlacaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPlaca(e.target.value);
    setPlaca(formatted);
    // Reset status when typing
    if (status !== 'idle') {
      setStatus('idle');
      setVeiculoEncontrado(null);
      setErrorMessage(null);
    }
  };

  const handleConsultar = async () => {
    const placaClean = placa.replace(/[^A-Za-z0-9]/g, '');
    if (placaClean.length < 7) {
      toast.error('Digite uma placa válida');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);

    try {
      const result = await getByPlaca(placaClean);
      
      if (result.success && result.vehicleData) {
        const { vehicleData, fipeData } = result;
        
        setVeiculoEncontrado({
          placa: vehicleData.placa,
          marca: vehicleData.marca,
          modelo: vehicleData.modelo,
          ano: vehicleData.ano,
          cor: vehicleData.cor,
          combustivel: vehicleData.combustivel,
          codigoFipe: fipeData?.codigo,
          valorFipe: fipeData?.valor,
        });
        
        setStatus('success');
        toast.success(`Veículo encontrado! ${vehicleData.marca} ${vehicleData.modelo}`);
      } else {
        setStatus('error');
        setErrorMessage(result.error || 'Veículo não encontrado na base FIPE');
      }
    } catch (error) {
      console.error('Erro ao buscar placa:', error);
      setStatus('error');
      setErrorMessage('Erro ao consultar. Tente novamente.');
    }
  };

  const canProceed = status === 'success' && veiculoEncontrado !== null;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Car className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Consulta de Veículo</CardTitle>
            <CardDescription>
              Digite a placa para buscar automaticamente os dados do veículo
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Input de Placa */}
        <div className="space-y-2">
          <Label htmlFor="placa">
            Placa do Veículo <span className="text-destructive">*</span>
          </Label>
          <div className="flex gap-3">
            <Input
              id="placa"
              placeholder="ABC-1234 ou ABC1D23"
              value={placa}
              onChange={handlePlacaChange}
              className="flex-1 uppercase text-lg font-mono tracking-wider"
              maxLength={8}
            />
            <Button
              onClick={handleConsultar}
              disabled={status === 'loading' || placa.replace(/[^A-Za-z0-9]/g, '').length < 7}
              className="min-w-[160px]"
            >
              {status === 'loading' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Consultando...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Consultar FIPE
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Status da Consulta */}
        <div className="space-y-3">
          <Label className="text-muted-foreground">Status da Consulta</Label>
          
          {status === 'idle' && (
            <div className="flex items-center gap-2 text-muted-foreground py-3">
              <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
              <span>Aguardando consulta...</span>
            </div>
          )}

          {status === 'loading' && (
            <div className="flex items-center gap-2 text-primary py-3">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Consultando base FIPE...</span>
            </div>
          )}

          {status === 'success' && veiculoEncontrado && (
            <Alert className="border-green-500/50 bg-green-500/10">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-700 dark:text-green-400">
                <div className="space-y-2">
                  <p className="font-medium">Veículo encontrado com sucesso!</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Marca:</span>
                      <p className="font-medium text-foreground">{veiculoEncontrado.marca}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Modelo:</span>
                      <p className="font-medium text-foreground">{veiculoEncontrado.modelo}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Ano:</span>
                      <p className="font-medium text-foreground">{veiculoEncontrado.ano}</p>
                    </div>
                    {veiculoEncontrado.valorFipe && (
                      <div>
                        <span className="text-muted-foreground">Valor FIPE:</span>
                        <p className="font-medium text-foreground">
                          {formatCurrency(veiculoEncontrado.valorFipe)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {status === 'error' && (
            <div className="space-y-3">
              <Alert className="border-destructive/50 bg-destructive/10">
                <XCircle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-destructive">
                  {errorMessage || 'Veículo não encontrado na base FIPE'}
                </AlertDescription>
              </Alert>
              
              <Button
                variant="outline"
                onClick={onManualEntry}
                className="w-full sm:w-auto"
              >
                <Edit className="mr-2 h-4 w-4" />
                Preencher dados manualmente
              </Button>
            </div>
          )}
        </div>

        {/* Botão Avançar */}
        <div className="flex justify-end pt-4 border-t border-border">
          <Button
            onClick={onNext}
            disabled={!canProceed}
            size="lg"
            className="min-w-[140px]"
          >
            Avançar
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
