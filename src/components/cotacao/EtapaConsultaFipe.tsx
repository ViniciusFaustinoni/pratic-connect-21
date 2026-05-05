import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { 
  Car, 
  Search, 
  Loader2, 
  CheckCircle, 
  XCircle,
  Edit,
  ArrowRight,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFipe, FipeAlternativa } from '@/hooks/useFipe';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  modoNotaFiscal?: boolean;
  setModoNotaFiscal?: (v: boolean) => void;
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
  modoNotaFiscal = false,
  setModoNotaFiscal,
}: EtapaConsultaFipeProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [camposAutoPreenchidos, setCamposAutoPreenchidos] = useState<string[]>([]);
  const [fipeAlternativas, setFipeAlternativas] = useState<FipeAlternativa[]>([]);
  const [fipeSelecionada, setFipeSelecionada] = useState<string>('');
  const { getByPlaca } = useFipe();

  // Ao ativar modo Nota Fiscal, limpa estado da busca FIPE
  useEffect(() => {
    if (modoNotaFiscal) {
      setStatus('idle');
      setErrorMessage(null);
      setVeiculoEncontrado(null);
      setFipeAlternativas([]);
      setFipeSelecionada('');
      setCamposAutoPreenchidos([]);
      setPlaca('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoNotaFiscal]);

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
        const { vehicleData, fipeData, fipeAlternativas: alts } = result;
        
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
        setModelo(fipeData?.descricao || vehicleData.modelo);
        setAno(vehicleData.ano);
        if (fipeData?.valor) {
          setValorFipe(fipeData.valor);
        }
        
        // Salvar alternativas para permitir troca manual
        setFipeAlternativas(alts || []);
        setFipeSelecionada(fipeData?.codigo || '');
        
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

  const handleTrocarFipe = (codigo: string) => {
    const escolhida = fipeAlternativas.find(f => String(f.codigo) === String(codigo));
    if (!escolhida) return;
    setFipeSelecionada(codigo);
    setValorFipe(escolhida.valor);
    setModelo(escolhida.descricao || modelo);
    setVeiculoEncontrado(veiculoEncontrado ? {
      ...veiculoEncontrado,
      codigoFipe: escolhida.codigo,
      valorFipe: escolhida.valor,
      modelo: escolhida.descricao || veiculoEncontrado.modelo,
    } : null);
    setCamposAutoPreenchidos(prev => Array.from(new Set([...prev, 'modelo', 'valorFipe'])));
    toast.success('Versão FIPE atualizada');
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

          {/* Seletor de variante FIPE — quando a API retorna múltiplas versões */}
          {fipeAlternativas.length > 1 && (
            <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
              <AlertDescription className="space-y-2">
                <div className="text-sm font-medium text-amber-900 dark:text-amber-200">
                  Foram encontradas {fipeAlternativas.length} versões FIPE para esta placa. Confira se a versão selecionada bate com o CRLV (combustível, câmbio, motorização):
                </div>
                <Select value={String(fipeSelecionada)} onValueChange={handleTrocarFipe}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Selecione a versão correta" />
                  </SelectTrigger>
                  <SelectContent className="max-w-[600px]">
                    {fipeAlternativas.map((alt) => (
                      <SelectItem key={String(alt.codigo)} value={String(alt.codigo)}>
                        <div className="flex flex-col">
                          <span className="font-medium">{alt.descricao}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatCurrency(alt.valor)} · cód. {alt.codigo}{alt.ano ? ` · ${alt.ano}` : ''}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </AlertDescription>
            </Alert>
          )}

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
