import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  DollarSign, 
  User, 
  Cpu, 
  FileText,
  CreditCard,
  FileSpreadsheet,
  Lock,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useAplicarMulta } from '@/hooks/useMultaRetirada';
import { useMultaRastreador } from '@/hooks/useConteudosSistema';
import { 
  type MotivoMulta, 
  type FormaCobrancaMulta,
  type IntegridadeAparelho,
  MOTIVO_MULTA_LABELS,
  FORMA_COBRANCA_MULTA_LABELS,
} from '@/types/retirada';

interface RetiradaParaMulta {
  id: string;
  associado?: { nome: string; cpf: string } | null;
  rastreador?: { codigo: string } | null;
  integridade?: IntegridadeAparelho | null;
}

interface AplicarMultaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  retirada: RetiradaParaMulta | null;
  motivoPreSelecionado?: MotivoMulta;
}

export function AplicarMultaModal({ 
  open, 
  onOpenChange, 
  retirada,
  motivoPreSelecionado,
}: AplicarMultaModalProps) {
  const [motivo, setMotivo] = useState<MotivoMulta | null>(null);
  const [formaCobranca, setFormaCobranca] = useState<FormaCobrancaMulta>('automatica_asaas');
  const [bloquearCancelamento, setBloquearCancelamento] = useState(false);
  const { data: multaValor = 400 } = useMultaRastreador();

  const aplicarMultaMutation = useAplicarMulta();

  // Pré-selecionar motivo se fornecido ou se integridade indica dano
  useEffect(() => {
    if (motivoPreSelecionado) {
      setMotivo(motivoPreSelecionado);
    } else if (retirada?.integridade && retirada.integridade !== 'integro') {
      setMotivo('aparelho_danificado');
      setBloquearCancelamento(true);
    } else {
      setMotivo(null);
    }
  }, [motivoPreSelecionado, retirada, open]);

  const handleConfirmar = async () => {
    if (!retirada || !motivo) return;

    await aplicarMultaMutation.mutateAsync({
      servicoId: retirada.id,
      motivo,
      formaCobranca,
      bloquearCancelamento,
    });

    onOpenChange(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setMotivo(null);
      setFormaCobranca('automatica_asaas');
      setBloquearCancelamento(false);
    }
    onOpenChange(isOpen);
  };

  if (!retirada) return null;

  const isFormValid = motivo !== null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <DollarSign className="h-5 w-5" />
            Aplicar Multa de Rastreador
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Info do serviço */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{retirada.associado?.nome || '-'}</span>
            </div>
            {retirada.associado?.cpf && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>CPF: {retirada.associado.cpf}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono">{retirada.rastreador?.codigo || '-'}</span>
            </div>
          </div>

          {/* Regulamento */}
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <FileText className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-700 dark:text-amber-300 text-xs">
              <strong>Regulamento Art. 5.11:</strong> Multa de R$ 400,00 para não devolução, 
              não comparecimento ou devolução de aparelho danificado.
            </AlertDescription>
          </Alert>

          {/* Motivo da Multa */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Motivo da Multa</Label>
            <RadioGroup
              value={motivo || ''}
              onValueChange={(v) => setMotivo(v as MotivoMulta)}
              className="space-y-2"
            >
              {(Object.keys(MOTIVO_MULTA_LABELS) as MotivoMulta[]).map((m) => (
                <div 
                  key={m}
                  className={`flex items-center space-x-3 p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                    motivo === m ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20' : 'border-border'
                  }`}
                  onClick={() => setMotivo(m)}
                >
                  <RadioGroupItem value={m} id={m} />
                  <Label htmlFor={m} className="cursor-pointer flex-1">
                    {MOTIVO_MULTA_LABELS[m]}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Forma de Cobrança */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Forma de Cobrança</Label>
            <RadioGroup
              value={formaCobranca}
              onValueChange={(v) => setFormaCobranca(v as FormaCobrancaMulta)}
              className="space-y-2"
            >
              {/* ASAAS Automático */}
              <div 
                className={`flex items-start space-x-3 p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                  formaCobranca === 'automatica_asaas' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' : 'border-border'
                }`}
                onClick={() => setFormaCobranca('automatica_asaas')}
              >
                <RadioGroupItem value="automatica_asaas" id="automatica_asaas" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="automatica_asaas" className="font-medium cursor-pointer flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-blue-600" />
                    {FORMA_COBRANCA_MULTA_LABELS.automatica_asaas}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Boleto/PIX será gerado automaticamente via ASAAS
                  </p>
                </div>
              </div>

              {/* Manual Financeiro */}
              <div 
                className={`flex items-start space-x-3 p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                  formaCobranca === 'manual_financeiro' ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-border'
                }`}
                onClick={() => setFormaCobranca('manual_financeiro')}
              >
                <RadioGroupItem value="manual_financeiro" id="manual_financeiro" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="manual_financeiro" className="font-medium cursor-pointer flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-green-600" />
                    {FORMA_COBRANCA_MULTA_LABELS.manual_financeiro}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Registrar pendência para cobrança manual pelo Financeiro
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Checkbox Bloquear Cancelamento */}
          <div 
            className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
              bloquearCancelamento ? 'border-orange-300 bg-orange-50 dark:bg-orange-950/20' : 'border-border'
            }`}
            onClick={() => setBloquearCancelamento(!bloquearCancelamento)}
          >
            <Checkbox 
              id="bloquear" 
              checked={bloquearCancelamento}
              onCheckedChange={(v) => setBloquearCancelamento(!!v)}
            />
            <div className="flex-1">
              <Label htmlFor="bloquear" className="font-medium cursor-pointer flex items-center gap-2">
                <Lock className="h-4 w-4 text-orange-600" />
                Bloquear finalização do cancelamento
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Associado não poderá ter cancelamento finalizado enquanto multa não for paga ou rastreador devolvido
              </p>
            </div>
          </div>

          {/* Valor */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="font-medium">Valor da Multa:</span>
            <Badge variant="secondary" className="text-lg font-bold">
              R$ {multaValor.toFixed(2).replace('.', ',')}
            </Badge>
          </div>

          {/* Alerta se aparelho danificado */}
          {retirada.integridade && retirada.integridade !== 'integro' && (
            <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700 dark:text-red-300 text-xs">
                Aparelho foi devolvido com problemas ({retirada.integridade}). 
                Multa recomendada conforme regulamento.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={aplicarMultaMutation.isPending}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmar}
            disabled={!isFormValid || aplicarMultaMutation.isPending}
            className="flex-1 bg-amber-600 hover:bg-amber-700"
          >
            {aplicarMultaMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <DollarSign className="h-4 w-4 mr-2" />
            )}
            Confirmar Multa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
