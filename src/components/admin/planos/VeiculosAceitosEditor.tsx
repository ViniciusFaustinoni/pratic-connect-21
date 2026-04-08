import { useState } from 'react';
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
} from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';
import { useRulesForEntity, useSaveRule, useUpdateRule, useDeleteRule } from '@/hooks/useEntityEligibilityRules';

interface ModeloEntry {
  marca: string;
  modelo: string;
  ano_min: number | null;
  ano_max: number | null;
  status: 'aceito' | 'limitado' | 'negado';
  combustivel: string;
  cobertura_fipe: number;
}

interface VeiculosAceitosEditorProps {
  entityId: string;
}

const STATUS_OPTIONS = [
  { value: 'aceito', label: 'Aceito' },
  { value: 'limitado', label: 'Limitado' },
  { value: 'negado', label: 'Negado' },
];

const COMBUSTIVEL_OPTIONS = [
  { value: 'qualquer', label: 'Qualquer' },
  { value: 'gasolina', label: 'Gasolina' },
  { value: 'flex', label: 'Flex' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'eletrico', label: 'Elétrico' },
  { value: 'gnv', label: 'GNV' },
];

const statusColors: Record<string, string> = {
  aceito: 'text-green-700 bg-green-50',
  limitado: 'text-amber-700 bg-amber-50',
  negado: 'text-red-700 bg-red-50',
};

export function VeiculosAceitosEditor({ entityId }: VeiculosAceitosEditorProps) {
  const { data: rules } = useRulesForEntity('linha', entityId);
  const saveRule = useSaveRule();
  const updateRule = useUpdateRule();
  const deleteRule = useDeleteRule();

  const marcaModeloRule = rules?.find(r => r.rule_type === 'marca_modelo');
  const modelos: ModeloEntry[] = (marcaModeloRule?.rule_config as any)?.modelos || [];

  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [anoMin, setAnoMin] = useState('');
  const [anoMax, setAnoMax] = useState('');
  const [status, setStatus] = useState<'aceito' | 'limitado' | 'negado'>('aceito');
  const [combustivel, setCombustivel] = useState('qualquer');
  const [coberturaFipe, setCoberturaFipe] = useState('100');

  const isPending = saveRule.isPending || updateRule.isPending || deleteRule.isPending;

  const handleAdd = async () => {
    if (!marca.trim() || !modelo.trim()) return;

    const newEntry: ModeloEntry = {
      marca: marca.trim().toUpperCase(),
      modelo: modelo.trim().toUpperCase(),
      ano_min: anoMin ? parseInt(anoMin) : null,
      ano_max: anoMax ? parseInt(anoMax) : null,
      status,
      combustivel,
      cobertura_fipe: parseInt(coberturaFipe) || 100,
    };

    const updatedModelos = [...modelos, newEntry];

    if (marcaModeloRule) {
      await updateRule.mutateAsync({
        id: marcaModeloRule.id,
        rule_config: { modelos: updatedModelos },
      });
    } else {
      await saveRule.mutateAsync({
        entity_type: 'linha',
        entity_id: entityId,
        rule_type: 'marca_modelo',
        rule_mode: 'include',
        rule_config: { modelos: updatedModelos },
        is_active: true,
      });
    }

    // Reset form
    setMarca('');
    setModelo('');
    setAnoMin('');
    setAnoMax('');
    setStatus('aceito');
    setCombustivel('qualquer');
    setCoberturaFipe('100');
  };

  const handleRemove = async (index: number) => {
    const updatedModelos = modelos.filter((_, i) => i !== index);

    if (updatedModelos.length === 0 && marcaModeloRule) {
      await deleteRule.mutateAsync(marcaModeloRule.id);
    } else if (marcaModeloRule) {
      await updateRule.mutateAsync({
        id: marcaModeloRule.id,
        rule_config: { modelos: updatedModelos },
      });
    }
  };

  return (
    <div className="space-y-3">
      {modelos.length > 0 && (
        <div className="rounded-md border overflow-auto max-h-60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Marca</TableHead>
                <TableHead className="text-xs">Modelo</TableHead>
                <TableHead className="text-xs">Ano De</TableHead>
                <TableHead className="text-xs">Ano Até</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Combustível</TableHead>
                <TableHead className="text-xs">FIPE %</TableHead>
                <TableHead className="text-xs w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modelos.map((m, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs py-1.5">{m.marca}</TableCell>
                  <TableCell className="text-xs py-1.5">{m.modelo}</TableCell>
                  <TableCell className="text-xs py-1.5">{m.ano_min ?? '—'}</TableCell>
                  <TableCell className="text-xs py-1.5">{m.ano_max ?? '—'}</TableCell>
                  <TableCell className="py-1.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${statusColors[m.status] || ''}`}>
                      {m.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs py-1.5">{m.combustivel}</TableCell>
                  <TableCell className="text-xs py-1.5">{m.cobertura_fipe}%</TableCell>
                  <TableCell className="py-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleRemove(i)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {modelos.length === 0 && (
        <p className="text-xs text-muted-foreground italic">Nenhum modelo configurado — todos os veículos são aceitos por padrão.</p>
      )}

      {/* Inline add form */}
      <div className="grid grid-cols-7 gap-2 items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium">Marca *</label>
          <Input
            value={marca}
            onChange={(e) => setMarca(e.target.value.toUpperCase())}
            placeholder="TOYOTA"
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Modelo *</label>
          <Input
            value={modelo}
            onChange={(e) => setModelo(e.target.value.toUpperCase())}
            placeholder="COROLLA"
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Ano de</label>
          <Input
            type="number"
            value={anoMin}
            onChange={(e) => setAnoMin(e.target.value)}
            placeholder="2005"
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Ano até</label>
          <Input
            type="number"
            value={anoMax}
            onChange={(e) => setAnoMax(e.target.value)}
            placeholder="2025"
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Status</label>
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Combustível</label>
          <Select value={combustivel} onValueChange={setCombustivel}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMBUSTIVEL_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-1">
          <div className="space-y-1 flex-1">
            <label className="text-xs font-medium">FIPE %</label>
            <Input
              type="number"
              value={coberturaFipe}
              onChange={(e) => setCoberturaFipe(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <Button
            type="button"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleAdd}
            disabled={!marca.trim() || !modelo.trim() || isPending}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
