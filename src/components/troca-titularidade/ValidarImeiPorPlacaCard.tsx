import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Cpu, Loader2, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

interface Props {
  placa: string | null | undefined;
  imei: string;
  onChange: (imei: string) => void;
  onValidar: () => void | Promise<void>;
  validando: boolean;
  validado: boolean;
  origem: 'softruck' | 'rede_veiculos' | null;
  erro: string | null;
  disabled?: boolean;
}

/**
 * Card de entrada + validação do IMEI físico instalado.
 * Botão "Validar" dispara a checagem Softruck → fallback Rede contra a placa.
 * O pai (ModalDetalhesTroca) só libera "Aprovar" depois que `validado=true`.
 * Ver `mem://logic/operations/vincular-rastreador-existente-monitoramento`.
 */
export function ValidarImeiPorPlacaCard({
  placa,
  imei,
  onChange,
  onValidar,
  validando,
  validado,
  origem,
  erro,
  disabled,
}: Props) {
  const imeiDigits = imei.replace(/\D/g, '').length;
  const podeValidar = !disabled && !validando && !validado && imeiDigits >= 15;

  return (
    <div className="rounded border p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Cpu className="h-4 w-4" />
        <h4 className="font-semibold">Rastreador instalado (validação)</h4>
        {validado && (
          <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Validado em {origem === 'softruck' ? 'Softruck' : 'Rede Veículos'}
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Veículo elegível a rastreador. Informe o IMEI fisicamente instalado na placa{' '}
        <strong>{placa || '(sem placa)'}</strong> e clique em <strong>Validar</strong>. O sistema
        confirma o vínculo IMEI ↔ placa na Softruck (com fallback Rede Veículos). O botão{' '}
        <strong>Aprovar</strong> só libera após a validação confirmar.
      </p>
      <div className="space-y-1">
        <Label htmlFor="validacao-imei">IMEI</Label>
        <div className="flex gap-2">
          <Input
            id="validacao-imei"
            inputMode="numeric"
            autoComplete="off"
            value={imei}
            onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 16))}
            disabled={disabled || validando || validado}
            maxLength={16}
            className="flex-1"
          />
          {!validado && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => void onValidar()}
              disabled={!podeValidar}
            >
              {validando ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Validando…
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Validar
                </>
              )}
            </Button>
          )}
        </div>
        {!validado && imeiDigits > 0 && imeiDigits < 15 && (
          <p className="text-xs text-muted-foreground">
            IMEI deve ter pelo menos 15 dígitos ({imeiDigits}/15).
          </p>
        )}
      </div>
      {validando && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Validando IMEI nas plataformas externas…
        </div>
      )}
      {erro && !validando && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Validação bloqueada</AlertTitle>
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
