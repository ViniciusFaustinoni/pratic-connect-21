import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Cpu, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

interface Props {
  placa: string | null | undefined;
  imei: string;
  onChange: (imei: string) => void;
  validando: boolean;
  validado: boolean;
  origem: 'softruck' | 'rede_veiculos' | null;
  erro: string | null;
  disabled?: boolean;
}

/**
 * Card de entrada do IMEI físico instalado, controlado pelo pai.
 * A validação placa ↔ IMEI é disparada no clique de Aprovar (transação única).
 * Ver `mem://logic/operations/vincular-rastreador-existente-monitoramento`.
 */
export function ValidarImeiPorPlacaCard({
  placa,
  imei,
  onChange,
  validando,
  validado,
  origem,
  erro,
  disabled,
}: Props) {
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
        <strong>{placa || '(sem placa)'}</strong>. A validação é feita ao clicar em
        <strong> Aprovar</strong>: o sistema confirma o vínculo IMEI ↔ placa na Softruck (com
        fallback Rede Veículos) antes de registrar a decisão.
      </p>
      <div className="space-y-1">
        <Label htmlFor="validacao-imei">IMEI</Label>
        <Input
          id="validacao-imei"
          inputMode="numeric"
          autoComplete="off"
          value={imei}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 16))}
          disabled={disabled || validando || validado}
          maxLength={16}
        />
      </div>
      {validando && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Validando IMEI nas plataformas externas…
        </div>
      )}
      {erro && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Validação bloqueada</AlertTitle>
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
