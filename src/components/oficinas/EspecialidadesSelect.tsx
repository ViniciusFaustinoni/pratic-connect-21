import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ESPECIALIDADES_OFICINAS, ESPECIALIDADES_PRESTADORES } from '@/lib/fornecedores-constants';

interface Props {
  value: string[];
  onChange: (value: string[]) => void;
  contexto?: 'oficina' | 'prestador';
}

export function EspecialidadesSelect({ value, onChange, contexto = 'oficina' }: Props) {
  const lista = contexto === 'oficina' ? ESPECIALIDADES_OFICINAS : ESPECIALIDADES_PRESTADORES;
  const toggle = (esp: string) => {
    onChange(
      value.includes(esp)
        ? value.filter(v => v !== esp)
        : [...value, esp]
    );
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Especialidades</Label>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map(e => (
            <Badge key={e} variant="outline" className="text-xs">
              {e}
            </Badge>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-md border p-3">
        {lista.map(esp => (
          <div key={esp} className="flex items-center gap-2">
            <Checkbox
              id={`esp-${esp}`}
              checked={value.includes(esp)}
              onCheckedChange={() => toggle(esp)}
            />
            <Label htmlFor={`esp-${esp}`} className="cursor-pointer text-sm">
              {esp}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}
