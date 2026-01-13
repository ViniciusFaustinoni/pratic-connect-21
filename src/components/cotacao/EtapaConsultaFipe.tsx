import { useState, useMemo } from 'react';
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
  ArrowRight,
  RefreshCw
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
  // Campos para preenchimento automático
  marca: string;
  setMarca: (marca: string) => void;
  modelo: string;
  setModelo: (modelo: string) => void;
  ano: string;
  setAno: (ano: string) => void;
  valorFipe: number | null;
  setValorFipe: (valor: number | null) => void;
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

const parseCurrency = (value: string): number | null => {
  const cleaned = value.replace(/[^\d,]/g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
};

export function EtapaConsultaFipe({
  placa,
  setPlaca,
  veiculoEncontrado,
  setVeiculoEncontrado,
  marca,
  setMarca,
  modelo,
  setModelo,
  ano,
  setAno,
  valorFipe,
  setValorFipe,
  onNext,
  onManualEntry,
}: EtapaConsultaFipeProps) {
  // Detectar se dados já existem (vieram do lead ou foram consultados antes)
  const dadosJaPreenchidos = useMemo(() => {
    return !!(marca && modelo && ano && valorFipe);
  }, [marca, modelo, ano, valorFipe]);

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(() => 
    (marca && modelo && ano && valorFipe) ? 'success' : 'idle'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [camposAutoPreenchidos, setCamposAutoPreenchidos] = useState<string[]>(() => {
    const campos: string[] = [];
    if (marca) campos.push('marca');
    if (modelo) campos.push('modelo');
    if (ano) campos.push('ano');
    if (valorFipe) campos.push('valorFipe');
    return campos;
  });
  const { getByPlaca } = useFipe();

  const handleReconsultar = () => {
    setStatus('idle');
    setCamposAutoPreenchidos([]);
    setVeiculoEncontrado(null);
  };

  const handlePlacaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPlaca(e.target.value);
    setPlaca(formatted);
    // Reset status when typing
    if (status !== 'idle') {
      setStatus('idle');
      setVeiculoEncontrado(null);
      setErrorMessage(null);
      setCamposAutoPreenchidos([]);
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
        
        // PREENCHER CAMPOS AUTOMATICAMENTE
        setMarca(vehicleData.marca);
        setModelo(vehicleData.modelo);
        setAno(vehicleData.ano);
        if (fipeData?.valor) {
          setValorFipe(fipeData.valor);
        }
        
        // Marcar quais campos foram auto-preenchidos
        const camposPreenchidos = ['marca', 'modelo', 'ano'];
        if (fipeData?.valor) {
          camposPreenchidos.push('valorFipe');
        }
        setCamposAutoPreenchidos(camposPreenchidos);
        
        setStatus('success');
        toast.success(`Dados do veículo preenchidos automaticamente!`);
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

  // Remove indicador de auto-preenchimento quando usuário edita manualmente
  const handleCampoChange = (campo: string, setter: (value: string) => void, value: string) => {
    setter(value);
    setCamposAutoPreenchidos(prev => prev.filter(c => c !== campo));
  };

  const handleValorFipeChange = (value: string) => {
    const parsed = parseCurrency(value);
    setValorFipe(parsed);
    setCamposAutoPreenchidos(prev => prev.filter(c => c !== 'valorFipe'));
  };

  // Pode avançar se tem marca, modelo, ano e valorFipe preenchidos
  const canProceed = marca && modelo && ano && valorFipe !== null;

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
            {dadosJaPreenchidos && status === 'success' ? (
              <Button
                variant="outline"
                onClick={handleReconsultar}
                className="min-w-[160px]"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reconsultar
              </Button>
            ) : (
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
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Campos do Veículo - aparecem sempre */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Dados do Veículo</Label>
            {status === 'success' && camposAutoPreenchidos.length > 0 && (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle className="h-4 w-4" />
                <span>Preenchido automaticamente via FIPE</span>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Marca */}
            <div className="space-y-2">
              <Label htmlFor="marca" className="flex items-center gap-2">
                Marca
                {camposAutoPreenchidos.includes('marca') && (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                )}
              </Label>
              <Input
                id="marca"
                value={marca}
                onChange={(e) => handleCampoChange('marca', setMarca, e.target.value)}
                placeholder="Ex: Toyota"
                className={cn(
                  camposAutoPreenchidos.includes('marca') && 
                  "border-green-500 bg-green-50 dark:bg-green-950/20"
                )}
              />
            </div>

            {/* Modelo */}
            <div className="space-y-2">
              <Label htmlFor="modelo" className="flex items-center gap-2">
                Modelo
                {camposAutoPreenchidos.includes('modelo') && (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                )}
              </Label>
              <Input
                id="modelo"
                value={modelo}
                onChange={(e) => handleCampoChange('modelo', setModelo, e.target.value)}
                placeholder="Ex: Corolla XEi"
                className={cn(
                  camposAutoPreenchidos.includes('modelo') && 
                  "border-green-500 bg-green-50 dark:bg-green-950/20"
                )}
              />
            </div>

            {/* Ano */}
            <div className="space-y-2">
              <Label htmlFor="ano" className="flex items-center gap-2">
                Ano
                {camposAutoPreenchidos.includes('ano') && (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                )}
              </Label>
              <Input
                id="ano"
                value={ano}
                onChange={(e) => handleCampoChange('ano', setAno, e.target.value)}
                placeholder="Ex: 2023/2024"
                className={cn(
                  camposAutoPreenchidos.includes('ano') && 
                  "border-green-500 bg-green-50 dark:bg-green-950/20"
                )}
              />
            </div>

            {/* Valor FIPE */}
            <div className="space-y-2">
              <Label htmlFor="valorFipe" className="flex items-center gap-2">
                Valor FIPE
                {camposAutoPreenchidos.includes('valorFipe') && (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                )}
              </Label>
              <Input
                id="valorFipe"
                value={valorFipe ? formatCurrency(valorFipe) : ''}
                onChange={(e) => handleValorFipeChange(e.target.value)}
                placeholder="R$ 0,00"
                className={cn(
                  camposAutoPreenchidos.includes('valorFipe') && 
                  "border-green-500 bg-green-50 dark:bg-green-950/20"
                )}
              />
            </div>
          </div>
        </div>

        {/* Mensagens de Status */}
        {dadosJaPreenchidos && status === 'success' && (
          <Alert className="border-green-500/50 bg-green-500/10">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700 dark:text-green-400">
              Dados do veículo já preenchidos. Clique em "Avançar" para continuar ou em "Reconsultar" para atualizar.
            </AlertDescription>
          </Alert>
        )}
        
        {status === 'idle' && !marca && !modelo && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
            <span>Consulte a placa ou preencha os dados manualmente</span>
          </div>
        )}

        {status === 'loading' && (
          <div className="flex items-center gap-2 text-primary text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Consultando base FIPE...</span>
          </div>
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
