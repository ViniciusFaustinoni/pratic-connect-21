import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Upload, X, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { TIPO_DILIGENCIA_LABELS, type TipoDiligencia } from '@/types/sindicancia';
import { useDropzone } from 'react-dropzone';

interface Props {
  sindicanciaId: string;
  sinistroId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const MAX_FILES = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = { 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'], 'application/pdf': ['.pdf'] };

export function RegistrarDiligenciaModal({ sindicanciaId, sinistroId, open, onOpenChange, onSuccess }: Props) {
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [tipo, setTipo] = useState<string>('');
  const [dataDiligencia, setDataDiligencia] = useState(new Date().toISOString().split('T')[0]);
  const [descricao, setDescricao] = useState('');
  const [resultado, setResultado] = useState('');
  const [local, setLocal] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  const onDrop = useCallback((accepted: File[]) => {
    const remaining = MAX_FILES - files.length;
    const toAdd = accepted.slice(0, remaining);
    const oversized = toAdd.filter(f => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      toast.error(`${oversized.length} arquivo(s) excede(m) 5MB e foi(ram) ignorado(s)`);
    }
    setFiles(prev => [...prev, ...toAdd.filter(f => f.size <= MAX_FILE_SIZE)]);
  }, [files.length]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxFiles: MAX_FILES - files.length,
    disabled: files.length >= MAX_FILES,
  });

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!tipo || !descricao || !profile?.id) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }
    if (descricao.length < 30) {
      toast.error('A descrição deve ter no mínimo 30 caracteres');
      return;
    }

    setSaving(true);

    // 1. Inserir diligência
    const { data: diligencia, error } = await supabase.from('sindicancia_diligencias').insert({
      sindicancia_id: sindicanciaId,
      tipo,
      data_diligencia: dataDiligencia,
      descricao,
      resultado: resultado || null,
      local: local || null,
      registrado_por: profile.id,
    }).select('id').single();

    if (error || !diligencia) {
      toast.error('Erro ao registrar diligência');
      console.error(error);
      setSaving(false);
      return;
    }

    // 2. Upload de evidências
    if (files.length > 0) {
      for (const file of files) {
        const ext = file.name.split('.').pop();
        const path = `${sindicanciaId}/${diligencia.id}/${crypto.randomUUID()}.${ext}`;
        
        const { error: upErr } = await supabase.storage
          .from('sindicancia-evidencias')
          .upload(path, file);

        if (!upErr) {
          await supabase.from('sindicancia_evidencias').insert({
            sinistro_id: sinistroId || '',
            sindicancia_id: sindicanciaId,
            diligencia_id: diligencia.id,
            titulo: file.name,
            tipo: file.type.startsWith('image/') ? 'foto' : 'documento',
            descricao: file.name,
            arquivo_url: path,
            registrado_por: profile.id,
          });
        }
      }
    }

    // 3. Atualizar status para em_andamento se estava atribuido
    await supabase
      .from('sindicancias')
      .update({ status: 'em_andamento' })
      .eq('id', sindicanciaId)
      .eq('status', 'atribuido');

    toast.success('Diligência registrada!');
    onOpenChange(false);
    onSuccess();
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Diligência</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo *</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_DILIGENCIA_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data *</Label>
            <Input type="date" value={dataDiligencia} onChange={e => setDataDiligencia(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Local da Diligência</Label>
            <Input
              placeholder="Endereço ou referência"
              value={local}
              onChange={e => setLocal(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Descrição do que foi feito * <span className="text-xs text-muted-foreground">(mín. 30 caracteres)</span></Label>
            <Textarea
              placeholder="Descreva o que foi feito, onde, com quem falou..."
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground text-right">{descricao.length}/30 caracteres</p>
          </div>

          <div className="space-y-2">
            <Label>Resultado / Achado</Label>
            <Textarea
              placeholder="O que foi encontrado ou constatado com esta diligência..."
              value={resultado}
              onChange={e => setResultado(e.target.value)}
              rows={2}
            />
          </div>

          {/* Upload de evidências */}
          <div className="space-y-2">
            <Label>Evidências <span className="text-xs text-muted-foreground">(até {MAX_FILES} arquivos, máx. 5MB cada — jpg, png, pdf)</span></Label>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'
              } ${files.length >= MAX_FILES ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <input {...getInputProps()} />
              <Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {isDragActive ? 'Solte os arquivos aqui...' : 'Arraste arquivos ou clique para selecionar'}
              </p>
            </div>

            {files.length > 0 && (
              <div className="space-y-1 mt-2">
                {files.map((file, i) => (
                  <div key={i} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">({(file.size / 1024).toFixed(0)}KB)</span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeFile(i)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Registrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
