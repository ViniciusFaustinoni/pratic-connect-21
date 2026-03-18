import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { setoresElogio } from "@/constants/ouvidoria";

interface SetorElogioModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (setorValue: string) => void;
}

export function SetorElogioModal({ open, onClose, onSelect }: SetorElogioModalProps) {
  const handleSelect = (setorValue: string) => {
    onSelect(setorValue);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Qual setor você deseja elogiar?</DialogTitle>
          <DialogDescription>
            Selecione o setor do profissional
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          {setoresElogio.map((setor) => {
            const Icon = setor.icon;
            return (
              <button
                key={setor.value}
                onClick={() => handleSelect(setor.value)}
                className="flex flex-col items-center gap-2 p-4 rounded-lg bg-green-50 border border-green-200 hover:bg-green-100 hover:border-green-400 cursor-pointer transition-all"
              >
                <Icon className="h-8 w-8 text-green-600" />
                <span className="font-medium text-center text-sm text-green-800">
                  {setor.label}
                </span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
