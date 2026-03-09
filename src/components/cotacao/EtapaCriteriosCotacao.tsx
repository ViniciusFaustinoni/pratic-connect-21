import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Settings, ArrowLeft, ArrowRight, Car, Smartphone, AlertTriangle, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VehicleCategorySelect } from '@/components/cotador/VehicleCategorySelect';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRegioesAtivas } from '@/hooks/useRegioes';
import { fetchBenefitExclusions, gerarMensagemAlertaCategoria } from '@/data/restricoesCategorias';
import { useCombustiveis } from '@/hooks/useConteudosSistema';
import { COMBUSTIVEIS_FALLBACK } from '@/data/combustiveis';
interface EtapaCriteriosCotacaoProps {
  // Região
  regiao: string;
  setRegiao: (regiao: string) => void;
  
  // Modalidade (passeio ou aplicativo)
  modalidade: 'passeio' | 'aplicativo';
  setModalidade: (modalidade: 'passeio' | 'aplicativo') => void;
  
  // Combustível
  combustivel: string;
  setCombustivel: (combustivel: string) => void;
  
  // Categoria/Deságio
  categoria: string;
  setCategoria: (categoria: string) => void;
  
  // Navegação
  onBack: () => void;
  onCalcular: () => void;
  isCalculando?: boolean;
}

// REGIOES agora vem do banco via useRegioesAtivas()

// COMBUSTIVEIS agora vem do banco via useCombustiveis() — fallback em combustiveis.ts

export function EtapaCriteriosCotacao({
  regiao,
  setRegiao,
  modalidade,
  setModalidade,
  combustivel,
  setCombustivel,
  categoria,
  setCategoria,
  onBack,
  onCalcular,
  isCalculando = false,
}: EtapaCriteriosCotacaoProps) {
  const { data: regioesDb = [] } = useRegioesAtivas();
  const REGIOES = regioesDb.map(r => ({ value: r.codigo.toLowerCase(), label: r.nome }));

  // Combustíveis do banco
  const { data: COMBUSTIVEIS = COMBUSTIVEIS_FALLBACK } = useCombustiveis();

  // Pode calcular se todos os campos obrigatórios estão preenchidos
  const canCalculate = regiao !== '' && modalidade && combustivel !== '' && categoria !== '';

  // Buscar exclusões do banco de dados
  const { data: benefitExclusions = [] } = useQuery({
    queryKey: ['benefit-exclusions-criteria'],
    queryFn: fetchBenefitExclusions,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  // Gerar mensagem de exclusão dinamicamente baseada na categoria
  const mensagemExclusao = useMemo(() => {
    if (!categoria || categoria === 'nenhuma') return null;
    return gerarMensagemAlertaCategoria(categoria, benefitExclusions);
  }, [categoria, benefitExclusions]);

  // Handler para mudança de categoria
  const handleCategoriaChange = (value: string) => {
    setCategoria(value);
    // Se selecionar aplicativo na categoria, atualizar modalidade
    if (value === 'aplicativo') {
      setModalidade('aplicativo');
    }
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Critérios da Cotação</CardTitle>
            <CardDescription>
              Selecione a região, modalidade de uso e combustível
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Região */}
        <div className="space-y-2">
          <Label htmlFor="regiao">
            Região <span className="text-destructive">*</span>
          </Label>
          <Select value={regiao} onValueChange={setRegiao}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a região" />
            </SelectTrigger>
            <SelectContent>
              {REGIOES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            A região define qual tabela de preços será aplicada
          </p>
        </div>

        {/* Modalidade de Uso */}
        <div className="space-y-3">
          <Label>
            Modalidade de Uso <span className="text-destructive">*</span>
          </Label>
          
          <RadioGroup
            value={modalidade}
            onValueChange={(value) => setModalidade(value as 'passeio' | 'aplicativo')}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {/* Passeio */}
            <div>
              <RadioGroupItem
                value="passeio"
                id="passeio"
                className="peer sr-only"
              />
              <Label
                htmlFor="passeio"
                className={cn(
                  "flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-all",
                  modalidade === 'passeio' && "border-primary bg-primary/5"
                )}
              >
                <Car className={cn(
                  "h-8 w-8 mb-3",
                  modalidade === 'passeio' ? "text-primary" : "text-muted-foreground"
                )} />
                <div className="text-center">
                  <p className="font-semibold">Uso Particular (Passeio)</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Veículo para uso pessoal e familiar
                  </p>
                </div>
              </Label>
            </div>

            {/* Aplicativo */}
            <div>
              <RadioGroupItem
                value="aplicativo"
                id="aplicativo"
                className="peer sr-only"
              />
              <Label
                htmlFor="aplicativo"
                className={cn(
                  "flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-all",
                  modalidade === 'aplicativo' && "border-primary bg-primary/5"
                )}
              >
                <Smartphone className={cn(
                  "h-8 w-8 mb-3",
                  modalidade === 'aplicativo' ? "text-primary" : "text-muted-foreground"
                )} />
                <div className="text-center">
                  <p className="font-semibold">Motorista de Aplicativo</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Uber, 99, InDriver, etc.
                  </p>
                </div>
              </Label>
            </div>
          </RadioGroup>

          {/* Alerta para Aplicativo */}
          {modalidade === 'aplicativo' && (
            <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700 dark:text-amber-400">
                <strong>Atenção:</strong> A modalidade Aplicativo possui cota de participação de <strong>8%</strong> sobre o valor FIPE em caso de sinistro.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Combustível */}
        <div className="space-y-2">
          <Label htmlFor="combustivel">
            Combustível <span className="text-destructive">*</span>
          </Label>
          <Select value={combustivel} onValueChange={setCombustivel}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo de combustível" />
            </SelectTrigger>
            <SelectContent>
              {COMBUSTIVEIS.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Categoria/Deságio */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Condições Especiais / Deságios</span>
          </div>
          
          <VehicleCategorySelect
            value={categoria}
            onChange={handleCategoriaChange}
          />

          {/* Alerta dinâmico baseado nas exclusões do banco */}
          {mensagemExclusao && (
            <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700 dark:text-amber-400">
                <strong>Atenção:</strong> {mensagemExclusao}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Botões de Navegação */}
        <div className="flex justify-between pt-4 border-t border-border">
          <Button
            variant="outline"
            onClick={onBack}
            size="lg"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          
          <Button
            onClick={onCalcular}
            disabled={!canCalculate || isCalculando}
            size="lg"
            className="min-w-[180px]"
          >
            {isCalculando ? (
              <>Calculando...</>
            ) : (
              <>
                Calcular Cotação
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
