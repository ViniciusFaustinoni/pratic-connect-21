import { useState, useRef } from 'react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, X, FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useMigracaoConfig } from '@/hooks/useConteudosSistema';

export interface MigracaoState {
  ativo: boolean;
  associacaoOrigem: string;
  arquivos: { nome: string; path: string; url: string }[];
}

interface MigracaoToggleProps {
  value: MigracaoState;
  onChange: (state: MigracaoState) => void;
}

export function MigracaoToggle({ value, onChange }: MigracaoToggleProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: migracaoConfig } = useMigracaoConfig();

  const handleToggle = (checked: boolean) => {
    onChange({
      ...value,
      ativo: checked,
      ...(checked ? {} : { associacaoOrigem: '', arquivos: [] }),
    });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const novosArquivos = [...value.arquivos];

    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} excede 10MB`);
        continue;
      }

      const timestamp = Date.now();
      const nomeSeguro = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const path = `comprovantes/${timestamp}-${nomeSeguro}`;

      const { data, error } = await supabase.storage
        .from('migracao-documentos')
        .upload(path, file, { contentType: file.type, upsert: false });

      if (error) {
        toast.error(`Erro ao enviar ${file.name}`);
        console.error(error);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from('migracao-documentos')
        .getPublicUrl(data.path);

      novosArquivos.push({
        nome: file.name,
        path: data.path,
        url: urlData.publicUrl,
      });
    }

    onChange({ ...value, arquivos: novosArquivos });
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleRemoverArquivo = async (index: number) => {
    const arquivo = value.arquivos[index];
    await supabase.storage.from('migracao-documentos').remove([arquivo.path]);
    const novos = value.arquivos.filter((_, i) => i !== index);
    onChange({ ...value, arquivos: novos });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Switch
          checked={value.ativo}
          onCheckedChange={handleToggle}
          id="migracao-toggle"
        />
        <Label htmlFor="migracao-toggle" className="text-sm font-medium cursor-pointer">
          É migração de outra associação?
        </Label>
      </div>

      {value.ativo && (
        <Card className="border-dashed border-primary/30">
          <CardContent className="p-4 space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Associação de origem</Label>
              <Input
                placeholder="Nome da associação anterior"
                value={value.associacaoOrigem}
                onChange={(e) => onChange({ ...value, associacaoOrigem: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">
                Comprovantes de migração
                {migracaoConfig && (
                  <span className="ml-1 text-muted-foreground/70">
                    ({migracaoConfig.comprovantes} exigidos · Prazo {migracaoConfig.prazo_horas}h)
                  </span>
                )}
              </Label>

              <div className="mt-2 space-y-2">
                {value.arquivos.map((arq, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm bg-muted/50 rounded-md px-3 py-2">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <span className="truncate flex-1">{arq.nome}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleRemoverArquivo(i)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}

                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  onChange={handleUpload}
                  className="hidden"
                />

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full border-dashed"
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  {uploading ? 'Enviando...' : 'Anexar comprovantes'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
