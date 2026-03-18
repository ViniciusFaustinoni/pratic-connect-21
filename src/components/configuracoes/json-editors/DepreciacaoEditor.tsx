import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface RegraDepreciacao {
  flag: string;
  label: string;
  percentual: number;
  adicional?: boolean;
}

interface Props {
  items: RegraDepreciacao[];
  onChange: (items: RegraDepreciacao[]) => void;
}

export function DepreciacaoEditor({ items, onChange }: Props) {
  const handlePercentualChange = (index: number, val: string) => {
    const num = parseFloat(val);
    if (isNaN(num) || num < 0 || num > 100) return;
    const updated = [...items];
    updated[index] = { ...updated[index], percentual: num };
    onChange(updated);
  };

  const handleAdicionalToggle = (index: number, checked: boolean) => {
    const updated = [...items];
    updated[index] = { ...updated[index], adicional: checked };
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        <strong>Concorrente:</strong> aplica-se apenas o maior percentual entre todos os concorrentes selecionados.{' '}
        <strong>Adicional:</strong> aplica-se sobre o valor já depreciado (composto).
      </p>
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Flag</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="w-[100px] text-center">Percentual</TableHead>
              <TableHead className="w-[120px] text-center">Adicional?</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, i) => (
              <TableRow key={item.flag}>
                <TableCell>
                  <Badge variant="outline" className="font-mono text-xs">{item.flag}</Badge>
                </TableCell>
                <TableCell className="text-sm">{item.label}</TableCell>
                <TableCell className="text-center">
                  <div className="relative">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={item.percentual}
                      onChange={(e) => handlePercentualChange(i, e.target.value)}
                      className="h-8 text-sm text-center pr-7 w-full"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Switch
                      checked={!!item.adicional}
                      onCheckedChange={(checked) => handleAdicionalToggle(i, checked)}
                    />
                    <span className="text-xs text-muted-foreground">
                      {item.adicional ? 'Adicional' : 'Concorrente'}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
