import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Receipt, 
  AlertTriangle,
  RotateCcw,
  FileText,
  UserPlus,
  ChevronDown,
  ChevronUp,
  Car,
  Loader2,
  Fuel
} from 'lucide-react';
import { CATEGORIAS_VEICULO } from '@/components/cotador/VehicleCategorySelect';
import { PlanoCardCotacao } from './PlanoCardCotacao';
import { cn } from '@/lib/utils';
import type { PlanoOficial } from '@/hooks/usePlanosOficiais';

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

interface EtapaResultadoProps {
  veiculoFipe: VeiculoEncontrado | null;
  marca: string;
  modelo: string;
  ano: string;
  valorFipe: number | null;
  placa: string;
  categoria: string | null;
  regiao: string;
  combustivel?: string;
  planos: PlanoOficial[];
  planoSelecionado: PlanoOficial | null;
  setPlanoSelecionado: (plano: PlanoOficial | null) => void;
  onNovaCotacao: () => void;
  onGerarPDF: () => void;
  onIniciarCadastro: () => void;
  isLoading?: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const REGIOES_LABELS: Record<string, string> = {
  rio_de_janeiro: 'Rio de Janeiro',
  regiao_lagos: 'Região dos Lagos',
  sao_paulo: 'São Paulo',
};

// Observações baseadas na categoria
const OBSERVACOES_CATEGORIA: Record<string, string> = {
  leilao: 'Veículo de leilão: sem cobertura de incêndio',
  aplicativo: 'Uso para aplicativo: cota de participação 8% (mín R$ 3.000)',
  chassi_remarcado: 'Chassi remarcado: sujeito à análise de aceitação',
};

export function EtapaResultado({
  veiculoFipe,
  marca,
  modelo,
  ano,
  valorFipe,
  placa,
  categoria,
  regiao,
  combustivel,
  planos,
  planoSelecionado,
  setPlanoSelecionado,
  onNovaCotacao,
  onGerarPDF,
  onIniciarCadastro,
  isLoading = false,
}: EtapaResultadoProps) {
  const [showAllPlanos, setShowAllPlanos] = useState(false);

  const categoriaLabel = CATEGORIAS_VEICULO.find(c => c.value === categoria)?.label || categoria;
  const regiaoLabel = REGIOES_LABELS[regiao] || regiao;
  const observacao = categoria ? OBSERVACOES_CATEGORIA[categoria] : null;

  // Mostrar 3 planos por padrão, ou todos se expandido
  const planosVisiveis = showAllPlanos ? planos : planos.slice(0, 3);
  const planoBasico = planos[0];

  const handleSelectPlano = (plano: PlanoOficial) => {
    setPlanoSelecionado(plano);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="border-border bg-card">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Calculando planos disponíveis...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumo do Veículo */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Resultado da Cotação</CardTitle>
              <CardDescription>
                Confira os valores e planos disponíveis para este veículo
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Card Resumo */}
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-card">
                <Car className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 space-y-1">
                <p className="font-semibold text-foreground">
                  {marca} {modelo} {ano}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {placa && <span>Placa: {placa}</span>}
                  {valorFipe && <span>FIPE: {formatCurrency(valorFipe)}</span>}
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="secondary" className="text-xs">
                    {categoriaLabel}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {regiaoLabel}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Observações */}
          {observacao && (
            <Alert className="border-amber-500/50 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-amber-700 dark:text-amber-400">
                {observacao}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Planos Disponíveis */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-foreground">Planos Disponíveis</h3>
          <Badge variant="secondary" className="text-xs">
            {planos.length} opções
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {planosVisiveis.map((plano) => (
            <PlanoCardCotacao
              key={plano.id}
              plano={plano}
              onSelect={handleSelectPlano}
              planoBasico={planoBasico}
              isSelected={planoSelecionado?.id === plano.id}
            />
          ))}
        </div>

        {/* Ver mais planos */}
        {planos.length > 3 && (
          <Button
            variant="ghost"
            onClick={() => setShowAllPlanos(!showAllPlanos)}
            className="w-full"
          >
            {showAllPlanos ? (
              <>
                <ChevronUp className="mr-2 h-4 w-4" />
                Mostrar menos planos
              </>
            ) : (
              <>
                <ChevronDown className="mr-2 h-4 w-4" />
                Ver mais {planos.length - 3} planos
              </>
            )}
          </Button>
        )}
      </div>

      {/* Ações */}
      <Card className="border-border bg-card">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              variant="outline"
              onClick={onNovaCotacao}
              className="sm:min-w-[160px]"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Nova Cotação
            </Button>
            
            <Button
              variant="outline"
              onClick={onGerarPDF}
              disabled={!planoSelecionado}
              className="sm:min-w-[160px]"
            >
              <FileText className="mr-2 h-4 w-4" />
              Gerar PDF
            </Button>
            
            <Button
              onClick={onIniciarCadastro}
              disabled={!planoSelecionado}
              className="sm:min-w-[160px]"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Iniciar Cadastro
            </Button>
          </div>
          
          {!planoSelecionado && (
            <p className="text-sm text-muted-foreground text-center mt-3">
              Selecione um plano para continuar
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
