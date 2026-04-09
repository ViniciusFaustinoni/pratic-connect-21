import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ClipboardList, 
  AlertTriangle, 
  Info,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { VehicleCategorySelect, CATEGORIAS_VEICULO } from '@/components/cotador/VehicleCategorySelect';
import { useAllEligibilityRules } from '@/hooks/useEntityEligibilityRules';
import { useCoberturas, useBenefits } from '@/hooks/usePlans';
import { gerarAlertaCategoriaElegibilidade } from '@/utils/alertaCategoriaElegibilidade';

interface EtapaCategoriaVeiculoProps {
  categoria: string | null;
  setCategoria: (categoria: string) => void;
  setUsoApp: (usoApp: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}

export function EtapaCategoriaVeiculo({
  categoria,
  setCategoria,
  setUsoApp,
  onBack,
  onNext,
}: EtapaCategoriaVeiculoProps) {
  
  const handleCategoriaChange = (value: string) => {
    setCategoria(value);
    setUsoApp(value === 'aplicativo');
  };

  const { data: allRules = [] } = useAllEligibilityRules();
  const { data: coberturasGlobal = [] } = useCoberturas(true);
  const { data: beneficiosGlobal = [] } = useBenefits();

  // Alerta dinâmico baseado nas regras de elegibilidade reais
  const alerta = useMemo(() => {
    if (!categoria) return null;
    return gerarAlertaCategoriaElegibilidade(
      categoria,
      allRules,
      coberturasGlobal.map(c => ({ id: c.id, nome: c.nome })),
      beneficiosGlobal.map(b => ({ id: b.id, name: b.name }))
    );
  }, [categoria, allRules, coberturasGlobal, beneficiosGlobal]);

  const canProceed = categoria !== null;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Categoria do Veículo</CardTitle>
            <CardDescription>
              Selecione a situação que se aplica ao veículo
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <VehicleCategorySelect
          value={categoria}
          onChange={handleCategoriaChange}
        />

        {alerta && (
          <Alert className="border-amber-500/50 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-amber-700 dark:text-amber-400">
              {alerta.mensagem}
            </AlertDescription>
          </Alert>
        )}

        <Alert className="border-muted bg-muted/50">
          <Info className="h-4 w-4 text-muted-foreground" />
          <AlertDescription className="text-muted-foreground text-sm">
            Esta seleção pode influenciar os planos disponíveis e valores da cotação.
          </AlertDescription>
        </Alert>

        <div className="flex justify-between pt-4 border-t border-border">
          <Button variant="outline" onClick={onBack} size="lg">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <Button onClick={onNext} disabled={!canProceed} size="lg" className="min-w-[140px]">
            Avançar
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
