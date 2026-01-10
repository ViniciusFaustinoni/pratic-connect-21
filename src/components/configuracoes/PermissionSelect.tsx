import { Check, Eye, Pencil, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type PermValue = boolean | 'read' | 'own';

interface PermissionSelectProps {
  value: PermValue;
  onChange: (value: PermValue) => void;
  disabled?: boolean;
}

const valueToString = (value: PermValue): string => {
  if (value === true) return 'total';
  if (value === 'read') return 'read';
  if (value === 'own') return 'own';
  return 'none';
};

const stringToValue = (str: string): PermValue => {
  if (str === 'total') return true;
  if (str === 'read') return 'read';
  if (str === 'own') return 'own';
  return false;
};

export function PermissionSelect({ value, onChange, disabled }: PermissionSelectProps) {
  return (
    <Select 
      value={valueToString(value)} 
      onValueChange={(v) => onChange(stringToValue(v))} 
      disabled={disabled}
    >
      <SelectTrigger className="w-[120px] h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="total">
          <div className="flex items-center gap-2">
            <Check className="w-3 h-3 text-green-500" />
            <span>Total</span>
          </div>
        </SelectItem>
        <SelectItem value="read">
          <div className="flex items-center gap-2">
            <Eye className="w-3 h-3 text-blue-500" />
            <span>Leitura</span>
          </div>
        </SelectItem>
        <SelectItem value="own">
          <div className="flex items-center gap-2">
            <Pencil className="w-3 h-3 text-amber-500" />
            <span>Próprios</span>
          </div>
        </SelectItem>
        <SelectItem value="none">
          <div className="flex items-center gap-2">
            <X className="w-3 h-3 text-muted-foreground" />
            <span>Sem acesso</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
