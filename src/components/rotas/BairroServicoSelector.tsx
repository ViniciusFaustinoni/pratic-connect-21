import { useState, useMemo } from 'react';
import { Check, MapPin, X, Wrench, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { BairroServico } from '@/types/servicos-rota';

interface BairroServicoSelectorProps {
  bairros: BairroServico[];
  selectedBairros: string[];
  onSelectionChange: (bairros: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  isLoading?: boolean;
}

export function BairroServicoSelector({
  bairros,
  selectedBairros,
  onSelectionChange,
  disabled = false,
  placeholder = 'Selecione os bairros',
  isLoading = false,
}: BairroServicoSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredBairros = useMemo(() => {
    if (!search) return bairros;
    const searchLower = search.toLowerCase();
    return bairros.filter(
      (b) =>
        b.bairro?.toLowerCase().includes(searchLower) ||
        b.cidade?.toLowerCase().includes(searchLower)
    );
  }, [bairros, search]);

  const handleToggle = (bairro: string) => {
    if (selectedBairros.includes(bairro)) {
      onSelectionChange(selectedBairros.filter((b) => b !== bairro));
    } else {
      onSelectionChange([...selectedBairros, bairro]);
    }
  };

  const handleRemove = (bairro: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectionChange(selectedBairros.filter((b) => b !== bairro));
  };

  const handleSelectAll = () => {
    const allBairros = filteredBairros.map((b) => b.bairro);
    onSelectionChange(allBairros);
  };

  const handleClearAll = () => {
    onSelectionChange([]);
  };

  const totais = useMemo(() => {
    const selecionados = bairros.filter((b) => selectedBairros.includes(b.bairro));
    return {
      total: selecionados.reduce((acc, b) => acc + b.total, 0),
      instalacoes: selecionados.reduce((acc, b) => acc + b.totalInstalacoes, 0),
      vistorias: selecionados.reduce((acc, b) => acc + b.totalVistorias, 0),
    };
  }, [bairros, selectedBairros]);

  const selectedBairrosInfo = bairros.filter((b) =>
    selectedBairros.includes(b.bairro)
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between h-auto min-h-10',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          disabled={disabled}
        >
          {selectedBairros.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {selectedBairrosInfo.slice(0, 3).map((b) => (
                <Badge
                  key={b.bairro}
                  variant="secondary"
                  className="flex items-center gap-1 pr-1"
                >
                  {b.bairro} ({b.total})
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-destructive"
                    onClick={(e) => handleRemove(b.bairro, e)}
                  />
                </Badge>
              ))}
              {selectedBairros.length > 3 && (
                <Badge variant="outline">
                  +{selectedBairros.length - 3} mais
                </Badge>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <MapPin className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <div className="p-2 border-b">
          <Input
            placeholder="Buscar bairro ou cidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
        </div>

        {selectedBairros.length > 0 && (
          <div className="p-2 border-b bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{selectedBairros.length} bairro(s)</span>
              <span className="flex items-center gap-1">
                <Wrench className="h-3 w-3 text-blue-600" />
                {totais.instalacoes}
              </span>
              <span className="flex items-center gap-1">
                <ClipboardCheck className="h-3 w-3 text-amber-600" />
                {totais.vistorias}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={handleClearAll}
            >
              Limpar
            </Button>
          </div>
        )}

        <ScrollArea className="h-[280px]">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Carregando bairros...
            </div>
          ) : !filteredBairros.length ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {bairros.length === 0
                ? 'Nenhum serviço pendente encontrado'
                : 'Nenhum bairro encontrado para a busca'}
            </div>
          ) : (
            <div className="p-1">
              {filteredBairros.length > 1 && (
                <div
                  onClick={handleSelectAll}
                  className="flex items-center gap-2 px-2 py-2 cursor-pointer rounded-md hover:bg-muted text-primary font-medium text-sm border-b mb-1"
                >
                  <Check className="h-4 w-4" />
                  Selecionar todos ({filteredBairros.length})
                </div>
              )}

              {filteredBairros.map((item) => {
                const isSelected = selectedBairros.includes(item.bairro);
                return (
                  <div
                    key={`${item.cidade}-${item.bairro}`}
                    onClick={() => handleToggle(item.bairro)}
                    className={cn(
                      'flex items-center gap-2 px-2 py-2 cursor-pointer rounded-md transition-colors',
                      isSelected
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted'
                    )}
                  >
                    <div
                      className={cn(
                        'h-4 w-4 rounded border flex items-center justify-center shrink-0',
                        isSelected
                          ? 'bg-primary border-primary'
                          : 'border-input'
                      )}
                    >
                      {isSelected && (
                        <Check className="h-3 w-3 text-primary-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{item.bairro || 'Sem bairro'}</div>
                      <div className="text-xs text-muted-foreground">{item.cidade}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.totalInstalacoes > 0 && (
                        <Badge variant="outline" className="flex items-center gap-1 bg-blue-50 dark:bg-blue-950/30">
                          <Wrench className="h-3 w-3 text-blue-600" />
                          {item.totalInstalacoes}
                        </Badge>
                      )}
                      {item.totalVistorias > 0 && (
                        <Badge variant="outline" className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/30">
                          <ClipboardCheck className="h-3 w-3 text-amber-600" />
                          {item.totalVistorias}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
