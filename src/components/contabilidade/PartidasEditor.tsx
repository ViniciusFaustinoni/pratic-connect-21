import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { ContaCombobox } from './ContaCombobox';
import { cn } from '@/lib/utils';

export interface Partida {
  id: string;
  conta_id: string;
  tipo: 'debito' | 'credito';
  valor: number;
}

interface PartidasEditorProps {
  partidas: Partida[];
  onChange: (partidas: Partida[]) => void;
}

export function PartidasEditor({ partidas, onChange }: PartidasEditorProps) {
  const totalDebito = partidas
    .filter(p => p.tipo === 'debito')
    .reduce((sum, p) => sum + (p.valor || 0), 0);

  const totalCredito = partidas
    .filter(p => p.tipo === 'credito')
    .reduce((sum, p) => sum + (p.valor || 0), 0);

  const diferenca = Math.abs(totalDebito - totalCredito);
  const balanceado = diferenca < 0.01;

  const addPartida = () => {
    const newPartida: Partida = {
      id: crypto.randomUUID(),
      conta_id: '',
      tipo: 'debito',
      valor: 0,
    };
    onChange([...partidas, newPartida]);
  };

  const updatePartida = (id: string, field: keyof Partida, value: any) => {
    onChange(
      partidas.map(p =>
        p.id === id ? { ...p, [field]: value } : p
      )
    );
  };

  const removePartida = (id: string) => {
    if (partidas.length > 1) {
      onChange(partidas.filter(p => p.id !== id));
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50%]">Conta</TableHead>
              <TableHead className="w-[120px]">Tipo</TableHead>
              <TableHead className="w-[150px] text-right">Débito</TableHead>
              <TableHead className="w-[150px] text-right">Crédito</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {partidas.map((partida) => (
              <TableRow key={partida.id}>
                <TableCell>
                  <ContaCombobox
                    value={partida.conta_id}
                    onValueChange={(value) => updatePartida(partida.id, 'conta_id', value)}
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={partida.tipo}
                    onValueChange={(value: 'debito' | 'credito') =>
                      updatePartida(partida.id, 'tipo', value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debito">Débito</SelectItem>
                      <SelectItem value="credito">Crédito</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  {partida.tipo === 'debito' && (
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={partida.valor || ''}
                      onChange={(e) =>
                        updatePartida(partida.id, 'valor', parseFloat(e.target.value) || 0)
                      }
                      className="text-right"
                    />
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {partida.tipo === 'credito' && (
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={partida.valor || ''}
                      onChange={(e) =>
                        updatePartida(partida.id, 'valor', parseFloat(e.target.value) || 0)
                      }
                      className="text-right"
                    />
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removePartida(partida.id)}
                    disabled={partidas.length <= 1}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2} className="font-semibold">
                Totais
              </TableCell>
              <TableCell className="text-right font-semibold">
                {formatCurrency(totalDebito)}
              </TableCell>
              <TableCell className="text-right font-semibold">
                {formatCurrency(totalCredito)}
              </TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" onClick={addPartida}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Partida
        </Button>

        <div className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium',
          balanceado
            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
        )}>
          {balanceado ? (
            <>✓ Balanceado</>
          ) : (
            <>⚠ Diferença: {formatCurrency(diferenca)}</>
          )}
        </div>
      </div>
    </div>
  );
}
