import { useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface CotaRow {
  categoria: string;
  percentual: string;
  minimo: string;
  comDesagio?: string;
  minimoDesagio?: string;
}

interface Props {
  rows: CotaRow[];
  onChange: (rows: CotaRow[]) => void;
}

export function CotasTaxasEditor({ rows, onChange }: Props) {
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState<CotaRow>({ categoria: '', percentual: '', minimo: '' });

  const handleEdit = (index: number, field: keyof CotaRow, value: string) => {
    const updated = [...rows];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const handleRemove = (index: number) => {
    onChange(rows.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    if (!newRow.categoria.trim()) return;
    onChange([...rows, { ...newRow }]);
    setNewRow({ categoria: '', percentual: '', minimo: '' });
    setAdding(false);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs font-semibold">Categoria</TableHead>
              <TableHead className="text-xs font-semibold w-[100px]">Percentual</TableHead>
              <TableHead className="text-xs font-semibold w-[120px]">Mínimo</TableHead>
              <TableHead className="text-xs font-semibold w-[100px]">% c/ Deságio</TableHead>
              <TableHead className="text-xs font-semibold w-[120px]">Mín. c/ Deságio</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Input value={row.categoria} onChange={(e) => handleEdit(i, 'categoria', e.target.value)} className="h-8 text-sm" />
                </TableCell>
                <TableCell>
                  <Input value={row.percentual} onChange={(e) => handleEdit(i, 'percentual', e.target.value)} className="h-8 text-sm" placeholder="6%" />
                </TableCell>
                <TableCell>
                  <Input value={row.minimo} onChange={(e) => handleEdit(i, 'minimo', e.target.value)} className="h-8 text-sm" placeholder="R$ 1.200" />
                </TableCell>
                <TableCell>
                  <Input value={row.comDesagio || ''} onChange={(e) => handleEdit(i, 'comDesagio', e.target.value)} className="h-8 text-sm" placeholder="—" />
                </TableCell>
                <TableCell>
                  <Input value={row.minimoDesagio || ''} onChange={(e) => handleEdit(i, 'minimoDesagio', e.target.value)} className="h-8 text-sm" placeholder="—" />
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/60 hover:text-destructive" onClick={() => handleRemove(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {adding && (
              <TableRow>
                <TableCell>
                  <Input value={newRow.categoria} onChange={(e) => setNewRow(r => ({ ...r, categoria: e.target.value }))} className="h-8 text-sm" placeholder="Nova categoria" autoFocus />
                </TableCell>
                <TableCell>
                  <Input value={newRow.percentual} onChange={(e) => setNewRow(r => ({ ...r, percentual: e.target.value }))} className="h-8 text-sm" placeholder="6%" />
                </TableCell>
                <TableCell>
                  <Input value={newRow.minimo} onChange={(e) => setNewRow(r => ({ ...r, minimo: e.target.value }))} className="h-8 text-sm" placeholder="R$ 1.200" />
                </TableCell>
                <TableCell colSpan={2} />
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={handleAdd}>
                    <Save className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {!adding && (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar categoria
        </Button>
      )}
    </div>
  );
}
