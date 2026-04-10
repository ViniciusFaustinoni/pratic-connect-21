import { useState, useMemo } from 'react';
import { ChevronRight, Search, X, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMarcasDistintas, useModelosPorMarca } from '@/hooks/useMarcasModelos';
import { cn } from '@/lib/utils';

export interface MarcaSelection {
  marca: string;
  modelos: string[];
  anos: number[];
}

interface MarcaModeloRuleSelectorProps {
  value: MarcaSelection[];
  onChange: (value: MarcaSelection[]) => void;
}

export function MarcaModeloRuleSelector({ value, onChange }: MarcaModeloRuleSelectorProps) {
  const [search, setSearch] = useState('');
  const [expandedMarca, setExpandedMarca] = useState<string | null>(null);
  const [anoInput, setAnoInput] = useState('');

  const { data: marcas = [], isLoading } = useMarcasDistintas();

  const filteredMarcas = useMemo(() => {
    if (!search) return marcas;
    const s = search.toUpperCase();
    return marcas.filter((m) => m.toUpperCase().includes(s));
  }, [marcas, search]);

  const selectedMap = useMemo(() => {
    const map = new Map<string, MarcaSelection>();
    value.forEach((v) => map.set(v.marca, v));
    return map;
  }, [value]);

  const isMarcaSelected = (marca: string) => selectedMap.has(marca);

  const toggleMarca = (marca: string) => {
    if (selectedMap.has(marca)) {
      onChange(value.filter((v) => v.marca !== marca));
    } else {
      onChange([...value, { marca, modelos: [], anos: [] }]);
    }
  };

  const toggleModelo = (marca: string, modelo: string) => {
    const existing = selectedMap.get(marca);
    if (!existing) {
      // Auto-select marca with this specific model
      onChange([...value, { marca, modelos: [modelo], anos: [] }]);
      return;
    }
    const modelos = existing.modelos.includes(modelo)
      ? existing.modelos.filter((m) => m !== modelo)
      : [...existing.modelos, modelo];
    onChange(value.map((v) => (v.marca === marca ? { ...v, modelos } : v)));
  };

  const addAno = () => {
    const ano = parseInt(anoInput, 10);
    if (!ano || ano < 1900 || ano > 2100) return;
    // Add year to all selected marcas
    onChange(
      value.map((v) => ({
        ...v,
        anos: v.anos.includes(ano) ? v.anos : [...v.anos, ano].sort(),
      }))
    );
    setAnoInput('');
  };

  const removeAno = (marca: string, ano: number) => {
    onChange(
      value.map((v) =>
        v.marca === marca ? { ...v, anos: v.anos.filter((a) => a !== ano) } : v
      )
    );
  };

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar marca..."
          className="pl-8 h-9 text-sm"
        />
      </div>

      {/* Brands list */}
      <ScrollArea className="h-[220px] rounded-md border">
        <div className="p-1">
          {isLoading ? (
            <p className="text-xs text-muted-foreground p-2">Carregando marcas...</p>
          ) : filteredMarcas.length === 0 ? (
            <p className="text-xs text-muted-foreground p-2">Nenhuma marca encontrada</p>
          ) : (
            filteredMarcas.map((marca) => (
              <MarcaItem
                key={marca}
                marca={marca}
                selected={isMarcaSelected(marca)}
                expanded={expandedMarca === marca}
                selection={selectedMap.get(marca)}
                onToggle={() => toggleMarca(marca)}
                onExpand={() => setExpandedMarca(expandedMarca === marca ? null : marca)}
                onToggleModelo={(modelo) => toggleModelo(marca, modelo)}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Selected summary */}
      {value.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Selecionados</Label>
          <div className="flex flex-wrap gap-1">
            {value.map((v) => (
              <Badge key={v.marca} variant="secondary" className="text-xs gap-1">
                {v.marca}
                {v.modelos.length > 0 && ` (${v.modelos.length})`}
                <X
                  className="h-3 w-3 cursor-pointer hover:text-destructive"
                  onClick={() => toggleMarca(v.marca)}
                />
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Year selector */}
      {value.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs">Anos (vazio = todos)</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              value={anoInput}
              onChange={(e) => setAnoInput(e.target.value)}
              placeholder="Ex: 2022"
              className="h-8 text-sm w-24"
              min={1900}
              max={2100}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAno())}
            />
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={addAno}>
              <Plus className="h-3 w-3 mr-1" /> Ano
            </Button>
          </div>
          {/* Year chips per marca */}
          {value.filter((v) => v.anos.length > 0).map((v) => (
            <div key={v.marca} className="flex flex-wrap items-center gap-1">
              <span className="text-xs text-muted-foreground">{v.marca}:</span>
              {v.anos.map((ano) => (
                <Badge key={ano} variant="outline" className="text-xs gap-1">
                  {ano}
                  <X
                    className="h-2.5 w-2.5 cursor-pointer hover:text-destructive"
                    onClick={() => removeAno(v.marca, ano)}
                  />
                </Badge>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Marca Item with collapsible models ----

function MarcaItem({
  marca,
  selected,
  expanded,
  selection,
  onToggle,
  onExpand,
  onToggleModelo,
}: {
  marca: string;
  selected: boolean;
  expanded: boolean;
  selection?: MarcaSelection;
  onToggle: () => void;
  onExpand: () => void;
  onToggleModelo: (modelo: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-muted/50 cursor-pointer">
        <button
          type="button"
          onClick={onExpand}
          className="p-0.5 hover:bg-muted rounded"
        >
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground transition-transform',
              expanded && 'rotate-90'
            )}
          />
        </button>
        <Checkbox checked={selected} onCheckedChange={onToggle} />
        <span className="text-sm font-medium flex-1" onClick={onExpand}>
          {marca}
        </span>
        {selected && selection && selection.modelos.length > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {selection.modelos.length} modelo(s)
          </span>
        )}
      </div>
      {expanded && <ModelosList marca={marca} selection={selection} onToggleModelo={onToggleModelo} />}
    </div>
  );
}

function ModelosList({
  marca,
  selection,
  onToggleModelo,
}: {
  marca: string;
  selection?: MarcaSelection;
  onToggleModelo: (modelo: string) => void;
}) {
  const { data: modelos = [], isLoading } = useModelosPorMarca(marca);

  if (isLoading) {
    return <p className="text-xs text-muted-foreground pl-8 py-1">Carregando modelos...</p>;
  }

  if (modelos.length === 0) {
    return <p className="text-xs text-muted-foreground pl-8 py-1">Nenhum modelo cadastrado</p>;
  }

  return (
    <div className="pl-8 pb-1 space-y-0.5">
      {modelos.map((modelo) => (
        <label
          key={modelo}
          className="flex items-center gap-2 px-1.5 py-0.5 rounded hover:bg-muted/30 cursor-pointer text-sm"
        >
          <Checkbox
            checked={selection?.modelos.includes(modelo) || false}
            onCheckedChange={() => onToggleModelo(modelo)}
          />
          {modelo}
        </label>
      ))}
    </div>
  );
}
