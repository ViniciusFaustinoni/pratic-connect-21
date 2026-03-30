import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CarenciaConfig {
  carencia_ativa: boolean;
  carencia_tipo: string;
  carencia_dias: string;
  carencia_multiplicador: string;
}

interface CarenciaConfigSectionProps {
  config: CarenciaConfig;
  onChange: (config: CarenciaConfig) => void;
  disabled?: boolean;
}

export function CarenciaConfigSection({ config, onChange, disabled }: CarenciaConfigSectionProps) {
  const update = (partial: Partial<CarenciaConfig>) => {
    onChange({ ...config, ...partial });
  };

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
      <div className="flex items-center justify-between">
        <Label htmlFor="carencia_ativa" className="font-medium">Carência</Label>
        <Switch
          id="carencia_ativa"
          checked={config.carencia_ativa}
          onCheckedChange={(checked) => update({ carencia_ativa: checked })}
          disabled={disabled}
        />
      </div>

      {config.carencia_ativa && (
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="carencia_tipo">Tipo</Label>
              <Select
                value={config.carencia_tipo}
                onValueChange={(value) => update({ carencia_tipo: value })}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="liberacao">Liberação</SelectItem>
                  <SelectItem value="multiplicadora_cota">Multiplicadora de Cota</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="carencia_dias">Prazo (dias)</Label>
              <Input
                id="carencia_dias"
                type="number"
                min="0"
                value={config.carencia_dias}
                onChange={(e) => update({ carencia_dias: e.target.value })}
                placeholder="Ex: 30"
                disabled={disabled}
              />
            </div>
          </div>

          {config.carencia_tipo === 'multiplicadora_cota' && (
            <div className="space-y-2">
              <Label htmlFor="carencia_multiplicador">Multiplicador da Cota</Label>
              <Input
                id="carencia_multiplicador"
                type="number"
                min="0"
                step="0.1"
                value={config.carencia_multiplicador}
                onChange={(e) => update({ carencia_multiplicador: e.target.value })}
                placeholder="Ex: 2.0"
                disabled={disabled}
              />
              <p className="text-xs text-muted-foreground">
                Fator pelo qual a cota de participação será multiplicada durante o período de carência
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
