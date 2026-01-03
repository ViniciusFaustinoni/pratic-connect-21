import { useState, useCallback } from 'react';
import { Upload, X, FileText, Image as ImageIcon, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { AssociadoCombobox } from './AssociadoCombobox';
import { useVeiculos } from '@/hooks/useVeiculos';
import { useUploadDocumento, validateFile } from '@/hooks/useUploadDocumento';
import { TIPO_DOCUMENTO_LABELS } from '@/types/database';
import type { Database } from '@/integrations/supabase/types';

type TipoDocumento = Database['public']['Enums']['tipo_documento'];

interface DocumentoUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ACCEPTED_TYPES = '.jpg,.jpeg,.png,.webp,.pdf';

export function DocumentoUploadDialog({ open, onOpenChange }: DocumentoUploadDialogProps) {
  const { toast } = useToast();
  const uploadMutation = useUploadDocumento();
  
  const [associadoId, setAssociadoId] = useState<string>('');
  const [veiculoId, setVeiculoId] = useState<string>('');
  const [tipo, setTipo] = useState<TipoDocumento | ''>('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  const { data: veiculos } = useVeiculos(associadoId || undefined);

  const resetForm = useCallback(() => {
    setAssociadoId('');
    setVeiculoId('');
    setTipo('');
    setFile(null);
    setFileError('');
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onOpenChange(false);
  }, [resetForm, onOpenChange]);

  const handleFileSelect = useCallback((selectedFile: File) => {
    const validation = validateFile(selectedFile);
    if (!validation.valid) {
      setFileError(validation.error || 'Arquivo inválido');
      setFile(null);
      return;
    }
    setFileError('');
    setFile(selectedFile);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  }, [handleFileSelect]);

  const handleSubmit = async () => {
    if (!associadoId || !tipo || !file) return;

    try {
      await uploadMutation.mutateAsync({
        associado_id: associadoId,
        veiculo_id: veiculoId || undefined,
        tipo: tipo as TipoDocumento,
        file,
      });

      toast({
        title: 'Documento enviado',
        description: 'O documento foi enviado com sucesso e está aguardando análise.',
      });

      handleClose();
    } catch (error) {
      toast({
        title: 'Erro ao enviar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isFormValid = associadoId && tipo && file && !fileError;
  const isVehicleDocument = tipo && ['crlv', 'foto_frontal_veiculo', 'foto_traseira_veiculo', 'foto_lateral_esquerda', 'foto_lateral_direita', 'foto_painel', 'foto_hodometro'].includes(tipo);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Enviar Documento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Associado */}
          <div className="space-y-2">
            <Label htmlFor="associado">Associado *</Label>
            <AssociadoCombobox
              value={associadoId}
              onSelect={(id) => {
                setAssociadoId(id);
                setVeiculoId(''); // Reset veículo when associado changes
              }}
            />
          </div>

          {/* Veículo */}
          <div className="space-y-2">
            <Label htmlFor="veiculo">Veículo (opcional)</Label>
            <Select
              value={veiculoId}
              onValueChange={setVeiculoId}
              disabled={!associadoId || !veiculos?.length}
            >
              <SelectTrigger>
                <SelectValue placeholder={
                  !associadoId 
                    ? 'Selecione um associado primeiro' 
                    : !veiculos?.length 
                      ? 'Nenhum veículo cadastrado'
                      : 'Selecione um veículo...'
                } />
              </SelectTrigger>
              <SelectContent>
                {veiculos?.map((veiculo) => (
                  <SelectItem key={veiculo.id} value={veiculo.id}>
                    {veiculo.placa} - {veiculo.marca} {veiculo.modelo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isVehicleDocument && !veiculoId && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Recomendado selecionar um veículo para este tipo de documento
              </p>
            )}
          </div>

          {/* Tipo de Documento */}
          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo de Documento *</Label>
            <Select value={tipo} onValueChange={(value) => setTipo(value as TipoDocumento)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_DOCUMENTO_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dropzone */}
          <div className="space-y-2">
            <Label>Arquivo *</Label>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`
                relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
                transition-colors duration-200
                ${isDragging 
                  ? 'border-primary bg-primary/5' 
                  : 'border-muted-foreground/25 hover:border-primary/50'
                }
                ${fileError ? 'border-destructive' : ''}
              `}
            >
              <input
                type="file"
                accept={ACCEPTED_TYPES}
                onChange={handleInputChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              
              {!file ? (
                <div className="space-y-2">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      Clique para selecionar ou arraste um arquivo
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Formatos: JPG, PNG, PDF (máx 10MB)
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  {file.type.startsWith('image/') ? (
                    <div className="h-16 w-16 rounded border bg-muted flex items-center justify-center overflow-hidden">
                      <img
                        src={URL.createObjectURL(file)}
                        alt="Preview"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-16 w-16 rounded border bg-muted flex items-center justify-center">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setFileError('');
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            
            {fileError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {fileError}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid || uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              <>Enviando...</>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Enviar Documento
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
