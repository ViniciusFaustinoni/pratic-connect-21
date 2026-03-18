import { Car, User, Settings, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useVendedores } from '@/hooks/useVendedores';
import { ORIGEM_LABELS } from '@/types/database';
import { CpfInput, TelefoneInput } from '@/components/inputs/MaskedInputs';
import type { NewLeadFlowState } from '@/hooks/useNewLeadFlow';
import { Loader2 } from 'lucide-react';

interface ConfirmationStepProps {
  state: NewLeadFlowState;
  updateState: (updates: Partial<NewLeadFlowState>) => void;
  onBack: () => void;
  onSubmit: () => Promise<{ leadId: string; token?: string } | null>;
  isSubmitting: boolean;
}

export function ConfirmationStep({ state, updateState, onBack, onSubmit, isSubmitting }: ConfirmationStepProps) {
  const { data: vendedores = [] } = useVendedores();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const autoFilledClass = 'border-green-500 bg-green-50 dark:bg-green-950/30 dark:border-green-700';

  return (
    <div className="space-y-6">
      {/* Seção: Dados do Veículo */}
      <div className="space-y-4">
        <h3 className="font-semibold text-sm text-muted-foreground border-b pb-2 uppercase tracking-wide flex items-center gap-2">
          <Car className="h-4 w-4" />
          Dados do Veículo
          {state.vehicleData && (
            <Badge variant="secondary" className="text-xs font-normal ml-auto">
              <CheckCircle2 className="h-3 w-3 mr-1 text-green-600" />
              Preenchido automaticamente
            </Badge>
          )}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Placa</Label>
            <Input 
              value={state.vehicleData?.placa || ''} 
              readOnly
              className={state.vehicleData ? autoFilledClass : ''}
            />
          </div>
          <div className="space-y-2">
            <Label>Marca</Label>
            <Input 
              value={state.vehicleData?.marca || ''} 
              readOnly
              className={state.vehicleData ? autoFilledClass : ''}
            />
          </div>
          <div className="space-y-2">
            <Label>Modelo</Label>
            <Input 
              value={state.vehicleData?.modelo || ''} 
              readOnly
              className={state.vehicleData ? autoFilledClass : ''}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Ano</Label>
            <Input 
              value={state.vehicleData?.ano || ''} 
              readOnly
              className={state.vehicleData ? autoFilledClass : ''}
            />
          </div>
          <div className="space-y-2">
            <Label>Cor</Label>
            <Input 
              value={state.vehicleData?.cor || ''} 
              readOnly
              className={state.vehicleData ? autoFilledClass : ''}
            />
          </div>
          <div className="space-y-2">
            <Label>Combustível</Label>
            <Input 
              value={state.vehicleData?.combustivel || ''} 
              readOnly
              className={state.vehicleData ? autoFilledClass : ''}
            />
          </div>
          <div className="space-y-2">
            <Label>Valor FIPE</Label>
            <Input 
              value={state.fipeData ? formatCurrency(state.fipeData.valor) : '—'} 
              readOnly
              className={state.fipeData ? autoFilledClass : ''}
            />
          </div>
        </div>
      </div>

      {/* Seção: Dados Pessoais */}
      <div className="space-y-4">
        <h3 className="font-semibold text-sm text-muted-foreground border-b pb-2 uppercase tracking-wide flex items-center gap-2">
          <User className="h-4 w-4" />
          Dados Pessoais
          {state.personalData?.nome && (
            <Badge variant="secondary" className="text-xs font-normal ml-auto">
              <CheckCircle2 className="h-3 w-3 mr-1 text-green-600" />
              Extraído da CNH
            </Badge>
          )}
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nome Completo *</Label>
            <Input 
              value={state.personalData?.nome || ''}
              onChange={(e) => updateState({ 
                personalData: { ...state.personalData!, nome: e.target.value } 
              })}
              placeholder="Nome do associado"
              className={state.personalData?.nome ? autoFilledClass : ''}
            />
          </div>
          <div className="space-y-2">
            <Label>CPF</Label>
            <CpfInput 
              value={state.personalData?.cpf || ''}
              onChange={(value) => updateState({ 
                personalData: { ...state.personalData!, cpf: value } 
              })}
              className={state.personalData?.cpf ? autoFilledClass : ''}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Telefone *</Label>
            <TelefoneInput 
              value={state.telefone}
              onChange={(value) => updateState({ telefone: value })}
            />
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input 
              type="email"
              value={state.email}
              onChange={(e) => updateState({ email: e.target.value })}
              placeholder="email@exemplo.com"
            />
          </div>
        </div>
      </div>

      {/* Seção: Atribuição */}
      <div className="space-y-4">
        <h3 className="font-semibold text-sm text-muted-foreground border-b pb-2 uppercase tracking-wide flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Atribuição
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Origem *</Label>
            <Select 
              value={state.origem} 
              onValueChange={(value) => updateState({ origem: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ORIGEM_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Consultor Responsável</Label>
            <Select 
              value={state.selectedVendedor || '_none'} 
              onValueChange={(value) => updateState({ selectedVendedor: value === '_none' ? '' : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Não atribuído" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Não atribuído</SelectItem>
                {vendedores.map(v => (
                  <SelectItem key={v.id} value={v.user_id}>{v.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="work-vehicle" 
              checked={state.isWorkVehicle}
              onCheckedChange={(checked) => updateState({ isWorkVehicle: !!checked })}
            />
            <label
              htmlFor="work-vehicle"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Veículo de trabalho (APP - Uber, 99, etc.)
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox 
              id="generate-link" 
              checked={state.generateQuoteLink}
              onCheckedChange={(checked) => updateState({ generateQuoteLink: !!checked })}
            />
            <label
              htmlFor="generate-link"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Gerar link de cotação pública automaticamente
            </label>
          </div>
        </div>
      </div>

      {/* Botões */}
      <div className="flex justify-between gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onBack} disabled={isSubmitting}>
          Voltar
        </Button>
        <Button onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Criando...
            </>
          ) : (
            <>
              Criar Lead
              {state.generateQuoteLink && ' e Gerar Link'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
