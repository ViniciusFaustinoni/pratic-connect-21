import { useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Shield, Car, CheckCircle2 } from 'lucide-react';
import { useCotacaoContratacao } from '@/hooks/useCotacaoContratacao';
import { StepperCotacao, type Step } from '@/components/cotacao-publica/StepperCotacao';
import { EscolhaPlano } from '@/components/cotacao-publica/EscolhaPlano';
import { FormularioDadosPessoais, type DadosPessoaisForm } from '@/components/cotacao-publica/FormularioDadosPessoais';
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { formatarMoeda } from '@/config/pricing';
import { Button } from '@/components/ui/button';

const STEPS: Step[] = [
  { id: 'plano', label: 'Escolha do Plano', description: 'Selecione seu plano' },
  { id: 'dados', label: 'Dados Pessoais', description: 'Preencha seus dados' },
  { id: 'documentos', label: 'Documentos', description: 'Envie seus documentos' },
  { id: 'vistoria', label: 'Vistoria', description: 'Realize a vistoria' },
  { id: 'pagamento', label: 'Pagamento', description: 'Pague a adesão' },
  { id: 'conclusao', label: 'Conclusão', description: 'Contrato gerado' },
];

export default function CotacaoContratacao() {
  const { token } = useParams<{ token: string }>();
  const {
    cotacao,
    isLoading,
    error,
    planosDisponiveis,
    etapaAtual,
    setEtapaAtual,
    determinarEtapa,
    selecionarPlano,
    salvarDadosPessoais,
    isPending,
  } = useCotacaoContratacao(token);

  const [planoSelecionadoId, setPlanoSelecionadoId] = useState<string | null>(null);

  // Sincronizar etapa com status da cotação
  useEffect(() => {
    if (cotacao?.status_contratacao) {
      const etapa = determinarEtapa(cotacao.status_contratacao);
      setEtapaAtual(etapa);
    }
  }, [cotacao?.status_contratacao, determinarEtapa, setEtapaAtual]);

  // Pré-selecionar plano se já escolhido
  useEffect(() => {
    if (cotacao?.plano_escolhido_id) {
      setPlanoSelecionadoId(cotacao.plano_escolhido_id);
    }
  }, [cotacao?.plano_escolhido_id]);

  const handleSelecionarPlano = () => {
    if (planoSelecionadoId) {
      selecionarPlano(planoSelecionadoId);
    }
  };

  const handleSalvarDados = (dados: DadosPessoaisForm) => {
    salvarDadosPessoais(dados);
  };

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-20 w-full" />
          <div className="grid md:grid-cols-[240px_1fr] gap-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </div>
    );
  }

  // Error / Not Found
  if (error || !cotacao) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Cotação não encontrada</h1>
            <p className="text-muted-foreground">
              Esta cotação não existe, expirou ou o link está incorreto.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Contrato já gerado
  if (cotacao.status_contratacao === 'contrato_gerado' && cotacao.contrato_gerado_id) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Contrato Gerado!</h1>
            <p className="text-muted-foreground mb-4">
              Seu contrato foi gerado com sucesso. Em breve você receberá um e-mail para assinatura.
            </p>
            <Badge variant="outline" className="text-lg px-4 py-2">
              {cotacao.numero}
            </Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Default values para formulário de dados pessoais
  const dadosPessoaisDefault: Partial<DadosPessoaisForm> = {
    nome: cotacao.nome_solicitante || '',
    email: cotacao.email_solicitante || '',
    telefone: cotacao.telefone1_solicitante || '',
    cpf: cotacao.cliente_cpf || '',
    data_nascimento: cotacao.cliente_data_nascimento || '',
    cep: cotacao.cliente_cep || '',
    logradouro: cotacao.cliente_logradouro || '',
    numero: cotacao.cliente_numero || '',
    complemento: cotacao.cliente_complemento || '',
    bairro: cotacao.cliente_bairro || '',
    cidade: cotacao.cliente_cidade || '',
    uf: cotacao.cliente_uf || '',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background">
      {/* Header */}
      <header className="bg-background border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold">PRATIC</h1>
              <p className="text-xs text-muted-foreground">Proteção Veicular</p>
            </div>
          </div>
          <Badge variant="outline">Cotação {cotacao.numero}</Badge>
        </div>
      </header>

      {/* Vehicle Info */}
      <div className="bg-muted/50 border-b">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3 text-sm">
            <Car className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">
              {cotacao.veiculo_marca} {cotacao.veiculo_modelo}
            </span>
            {cotacao.veiculo_ano && (
              <Badge variant="secondary" className="text-xs">
                {cotacao.veiculo_ano}
              </Badge>
            )}
            {cotacao.valor_fipe && (
              <span className="text-muted-foreground">
                FIPE: {formatarMoeda(cotacao.valor_fipe)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid md:grid-cols-[240px_1fr] gap-6">
          {/* Stepper Sidebar */}
          <aside className="md:sticky md:top-24 md:self-start">
            <StepperCotacao
              steps={STEPS}
              currentStep={etapaAtual}
              onStepClick={(step) => step < etapaAtual && setEtapaAtual(step)}
            />
          </aside>

          {/* Step Content */}
          <div className="min-w-0">
            {/* Etapa 0: Escolha do Plano */}
            {etapaAtual === 0 && (
              <EscolhaPlano
                planos={planosDisponiveis}
                planoSelecionadoId={planoSelecionadoId}
                onSelectPlano={setPlanoSelecionadoId}
                onConfirmar={handleSelecionarPlano}
                isLoading={isPending}
              />
            )}

            {/* Etapa 1: Dados Pessoais */}
            {etapaAtual === 1 && (
              <FormularioDadosPessoais
                onSubmit={handleSalvarDados}
                defaultValues={dadosPessoaisDefault}
                isLoading={isPending}
              />
            )}

            {/* Etapa 2: Documentos - Placeholder */}
            {etapaAtual === 2 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <h2 className="text-xl font-semibold mb-4">Envio de Documentos</h2>
                  <p className="text-muted-foreground mb-6">
                    Esta etapa será implementada em breve. Por enquanto, clique em continuar.
                  </p>
                  <Button onClick={() => setEtapaAtual(3)}>Continuar</Button>
                </CardContent>
              </Card>
            )}

            {/* Etapa 3: Vistoria - Placeholder */}
            {etapaAtual === 3 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <h2 className="text-xl font-semibold mb-4">Vistoria</h2>
                  <p className="text-muted-foreground mb-6">
                    Esta etapa será implementada em breve. Por enquanto, clique em continuar.
                  </p>
                  <Button onClick={() => setEtapaAtual(4)}>Continuar</Button>
                </CardContent>
              </Card>
            )}

            {/* Etapa 4: Pagamento - Placeholder */}
            {etapaAtual === 4 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <h2 className="text-xl font-semibold mb-4">Pagamento</h2>
                  <p className="text-muted-foreground mb-6">
                    Esta etapa será implementada em breve. Por enquanto, clique em continuar.
                  </p>
                  <Button onClick={() => setEtapaAtual(5)}>Continuar</Button>
                </CardContent>
              </Card>
            )}

            {/* Etapa 5: Conclusão */}
            {etapaAtual === 5 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h2 className="text-xl font-semibold mb-2">Processo Concluído!</h2>
                  <p className="text-muted-foreground">
                    Seu contrato será gerado e você receberá um e-mail para assinatura.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-12">
        <div className="max-w-4xl mx-auto px-4 py-4 text-center text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} PRATIC - Proteção Veicular. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
