import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowLeft, Home, ChevronRight, UserCheck, UserX, Car, RefreshCw, CreditCard, Copy, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SubstituicaoStepper } from '@/components/substituicao/SubstituicaoStepper';
import { StepElegibilidade } from '@/components/substituicao/StepElegibilidade';
import { StepEventoAtivo } from '@/components/substituicao/StepEventoAtivo';
import { StepRastreador } from '@/components/substituicao/StepRastreador';
import { StepNovoVeiculo } from '@/components/substituicao/StepNovoVeiculo';
import { StepVistoria } from '@/components/substituicao/StepVistoria';
import { StepBeneficios } from '@/components/substituicao/StepBeneficios';
import { StepFinanceiro } from '@/components/substituicao/StepFinanceiro';
import { StepConclusao } from '@/components/substituicao/StepConclusao';
import { useIniciarSubstituicao } from '@/hooks/useSubstituicaoVeiculo';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { DadosNovoVeiculo } from '@/types/substituicao';

export default function SubstituicaoVeiculoPage() {
  const { associadoId } = useParams<{ associadoId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isVendasContext = location.pathname.startsWith('/vendas/');
  const { profile, isVendedor } = useAuth();

  const consultorId = isVendedor() ? profile?.id ?? null : null;
  const consultorNome = isVendedor() ? profile?.nome ?? null : null;

  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [skippedSteps, setSkippedSteps] = useState<number[]>([]);
  const [substituicaoId, setSubstituicaoId] = useState<string | null>(null);
  const [tokenPublico, setTokenPublico] = useState<string | null>(null);
  const [veiculoNovoId, setVeiculoNovoId] = useState<string | null>(null);

  const [eventoAtivo, setEventoAtivo] = useState<{ id: string; tipo: string } | null>(null);
  const [dadosNovoVeiculo, setDadosNovoVeiculo] = useState<Partial<DadosNovoVeiculo>>({});
  const [beneficiosSelecionados, setBeneficiosSelecionados] = useState<Record<string, boolean | string>>({});

  const iniciarSubstituicao = useIniciarSubstituicao();

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
      consultor_id: consultorId,
    });

    setSubstituicaoId(result.id);
    setTokenPublico((result as any).token_publico || null);
    return result.id;
  };

  const handleElegibilidadeNext = (hasEventoProprio: boolean, evento?: { id: string; tipo: string }) => {
    completeStep(1);
    if (hasEventoProprio && evento) {
      setEventoAtivo(evento);
      setCurrentStep(2);
    } else {
      setSkippedSteps((prev) => [...prev, 2]);
      completeStep(2);
      setCurrentStep(3);
    }
  };

  const handleEventoNext = () => { completeStep(2); setCurrentStep(3); };
  const handleRastreadorNext = () => { completeStep(3); setCurrentStep(4); };
  const handleNovoVeiculoNext = (novoVeiculoId?: string) => {
    if (novoVeiculoId) setVeiculoNovoId(novoVeiculoId);
    completeStep(4);
    setCurrentStep(5);
  };
  const handleVistoriaNext = () => { completeStep(5); setCurrentStep(6); };
  const handleBeneficiosNext = () => { completeStep(6); setCurrentStep(7); };
  const handleFinanceiroConfirmar = () => {
    completeStep(7);
    setCurrentStep(8);
    toast.success('Substituição enviada para aprovação!');
  };
  const handleRetry = () => { setCurrentStep(7); };

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

  const fipeFormatted = veiculoAtivo.valor_fipe
    ? `R$ ${Number(veiculoAtivo.valor_fipe).toLocaleString('pt-BR')}`
    : '—';

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
        <Link to="/dashboard" className="hover:text-foreground transition-colors"><Home className="h-3.5 w-3.5" /></Link>
        <ChevronRight className="h-3 w-3" />
        {isVendasContext ? (
          <>
            <Link to="/vendas" className="hover:text-foreground transition-colors">Vendas</Link>
            <ChevronRight className="h-3 w-3" />
          </>
        ) : (
          <>
            <Link to="/cadastro/associados" className="hover:text-foreground transition-colors">Associados</Link>
            <ChevronRight className="h-3 w-3" />
            <Link to={`/cadastro/associados/${associadoId}`} className="hover:text-foreground transition-colors truncate max-w-[180px]">
              {associado.nome}
            </Link>
            <ChevronRight className="h-3 w-3" />
          </>
        )}
        <span className="text-foreground font-medium">Substituição</span>
      </nav>

      {/* Header Card */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="py-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0 self-start">
              <ArrowLeft className="h-5 w-5" />
            </Button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <RefreshCw className="h-5 w-5 text-primary shrink-0" />
                <h1 className="text-lg font-bold text-foreground truncate">Substituição de Veículo</h1>
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {associado.nome} · CPF: {associado.cpf}
              </p>
            </div>

            {/* Info pills */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Badge variant="outline" className="gap-1.5 py-1 px-2.5 text-xs font-normal border-border">
                <Car className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">{veiculoAtivo.placa}</span>
              </Badge>
              <Badge variant="outline" className="gap-1.5 py-1 px-2.5 text-xs font-normal border-border">
                <CreditCard className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">FIPE: {fipeFormatted}</span>
              </Badge>
              {consultorNome ? (
                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1 text-xs">
                  <UserCheck className="h-3 w-3" />
                  {consultorNome}
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <UserX className="h-3 w-3" />
                  Sem consultor
                </Badge>
              )}
            </div>
          </div>

          {/* Vehicle info summary */}
          <div className="mt-3 ml-0 md:ml-12 p-2.5 rounded-lg bg-muted/50 border border-border/50">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Veículo atual:</span>{' '}
              {veiculoAtivo.marca} {veiculoAtivo.modelo}
              {veiculoAtivo.ano_modelo ? ` ${veiculoAtivo.ano_modelo}` : ''}
              {' · '}
              <span className="font-mono">{veiculoAtivo.placa}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Stepper */}
      <Card>
        <CardContent className="py-4 px-4 md:px-6">
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
        <StepElegibilidade associadoId={associadoId!} onNext={handleElegibilidadeNext} />
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
          onBack={() => skippedSteps.includes(2) ? setCurrentStep(1) : setCurrentStep(2)}
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
        <StepVistoria
          associadoId={associadoId!}
          veiculoNovoId={veiculoNovoId}
          substituicaoId={substituicaoId}
          dadosNovoVeiculo={dadosNovoVeiculo}
          onNext={handleVistoriaNext}
          onBack={() => setCurrentStep(4)}
          onIniciarSubstituicao={handleIniciarSubstituicao}
        />
      )}

      {currentStep === 6 && (
        <StepBeneficios
          veiculoAntigo={veiculoAntigoResumo}
          dadosNovoVeiculo={dadosNovoVeiculo}
          beneficiosSelecionados={beneficiosSelecionados}
          setBeneficiosSelecionados={setBeneficiosSelecionados}
          onNext={handleBeneficiosNext}
          onBack={() => setCurrentStep(5)}
        />
      )}

      {currentStep === 7 && (
        <StepFinanceiro
          substituicaoId={substituicaoId}
          associadoId={associadoId!}
          diaVencimento={associado?.dia_vencimento || 10}
          veiculoAntigo={veiculoAntigoResumo}
          dadosNovoVeiculo={dadosNovoVeiculo}
          beneficiosSelecionados={beneficiosSelecionados}
          onConfirmar={handleFinanceiroConfirmar}
          onBack={() => setCurrentStep(6)}
          onIniciarSubstituicao={handleIniciarSubstituicao}
        />
      )}

      {currentStep >= 8 && substituicaoId && (
        <>
          {tokenPublico && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">Link do associado</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {window.location.origin}/substituicao/{tokenPublico}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/substituicao/${tokenPublico}`);
                        toast.success('Link copiado!');
                      }}
                      className="gap-1.5"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copiar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`/substituicao/${tokenPublico}`, '_blank')}
                      className="gap-1.5"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Abrir
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          <StepConclusao
            substituicaoId={substituicaoId}
            associadoId={associadoId!}
            associadoNome={associado.nome}
            veiculoAntigoPlaca={veiculoAntigoResumo.placa}
            onRetry={handleRetry}
          />
        </>
      )}

      {currentStep >= 8 && !substituicaoId && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Erro: substituição não encontrada.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
