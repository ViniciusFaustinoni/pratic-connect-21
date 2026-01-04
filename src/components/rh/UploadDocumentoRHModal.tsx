import { Upload, FileText, Calendar as CalendarIcon, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface UploadDocumentoRHModalProps {
  open: boolean;
  onClose: () => void;
  funcionarioId: string;
}

const tiposDocumento = [
  { value: 'rg', label: 'RG' },
  { value: 'cpf', label: 'CPF' },
  { value: 'ctps', label: 'CTPS' },
  { value: 'pis', label: 'PIS' },
  { value: 'titulo_eleitor', label: 'Título de Eleitor' },
  { value: 'certificado_reservista', label: 'Certificado Reservista' },
  { value: 'cnh', label: 'CNH' },
  { value: 'comprovante_residencia', label: 'Comprovante de Residência' },
  { value: 'comprovante_escolaridade', label: 'Comprovante de Escolaridade' },
  { value: 'certidao_nascimento', label: 'Certidão de Nascimento' },
  { value: 'certidao_casamento', label: 'Certidão de Casamento' },
  { value: 'exame_admissional', label: 'Exame Admissional' },
  { value: 'exame_periodico', label: 'Exame Periódico' },
  { value: 'contrato_trabalho', label: 'Contrato de Trabalho' },
  { value: 'atestado_medico', label: 'Atestado Médico' },
  { value: 'outros', label: 'Outros' },
];

export function UploadDocumentoRHModal({ open, onClose, funcionarioId }: UploadDocumentoRHModalProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [tipo, setTipo] = useState('');
  const [nome, setNome] = useState('');
  const [dataValidade, setDataValidade] = useState<Date | undefined>();
  const [observacoes, setObservacoes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!open) {
      setTipo('');
      setNome('');
      setDataValidade(undefined);
      setObservacoes('');
      setFile(null);
      setIsDragging(false);
    }
  }, [open]);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Nenhum arquivo selecionado');

      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `${funcionarioId}/documentos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('funcionarios')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('funcionarios')
        .getPublicUrl(filePath);

      const { data: { user } } = await supabase.auth.getUser();

      const { error: insertError } = await supabase
        .from('funcionarios_documentos')
        .insert({
          funcionario_id: funcionarioId,
          tipo,
          nome,
          arquivo_url: urlData.publicUrl,
          data_validade: dataValidade ? format(dataValidade, 'yyyy-MM-dd') : null,
          observacoes: observacoes || null,
          enviado_por: user?.id,
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      toast.success('Documento enviado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['funcionario-documentos', funcionarioId] });
      onClose();
    },
    onError: (error: Error) => {
      toast.error('Erro ao enviar documento: ' + error.message);
    },
  });

  const validateAndSetFile = (selectedFile: File) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    const maxSize = 10 * 1024 * 1024;

    if (!allowedTypes.includes(selectedFile.type)) {
      toast.error('Formato inválido. Envie JPG, PNG, WebP ou PDF.');
      return;
    }
    if (selectedFile.size > maxSize) {
      toast.error('Arquivo muito grande. Máximo 10MB.');
      return;
    }

    setFile(selectedFile);
    if (!nome) {
      setNome(selectedFile.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) validateAndSetFile(droppedFile);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) validateAndSetFile(selectedFile);
  };

  const handleSubmit = () => {
    uploadMutation.mutate();
  };

  const canSubmit = tipo && nome && file && !uploadMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload de Documento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de Documento *</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {tiposDocumento.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Nome do Documento *</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: CNH João Silva"
            />
          </div>

          <div className="space-y-2">
            <Label>Validade (opcional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !dataValidade && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataValidade ? format(dataValidade, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione a validade'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataValidade}
                  onSelect={setDataValidade}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações sobre o documento..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Arquivo *</Label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer',
                isDragging && 'border-primary bg-primary/5',
                !isDragging && !file && 'border-muted-foreground/25 hover:border-primary/50',
                file && 'border-green-500 bg-green-50 dark:bg-green-950/20'
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                className="hidden"
                onChange={handleFileInput}
              />

              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="h-8 w-8 text-green-600" />
                  <div className="text-left">
                    <p className="font-medium truncate max-w-[180px]">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm font-medium">Arraste um arquivo ou clique para selecionar</p>
                  <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP ou PDF até 10MB</p>
                </>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={uploadMutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {uploadMutation.isPending ? 'Enviando...' : 'Enviar Documento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
