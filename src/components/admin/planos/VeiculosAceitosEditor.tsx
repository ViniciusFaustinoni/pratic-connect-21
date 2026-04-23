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
import { Plus, Trash2, Info } from 'lucide-react';
import { useRulesForEntity, useSaveRule, useUpdateRule, useDeleteRule } from '@/hooks/useEntityEligibilityRules';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useMarcasDistintas, useModelosPorMarca, useTiposVeiculo, TIPO_VEICULO_LABELS, type TipoVeiculo } from '@/hooks/useMarcasModelos';

interface ModeloEntry {
  marca: string;
  modelo: string;
  ano_min: number | null;
  ano_max: number | null;
  status: 'aceito' | 'limitado' | 'negado';
}

interface VeiculosAceitosEditorProps {
  entityId: string;
}

const STATUS_OPTIONS = [
  { value: 'aceito', label: 'Aceito' },
  { value: 'limitado', label: 'Limitado' },
  { value: 'negado', label: 'Negado' },
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

  const [tipoVeiculo, setTipoVeiculo] = useState<TipoVeiculo | ''>('');
  const [marca, setMarca] = useState('');
  const [modeloSelecionado, setModeloSelecionado] = useState('');
  const [anoMin, setAnoMin] = useState('');
  const [anoMax, setAnoMax] = useState('');
  const [status, setStatus] = useState<'aceito' | 'limitado' | 'negado'>('aceito');

  const { data: tiposDisponiveis } = useTiposVeiculo();
  const { data: marcasDistintas, isLoading: loadingMarcas } = useMarcasDistintas(tipoVeiculo || null);
  const { data: modelosPorMarca, isLoading: loadingModelos } = useModelosPorMarca(marca);

  const tipoOptions = (tiposDisponiveis || []).map(t => ({ value: t, label: TIPO_VEICULO_LABELS[t] }));
  const marcaOptions = (marcasDistintas || []).map(m => ({ value: m, label: m }));
  const modeloOptions = [
    { value: '__TODOS__', label: '✓ Todos os modelos desta marca' },
    ...(modelosPorMarca || []).map(m => ({ value: m, label: m })),
  ];

  const isPending = saveRule.isPending || updateRule.isPending || deleteRule.isPending;

  const handleTipoChange = (value: string) => {
    setTipoVeiculo(value as TipoVeiculo | '');
    setMarca('');
    setModeloSelecionado('');
  };

  const handleMarcaChange = (value: string) => {
    setMarca(value);
    setModeloSelecionado('');
  };

  const handleAdd = async () => {
    if (!marca.trim() || !modeloSelecionado.trim()) return;

    // "__TODOS__" = wildcard: aceita todas as variantes da marca (motor reconhece string vazia)
    const isWildcard = modeloSelecionado === '__TODOS__';
    const modeloBase = isWildcard ? '' : modeloSelecionado.split(' ')[0].toUpperCase();

    const newEntry: ModeloEntry = {
      marca: marca.trim().toUpperCase(),
      modelo: modeloBase,
      ano_min: anoMin ? parseInt(anoMin) : null,
      ano_max: anoMax ? parseInt(anoMax) : null,
      status,
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

    setMarca('');
    setModeloSelecionado('');
    setAnoMin('');
    setAnoMax('');
    setStatus('aceito');
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
      <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_auto] gap-2 items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium">Marca *</label>
          <SearchableSelect
            options={marcaOptions}
            value={marca}
            onValueChange={handleMarcaChange}
            placeholder="Selecione..."
            searchPlaceholder="Buscar marca..."
            loading={loadingMarcas}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Modelo *</label>
          <SearchableSelect
            options={modeloOptions}
            value={modeloSelecionado}
            onValueChange={setModeloSelecionado}
            placeholder="Selecione..."
            searchPlaceholder="Buscar modelo..."
            disabled={!marca}
            loading={loadingModelos}
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
        <div>
          <Button
            type="button"
            size="icon"
            className="h-8 w-8"
            onClick={handleAdd}
            disabled={!marca.trim() || !modeloSelecionado.trim() || isPending}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
