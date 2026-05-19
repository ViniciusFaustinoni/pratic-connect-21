import { useMemo, useState } from 'react';
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
import { FileText, Send, Camera, Gauge, Car, Video } from 'lucide-react';

interface SolicitarDocumentosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (documentos: string[], observacoes: string) => void;
  loading?: boolean;
  /** Se true, proposta veio de autovistoria de Roubo e Furto (apenas chassi, motor e vídeo 360°) */
  isAutovistoria?: boolean;
  /** Tipo de veículo para rótulos adequados. Default: 'carro' */
  tipoVeiculo?: 'carro' | 'moto';
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

function buildCategorias(
  isAutovistoria: boolean,
  tipoVeiculo: 'carro' | 'moto'
): CategoriaDocumentos[] {
  const pessoais: CategoriaDocumentos = {
    id: 'pessoais',
    categoria: 'Documentos Pessoais',
    icon: <FileText className="h-4 w-4" />,
    documentos: [
      { id: 'cnh', label: 'CNH (Carteira Nacional de Habilitação)' },
      { id: 'crlv', label: 'CRLV (Documento do Veículo)' },
      { id: 'comprovante_residencia', label: 'Comprovante de Residência' },
    ],
  };

  const video: CategoriaDocumentos = {
    id: 'video',
    categoria: 'Vídeo da Autovistoria',
    icon: <Video className="h-4 w-4" />,
    documentos: [
      {
        id: 'video_360',
        label: 'Vídeo 360° do veículo (terminar no painel ligado com motor funcionando)',
      },
    ],
  };

  const outros: CategoriaDocumentos = {
    id: 'outros',
    categoria: 'Outros',
    icon: <Camera className="h-4 w-4" />,
    documentos: [
      { id: 'outro', label: 'Outro (descrever nas observações)' },
    ],
  };

  if (isAutovistoria) {
    const veiculoLabel = tipoVeiculo === 'moto' ? 'da Moto' : 'do Veículo';
    return [
      pessoais,
      {
        id: 'autovistoria',
        categoria: 'Autovistoria — Roubo e Furto',
        icon: <Camera className="h-4 w-4" />,
        documentos: [
          { id: 'frente_centro', label: `Frente — Placa + Centro ${veiculoLabel}` },
          { id: 'frente_lateral_esquerda', label: `Frente — Placa + Lateral Esquerda ${veiculoLabel}` },
          { id: 'frente_lateral_direita', label: `Frente — Placa + Lateral Direita ${veiculoLabel}` },
          { id: 'traseira_centro', label: `Traseira — Placa + Centro ${veiculoLabel}` },
          { id: 'traseira_lateral_esquerda', label: `Traseira — Placa + Lateral Esquerda ${veiculoLabel}` },
          { id: 'traseira_lateral_direita', label: `Traseira — Placa + Lateral Direita ${veiculoLabel}` },
          { id: 'chassi', label: `Foto do Chassi ${veiculoLabel}` },
          { id: 'motor', label: `Foto do Motor ${veiculoLabel}` },
          { id: 'painel_ligado', label: `Painel com ${tipoVeiculo === 'moto' ? 'a moto ligada' : 'o veículo ligado'}` },
        ],
      },
      video,
      outros,
    ];
  }

  // Fluxo de instalação/vistoria presencial (laudo do instalador)
  return [
    pessoais,
    {
      id: 'fotos_instalador',
      categoria: 'Fotos Técnicas (Instalador)',
      icon: <Car className="h-4 w-4" />,
      documentos: [
        { id: 'frente', label: 'Frente do Veículo' },
        { id: 'traseira', label: 'Traseira do Veículo' },
        { id: 'lateral_direita', label: 'Lateral Direita' },
        { id: 'lateral_esquerda', label: 'Lateral Esquerda' },
        { id: 'painel', label: 'Painel Completo' },
        { id: 'odometro', label: 'Odômetro (veículo ligado)' },
        { id: 'chassi', label: 'Número do Chassi' },
        { id: 'motor', label: 'Motor (capô aberto)' },
      ],
    },
    outros,
  ];
}

export function SolicitarDocumentosDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
  isAutovistoria = false,
  tipoVeiculo = 'carro',
}: SolicitarDocumentosDialogProps) {
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [observacoes, setObservacoes] = useState('');
  const [openCategories, setOpenCategories] = useState<string[]>([
    'pessoais',
    isAutovistoria ? 'autovistoria' : 'fotos_instalador',
  ]);

  const CATEGORIAS = useMemo(
    () => buildCategorias(isAutovistoria, tipoVeiculo),
    [isAutovistoria, tipoVeiculo]
  );

  const handleToggleDoc = (docId: string) => {
    setSelectedDocs((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const handleSelectCategory = (categoriaId: string) => {
    const categoria = CATEGORIAS.find((c) => c.id === categoriaId);
    if (!categoria) return;
    const ids = categoria.documentos.map((d) => d.id);
    const allSelected = ids.every((id) => selectedDocs.includes(id));
    if (allSelected) {
      setSelectedDocs((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedDocs((prev) => Array.from(new Set([...prev, ...ids])));
    }
  };

  const handleClearSelection = () => setSelectedDocs([]);

  const getSelectedCountForCategory = (categoriaId: string) => {
    const categoria = CATEGORIAS.find((c) => c.id === categoriaId);
    if (!categoria) return 0;
    return categoria.documentos.filter((d) => selectedDocs.includes(d.id)).length;
  };

  const handleConfirm = () => {
    if (selectedDocs.length === 0) return;
    onConfirm(selectedDocs, observacoes);
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
            Solicitar Reenvio
          </DialogTitle>
          <DialogDescription>
            Selecione os itens que o associado precisa <strong>reenviar</strong> (documentos, fotos ou vídeo). Ele será notificado via WhatsApp com o link de acompanhamento.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 flex-wrap">
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
            {CATEGORIAS.map((categoria) => {
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
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded-full ml-auto mr-2 ${
                          selectedCount > 0
                            ? 'bg-warning/20 text-warning'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {selectedCount}/{totalCount}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-3">
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
          <Button variant="outline" onClick={handleClose} className="border-border">
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
                Solicitar novo envio ({selectedDocs.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
