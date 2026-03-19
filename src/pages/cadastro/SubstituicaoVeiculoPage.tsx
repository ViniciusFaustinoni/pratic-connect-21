import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowLeft, Home, ChevronRight, UserCheck, UserX } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SubstituicaoStepper } from '@/components/substituicao/SubstituicaoStepper';
import { StepElegibilidade } from '@/components/substituicao/StepElegibilidade';
import { StepEventoAtivo } from '@/components/substituicao/StepEventoAtivo';
import { StepRastreador } from '@/components/substituicao/StepRastreador';
import { StepNovoVeiculo } from '@/components/substituicao/StepNovoVeiculo';
import { StepBeneficios } from '@/components/substituicao/StepBeneficios';
import { StepFinanceiro } from '@/components/substituicao/StepFinanceiro';
import { useIniciarSubstituicao } from '@/hooks/useSubstituicaoVeiculo';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { DadosNovoVeiculo } from '@/types/substituicao';

export default function SubstituicaoVeiculoPage() {
  const { associadoId } = useParams<{ associadoId: string }>();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [skippedSteps, setSkippedSteps] = useState<number[]>([]);
  const [substituicaoId, setSubstituicaoId] = useState<string | null>(null);

  // Evento ativo data
  const [eventoAtivo, setEventoAtivo] = useState<{ id: string; tipo: string } | null>(null);

  // Step 4 data
  const [dadosNovoVeiculo, setDadosNovoVeiculo] = useState<Partial<DadosNovoVeiculo>>({});

  // Step 5 data
  const [beneficiosSelecionados, setBeneficiosSelecionados] = useState<Record<string, boolean | string>>({});

  const iniciarSubstituicao = useIniciarSubstituicao();

  // Buscar associado
  const { data: associado, isLoading: loadingAssociado } = useQuery({
    queryKey: ['associados', 'detail', associadoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('associados')
        .select('id, nome, cpf, status, dia_vencimento')
        .eq('id', associadoId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!associadoId,
  });

  // Buscar veículo ativo
  const { data: veiculoAtivo, isLoading: loadingVeiculo } = useQuery({
    queryKey: ['veiculos', 'ativo', associadoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('veiculos')
        .select('*')
        .eq('associado_id', associadoId!)
        .eq('ativo', true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!associadoId,
  });

  const veiculoAntigoResumo = useMemo(() => {
    if (!veiculoAtivo) return { placa: '', modelo: '', marca: '', valor_fipe: 0 };
    return {
      placa: veiculoAtivo.placa || '',
      modelo: veiculoAtivo.modelo || '',
      marca: veiculoAtivo.marca || '',
      valor_fipe: veiculoAtivo.valor_fipe || 0,
      cobertura_vidros: !!veiculoAtivo.cobertura_vidros,
      cobertura_terceiros: typeof veiculoAtivo.cobertura_terceiros === 'string' ? veiculoAtivo.cobertura_terceiros : null,
      cobertura_assistencia: typeof veiculoAtivo.cobertura_assistencia === 'string' ? veiculoAtivo.cobertura_assistencia : null,
      mensalidade: 0,
    };
  }, [veiculoAtivo]);

  const completeStep = (step: number) => {
    if (!completedSteps.includes(step)) {
      setCompletedSteps((prev) => [...prev, step]);
    }
  };

  const handleIniciarSubstituicao = async (): Promise<string> => {
    if (substituicaoId) return substituicaoId;
    if (!associadoId || !veiculoAtivo) throw new Error('Dados insuficientes');

    const result = await iniciarSubstituicao.mutateAsync({
      associado_id: associadoId,
      veiculo_antigo_id: veiculoAtivo.id,
      veiculo_antigo_placa: veiculoAtivo.placa || '',
      veiculo_antigo_modelo: `${veiculoAtivo.marca || ''} ${veiculoAtivo.modelo || ''}`.trim(),
      veiculo_antigo_fipe: veiculoAtivo.valor_fipe || 0,
      mensalidade_antiga: 0,
      cota_participacao_antiga: 0,
    });

    setSubstituicaoId(result.id);
    return result.id;
  };

  // Step 1 -> next
  const handleElegibilidadeNext = (hasEventoProprio: boolean, evento?: { id: string; tipo: string }) => {
    completeStep(1);
    if (hasEventoProprio && evento) {
      setEventoAtivo(evento);
      setCurrentStep(2);
    } else {
      setSkippedSteps((prev) => [...prev, 2]);
      completeStep(2);
      setCurrentStep(3); // Go to Rastreador
    }
  };

  // Step 2 -> next (Evento -> Rastreador)
  const handleEventoNext = () => {
    completeStep(2);
    setCurrentStep(3);
  };

  // Step 3 -> next (Rastreador -> Novo Veículo)
  const handleRastreadorNext = () => {
    completeStep(3);
    setCurrentStep(4);
  };

  // Step 4 -> next (Novo Veículo -> Benefícios)
  const handleNovoVeiculoNext = (_veiculoNovoId?: string) => {
    completeStep(4);
    setCurrentStep(5);
  };

  // Step 5 -> next (Benefícios -> Financeiro)
  const handleBeneficiosNext = () => {
    completeStep(5);
    setCurrentStep(6);
  };

  // Step 6 -> confirmar (Financeiro -> Aprovação)
  const handleFinanceiroConfirmar = () => {
    completeStep(6);
    toast.success('Substituição enviada para aprovação!');
  };

  if (loadingAssociado || loadingVeiculo) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!associado) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Associado não encontrado.</p>
        <Button variant="outline" onClick={() => navigate(-1)} className="mt-4">Voltar</Button>
      </div>
    );
  }

  if (!veiculoAtivo) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Nenhum veículo ativo encontrado para este associado.</p>
        <Button variant="outline" onClick={() => navigate(-1)} className="mt-4">Voltar</Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
        <Link to="/dashboard" className="hover:text-foreground"><Home className="h-4 w-4" /></Link>
        <ChevronRight className="h-3 w-3" />
        <Link to="/cadastro/associados" className="hover:text-foreground">Associados</Link>
        <ChevronRight className="h-3 w-3" />
        <Link to={`/cadastro/associados/${associadoId}`} className="hover:text-foreground">{associado.nome}</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">Substituição de Veículo</span>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Substituição de Veículo</h1>
          <p className="text-sm text-muted-foreground">
            Associado: {associado.nome} — Veículo atual: {veiculoAtivo.marca} {veiculoAtivo.modelo} ({veiculoAtivo.placa})
          </p>
        </div>
      </div>

      {/* Stepper */}
      <Card>
        <CardContent className="py-4">
          <SubstituicaoStepper
            currentStep={currentStep}
            completedSteps={completedSteps}
            skippedSteps={skippedSteps}
            onStepClick={(step) => {
              if (completedSteps.includes(step) || step <= currentStep) {
                setCurrentStep(step);
              }
            }}
          />
        </CardContent>
      </Card>

      {/* Steps */}
      {currentStep === 1 && (
        <StepElegibilidade
          associadoId={associadoId!}
          onNext={handleElegibilidadeNext}
        />
      )}

      {currentStep === 2 && eventoAtivo && (
        <StepEventoAtivo
          evento={eventoAtivo}
          substituicaoId={substituicaoId}
          associadoId={associadoId!}
          veiculoAntigoId={veiculoAtivo.id}
          onNext={handleEventoNext}
          onBack={() => setCurrentStep(1)}
          onIniciarSubstituicao={handleIniciarSubstituicao}
        />
      )}

      {currentStep === 3 && (
        <StepRastreador
          associadoId={associadoId!}
          veiculoAntigoId={veiculoAtivo.id}
          substituicaoId={substituicaoId}
          onNext={handleRastreadorNext}
          onBack={() => {
            if (skippedSteps.includes(2)) {
              setCurrentStep(1);
            } else {
              setCurrentStep(2);
            }
          }}
          onIniciarSubstituicao={handleIniciarSubstituicao}
        />
      )}

      {currentStep === 4 && (
        <StepNovoVeiculo
          veiculoAntigo={veiculoAntigoResumo}
          associadoId={associadoId!}
          substituicaoId={substituicaoId}
          dadosNovoVeiculo={dadosNovoVeiculo}
          setDadosNovoVeiculo={setDadosNovoVeiculo}
          onNext={handleNovoVeiculoNext}
          onBack={() => setCurrentStep(3)}
          onIniciarSubstituicao={handleIniciarSubstituicao}
        />
      )}

      {currentStep === 5 && (
        <StepBeneficios
          veiculoAntigo={veiculoAntigoResumo}
          dadosNovoVeiculo={dadosNovoVeiculo}
          beneficiosSelecionados={beneficiosSelecionados}
          setBeneficiosSelecionados={setBeneficiosSelecionados}
          onNext={handleBeneficiosNext}
          onBack={() => setCurrentStep(4)}
        />
      )}

      {currentStep === 6 && (
        <StepFinanceiro
          substituicaoId={substituicaoId}
          associadoId={associadoId!}
          diaVencimento={associado?.dia_vencimento || 10}
          veiculoAntigo={veiculoAntigoResumo}
          dadosNovoVeiculo={dadosNovoVeiculo}
          beneficiosSelecionados={beneficiosSelecionados}
          onConfirmar={handleFinanceiroConfirmar}
          onBack={() => setCurrentStep(5)}
          onIniciarSubstituicao={handleIniciarSubstituicao}
        />
      )}

      {currentStep >= 7 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">O step de Aprovação será implementado na próxima fase.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
