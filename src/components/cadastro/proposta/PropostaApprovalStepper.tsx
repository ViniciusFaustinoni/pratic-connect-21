import { useState } from 'react';
import { 
  FileText, Camera, ShieldCheck, CheckCircle, ChevronRight, ChevronLeft,
  AlertCircle, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { DocumentosAnexadosPanel } from '@/components/cadastro/DocumentosAnexadosPanel';
import { PropostaMidiaGrid } from './PropostaMidiaGrid';
import { VistoriaObservacoesCard } from '@/components/cadastro/VistoriaObservacoesCard';
import type { DocumentoAnexadoCompleto } from '@/types/documentos';
import type { PropostaPendente, VistoriaFotoInfo } from '@/hooks/usePropostasPendentes';
import type { DocumentoSolicitadoEnviado } from '@/components/cadastro/DocumentosSolicitadosCard';

interface PropostaApprovalStepperProps {
  proposta: PropostaPendente;
  documentos: DocumentoAnexadoCompleto[];
  onViewDocumento: (documento: DocumentoAnexadoCompleto) => void;
  onAprovarDocumento: (docId: string) => Promise<void>;
  onReprovarDocumento: (docId: string, motivo: string) => Promise<void>;
  onAprovar: () => void;
  onSolicitarDocs: () => void;
  onReprovar: () => void;
  isAprovando: boolean;
  isAutovistoria: boolean;
  podeAprovar: boolean;
}

interface StepConfig {
  id: number;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  description: string;
}

const steps: StepConfig[] = [
  { 
    id: 1, label: 'Documentos', shortLabel: 'Docs',
    icon: <FileText className="h-4 w-4" />,
    description: 'Analise e aprove cada documento anexado'
  },
  { 
    id: 2, label: 'Fotos & Vistoria', shortLabel: 'Fotos',
    icon: <Camera className="h-4 w-4" />,
    description: 'Revise as fotos e o vídeo da vistoria'
  },
  { 
    id: 3, label: 'Aprovação Final', shortLabel: 'Aprovar',
    icon: <ShieldCheck className="h-4 w-4" />,
    description: 'Confirme a liberação da cobertura'
  },
];

export function PropostaApprovalStepper({
  proposta,
  documentos,
  onViewDocumento,
  onAprovarDocumento,
  onReprovarDocumento,
  onAprovar,
  onSolicitarDocs,
  onReprovar,
  isAprovando,
  isAutovistoria,
  podeAprovar,
}: PropostaApprovalStepperProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [fotosRevisadas, setFotosRevisadas] = useState(false);

  // Step 1 validation: all documents approved (or no documents)
  const totalDocs = documentos.length;
  const docsAprovados = documentos.filter(d => d.status === 'aprovado').length;
  const docsPendentes = documentos.filter(d => d.status === 'pendente' || d.status === 'em_analise').length;
  const docsReprovados = documentos.filter(d => d.status === 'reprovado').length;
  const step1Complete = totalDocs === 0 || (docsPendentes === 0 && docsReprovados === 0);

  // Step 2 validation: user confirmed photos reviewed
  const temFotos = (proposta.vistoria?.fotos?.length || 0) > 0 || !!proposta.vistoria?.video_360_url;
  const step2Complete = fotosRevisadas || !temFotos;

  const canAdvanceFromStep = (step: number): boolean => {
    if (step === 1) return step1Complete;
    if (step === 2) return step2Complete;
    return true;
  };

  const getStepStatus = (stepId: number): 'complete' | 'active' | 'pending' => {
    if (stepId < currentStep) {
      if (stepId === 1 && step1Complete) return 'complete';
      if (stepId === 2 && step2Complete) return 'complete';
      if (stepId === 1 && !step1Complete) return 'active';
      if (stepId === 2 && !step2Complete) return 'active';
      return 'complete';
    }
    if (stepId === currentStep) return 'active';
    return 'pending';
  };

  return (
    <div className="space-y-4">
      {/* Stepper Bar */}
      <Card className="border-border bg-card overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const status = getStepStatus(step.id);
              return (
                <div key={step.id} className="flex items-center flex-1">
                  {/* Step circle + label */}
                  <button
                    onClick={() => {
                      // Allow going back freely, forward only if current step is complete
                      if (step.id < currentStep || (step.id === currentStep) || canAdvanceFromStep(currentStep)) {
                        if (step.id <= currentStep || canAdvanceFromStep(step.id - 1)) {
                          setCurrentStep(step.id);
                        }
                      }
                    }}
                    className={cn(
                      "flex items-center gap-2.5 group cursor-pointer transition-all",
                      status === 'pending' && "opacity-50"
                    )}
                  >
                    <div className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all shrink-0",
                      status === 'complete' && "bg-success text-white",
                      status === 'active' && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                      status === 'pending' && "bg-muted text-muted-foreground"
                    )}>
                      {status === 'complete' ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        step.id
                      )}
                    </div>
                    <div className="hidden sm:block text-left">
                      <p className={cn(
                        "text-sm font-semibold leading-tight",
                        status === 'active' && "text-foreground",
                        status === 'complete' && "text-success",
                        status === 'pending' && "text-muted-foreground"
                      )}>
                        {step.label}
                      </p>
                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                        {step.description}
                      </p>
                    </div>
                    {/* Mobile label */}
                    <span className={cn(
                      "sm:hidden text-xs font-semibold",
                      status === 'active' && "text-foreground",
                      status === 'complete' && "text-success",
                      status === 'pending' && "text-muted-foreground"
                    )}>
                      {step.shortLabel}
                    </span>
                  </button>
                  
                  {/* Connector line */}
                  {index < steps.length - 1 && (
                    <div className={cn(
                      "flex-1 h-0.5 mx-3 rounded-full transition-colors",
                      getStepStatus(step.id) === 'complete' ? "bg-success" : "bg-border"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      <div className="min-h-[200px]">
        {/* STEP 1: Documentos */}
        {currentStep === 1 && (
          <div className="space-y-4 animate-fade-in">
            {/* Status banner */}
            {totalDocs > 0 && !step1Complete && (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-warning/10 border border-warning/30">
                <AlertCircle className="h-5 w-5 text-warning shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-warning">
                    {docsPendentes > 0 && `${docsPendentes} documento(s) pendente(s) de análise`}
                    {docsPendentes > 0 && docsReprovados > 0 && ' · '}
                    {docsReprovados > 0 && `${docsReprovados} reprovado(s)`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Aprove ou reprove todos os documentos para avançar
                  </p>
                </div>
                <Badge variant="outline" className="bg-success/10 text-success border-success/30 shrink-0">
                  {docsAprovados}/{totalDocs} aprovados
                </Badge>
              </div>
            )}

            {totalDocs > 0 && step1Complete && (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-success/10 border border-success/30">
                <CheckCircle className="h-5 w-5 text-success shrink-0" />
                <p className="text-sm font-semibold text-success">
                  Todos os {totalDocs} documento(s) foram analisados ✓
                </p>
              </div>
            )}

            <DocumentosAnexadosPanel
              documentos={documentos}
              onViewDocumento={onViewDocumento}
              onAprovarDocumento={onAprovarDocumento}
              onReprovarDocumento={onReprovarDocumento}
            />
          </div>
        )}

        {/* STEP 2: Fotos & Vistoria */}
        {currentStep === 2 && (
          <div className="space-y-4 animate-fade-in">
            <PropostaMidiaGrid
              video360Url={proposta.vistoria?.video_360_url}
              fotos={proposta.vistoria?.fotos || []}
              assinaturaUrl={proposta.instalacao_info?.assinatura_cliente_url}
              assinaturaData={proposta.instalacao_info?.concluida_em}
              assinaturaPor={proposta.instalacao_info?.instalador_nome}
              documentosSolicitados={proposta.documentos_solicitados_enviados}
            />

            {proposta.vistoria && (proposta.vistoria.observacoes || proposta.vistoria.km_atual) && (
              <VistoriaObservacoesCard 
                observacoes={proposta.vistoria.observacoes}
                kmAtual={proposta.vistoria.km_atual}
              />
            )}

            {/* Confirmation checkbox */}
            {temFotos && (
              <Card className={cn(
                "border-2 transition-colors",
                fotosRevisadas ? "border-success/50 bg-success/5" : "border-border"
              )}>
                <CardContent className="p-4">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <Checkbox 
                      checked={fotosRevisadas}
                      onCheckedChange={(checked) => setFotosRevisadas(!!checked)}
                      className="h-5 w-5"
                    />
                    <div>
                      <p className={cn(
                        "text-sm font-semibold",
                        fotosRevisadas ? "text-success" : "text-foreground"
                      )}>
                        {fotosRevisadas ? '✓ Fotos e vistoria revisadas' : 'Confirmo que revisei todas as fotos e dados da vistoria'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Verifique o estado do veículo nas fotos, vídeo 360° e observações do vistoriador
                      </p>
                    </div>
                  </label>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* STEP 3: Aprovação Final */}
        {currentStep === 3 && (
          <div className="space-y-4 animate-fade-in">
            {/* Summary checklist */}
            <Card className="border-border">
              <CardContent className="p-5 space-y-4">
                <h3 className="text-base font-bold text-foreground">Resumo da Análise</h3>
                
                <div className="space-y-3">
                  {/* Doc check */}
                  <div className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border",
                    step1Complete 
                      ? "bg-success/5 border-success/30" 
                      : "bg-destructive/5 border-destructive/30"
                  )}>
                    {step1Complete ? (
                      <CheckCircle className="h-5 w-5 text-success shrink-0" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className={cn("text-sm font-semibold", step1Complete ? "text-success" : "text-destructive")}>
                        Documentos
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {totalDocs === 0 
                          ? 'Nenhum documento anexado' 
                          : `${docsAprovados}/${totalDocs} aprovado(s)`
                        }
                      </p>
                    </div>
                    {step1Complete && (
                      <Badge className="bg-success/20 text-success border-0 text-xs">Concluído</Badge>
                    )}
                  </div>

                  {/* Photos check */}
                  <div className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border",
                    step2Complete 
                      ? "bg-success/5 border-success/30" 
                      : "bg-warning/5 border-warning/30"
                  )}>
                    {step2Complete ? (
                      <CheckCircle className="h-5 w-5 text-success shrink-0" />
                    ) : (
                      <Eye className="h-5 w-5 text-warning shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className={cn("text-sm font-semibold", step2Complete ? "text-success" : "text-warning")}>
                        Fotos & Vistoria
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {!temFotos 
                          ? 'Sem fotos/vídeo disponíveis' 
                          : step2Complete 
                            ? 'Fotos e vistoria revisadas' 
                            : 'Revisão pendente'
                        }
                      </p>
                    </div>
                    {step2Complete && (
                      <Badge className="bg-success/20 text-success border-0 text-xs">Concluído</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action buttons */}
            {podeAprovar && (
              <div className="space-y-3">
                <Button
                  className="w-full h-14 text-base font-bold bg-success hover:bg-success/90 text-white shadow-lg"
                  onClick={onAprovar}
                  disabled={isAprovando || !step1Complete || !step2Complete}
                  size="lg"
                >
                  {isAprovando ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span>
                      Aprovando...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="mr-2 h-5 w-5" />
                      {isAutovistoria ? 'Liberar Cobertura Roubo e Furto' : 'Aprovar Proposta'}
                    </>
                  )}
                </Button>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 border-warning/50 text-warning hover:bg-warning/10"
                    onClick={onSolicitarDocs}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Solicitar Documentos
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-destructive/50 text-destructive hover:bg-destructive/10"
                    onClick={onReprovar}
                  >
                    <AlertCircle className="mr-2 h-4 w-4" />
                    Reprovar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
          disabled={currentStep === 1}
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar
        </Button>

        <span className="text-xs text-muted-foreground">
          Etapa {currentStep} de {steps.length}
        </span>

        {currentStep < 3 ? (
          <Button
            onClick={() => setCurrentStep(prev => Math.min(3, prev + 1))}
            disabled={!canAdvanceFromStep(currentStep)}
            className="gap-2"
          >
            Avançar
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <div className="w-[100px]" /> // Spacer
        )}
      </div>
    </div>
  );
}
