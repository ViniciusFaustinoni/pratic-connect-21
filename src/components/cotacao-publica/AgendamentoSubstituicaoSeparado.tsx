import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeftRight, CheckCircle2, Loader2, Wrench, Truck, ArrowLeft, Info } from 'lucide-react';
import { AgendamentoVistoria, type AgendamentoRicoPayload } from './AgendamentoVistoria';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type EnderecoForm = {
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
};

interface Props {
  cotacaoId: string;
  veiculoAntigoPlaca: string;
  veiculoAntigoModelo: string;
  veiculoNovoDescricao: string;
  enderecoInicialNovo?: Partial<EnderecoForm>;
  onComplete: () => void;
}

type Passo = 'instalacao' | 'retirada' | 'enviando';

/**
 * Substituição com locais diferentes: cliente preenche 2 formulários
 * de agendamento independentes (instalação do veículo novo primeiro,
 * depois retirada do veículo antigo). Ao confirmar o segundo, dispara
 * a edge `criar-substituicao-agendamentos-separados` que materializa
 * 2 `agendamentos_base` separados.
 */
export function AgendamentoSubstituicaoSeparado({
  cotacaoId,
  veiculoAntigoPlaca,
  veiculoAntigoModelo,
  veiculoNovoDescricao,
  enderecoInicialNovo,
  onComplete,
}: Props) {
  const [passo, setPasso] = useState<Passo>('instalacao');
  const [dadosInstalacao, setDadosInstalacao] = useState<AgendamentoRicoPayload | null>(null);

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-card/80 backdrop-blur-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <ArrowLeftRight className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg">Substituição — Agendamentos separados</CardTitle>
              <CardDescription>
                Como os veículos estão em locais diferentes, vamos agendar cada serviço.
              </CardDescription>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4">
            <div
              className={`p-3 rounded-lg border-2 transition-all ${
                passo === 'instalacao'
                  ? 'border-primary bg-primary/5'
                  : dadosInstalacao
                  ? 'border-success/40 bg-success/5'
                  : 'border-border opacity-60'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Wrench className="h-4 w-4 text-primary" />
                <Badge variant="outline" className="text-[10px]">1 de 2 — Instalação</Badge>
                {dadosInstalacao && <CheckCircle2 className="h-4 w-4 text-success ml-auto" />}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-1">
                Veículo novo: <strong>{veiculoNovoDescricao}</strong>
              </p>
            </div>

            <div
              className={`p-3 rounded-lg border-2 transition-all ${
                passo === 'retirada' ? 'border-primary bg-primary/5' : 'border-border opacity-60'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Truck className="h-4 w-4 text-destructive" />
                <Badge variant="outline" className="text-[10px]">2 de 2 — Retirada</Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-1">
                Veículo antigo: <strong className="font-mono">{veiculoAntigoPlaca}</strong>
                {veiculoAntigoModelo ? ` · ${veiculoAntigoModelo}` : ''}
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {passo === 'instalacao' && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground px-1">
            Agendar instalação no veículo novo
          </h3>
          <AgendamentoVistoria
            cotacaoId={cotacaoId}
            contexto="presencial-direto"
            enderecoInicial={enderecoInicialNovo}
            skipMutation
            onConfirmar={() => { /* substituído por onConfirmarRico */ }}
            onConfirmarRico={(payload) => {
              setDadosInstalacao(payload);
              setPasso('retirada');
              try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) { /* noop */ }
            }}
          />
        </div>
      )}

      {passo === 'retirada' && dadosInstalacao && (
        <>
          <Alert className="border-amber-500/30 bg-amber-500/5">
            <Info className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-xs">
              Falta apenas o agendamento da <strong>retirada do veículo antigo</strong> (
              <span className="font-mono">{veiculoAntigoPlaca}</span>). Pode ser em outra data e
              endereço — totalmente independente da instalação.
            </AlertDescription>
          </Alert>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPasso('instalacao')}
            className="gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar e corrigir o agendamento da instalação
          </Button>

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground px-1">
              Agendar retirada do veículo antigo
            </h3>
            <AgendamentoVistoria
              cotacaoId={cotacaoId}
              contexto="presencial-direto"
              enderecoInicial={undefined}
              skipMutation
              onConfirmar={() => { /* substituído por onConfirmarRico */ }}
              onConfirmarRico={async (retiradaPayload) => {
                setPasso('enviando');
                try {
                  const { data, error } = await supabase.functions.invoke(
                    'criar-substituicao-agendamentos-separados',
                    {
                      body: {
                        cotacaoId,
                        instalacao: dadosInstalacao,
                        retirada: retiradaPayload,
                      },
                    },
                  );
                  if (error || !(data as any)?.success) {
                    console.error('[AgendamentoSubstituicaoSeparado] edge falhou:', error, data);
                    toast.error(
                      (data as any)?.error ||
                        error?.message ||
                        'Falha ao registrar os agendamentos. Tente novamente.',
                    );
                    setPasso('retirada');
                    return;
                  }
                  toast.success('Agendamentos confirmados!');
                  onComplete();
                } catch (e) {
                  console.error('[AgendamentoSubstituicaoSeparado] erro inesperado:', e);
                  toast.error('Erro de conexão. Tente novamente.');
                  setPasso('retirada');
                }
              }}
            />
          </div>
        </>
      )}

      {passo === 'enviando' && (
        <Card className="border-primary/20 bg-card/80 backdrop-blur-xl">
          <CardContent className="py-12 text-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">
              Registrando os dois agendamentos…
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
