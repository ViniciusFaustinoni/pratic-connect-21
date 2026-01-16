import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Upload, X, Image, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface UploadLogoProps {
  logoAtual?: string;
  onLogoChange: (url: string | null) => void;
}

export function UploadLogo({ logoAtual, onLogoChange }: UploadLogoProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(logoAtual || null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      toast.error('Apenas PNG ou JPEG são aceitos');
      return;
    }

    // Validar tamanho (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Imagem muito grande (máx 2MB)');
      return;
    }

    try {
      setUploading(true);

      // Preview local
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);

      // Upload para Storage
      const fileName = `logo-${Date.now()}.${file.type.split('/')[1]}`;
      const { data, error } = await supabase.storage
        .from('documentos')
        .upload(`logos/${fileName}`, file, {
          contentType: file.type,
          upsert: true,
        });

      if (error) throw error;

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from('documentos')
        .getPublicUrl(data.path);

      onLogoChange(urlData.publicUrl);
      toast.success('Logo atualizado!');
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      toast.error(`Erro: ${error.message}`);
      setPreview(logoAtual || null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemover = () => {
    setPreview(null);
    onLogoChange(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <Label>Logo da Empresa (PDF)</Label>
      
      <Card className="border-dashed">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            {/* Preview */}
            <div className="w-24 h-16 bg-muted rounded-lg flex items-center justify-center overflow-hidden border">
              {preview ? (
                <img 
                  src={preview} 
                  alt="Logo" 
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <Image className="h-8 w-8 text-muted-foreground" />
              )}
            </div>

            {/* Ações */}
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={handleFileSelect}
                className="hidden"
              />

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {preview ? 'Trocar' : 'Upload'}
              </Button>

              {preview && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemover}
                  disabled={uploading}
                >
                  <X className="h-4 w-4 mr-2" />
                  Remover
                </Button>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-3">
            PNG ou JPEG, máximo 2MB. Recomendado: 200x80px
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
