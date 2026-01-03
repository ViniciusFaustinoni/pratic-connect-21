import { useState } from 'react';
import { useFipe, PlateResult } from '@/hooks/useFipe';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Car, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PlacaLookupProps {
  onResult?: (data: PlateResult) => void;
  onError?: (error: string) => void;
}

export function PlacaLookup({ onResult, onError }: PlacaLookupProps) {
  const { loading, error, getByPlaca, clearError } = useFipe();
  const [placa, setPlaca] = useState('');
  const [resultado, setResultado] = useState<PlateResult | null>(null);

  // Formatar placa enquanto digita
  const handlePlacaChange = (value: string) => {
    // Remove caracteres não alfanuméricos e converte para maiúsculo
    const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    
    // Limita a 7 caracteres
    const limited = cleaned.slice(0, 7);
    
    // Formata com hífen se for placa antiga (3 letras + 4 números)
    if (limited.length >= 4 && /^[A-Z]{3}[0-9]/.test(limited) && !/[A-Z]/.test(limited[4] || '')) {
      setPlaca(`${limited.slice(0, 3)}-${limited.slice(3)}`);
    } else {
      setPlaca(limited);
    }
    
    clearError();
    setResultado(null);
  };

  const handleConsultar = async () => {
    if (!placa || placa.replace(/[^A-Za-z0-9]/g, '').length < 7) {
      return;
    }

    const result = await getByPlaca(placa);
    
    if (result.success && result.vehicleData) {
      setResultado(result);
      onResult?.(result);
    } else if (result.error) {
      onError?.(result.error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConsultar();
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="space-y-4">
      {/* Input de busca */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Car className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Digite a placa (ABC1234 ou ABC1D23)"
            value={placa}
            onChange={(e) => handlePlacaChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-10 uppercase font-mono text-lg tracking-wider"
            maxLength={8}
            disabled={loading}
          />
        </div>
        <Button 
          onClick={handleConsultar}
          disabled={loading || placa.replace(/[^A-Za-z0-9]/g, '').length < 7}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          <span className="ml-2">Consultar</span>
        </Button>
      </div>

      {/* Erro */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Resultado */}
      {resultado?.success && resultado.vehicleData && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Veículo Encontrado
              </CardTitle>
              <Badge variant="outline" className="font-mono text-lg">
                {resultado.vehicleData.placa}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Dados do veículo */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Marca</p>
                <p className="font-medium">{resultado.vehicleData.marca}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Modelo</p>
                <p className="font-medium">{resultado.vehicleData.modelo}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ano</p>
                <p className="font-medium">{resultado.vehicleData.ano || '-'}</p>
              </div>
              {resultado.vehicleData.cor && (
                <div>
                  <p className="text-sm text-muted-foreground">Cor</p>
                  <p className="font-medium">{resultado.vehicleData.cor}</p>
                </div>
              )}
              {resultado.vehicleData.combustivel && (
                <div>
                  <p className="text-sm text-muted-foreground">Combustível</p>
                  <p className="font-medium">{resultado.vehicleData.combustivel}</p>
                </div>
              )}
              {resultado.vehicleData.uf && (
                <div>
                  <p className="text-sm text-muted-foreground">UF</p>
                  <p className="font-medium">{resultado.vehicleData.uf}</p>
                </div>
              )}
            </div>

            {/* Dados FIPE */}
            {resultado.fipeData ? (
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Valor FIPE</p>
                    <p className="text-2xl font-bold text-primary">
                      {formatCurrency(resultado.fipeData.valor)}
                    </p>
                    {resultado.fipeData.mesReferencia && (
                      <p className="text-xs text-muted-foreground">
                        Referência: {resultado.fipeData.mesReferencia}
                      </p>
                    )}
                  </div>
                  {resultado.fipeData.codigo && (
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Código FIPE</p>
                      <Badge variant="secondary" className="font-mono">
                        {resultado.fipeData.codigo}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="border-t pt-4 mt-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Valor FIPE não encontrado automaticamente. Use a consulta manual por marca/modelo.
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
