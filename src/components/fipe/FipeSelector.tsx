import { useState, useEffect, useCallback } from 'react';
import { useFipe, type FipeMarca, type FipeModelo, type FipeAno, type FipeResult, type TipoVeiculo } from '@/hooks/useFipe';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Search, Car, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface FipeSelectionData {
  marca: string;
  modelo: string;
  ano: number;
  codigoFipe: string;
  valorFipe: number;
  combustivel?: string;
}

interface FipeSelectorProps {
  tipo?: TipoVeiculo;
  onSelect?: (data: FipeSelectionData) => void;
  showResult?: boolean;
}

export function FipeSelector({ tipo = 'carros', onSelect, showResult = true }: FipeSelectorProps) {
  const { loading, error, getMarcas, getModelos, getAnos, getPreco, clearError } = useFipe();

  const [marcas, setMarcas] = useState<FipeMarca[]>([]);
  const [modelos, setModelos] = useState<FipeModelo[]>([]);
  const [anos, setAnos] = useState<FipeAno[]>([]);
  const [resultado, setResultado] = useState<FipeResult | null>(null);

  const [marcaSelecionada, setMarcaSelecionada] = useState('');
  const [modeloSelecionado, setModeloSelecionado] = useState('');
  const [anoSelecionado, setAnoSelecionado] = useState('');

  const [loadingMarcas, setLoadingMarcas] = useState(false);
  const [loadingModelos, setLoadingModelos] = useState(false);
  const [loadingAnos, setLoadingAnos] = useState(false);

  // Carregar marcas no mount
  useEffect(() => {
    const fetchMarcas = async () => {
      setLoadingMarcas(true);
      const data = await getMarcas(tipo);
      setMarcas(data);
      setLoadingMarcas(false);
    };
    fetchMarcas();
  }, [tipo, getMarcas]);

  // Carregar modelos quando selecionar marca
  const handleMarcaChange = useCallback(async (value: string) => {
    setMarcaSelecionada(value);
    setModeloSelecionado('');
    setAnoSelecionado('');
    setModelos([]);
    setAnos([]);
    setResultado(null);
    clearError();

    if (value) {
      setLoadingModelos(true);
      const data = await getModelos(value, tipo);
      setModelos(data);
      setLoadingModelos(false);
    }
  }, [getModelos, tipo, clearError]);

  // Carregar anos quando selecionar modelo
  const handleModeloChange = useCallback(async (value: string) => {
    setModeloSelecionado(value);
    setAnoSelecionado('');
    setAnos([]);
    setResultado(null);
    clearError();

    if (marcaSelecionada && value) {
      setLoadingAnos(true);
      const data = await getAnos(marcaSelecionada, value, tipo);
      setAnos(data);
      setLoadingAnos(false);
    }
  }, [marcaSelecionada, getAnos, tipo, clearError]);

  const handleAnoChange = (value: string) => {
    setAnoSelecionado(value);
    setResultado(null);
    clearError();
  };

  // Buscar preço
  const buscarPreco = async () => {
    if (!marcaSelecionada || !modeloSelecionado || !anoSelecionado) return;

    const preco = await getPreco(marcaSelecionada, modeloSelecionado, anoSelecionado, tipo);
    if (preco) {
      setResultado(preco);
      onSelect?.({
        marca: preco.marca,
        modelo: preco.modelo,
        ano: preco.anoModelo,
        codigoFipe: preco.codigoFipe,
        valorFipe: preco.valorNumerico,
        combustivel: preco.combustivel
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const isFormComplete = marcaSelecionada && modeloSelecionado && anoSelecionado;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <Car className="h-4 w-4" />
        <span>Consulta Tabela FIPE</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Marca */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Marca</label>
          <Select onValueChange={handleMarcaChange} value={marcaSelecionada}>
            <SelectTrigger disabled={loadingMarcas}>
              {loadingMarcas ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Carregando...</span>
                </div>
              ) : (
                <SelectValue placeholder="Selecione a marca" />
              )}
            </SelectTrigger>
            <SelectContent>
              {marcas.map((marca) => (
                <SelectItem key={marca.codigo} value={marca.codigo}>
                  {marca.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Modelo */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Modelo</label>
          <Select 
            onValueChange={handleModeloChange} 
            value={modeloSelecionado}
            disabled={!marcaSelecionada || loadingModelos}
          >
            <SelectTrigger>
              {loadingModelos ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Carregando...</span>
                </div>
              ) : (
                <SelectValue placeholder="Selecione o modelo" />
              )}
            </SelectTrigger>
            <SelectContent>
              {modelos.map((modelo) => (
                <SelectItem key={modelo.codigo} value={modelo.codigo.toString()}>
                  {modelo.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Ano */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Ano</label>
          <Select 
            onValueChange={handleAnoChange} 
            value={anoSelecionado}
            disabled={!modeloSelecionado || loadingAnos}
          >
            <SelectTrigger>
              {loadingAnos ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Carregando...</span>
                </div>
              ) : (
                <SelectValue placeholder="Selecione o ano" />
              )}
            </SelectTrigger>
            <SelectContent>
              {anos.map((ano) => (
                <SelectItem key={ano.codigo} value={ano.codigo}>
                  {ano.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Botão Consultar */}
      <Button 
        type="button"
        onClick={buscarPreco}
        disabled={!isFormComplete || loading}
        className="w-full sm:w-auto"
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Search className="mr-2 h-4 w-4" />
        )}
        Consultar FIPE
      </Button>

      {/* Erro */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Resultado */}
      {showResult && resultado && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-primary mb-3">
              <CheckCircle2 className="h-4 w-4" />
              <span className="font-medium text-sm">Resultado da Consulta</span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Marca/Modelo:</span>
                <p className="font-medium">{resultado.marca} {resultado.modelo}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Ano:</span>
                <p className="font-medium">{resultado.anoModelo}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Código FIPE:</span>
                <p className="font-medium">{resultado.codigoFipe}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Combustível:</span>
                <p className="font-medium">{resultado.combustivel}</p>
              </div>
              <div className="col-span-2 pt-2 border-t mt-2">
                <span className="text-muted-foreground">Valor FIPE:</span>
                <p className="font-bold text-lg text-primary">{resultado.valor}</p>
                <p className="text-xs text-muted-foreground">Ref: {resultado.mesReferencia}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
