import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeftRight, CheckCircle2, Loader2, Wrench, Truck, ArrowLeft, Info } from 'lucide-react';
import { AgendamentoVistoria } from './AgendamentoVistoria';
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

type DadosAgendamento = {
  dataAgendada: string;
  periodo: string;
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
 * de agendamento independentes (instalação do novo veículo primeiro,
 * depois retirada do veículo antigo). No final dispara a edge
 * `criar-substituicao-agendamentos-separados` que materializa
 * 2 `agendamentos_base` separados — um para a instalação e outro
 * para o serviço de retirada.
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
  const [dadosInstalacao, setDadosInstalacao] = useState<DadosAgendamento | null>(null);
  // O AgendamentoVistoria com skipMutation só devolve data/período. Precisamos
  // capturar o endereço/responsável/encaixe via um wrapper mais rico —
  // usamos uma ref-callback simples passando pelos próprios estados internos.
  // Para evitar refatorar AgendamentoVistoria agora, persistimos o snapshot
  // completo dos campos da cotação chamando duas vezes a função `agendar-vistoria-completa`
  // não — em vez disso, o edge `criar-substituicao-agendamentos-separados` recebe
  // os 2 payloads completos. Para coletá-los, montamos um wrapper que
  // intercepta o submit do AgendamentoVistoria via callback enriquecido.

  return (
    <div className="space-y-4">
      {/* Header com progresso */}
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
                <Badge variant="outline" className="text-[10px]">
                  1 de 2 — Instalação
                </Badge>
                {dadosInstalacao && <CheckCircle2 className="h-4 w-4 text-success ml-auto" />}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-1">
                Veículo novo: <strong>{veiculoNovoDescricao}</strong>
              </p>
            </div>

            <div
              className={`p-3 rounded-lg border-2 transition-all ${
                passo === 'retirada'
                  ? 'border-primary bg-primary/5'
                  : 'border-border opacity-60'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Truck className="h-4 w-4 text-destructive" />
                <Badge variant="outline" className="text-[10px]">
                  2 de 2 — Retirada
                </Badge>
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
        <AgendamentoFormWrapper
          cotacaoId={cotacaoId}
          titulo="Agendar instalação no veículo novo"
          enderecoInicial={enderecoInicialNovo}
          onConfirmar={(payload) => {
            setDadosInstalacao(payload);
            setPasso('retirada');
            try {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            } catch (_) {
              /* noop */
            }
          }}
        />
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

          <AgendamentoFormWrapper
            cotacaoId={cotacaoId}
            titulo="Agendar retirada do veículo antigo"
            // Sem endereço inicial: cliente preenche o local do veículo antigo
            enderecoInicial={undefined}
            onConfirmar={async (retiradaPayload) => {
              setPasso('enviando');
              try {
                const { data, error } = await supabase.functions.invoke(
                  'criar-substituicao-agendamentos-separados',
                  {
                    body: {
                      cotacaoId,
                      instalacao: dadosInstalacao.fullPayload,
                      retirada: retiradaPayload.fullPayload,
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

/* ============================================================================
 * Wrapper interno que reaproveita AgendamentoVistoria (skipMutation) mas
 * intercepta o payload completo via patch local: AgendamentoVistoria já
 * persiste os campos via supabase quando skipMutation=false; aqui forçamos
 * skipMutation=true e usamos o callback que recebe (data, periodo). Para
 * capturar endereço/responsável/encaixe, lemos da cotação após o envio? NÃO —
 * precisamos do payload sem efeito colateral. Por isso o componente abaixo
 * referencia uma versão estendida que captura os dados via portal.
 *
 * Para manter o escopo desta PR pequeno, usamos um truque: AgendamentoVistoria
 * com skipMutation só nos dá data + período. Mas precisamos do endereço para
 * a edge. Solução: o próprio AgendamentoVistoria já guarda o endereço em
 * estado interno e o expõe via window? Não. Solução real: extendemos
 * AgendamentoVistoria para também devolver o `endereco`, `responsavel` e
 * `permiteEncaixe` no callback `onConfirmar`. Vamos fazer essa pequena
 * extensão lá.
 * ========================================================================== */

interface AgendamentoFormPayload {
  dataAgendada: string;
  periodo: string;
  fullPayload: {
    dataAgendada: string;
    periodo: 'manha' | 'tarde';
    endereco: {
      cep: string;
      logradouro: string;
      numero: string;
      bairro: string;
      cidade: string;
      estado: string;
    };
    responsavel: { euMesmo: boolean; nome?: string; telefone?: string };
    permiteEncaixe: boolean;
  };
}

function AgendamentoFormWrapper({
  cotacaoId,
  titulo,
  enderecoInicial,
  onConfirmar,
}: {
  cotacaoId: string;
  titulo: string;
  enderecoInicial?: Partial<EnderecoForm>;
  onConfirmar: (p: AgendamentoFormPayload) => void;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground px-1">{titulo}</h3>
      <AgendamentoVistoria
        cotacaoId={cotacaoId}
        contexto="presencial-direto"
        enderecoInicial={enderecoInicial}
        skipMutation
        onConfirmarRico={(payload) => onConfirmar(payload)}
        onConfirmar={() => {
          /* substituído por onConfirmarRico no skipMutation */
        }}
      />
    </div>
  );
}
