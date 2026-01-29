import { useState } from 'react';
import { X, Download, Mail, Archive, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface BatchActionsBarProcessosProps {
  selectedCount: number;
  selectedIds: string[];
  onClearSelection: () => void;
  onExport: (ids: string[], format: 'excel' | 'pdf') => Promise<void>;
  onArchive: (ids: string[]) => Promise<void>;
}

export function BatchActionsBarProcessos({
  selectedCount,
  selectedIds,
  onClearSelection,
  onExport,
  onArchive,
}: BatchActionsBarProcessosProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  if (selectedCount === 0) return null;

  const handleExport = async (format: 'excel' | 'pdf') => {
    setIsExporting(true);
    try {
      await onExport(selectedIds, format);
      toast.success(`Exportação ${format.toUpperCase()} iniciada!`);
    } catch (error) {
      toast.error('Erro ao exportar processos');
    } finally {
      setIsExporting(false);
    }
  };

  const handleArchive = async () => {
    if (!confirm(`Tem certeza que deseja arquivar ${selectedCount} processo(s)?`)) return;
    
    setIsArchiving(true);
    try {
      await onArchive(selectedIds);
      toast.success(`${selectedCount} processo(s) arquivado(s)!`);
      onClearSelection();
    } catch (error) {
      toast.error('Erro ao arquivar processos');
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-background border shadow-lg rounded-lg px-4 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {selectedCount} selecionado(s)
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClearSelection}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="h-6 w-px bg-border" />

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('excel')}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Excel
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('pdf')}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            PDF
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleArchive}
            disabled={isArchiving}
            className="text-orange-600 hover:text-orange-700"
          >
            {isArchiving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Archive className="h-4 w-4 mr-2" />
            )}
            Arquivar
          </Button>
        </div>
      </div>
    </div>
  );
}
