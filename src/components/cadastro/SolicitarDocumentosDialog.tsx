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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { FileText, Send, Camera, Gauge, CircleDot, Car, User } from 'lucide-react';

interface SolicitarDocumentosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (documentos: string[], observacoes: string) => void;
  loading?: boolean;
}

interface DocumentoItem {
  id: string;
  label: string;
}

interface CategoriaDocumentos {
  id: string;
  categoria: string;
  icon: React.ReactNode;
  documentos: DocumentoItem[];
}

const CATEGORIAS_DOCUMENTOS: CategoriaDocumentos[] = [
  {
    id: 'pessoais',
    categoria: 'Documentos Pessoais',
    icon: <FileText className="h-4 w-4" />,
    documentos: [
      { id: 'cnh', label: 'CNH (Carteira Nacional de Habilitação)' },
      { id: 'crlv', label: 'CRLV (Documento do Veículo)' },
      { id: 'comprovante_residencia', label: 'Comprovante de Residência' },
    ],
  },
  {
    id: 'externas',
    categoria: 'Fotos do Veículo - Externas',
    icon: <Car className="h-4 w-4" />,
    documentos: [
      { id: 'selfie_veiculo', label: 'Selfie com o Veículo ao Fundo' },
      { id: 'frente', label: 'Frente do Veículo' },
      { id: 'traseira', label: 'Traseira do Veículo' },
      { id: 'lateral_direita', label: 'Lateral Direita' },
      { id: 'lateral_esquerda', label: 'Lateral Esquerda' },
    ],
  },
  {
    id: 'internas',
    categoria: 'Fotos do Veículo - Internas',
    icon: <Gauge className="h-4 w-4" />,
    documentos: [
      { id: 'odometro', label: 'Odômetro (veículo ligado)' },
      { id: 'painel', label: 'Painel Completo' },
      { id: 'chassi', label: 'Número do Chassi' },
      { id: 'motor', label: 'Motor (capô aberto)' },
      { id: 'banco_dianteiro', label: 'Banco Dianteiro' },
      { id: 'banco_traseiro', label: 'Banco Traseiro' },
    ],
  },
  {
    id: 'pneus',
    categoria: 'Fotos dos Pneus',
    icon: <CircleDot className="h-4 w-4" />,
    documentos: [
      { id: 'pneu_dianteiro_direito', label: 'Pneu Dianteiro Direito' },
      { id: 'pneu_dianteiro_esquerdo', label: 'Pneu Dianteiro Esquerdo' },
      { id: 'pneu_traseiro_direito', label: 'Pneu Traseiro Direito' },
      { id: 'pneu_traseiro_esquerdo', label: 'Pneu Traseiro Esquerdo' },
    ],
  },
  {
    id: 'outros',
    categoria: 'Outros',
    icon: <Camera className="h-4 w-4" />,
    documentos: [
      { id: 'outro', label: 'Outro Documento (especificar nas observações)' },
    ],
  },
];

// IDs de todas as fotos de vistoria (para seleção em massa)
const FOTOS_VISTORIA_IDS = CATEGORIAS_DOCUMENTOS
  .filter(cat => ['externas', 'internas', 'pneus'].includes(cat.id))
  .flatMap(cat => cat.documentos.map(doc => doc.id));

export function SolicitarDocumentosDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
}: SolicitarDocumentosDialogProps) {
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [observacoes, setObservacoes] = useState('');
  const [openCategories, setOpenCategories] = useState<string[]>(['pessoais']);

  const handleToggleDoc = (docId: string) => {
    setSelectedDocs((prev) =>
      prev.includes(docId)
        ? prev.filter((id) => id !== docId)
        : [...prev, docId]
    );
  };

  const handleSelectAllVistoria = () => {
    setSelectedDocs((prev) => {
      const newDocs = new Set(prev);
      FOTOS_VISTORIA_IDS.forEach(id => newDocs.add(id));
      return Array.from(newDocs);
    });
    // Expandir categorias de vistoria
    setOpenCategories(prev => {
      const newOpen = new Set(prev);
      ['externas', 'internas', 'pneus'].forEach(id => newOpen.add(id));
      return Array.from(newOpen);
    });
  };

  const handleSelectCategory = (categoriaId: string) => {
    const categoria = CATEGORIAS_DOCUMENTOS.find(c => c.id === categoriaId);
    if (!categoria) return;
    
    const categoryDocIds = categoria.documentos.map(d => d.id);
    const allSelected = categoryDocIds.every(id => selectedDocs.includes(id));
    
    if (allSelected) {
      // Desmarcar todos da categoria
      setSelectedDocs(prev => prev.filter(id => !categoryDocIds.includes(id)));
    } else {
      // Marcar todos da categoria
      setSelectedDocs(prev => {
        const newDocs = new Set(prev);
        categoryDocIds.forEach(id => newDocs.add(id));
        return Array.from(newDocs);
      });
    }
  };

  const handleClearSelection = () => {
    setSelectedDocs([]);
  };

  const getSelectedCountForCategory = (categoriaId: string) => {
    const categoria = CATEGORIAS_DOCUMENTOS.find(c => c.id === categoriaId);
    if (!categoria) return 0;
    return categoria.documentos.filter(d => selectedDocs.includes(d.id)).length;
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
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] bg-card border-border flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <FileText className="h-5 w-5 text-warning" />
            Solicitar Documentos
          </DialogTitle>
          <DialogDescription>
            Selecione os documentos ou fotos que precisam ser reenviados pelo associado.
          </DialogDescription>
        </DialogHeader>

        {/* Botões de ação rápida */}
        <div className="flex gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSelectAllVistoria}
            className="text-xs"
          >
            <Camera className="h-3 w-3 mr-1" />
            Todas Fotos Vistoria
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearSelection}
            className="text-xs text-muted-foreground"
            disabled={selectedDocs.length === 0}
          >
            Limpar ({selectedDocs.length})
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 -mr-2">
          <Accordion
            type="multiple"
            value={openCategories}
            onValueChange={setOpenCategories}
            className="w-full"
          >
            {CATEGORIAS_DOCUMENTOS.map((categoria) => {
              const selectedCount = getSelectedCountForCategory(categoria.id);
              const totalCount = categoria.documentos.length;
              const allSelected = selectedCount === totalCount && totalCount > 0;

              return (
                <AccordionItem
                  key={categoria.id}
                  value={categoria.id}
                  className="border-border"
                >
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-muted-foreground">{categoria.icon}</span>
                      <span className="text-sm font-medium text-foreground">
                        {categoria.categoria}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ml-auto mr-2 ${
                        selectedCount > 0 
                          ? 'bg-warning/20 text-warning' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {selectedCount}/{totalCount}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-3">
                    {/* Botão selecionar todos da categoria */}
                    {totalCount > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSelectCategory(categoria.id)}
                        className="text-xs mb-2 h-7 text-muted-foreground hover:text-foreground"
                      >
                        {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                      </Button>
                    )}
                    <div className="space-y-1.5">
                      {categoria.documentos.map((doc) => (
                        <div
                          key={doc.id}
                          className={`flex items-center space-x-3 p-2.5 rounded-lg border transition-colors cursor-pointer ${
                            selectedDocs.includes(doc.id)
                              ? 'border-warning bg-warning/5'
                              : 'border-border hover:border-border-hover'
                          }`}
                          onClick={() => handleToggleDoc(doc.id)}
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
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>

          {/* Campo de observações */}
          <div className="space-y-2 mt-4">
            <Label htmlFor="observacoes" className="text-foreground font-medium">
              Observações para o associado (opcional)
            </Label>
            <Textarea
              id="observacoes"
              placeholder="Ex: Por favor, envie as fotos em boa resolução com boa iluminação..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="min-h-[80px] bg-background border-border"
            />
          </div>
        </div>

        <DialogFooter className="mt-4">
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
                Enviar Solicitação ({selectedDocs.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
