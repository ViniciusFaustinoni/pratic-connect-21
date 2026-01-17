import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  FileText, 
  User, 
  MapPin, 
  Check, 
  X, 
  Loader2,
  AlertCircle,
  Sparkles,
  Mail,
  Phone,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DadosPessoaisForm } from './FormularioDadosPessoais';
import { convertPdfToImage, isPdf, getPdfConvertedName } from '@/lib/pdfToImage';

interface DocumentoProcessado {
  id: string;
  nome: string;
  url: string;
  tipo: 'cnh' | 'rg' | 'comprovante_residencia' | 'outro';
  status: 'uploading' | 'processing' | 'success' | 'error';
  dadosExtraidos?: Record<string, string>;
  erro?: string;
}

interface DadosExtraidos {
  // Dados pessoais (de CNH/RG)
  nome?: string;
  cpf?: string;
  rg?: string;
  data_nascimento?: string;
  // Endereço (de Comprovante)
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
}

interface EtapaDadosPessoaisDocumentosProps {
  cotacaoId: string;
  onSubmit: (dados: DadosPessoaisForm) => void;
  isLoading?: boolean;
  defaultValues?: Partial<DadosPessoaisForm>;
}

export function EtapaDadosPessoaisDocumentos({
  cotacaoId,
  onSubmit,
  isLoading = false,
  defaultValues,
}: EtapaDadosPessoaisDocumentosProps) {
  const [documentos, setDocumentos] = useState<DocumentoProcessado[]>([]);
  const [dadosExtraidos, setDadosExtraidos] = useState<DadosExtraidos>({});
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Campos manuais (não podem ser extraídos de documentos)
  const [email, setEmail] = useState(defaultValues?.email || '');
  const [telefone, setTelefone] = useState(defaultValues?.telefone || '');

  // Verificar se temos os dados necessários
  const temDocumentoPessoal = documentos.some(
    d => (d.tipo === 'cnh' || d.tipo === 'rg') && d.status === 'success'
  );
  const temComprovante = documentos.some(
    d => d.tipo === 'comprovante_residencia' && d.status === 'success'
  );
  const temDadosPessoais = !!(dadosExtraidos.nome && dadosExtraidos.cpf);
  const temEndereco = !!(dadosExtraidos.logradouro && dadosExtraidos.cidade && dadosExtraidos.uf);
  const temContato = !!(email && telefone);
  
  const podeAvancar = temDadosPessoais && temEndereco && temContato;

  const formatTelefone = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 10) {
      return cleaned.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    }
    return cleaned.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
  };

  const processFile = useCallback(async (file: File) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Formato não suportado. Use JPG, PNG ou PDF.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 10MB.');
      return;
    }

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    const newDoc: DocumentoProcessado = {
      id: tempId,
      nome: file.name,
      url: URL.createObjectURL(file),
      tipo: 'outro',
      status: 'uploading',
    };

    setDocumentos(prev => [...prev, newDoc]);
    setIsProcessing(true);

    try {
      let fileToUpload = file;
      let finalFileName = file.name;

      // Se for PDF, converter para imagem
      if (isPdf(file)) {
        setDocumentos(prev => prev.map(d => 
          d.id === tempId ? { ...d, status: 'processing' as const } : d
        ));
        
        toast.info('Convertendo PDF para imagem...');
        
        try {
          const imageBlob = await convertPdfToImage(file);
          finalFileName = getPdfConvertedName(file.name);
          fileToUpload = new File([imageBlob], finalFileName, { type: 'image/jpeg' });
        } catch (pdfError) {
          console.error('PDF conversion error:', pdfError);
          throw new Error('Erro ao converter PDF. Tente enviar como imagem JPG ou PNG.');
        }
      }

      // Upload para storage
      const timestamp = Date.now();
      const sanitizedFileName = finalFileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `cotacoes-publicas/${cotacaoId}/${timestamp}_${sanitizedFileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('contratos-documentos')
        .upload(filePath, fileToUpload, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw new Error('Erro ao enviar arquivo para o storage.');
      }

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from('contratos-documentos')
        .getPublicUrl(uploadData.path);

      const arquivoUrl = urlData.publicUrl;

      // Atualizar para processando
      setDocumentos(prev => prev.map(d => 
        d.id === tempId ? { ...d, url: arquivoUrl, status: 'processing' as const } : d
      ));

      // Chamar OCR
      const { data: ocrData, error: ocrError } = await supabase.functions.invoke('document-ocr', {
        body: { 
          url: arquivoUrl,
          cpfEsperado: defaultValues?.cpf,
          nomeEsperado: defaultValues?.nome,
        }
      });

      if (ocrError) {
        throw new Error(ocrError.message || 'Erro ao processar documento com IA');
      }

      // Mapear tipo detectado
      let tipoDetectado: DocumentoProcessado['tipo'] = 'outro';
      const tipoOcr = (ocrData.tipo || '').toLowerCase();
      
      if (tipoOcr.includes('cnh')) tipoDetectado = 'cnh';
      else if (tipoOcr.includes('rg')) tipoDetectado = 'rg';
      else if (tipoOcr.includes('residencia') || tipoOcr.includes('residência') || tipoOcr.includes('comprovante')) {
        tipoDetectado = 'comprovante_residencia';
      }

      // Atualizar documento com resultado
      setDocumentos(prev => prev.map(d => 
        d.id === tempId ? { 
          ...d, 
          tipo: tipoDetectado,
          status: ocrData.legivel ? 'success' : 'error',
          dadosExtraidos: ocrData,
          erro: !ocrData.legivel ? ocrData.motivo : undefined,
        } : d
      ));

      // Extrair dados conforme tipo
      if (ocrData.legivel) {
        if (tipoDetectado === 'cnh' || tipoDetectado === 'rg') {
          setDadosExtraidos(prev => ({
            ...prev,
            ...(ocrData.nome && { nome: ocrData.nome }),
            ...(ocrData.cpf && { cpf: ocrData.cpf }),
            ...(ocrData.rg && { rg: ocrData.rg }),
            ...(ocrData.data_nascimento && { data_nascimento: ocrData.data_nascimento }),
          }));
          toast.success(`${tipoDetectado.toUpperCase()} processada com sucesso!`);
        } else if (tipoDetectado === 'comprovante_residencia') {
          setDadosExtraidos(prev => ({
            ...prev,
            ...(ocrData.cep && { cep: ocrData.cep }),
            ...(ocrData.logradouro && { logradouro: ocrData.logradouro }),
            ...(ocrData.numero && { numero: ocrData.numero }),
            ...(ocrData.complemento && { complemento: ocrData.complemento }),
            ...(ocrData.bairro && { bairro: ocrData.bairro }),
            ...(ocrData.cidade && { cidade: ocrData.cidade }),
            ...(ocrData.uf && { uf: ocrData.uf }),
          }));
          toast.success('Comprovante de residência processado!');
        }
      } else {
        toast.error(`Documento ilegível: ${ocrData.motivo}`);
      }

    } catch (error: any) {
      console.error('Error processing file:', error);
      setDocumentos(prev => prev.map(d => 
        d.id === tempId ? { ...d, status: 'error', erro: error.message } : d
      ));
      toast.error(error.message || 'Erro ao processar documento');
    } finally {
      setIsProcessing(false);
    }
  }, [cotacaoId, defaultValues]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    files.forEach(processFile);
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(processFile);
  }, [processFile]);

  const handleSubmit = () => {
    const dados: DadosPessoaisForm = {
      nome: dadosExtraidos.nome || '',
      cpf: dadosExtraidos.cpf || '',
      email,
      telefone,
      data_nascimento: dadosExtraidos.data_nascimento || '',
      cep: dadosExtraidos.cep || '',
      logradouro: dadosExtraidos.logradouro || '',
      numero: dadosExtraidos.numero || '',
      complemento: dadosExtraidos.complemento || '',
      bairro: dadosExtraidos.bairro || '',
      cidade: dadosExtraidos.cidade || '',
      uf: dadosExtraidos.uf || '',
    };
    onSubmit(dados);
  };

  const removerDocumento = (id: string) => {
    setDocumentos(prev => prev.filter(d => d.id !== id));
  };

  const getStatusIcon = (status: DocumentoProcessado['status']) => {
    switch (status) {
      case 'uploading':
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'success':
        return <Check className="h-4 w-4 text-success" />;
      case 'error':
        return <X className="h-4 w-4 text-destructive" />;
    }
  };

  const getTipoLabel = (tipo: DocumentoProcessado['tipo']) => {
    const labels: Record<string, string> = {
      cnh: 'CNH',
      rg: 'RG',
      comprovante_residencia: 'Comprovante',
      outro: 'Outro',
    };
    return labels[tipo] || 'Documento';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
          <Sparkles className="h-4 w-4" />
          <span className="text-sm font-medium">IA Extrai seus dados automaticamente</span>
        </div>
        <h2 className="text-2xl font-bold text-foreground">Envie seus Documentos</h2>
        <p className="text-muted-foreground mt-2">
          A inteligência artificial irá preencher seus dados automaticamente
        </p>
      </div>

      {/* Upload Area */}
      <Card className="border-dashed border-2 border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-6">
          <div
            className={cn(
              'relative rounded-xl border-2 border-dashed transition-all duration-200',
              'flex flex-col items-center justify-center p-8 text-center cursor-pointer',
              isDragOver 
                ? 'border-primary bg-primary/5' 
                : 'border-border/50 hover:border-primary/50 hover:bg-primary/5'
            )}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            
            <p className="text-lg font-medium text-foreground mb-2">
              Arraste seus documentos aqui
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              ou clique para selecionar
            </p>
            
            <div className="flex flex-wrap gap-2 justify-center">
              <Badge variant="outline" className="bg-background/50">CNH</Badge>
              <Badge variant="outline" className="bg-background/50">RG</Badge>
              <Badge variant="outline" className="bg-background/50">Comprovante de Residência</Badge>
            </div>
            
            <p className="text-xs text-muted-foreground mt-4">
              Formatos: JPG, PNG ou PDF • Máximo 10MB
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Documentos Enviados */}
      <AnimatePresence>
        {documentos.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Documentos Enviados
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {documentos.map((doc) => (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg',
                      doc.status === 'success' && 'bg-success/5 border border-success/20',
                      doc.status === 'error' && 'bg-destructive/5 border border-destructive/20',
                      (doc.status === 'uploading' || doc.status === 'processing') && 'bg-muted/50 border border-border/50'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(doc.status)}
                      <div>
                        <p className="text-sm font-medium text-foreground truncate max-w-[200px]">
                          {doc.nome}
                        </p>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {getTipoLabel(doc.tipo)}
                          </Badge>
                          {doc.erro && (
                            <span className="text-xs text-destructive">{doc.erro}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removerDocumento(doc.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </motion.div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Checklist de Documentos */}
      <Card className="bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Documentos Necessários</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className={cn(
            'flex items-center gap-3 p-3 rounded-lg transition-colors',
            temDocumentoPessoal ? 'bg-success/5' : 'bg-muted/30'
          )}>
            <div className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center',
              temDocumentoPessoal ? 'bg-success/10' : 'bg-muted'
            )}>
              {temDocumentoPessoal ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <User className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">CNH ou RG</p>
              {temDadosPessoais && (
                <p className="text-xs text-muted-foreground">
                  {dadosExtraidos.nome} • CPF: {dadosExtraidos.cpf}
                </p>
              )}
            </div>
          </div>

          <div className={cn(
            'flex items-center gap-3 p-3 rounded-lg transition-colors',
            temComprovante ? 'bg-success/5' : 'bg-muted/30'
          )}>
            <div className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center',
              temComprovante ? 'bg-success/10' : 'bg-muted'
            )}>
              {temComprovante ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <MapPin className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Comprovante de Residência</p>
              {temEndereco && (
                <p className="text-xs text-muted-foreground">
                  {dadosExtraidos.logradouro}, {dadosExtraidos.numero} - {dadosExtraidos.cidade}/{dadosExtraidos.uf}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dados Extraídos */}
      <AnimatePresence>
        {(temDadosPessoais || temEndereco) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid md:grid-cols-2 gap-4"
          >
            {temDadosPessoais && (
              <Card className="bg-card/80 backdrop-blur-sm border-success/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4 text-success" />
                    Dados Pessoais
                    <Badge variant="outline" className="ml-auto bg-success/5 text-success border-success/20">
                      Extraído
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Nome:</span>
                    <span className="ml-2 font-medium">{dadosExtraidos.nome}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">CPF:</span>
                    <span className="ml-2 font-medium">{dadosExtraidos.cpf}</span>
                  </div>
                  {dadosExtraidos.data_nascimento && (
                    <div>
                      <span className="text-muted-foreground">Nascimento:</span>
                      <span className="ml-2 font-medium">{dadosExtraidos.data_nascimento}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {temEndereco && (
              <Card className="bg-card/80 backdrop-blur-sm border-success/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-success" />
                    Endereço
                    <Badge variant="outline" className="ml-auto bg-success/5 text-success border-success/20">
                      Extraído
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Logradouro:</span>
                    <span className="ml-2 font-medium">
                      {dadosExtraidos.logradouro}, {dadosExtraidos.numero}
                      {dadosExtraidos.complemento && ` - ${dadosExtraidos.complemento}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Bairro:</span>
                    <span className="ml-2 font-medium">{dadosExtraidos.bairro}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cidade:</span>
                    <span className="ml-2 font-medium">{dadosExtraidos.cidade} - {dadosExtraidos.uf}</span>
                  </div>
                  {dadosExtraidos.cep && (
                    <div>
                      <span className="text-muted-foreground">CEP:</span>
                      <span className="ml-2 font-medium">{dadosExtraidos.cep}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Campos Manuais - Email e Telefone */}
      <Card className="bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Contato
            <span className="text-xs text-muted-foreground font-normal ml-2">
              (preencha manualmente)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone / WhatsApp *</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="telefone"
                  type="tel"
                  placeholder="(00) 00000-0000"
                  value={telefone}
                  onChange={(e) => setTelefone(formatTelefone(e.target.value))}
                  className="pl-10"
                  maxLength={15}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerta se faltar algo */}
      {!podeAvancar && documentos.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-warning/5 border border-warning/20">
          <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-warning">Documentos pendentes</p>
            <p className="text-muted-foreground">
              {!temDadosPessoais && 'Envie sua CNH ou RG. '}
              {!temEndereco && 'Envie um comprovante de residência. '}
              {!temContato && 'Preencha seu e-mail e telefone.'}
            </p>
          </div>
        </div>
      )}

      {/* Botão Continuar */}
      <Button
        onClick={handleSubmit}
        disabled={!podeAvancar || isLoading || isProcessing}
        className="w-full h-14 text-lg bg-accent hover:bg-accent-hover text-accent-foreground"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Salvando...
          </>
        ) : isProcessing ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Processando documentos...
          </>
        ) : (
          <>
            Continuar
            <ArrowRight className="ml-2 h-5 w-5" />
          </>
        )}
      </Button>
    </div>
  );
}
