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
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FileText, Send } from 'lucide-react';

interface SolicitarDocumentosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (documentos: string[], observacoes: string) => void;
  loading?: boolean;
}

const DOCUMENTOS_DISPONIVEIS = [
  { id: 'cnh', label: 'CNH (Carteira Nacional de Habilitação)' },
  { id: 'crlv', label: 'CRLV (Documento do Veículo)' },
  { id: 'comprovante_residencia', label: 'Comprovante de Residência' },
  { id: 'fotos_veiculo', label: 'Fotos do Veículo (frente, traseira, laterais)' },
  { id: 'selfie_documento', label: 'Selfie com Documento' },
];

export function SolicitarDocumentosDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
}: SolicitarDocumentosDialogProps) {
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [observacoes, setObservacoes] = useState('');

  const handleToggleDoc = (docId: string) => {
    setSelectedDocs((prev) =>
      prev.includes(docId)
        ? prev.filter((id) => id !== docId)
        : [...prev, docId]
    );
  };

  const handleConfirm = () => {
    if (selectedDocs.length === 0) return;
    onConfirm(selectedDocs, observacoes);
    // Reset form
    setSelectedDocs([]);
    setObservacoes('');
  };

  const handleClose = () => {
    setSelectedDocs([]);
    setObservacoes('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <FileText className="h-5 w-5 text-warning" />
            Solicitar Documentos
          </DialogTitle>
          <DialogDescription>
            Selecione os documentos que precisam ser enviados pelo cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Lista de documentos */}
          <div className="space-y-3">
            <Label className="text-foreground font-medium">
              Documentos necessários
            </Label>
            {DOCUMENTOS_DISPONIVEIS.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:border-border-hover transition-colors"
              >
                <Checkbox
                  id={doc.id}
                  checked={selectedDocs.includes(doc.id)}
                  onCheckedChange={() => handleToggleDoc(doc.id)}
                  className="border-border"
                />
                <Label
                  htmlFor={doc.id}
                  className="text-sm text-foreground cursor-pointer flex-1"
                >
                  {doc.label}
                </Label>
              </div>
            ))}
          </div>

          {/* Campo de observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes" className="text-foreground font-medium">
              Observações para o cliente (opcional)
            </Label>
            <Textarea
              id="observacoes"
              placeholder="Ex: Por favor, envie as fotos em boa resolução e com o veículo limpo..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="min-h-[100px] bg-background border-border"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            className="border-border"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedDocs.length === 0 || loading}
            className="bg-warning hover:bg-warning/90 text-warning-foreground"
          >
            {loading ? (
              'Enviando...'
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Enviar Solicitação
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
