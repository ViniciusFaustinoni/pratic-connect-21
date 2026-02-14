import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { TIPOS_PECAS } from '@/lib/fornecedores-constants';

interface Props {
  value: string[];
  onChange: (value: string[]) => void;
}

export function TiposPecasSelect({ value, onChange }: Props) {
  const toggle = (tipo: string) => {
    onChange(
      value.includes(tipo)
        ? value.filter(v => v !== tipo)
        : [...value, tipo]
    );
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Tipos de Peças</Label>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map(t => (
            <Badge key={t} variant="outline" className="text-xs">
              {t}
            </Badge>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-md border p-3">
        {TIPOS_PECAS.map(tipo => (
          <div key={tipo} className="flex items-center gap-2">
            <Checkbox
              id={`tipo-peca-${tipo}`}
              checked={value.includes(tipo)}
              onCheckedChange={() => toggle(tipo)}
            />
            <Label htmlFor={`tipo-peca-${tipo}`} className="cursor-pointer text-sm">
              {tipo}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}
