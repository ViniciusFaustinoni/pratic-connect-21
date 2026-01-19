import { Wrench, ClipboardCheck, FileSearch } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { 
  TIPO_VISTORIA_LABELS, 
  type FiltroTipoServico,
  type TipoVistoria 
} from '@/types/servicos-rota';

interface TipoServicoFilterProps {
  filtros: FiltroTipoServico;
  onChange: (filtros: FiltroTipoServico) => void;
  disabled?: boolean;
}

const TIPOS_VISTORIA: TipoVistoria[] = ['saida', 'sinistro', 'periodica', 'cancelamento', 'manutencao'];

export function TipoServicoFilter({ filtros, onChange, disabled }: TipoServicoFilterProps) {
  const handleChange = (key: keyof FiltroTipoServico, value: boolean) => {
    onChange({ ...filtros, [key]: value });
  };

  const handleSelectAll = () => {
    const allTrue: FiltroTipoServico = {
      instalacao: true,
      saida: true,
      sinistro: true,
      periodica: true,
      cancelamento: true,
      manutencao: true,
    };
    onChange(allTrue);
  };

  const handleDeselectAll = () => {
    const allFalse: FiltroTipoServico = {
      instalacao: false,
      saida: false,
      sinistro: false,
      periodica: false,
      cancelamento: false,
      manutencao: false,
    };
    onChange(allFalse);
  };

  const allSelected = Object.values(filtros).every(v => v);
  const noneSelected = Object.values(filtros).every(v => !v);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Tipos de Serviço</Label>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={handleSelectAll}
            disabled={disabled || allSelected}
            className="text-primary hover:underline disabled:opacity-50 disabled:no-underline"
          >
            Todos
          </button>
          <span className="text-muted-foreground">|</span>
          <button
            type="button"
            onClick={handleDeselectAll}
            disabled={disabled || noneSelected}
            className="text-primary hover:underline disabled:opacity-50 disabled:no-underline"
          >
            Nenhum
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Instalação */}
        <div 
          className="flex items-center space-x-2 p-2 rounded-md border bg-blue-50/50 dark:bg-blue-950/20"
        >
          <Checkbox
            id="tipo-instalacao"
            checked={filtros.instalacao}
            onCheckedChange={(checked) => handleChange('instalacao', !!checked)}
            disabled={disabled}
          />
          <Label 
            htmlFor="tipo-instalacao" 
            className="flex items-center gap-2 text-sm cursor-pointer"
          >
            <Wrench className="h-4 w-4 text-blue-600" />
            Instalação
          </Label>
        </div>

        {/* Tipos de Vistoria */}
        {TIPOS_VISTORIA.map((tipo) => (
          <div 
            key={tipo}
            className="flex items-center space-x-2 p-2 rounded-md border bg-amber-50/50 dark:bg-amber-950/20"
          >
            <Checkbox
              id={`tipo-${tipo}`}
              checked={filtros[tipo]}
              onCheckedChange={(checked) => handleChange(tipo, !!checked)}
              disabled={disabled}
            />
            <Label 
              htmlFor={`tipo-${tipo}`} 
              className="flex items-center gap-2 text-sm cursor-pointer"
            >
            {tipo === 'saida' || tipo === 'cancelamento' ? (
              <ClipboardCheck className="h-4 w-4 text-amber-600" />
            ) : (
              <FileSearch className="h-4 w-4 text-amber-600" />
              )}
              {TIPO_VISTORIA_LABELS[tipo]}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}
