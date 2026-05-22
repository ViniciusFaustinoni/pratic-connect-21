// ============================================
// Pergunta canônica: "Este veículo é 0KM?"
// Aparece no topo do bloco de veículo, ANTES de qualquer dado.
// Bloqueia o restante do formulário enquanto resposta == null.
//
// Por que existe:
//   O toggle "Veículo 0KM" era passável e o operador esquecia.
//   Sem a flag explícita, o sistema decide em cascata como se fosse
//   veículo emplacado normal (placeholder de placa, dispensa de RENAVAM,
//   roteiro de vistoria e sync SGA tomam decisões erradas).
//
// Persistência: grava em cotacoes.veiculo_zero_km (boolean).
// Pré-população: somente quando o campo na cotação carregada é
// explicitamente true ou false. NULL nunca infere — força decisão.
// Ver mem://logic/quotation/cotacao-0km-fluxo-canonico
// ============================================

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Car, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PerguntaZeroKmGateProps {
  /** Resposta atual: null = não respondida, true = 0KM, false = emplacado */
  value: boolean | null;
  /** Disparado ao escolher "Sim" ou "Não" */
  onChange: (isZeroKm: boolean) => void;
  /** Mostrar opção de trocar resposta (após decidir) */
  allowChange?: boolean;
  /** Quando true, oculta o bloco (útil em fluxos onde o veículo já existe — ex.: edição de troca de titularidade) */
  hidden?: boolean;
  /** Texto extra de contexto (ex.: "Esta resposta define se o sistema vai tratar como 0KM em toda a cascata.") */
  helperText?: string;
}

export function PerguntaZeroKmGate({
  value,
  onChange,
  allowChange = true,
  hidden = false,
  helperText,
}: PerguntaZeroKmGateProps) {
  if (hidden) return null;

  // Estado: ainda não respondido — mostrar pergunta cheia (bloqueante)
  if (value === null) {
    return (
      <Card className="border-2 border-amber-300/70 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-700/60">
        <CardContent className="pt-5 pb-5 space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-base font-semibold text-foreground">
                Este veículo é zero quilômetro?
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {helperText ||
                  'Responda antes de continuar. Essa resposta define se o sistema vai tratar como 0KM em toda a cascata (placa, RENAVAM, vistoria, SGA).'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-auto py-4 border-2 hover:border-primary hover:bg-primary/5"
              onClick={() => onChange(true)}
            >
              <div className="flex items-start gap-3 text-left w-full">
                <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Sim, é 0KM</p>
                  <p className="text-xs text-muted-foreground mt-0.5 whitespace-normal">
                    Sem placa definitiva. Preenchimento manual com chassi.
                  </p>
                </div>
              </div>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-auto py-4 border-2 hover:border-primary hover:bg-primary/5"
              onClick={() => onChange(false)}
            >
              <div className="flex items-start gap-3 text-left w-full">
                <Car className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Não, é emplacado</p>
                  <p className="text-xs text-muted-foreground mt-0.5 whitespace-normal">
                    Veículo com placa definitiva. Busca por placa ou manual.
                  </p>
                </div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Estado: respondido — strip fino mostrando a decisão + opção de trocar
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border px-3 py-2 text-sm',
        value
          ? 'border-primary/40 bg-primary/5'
          : 'border-border bg-muted/40'
      )}
    >
      <CheckCircle2 className={cn('h-4 w-4 shrink-0', value ? 'text-primary' : 'text-muted-foreground')} />
      <span className="font-medium">
        {value ? 'Veículo 0KM' : 'Veículo emplacado'}
      </span>
      <Badge variant="outline" className="ml-auto text-xs">
        {value ? 'Sem placa definitiva' : 'Com placa'}
      </Badge>
      {allowChange && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => onChange(!value)}
        >
          Trocar resposta
        </Button>
      )}
    </div>
  );
}
