import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FileText, Upload, X, Loader2 } from 'lucide-react';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { toast } from 'sonner';

interface Props {
  token: string;
  onComplete: () => void;
}

interface ArquivoItem {
  file: File;
  previewUrl: string | null;
}

export default function EventoEtapa2BO({ token, onComplete }: Props) {
  const [arquivos, setArquivos] = useState<ArquivoItem[]>([]);
  const [numeroBO, setNumeroBO] = useState('');
  const [resumoBO, setResumoBO] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addArquivo = (file: File) => {
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    setArquivos((prev) => [...prev, { file, previewUrl }]);
  };

  const removeArquivo = (idx: number) => {
    setArquivos((prev) => {
      if (prev[idx].previewUrl) URL.revokeObjectURL(prev[idx].previewUrl!);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(addArquivo);
    e.target.value = '';
  };

  const canSubmit = arquivos.length >= 1 && numeroBO.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('token', token);
      formData.append('etapa', '2');
      formData.append('dados', JSON.stringify({
        numero_bo: numeroBO.trim(),
        resumo_bo: resumoBO.trim(),
      }));
      arquivos.forEach((a, i) => formData.append(`arquivo${i}`, a.file));

      const { data, error } = await publicSupabase.functions.invoke('salvar-etapa-evento', {
        body: formData,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('B.O. enviado com sucesso!');
      onComplete();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar B.O.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Boletim de Ocorrência</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Envie o B.O. registrado sobre o sinistro. Pode ser foto, PDF ou imagem digitalizada.
        </p>
      </div>

      {/* Upload area */}
      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
      >
        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Toque para enviar foto ou PDF do B.O.</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Preview dos arquivos */}
      {arquivos.length > 0 && (
        <div className="space-y-2">
          {arquivos.map((arq, idx) => (
            <div key={idx} className="flex items-center gap-3 p-2 rounded-lg border bg-muted/30">
              {arq.previewUrl ? (
                <img src={arq.previewUrl} alt="" className="h-12 w-12 object-cover rounded" />
              ) : (
                <div className="h-12 w-12 flex items-center justify-center bg-muted rounded">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <span className="text-sm flex-1 truncate">{arq.file.name}</span>
              <button type="button" onClick={() => removeArquivo(idx)} className="text-muted-foreground hover:text-destructive">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Campos */}
      <div className="space-y-3">
        <div>
          <Label htmlFor="numero_bo">Número do B.O. *</Label>
          <Input
            id="numero_bo"
            placeholder="Ex: 123456/2026"
            value={numeroBO}
            onChange={(e) => setNumeroBO(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="resumo_bo">Resumo do B.O. (opcional)</Label>
          <Textarea
            id="resumo_bo"
            placeholder="Copie o relato do B.O. ou escreva um resumo..."
            value={resumoBO}
            onChange={(e) => setResumoBO(e.target.value)}
            rows={4}
          />
        </div>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={!canSubmit || saving}
        className="w-full"
        size="lg"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Enviando...
          </>
        ) : (
          'Próxima Etapa'
        )}
      </Button>
    </div>
  );
}
