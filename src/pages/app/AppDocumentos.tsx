import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Upload, CheckCircle, Clock, XCircle, AlertCircle, Eye, RefreshCw, Camera, File, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useMyDocumentos } from '@/hooks/useMyData';
import { cn } from '@/lib/utils';

const statusConfig: Record<string, { label: string; icon: typeof CheckCircle; className: string; bgColor: string }> = {
  aprovado: { label: 'Aprovado', icon: CheckCircle, className: 'bg-green-100 text-green-800', bgColor: 'bg-green-50' },
  pendente: { label: 'Pendente', icon: Clock, className: 'bg-yellow-100 text-yellow-800', bgColor: 'bg-yellow-50' },
  em_analise: { label: 'Em Análise', icon: Clock, className: 'bg-blue-100 text-blue-800', bgColor: 'bg-blue-50' },
  reprovado: { label: 'Reprovado', icon: XCircle, className: 'bg-red-100 text-red-800', bgColor: 'bg-red-50' },
};

type TipoDocumento = 'cnh' | 'crlv' | 'comprovante_residencia' | 'foto_frontal_veiculo' | 'foto_traseira_veiculo' | 'foto_lateral_esquerda' | 'foto_lateral_direita' | 'foto_painel' | 'foto_hodometro' | 'outro';

const tipoLabels: Record<TipoDocumento, string> = {
  cnh: 'CNH',
  crlv: 'CRLV',
  comprovante_residencia: 'Comprovante de Residência',
  foto_frontal_veiculo: 'Foto Frontal do Veículo',
  foto_traseira_veiculo: 'Foto Traseira do Veículo',
  foto_lateral_esquerda: 'Foto Lateral Esquerda',
  foto_lateral_direita: 'Foto Lateral Direita',
  foto_painel: 'Foto do Painel',
  foto_hodometro: 'Foto do Hodômetro',
  outro: 'Outro',
};

const tipoOptions = [
  { value: 'cnh', label: 'CNH', obrigatorio: true },
  { value: 'crlv', label: 'CRLV', obrigatorio: true },
  { value: 'comprovante_residencia', label: 'Comprovante de Residência', obrigatorio: true },
  { value: 'foto_frontal_veiculo', label: 'Foto Frontal do Veículo', obrigatorio: false },
  { value: 'foto_traseira_veiculo', label: 'Foto Traseira do Veículo', obrigatorio: false },
  { value: 'foto_lateral_esquerda', label: 'Foto Lateral Esquerda', obrigatorio: false },
  { value: 'foto_lateral_direita', label: 'Foto Lateral Direita', obrigatorio: false },
  { value: 'foto_painel', label: 'Foto do Painel', obrigatorio: false },
  { value: 'foto_hodometro', label: 'Foto do Hodômetro', obrigatorio: false },
  { value: 'outro', label: 'Outro Documento', obrigatorio: false },
];

export default function AppDocumentos() {
  const navigate = useNavigate();
  const { data: documentos, isLoading, refetch } = useMyDocumentos();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal states
  const [modalUpload, setModalUpload] = useState(false);
  const [modalPreview, setModalPreview] = useState(false);
  const [selectedTipo, setSelectedTipo] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; tipo: string } | null>(null);

  // Get list of already uploaded document types
  const uploadedTypes = (documentos?.map(d => d.tipo) || []) as TipoDocumento[];

  // Check which required documents are missing
  const documentosObrigatorios = tipoOptions.filter(t => t.obrigatorio);
  const documentosFaltando = documentosObrigatorios.filter(t => !uploadedTypes.includes(t.value as TipoDocumento));
  const documentosReprovados = documentos?.filter(d => d.status === 'reprovado') || [];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        toast.error('Formato inválido. Envie imagem ou PDF.');
        return;
      }
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Arquivo muito grande. Máximo 10MB.');
        return;
      }

      setSelectedFile(file);
      if (file.type.startsWith('image/')) {
        setPreviewUrl(URL.createObjectURL(file));
      } else {
        setPreviewUrl('');
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedTipo) {
      toast.error('Selecione o tipo e o arquivo');
      return;
    }

    setUploading(true);
    
    // Simulate upload (replace with actual upload logic)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    toast.success('Documento enviado com sucesso!');
    setUploading(false);
    setModalUpload(false);
    setSelectedFile(null);
    setSelectedTipo('');
    setPreviewUrl('');
    refetch();
  };

  const handleOpenUpload = () => {
    setSelectedFile(null);
    setSelectedTipo('');
    setPreviewUrl('');
    setModalUpload(true);
  };

  const handleReenviar = (tipo: string) => {
    setSelectedTipo(tipo);
    setSelectedFile(null);
    setPreviewUrl('');
    setModalUpload(true);
  };

  const handlePreview = (url: string, tipo: string) => {
    setPreviewDoc({ url, tipo });
    setModalPreview(true);
  };

  return (
    <div className="p-4 pb-24">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="min-h-[44px] min-w-[44px]"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold text-foreground">Meus Documentos</h1>
      </div>

      {/* Alert for missing documents */}
      {documentosFaltando.length > 0 && !isLoading && (
        <Card className="mb-4 border-0 shadow-sm bg-yellow-50">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800">Documentos pendentes</p>
              <p className="text-sm text-yellow-700">
                Envie: {documentosFaltando.map(d => d.label).join(', ')}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alert for rejected documents */}
      {documentosReprovados.length > 0 && !isLoading && (
        <Card className="mb-4 border-0 shadow-sm bg-red-50">
          <CardContent className="flex items-start gap-3 p-4">
            <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-red-800">Documentos reprovados</p>
              <p className="text-sm text-red-700 mb-2">
                Reenvie os documentos abaixo para continuar
              </p>
              <div className="flex flex-wrap gap-2">
                {documentosReprovados.map((doc) => (
                  <Button
                    key={doc.id}
                    variant="outline"
                    size="sm"
                    className="bg-white text-red-700 border-red-200 hover:bg-red-100"
                    onClick={() => handleReenviar(doc.tipo)}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    {tipoLabels[doc.tipo]}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="flex items-center gap-4 p-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : documentos && documentos.length > 0 ? (
          documentos.map((doc) => {
            const status = statusConfig[doc.status] || statusConfig.pendente;
            const StatusIcon = status.icon;
            
            return (
              <Card 
                key={doc.id} 
                className={cn(
                  "border-0 shadow-sm transition-colors",
                  doc.status === 'reprovado' && "ring-1 ring-red-200"
                )}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    doc.status === 'reprovado' ? 'bg-red-100' : 'bg-primary/10'
                  )}>
                    <FileText className={cn(
                      "h-5 w-5",
                      doc.status === 'reprovado' ? 'text-red-600' : 'text-primary'
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {tipoLabels[doc.tipo] || doc.tipo}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Enviado em {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                    </p>
                    {doc.status === 'reprovado' && doc.motivo_reprovacao && (
                      <p className="text-xs text-red-600 mt-1">
                        Motivo: {doc.motivo_reprovacao}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {doc.status === 'reprovado' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => handleReenviar(doc.tipo)}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Reenviar
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handlePreview(doc.arquivo_url, doc.tipo)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Badge variant="outline" className={status.className}>
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {status.label}
                        </Badge>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="border-0 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-muted p-4 mb-4">
                <FileText className="h-10 w-10 text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground mb-1">Nenhum documento enviado</p>
              <p className="text-sm text-muted-foreground text-center mb-4">
                Envie seus documentos para completar seu cadastro
              </p>
              <Button onClick={handleOpenUpload}>
                <Upload className="mr-2 h-4 w-4" />
                Enviar primeiro documento
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Upload Button */}
        {documentos && documentos.length > 0 && (
          <Button 
            variant="outline" 
            className="w-full min-h-[44px]"
            onClick={handleOpenUpload}
          >
            <Upload className="mr-2 h-4 w-4" />
            Enviar Documento
          </Button>
        )}
      </div>

      {/* Modal Upload */}
      <Dialog open={modalUpload} onOpenChange={setModalUpload}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar Documento</DialogTitle>
            <DialogDescription>
              Selecione o tipo de documento e faça o upload do arquivo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Tipo de Documento */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de Documento</label>
              <Select value={selectedTipo} onValueChange={setSelectedTipo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {tipoOptions.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      <span className="flex items-center gap-2">
                        {tipo.label}
                        {tipo.obrigatorio && (
                          <span className="text-xs text-red-500">*</span>
                        )}
                        {uploadedTypes.includes(tipo.value as TipoDocumento) && (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* File Upload Area */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Arquivo</label>
              {!selectedFile ? (
                <div
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="rounded-full bg-primary/10 p-3">
                      <Camera className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-sm font-medium">Toque para selecionar</p>
                    <p className="text-xs text-muted-foreground">
                      Imagem ou PDF (máx. 10MB)
                    </p>
                  </div>
                </div>
              ) : (
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    {previewUrl ? (
                      <img 
                        src={previewUrl} 
                        alt="Preview" 
                        className="h-16 w-16 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
                        <File className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl('');
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setModalUpload(false)}
              disabled={uploading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || !selectedTipo || uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Enviar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Preview */}
      <Dialog open={modalPreview} onOpenChange={setModalPreview}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{previewDoc ? tipoLabels[previewDoc.tipo] : 'Documento'}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {previewDoc?.url && (
              <img 
                src={previewDoc.url} 
                alt="Documento" 
                className="w-full rounded-lg"
              />
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setModalPreview(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
