import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
import { useCategoriasVeiculo, useObservacoesCategoria } from '@/hooks/useConteudosSistema';
import { useRegioesAtivas } from '@/hooks/useRegioes';
import { PlanoCardCotacao } from './PlanoCardCotacao';
import { CurrencyInput } from '@/components/inputs/MaskedInputs';
import { cn } from '@/lib/utils';
import type { PlanoCotacao } from '@/hooks/usePlanosCotacao';

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
  planos: PlanoCotacao[];
  planosSelecionados: PlanoCotacao[];
  onTogglePlano: (plano: PlanoCotacao) => void;
  valorAdesao?: number | null;
  onValorAdesaoChange?: (valor: number) => void;
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

// REGIOES_LABELS e OBSERVACOES_CATEGORIA agora vêm do banco

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
  planosSelecionados,
  onTogglePlano,
  valorAdesao,
  onValorAdesaoChange,
  onNovaCotacao,
  onGerarPDF,
  onIniciarCadastro,
  isLoading = false,
}: EtapaResultadoProps) {
  const [showAllPlanos, setShowAllPlanos] = useState(false);

  // Dados dinâmicos do banco
  const { data: categoriasVeiculo = [] } = useCategoriasVeiculo();
  const { data: observacoesCategoria = {} } = useObservacoesCategoria();
  const { data: regioesDb = [] } = useRegioesAtivas();

  const categoriaLabel = categoriasVeiculo.find(c => c.value === categoria)?.label || categoria;
  const regiaoDb = regioesDb.find(r => r.codigo.toLowerCase() === regiao.toLowerCase());
  const regiaoLabel = regiaoDb?.nome || regiao;
  const observacao = categoria ? observacoesCategoria[categoria] || null : null;

  // Mostrar 3 planos por padrão, ou todos se expandido
  const planosVisiveis = showAllPlanos ? planos : planos.slice(0, 3);
  const planoBasico = planos[0];
  
  // Verifica se tem planos selecionados
  const temPlanosSelecionados = planosSelecionados.length > 0;
  const primeiroPlanoSelecionado = planosSelecionados[0] || null;

  // Função para verificar se plano está selecionado e sua ordem
  const getSelectionInfo = (planoId: string) => {
    const index = planosSelecionados.findIndex(p => p.id === planoId);
    return {
      isSelected: index !== -1,
      order: index !== -1 ? index + 1 : undefined,
    };
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-foreground">Planos Disponíveis</h3>
            <Badge variant="secondary" className="text-xs">
              {planos.length} opções
            </Badge>
          </div>
          <Badge 
            variant={temPlanosSelecionados ? "default" : "outline"} 
            className="text-xs"
          >
            {planosSelecionados.length} selecionado{planosSelecionados.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {planosVisiveis.map((plano) => {
            const { isSelected, order } = getSelectionInfo(plano.id);
            return (
              <PlanoCardCotacao
                key={plano.id}
                plano={plano}
                onSelect={onTogglePlano}
                planoBasico={planoBasico}
                isSelected={isSelected}
                selectionOrder={order}
              />
            );
          })}
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
        <CardContent className="pt-6 space-y-4">
          {/* Campo de Adesão Editável - quando tem planos selecionados */}
          {temPlanosSelecionados && primeiroPlanoSelecionado && onValorAdesaoChange && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pb-4 border-b border-border">
              <Label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                Taxa de Filiação:
              </Label>
              <CurrencyInput
                value={valorAdesao ?? primeiroPlanoSelecionado.valorAdesao ?? 0}
                onChange={onValorAdesaoChange}
                className="w-40 text-center font-semibold"
              />
              {(valorAdesao ?? 0) <= 0 && (
                <span className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Valor inválido
                </span>
              )}
            </div>
          )}

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
              disabled={!temPlanosSelecionados}
              className="sm:min-w-[160px]"
            >
              <FileText className="mr-2 h-4 w-4" />
              {planosSelecionados.length > 1 ? 'Gerar PDF Comparativo' : 'Gerar PDF'}
            </Button>
            
            <Button
              onClick={onIniciarCadastro}
              disabled={!temPlanosSelecionados || (valorAdesao !== undefined && valorAdesao !== null && valorAdesao <= 0)}
              className="sm:min-w-[160px]"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Iniciar Cadastro
            </Button>
          </div>
          
          {!temPlanosSelecionados && (
            <p className="text-sm text-muted-foreground text-center mt-3">
              Selecione os planos que deseja incluir na cotação
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
