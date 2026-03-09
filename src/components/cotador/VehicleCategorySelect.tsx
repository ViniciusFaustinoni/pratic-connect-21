import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCategoriasVeiculo, type CategoriaVeiculo } from '@/hooks/useConteudosSistema';

// ============================================
// CONSTANTES - CATEGORIAS DE VEÍCULO (fallback, fonte primária é o banco)
// ============================================

const CATEGORIAS_VEICULO_FALLBACK: CategoriaVeiculo[] = [
  { value: 'chassi_remarcado', label: 'Chassi remarcado' },
  { value: 'placa_vermelha', label: 'Placa vermelha' },
  { value: 'aplicativo', label: 'Veículo utilizado para aplicativos de transporte' },
  { value: 'leilao', label: 'Veículo proveniente de leilão' },
  { value: 'ressarcimento_integral', label: 'Veículo que já teve ressarcimento integral' },
  { value: 'ex_taxi', label: 'Ex-táxi' },
  { value: 'taxi', label: 'Táxi' },
  { value: 'nenhuma', label: 'Nenhuma das opções' },
];

// Re-exportar para compatibilidade com importadores existentes
export { CATEGORIAS_VEICULO_FALLBACK as CATEGORIAS_VEICULO };
export type { CategoriaVeiculo } from '@/hooks/useConteudosSistema';

// ============================================
// INTERFACES
// ============================================

interface VehicleCategorySelectProps {
  value: string | null;
  onChange: (value: string) => void;
  error?: boolean;
  disabled?: boolean;
}

// ============================================
// COMPONENTE
// ============================================

export function VehicleCategorySelect({
  value,
  onChange,
  error = false,
  disabled = false,
}: VehicleCategorySelectProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Encontrar label da opção selecionada
  const selectedLabel = useMemo(() => {
    if (!value) return null;
    return CATEGORIAS_VEICULO.find((cat) => cat.value === value)?.label || null;
  }, [value]);

  // Filtrar opções pela busca
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return CATEGORIAS_VEICULO;
    const term = searchTerm.toLowerCase();
    return CATEGORIAS_VEICULO.filter((cat) =>
      cat.label.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  // Handler para seleção
  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setOpen(false);
    setSearchTerm('');
  };

  return (
    <div className="space-y-2" id="categoria-veiculo-select">
      <Label className="flex items-center gap-1">
        Categoria / Situação do Veículo
        <span className="text-destructive">*</span>
      </Label>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-colors',
          'bg-background hover:bg-accent/50',
          error
            ? 'border-destructive ring-1 ring-destructive'
            : 'border-input hover:border-primary/50',
          disabled && 'opacity-50 cursor-not-allowed',
          value && 'text-foreground',
          !value && 'text-muted-foreground'
        )}
      >
        <span className={cn('truncate', !value && 'text-muted-foreground')}>
          {selectedLabel || 'Selecione a categoria do veículo'}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {/* Modal Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md p-0 gap-0 bg-[hsl(var(--card))] border-border overflow-hidden">
          {/* Header */}
          <DialogHeader className="px-4 py-3 border-b border-border">
            <DialogTitle className="text-base font-semibold">
              Categoria / Situação do Veículo
            </DialogTitle>
          </DialogHeader>

          {/* Search Input */}
          <div className="px-4 py-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar categoria..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-muted/50 border-border"
                autoFocus
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-[280px] overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma categoria encontrada
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = value === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                      'hover:bg-accent/50',
                      isSelected && 'bg-accent/30'
                    )}
                  >
                    {/* Radio indicator */}
                    <div
                      className={cn(
                        'w-[18px] h-[18px] rounded-full border-2 shrink-0 flex items-center justify-center transition-colors',
                        isSelected
                          ? 'border-emerald-500 bg-emerald-500'
                          : 'border-muted-foreground'
                      )}
                    >
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                    
                    {/* Label */}
                    <span
                      className={cn(
                        'text-sm',
                        isSelected ? 'font-medium text-foreground' : 'text-foreground/90'
                      )}
                    >
                      {option.label}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
