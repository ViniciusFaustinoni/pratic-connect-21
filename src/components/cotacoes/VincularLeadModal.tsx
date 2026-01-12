import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LeadCombobox } from '@/components/leads/LeadCombobox';
import { useUpdateCotacao } from '@/hooks/useCotacoes';
import { toast } from 'sonner';
import { Link2, Loader2, User } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Lead = Tables<'leads'>;

interface VincularLeadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cotacaoId: string;
  leadAtualId?: string | null;
  onSuccess?: () => void;
}

export function VincularLeadModal({
  open,
  onOpenChange,
  cotacaoId,
  leadAtualId,
  onSuccess,
}: VincularLeadModalProps) {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(leadAtualId || null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const updateCotacao = useUpdateCotacao();

  const handleSelectLead = (leadId: string | null, lead?: Lead) => {
    setSelectedLeadId(leadId);
    setSelectedLead(lead || null);
  };

  const handleVincular = async () => {
    if (!cotacaoId) return;

    try {
      await updateCotacao.mutateAsync({
        id: cotacaoId,
        lead_id: selectedLeadId,
      });

      toast.success(selectedLeadId ? 'Lead vinculado com sucesso!' : 'Lead desvinculado');
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      toast.error('Erro ao vincular lead');
    }
  };

  const handleClose = () => {
    setSelectedLeadId(leadAtualId || null);
    setSelectedLead(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            {leadAtualId ? 'Trocar Lead' : 'Vincular Lead'}
          </DialogTitle>
          <DialogDescription>
            {leadAtualId
              ? 'Selecione outro lead para vincular a esta cotação'
              : 'Vincule esta cotação a um lead para poder enviá-la'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <LeadCombobox
            value={selectedLeadId}
            onSelect={handleSelectLead}
            placeholder="Buscar lead por nome ou telefone..."
          />

          {/* Preview do lead selecionado */}
          {selectedLead && (
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">{selectedLead.nome}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedLead.telefone || 'Sem telefone'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {!selectedLeadId && leadAtualId && (
            <p className="text-sm text-muted-foreground text-center">
              Nenhum lead selecionado - a cotação ficará sem vínculo
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleVincular}
            disabled={updateCotacao.isPending}
          >
            {updateCotacao.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Vinculando...
              </>
            ) : (
              <>
                <Link2 className="mr-2 h-4 w-4" />
                {selectedLeadId ? 'Vincular' : 'Confirmar'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
