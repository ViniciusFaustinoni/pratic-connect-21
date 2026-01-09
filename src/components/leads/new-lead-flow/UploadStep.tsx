import { useState, useRef } from 'react';
import { Camera, Search, FileText, Loader2, CheckCircle2, Phone, Mail, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { TelefoneInput, PlacaInput } from '@/components/inputs/MaskedInputs';
import type { NewLeadFlowState } from '@/hooks/useNewLeadFlow';

interface UploadStepProps {
  state: NewLeadFlowState;
  updateState: (updates: Partial<NewLeadFlowState>) => void;
  lookupPlate: (placa: string) => Promise<boolean>;
  onCancel: () => void;
  onNext: () => void;
}

export function UploadStep({ state, updateState, lookupPlate, onCancel, onNext }: UploadStepProps) {
  const [placa, setPlaca] = useState(state.vehicleData?.placa || '');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePlacaLookup = async () => {
    const placaLimpa = placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (placaLimpa.length < 7) return;
    
    setIsLookingUp(true);
    await lookupPlate(placaLimpa);
    setIsLookingUp(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      updateState({ documentImage: file });
    }
  };

  const removeDocument = () => {
    updateState({ documentImage: null, personalData: null });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const canProceed = state.telefone.replace(/\D/g, '').length >= 10 && 
                     state.vehicleData !== null;

  return (
    <div className="space-y-6">
      {/* Seção 1: Contatos */}
      <div className="space-y-4">
        <h3 className="font-semibold text-sm text-muted-foreground border-b pb-2 uppercase tracking-wide flex items-center gap-2">
          <Phone className="h-4 w-4" />
          Dados de Contato
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone *</Label>
            <TelefoneInput 
              value={state.telefone} 
              onChange={(value) => updateState({ telefone: value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input 
              id="email"
              type="email" 
              placeholder="email@exemplo.com"
              value={state.email}
              onChange={(e) => updateState({ email: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Seção 2: Veículo */}
      <div className="space-y-4">
        <h3 className="font-semibold text-sm text-muted-foreground border-b pb-2 uppercase tracking-wide flex items-center gap-2">
          <Camera className="h-4 w-4" />
          Dados do Veículo
        </h3>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            Placa do Veículo *
            {state.vehicleData && (
              <Badge variant="secondary" className="text-xs font-normal">
                <CheckCircle2 className="h-3 w-3 mr-1 text-green-600" />
                Dados carregados
              </Badge>
            )}
          </Label>
          <div className="flex gap-2">
            <PlacaInput 
              value={placa}
              onChange={(value) => {
                setPlaca(value);
                if (state.vehicleData) {
                  updateState({ vehicleData: null, fipeData: null });
                }
              }}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              disabled={isLookingUp || placa.replace(/[^A-Za-z0-9]/g, '').length < 7}
              onClick={handlePlacaLookup}
            >
              {isLookingUp ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Consultar
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Digite a placa e clique em consultar para carregar os dados automaticamente
          </p>
        </div>

        {/* Preview dos dados do veículo */}
        {state.vehicleData && (
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold text-green-800 dark:text-green-200">
                  {state.vehicleData.marca} {state.vehicleData.modelo}
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  {state.vehicleData.placa} • {state.vehicleData.ano} • {state.vehicleData.cor}
                </p>
              </div>
              {state.fipeData && (
                <Badge className="bg-green-600">
                  FIPE: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(state.fipeData.valor)}
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Seção 3: Documento (Opcional) */}
      <div className="space-y-4">
        <h3 className="font-semibold text-sm text-muted-foreground border-b pb-2 uppercase tracking-wide flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Documento CNH (Opcional)
        </h3>

        <div className="space-y-2">
          <Label>Upload da CNH para preenchimento automático</Label>
          
          {state.documentImage ? (
            <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
              <FileText className="h-5 w-5 text-primary" />
              <span className="flex-1 text-sm truncate">{state.documentImage.name}</span>
              <Button variant="ghost" size="icon" onClick={removeDocument}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
                id="doc-upload"
              />
              <label
                htmlFor="doc-upload"
                className="flex-1 flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <Camera className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Clique para tirar foto ou selecionar
                </span>
              </label>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            A CNH será usada para preencher nome e CPF automaticamente
          </p>
        </div>
      </div>

      {/* Botões */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button 
          onClick={onNext} 
          disabled={!canProceed}
        >
          Continuar
        </Button>
      </div>
    </div>
  );
}
