import { useState, useCallback } from 'react';
import { AlertCircle, CheckCircle, Clock, FileUp, Loader2, Upload, XCircle, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useMigracaoConfig } from '@/hooks/useConteudosSistema';
import {
  useVerificarBloqueiosMigracao,
  useCriarSolicitacaoMigracao,
  useSolicitacaoMigracaoByCotacao,
} from '@/hooks/useSolicitacaoMigracao';

interface DocEntry {
  id: string;
  file: File;
  tipo: 'comprovante_pagamento' | 'boleto_referencia';
  status: 'pending' | 'uploading' | 'validating' | 'done' | 'error';
  arquivo_url?: string;
  cpf_detectado?: string;
  placa_detectada?: string;
  data_documento?: string;
  legivel?: boolean;
  erro?: string;
}

interface MigracaoStepFormProps {
  cotacaoId: string;
  cpf: string;
  nome?: string;
  placa?: string;
  onStatusChange: (canAdvance: boolean) => void;
}

export function MigracaoStepForm({ cotacaoId, cpf, nome, placa, onStatusChange }: MigracaoStepFormProps) {
  const [associacaoOrigem, setAssociacaoOrigem] = useState('');
  const [comprovantes, setComprovantes] = useState<DocEntry[]>([]);
  const [boleto, setBoleto] = useState<DocEntry | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [declaracaoCancelamento, setDeclaracaoCancelamento] = useState(false);

  const { data: migracaoConfig, isLoading: loadingConfig } = useMigracaoConfig();
  const { data: bloqueio, isLoading: loadingBloqueio } = useVerificarBloqueiosMigracao(cpf);
  const { data: solicitacaoExistente } = useSolicitacaoMigracaoByCotacao(cotacaoId);
  const criarSolicitacao = useCriarSolicitacaoMigracao();

  const comprovantesExigidos = migracaoConfig?.comprovantes ?? 3;
  const prazoHoras = migracaoConfig?.prazo_horas ?? 48;
  const prazoMaxComprovanteMeses = migracaoConfig?.prazo_max_comprovante_meses ?? 3;

  // Notify parent about advance capability
  const canAdvance = solicitacaoExistente?.status === 'aprovada';
  
  // Call onStatusChange whenever status changes
  if (canAdvance) {
    onStatusChange(true);
  } else {
    onStatusChange(false);
  }

  // If there's already a submitted request, show status
  if (solicitacaoExistente) {
    return <SolicitacaoStatus solicitacao={solicitacaoExistente} />;
  }

  if (loadingBloqueio || loadingConfig) {
    return (
      <div className="flex items-center justify-center py-12 gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-muted-foreground">Verificando elegibilidade para migração...</span>
      </div>
    );
  }

  // Show blocking alert
  if (bloqueio?.bloqueado) {
    return (
      <Alert variant="destructive" className="my-4">
        <AlertCircle className="h-5 w-5" />
        <AlertTitle>Vínculo Ativo Existente</AlertTitle>
        <AlertDescription className="mt-2">{bloqueio.mensagem}</AlertDescription>
      </Alert>
    );
  }

  // Upload file to storage
  const uploadFile = async (file: File, tipo: string): Promise<string> => {
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `migracao/${cotacaoId}/${tipo}/${timestamp}_${safeName}`;

    const { data, error } = await supabase.storage
      .from('documentos')
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (error) throw new Error('Erro ao enviar arquivo.');

    const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  // OCR validation
  const validateWithOCR = async (url: string): Promise<{ cpf?: string; placa?: string; data_documento?: string; legivel: boolean }> => {
    try {
      const { data, error } = await supabase.functions.invoke('document-ocr', {
        body: { url, tipoEsperado: 'comprovante_pagamento' },
      });
      if (error) return { legivel: false };
      return {
        cpf: data?.cpf || undefined,
        placa: data?.placa || undefined,
        data_documento: data?.data_documento || undefined,
        legivel: data?.legivel !== false,
      };
    } catch {
      return { legivel: false };
    }
  };

  const handleAddComprovantes = async (files: File[]) => {
    const newEntries: DocEntry[] = files.map(f => ({
      id: crypto.randomUUID(),
      file: f,
      tipo: 'comprovante_pagamento' as const,
      status: 'pending' as const,
    }));
    setComprovantes(prev => [...prev, ...newEntries]);

    // Process each file
    for (const entry of newEntries) {
      setComprovantes(prev => prev.map(c => c.id === entry.id ? { ...c, status: 'uploading' } : c));

      try {
        const url = await uploadFile(entry.file, 'comprovante');
        setComprovantes(prev => prev.map(c => c.id === entry.id ? { ...c, status: 'validating', arquivo_url: url } : c));

        const ocr = await validateWithOCR(url);
        setComprovantes(prev => prev.map(c => c.id === entry.id ? {
          ...c,
          status: 'done',
          cpf_detectado: ocr.cpf,
          placa_detectada: ocr.placa,
          data_documento: ocr.data_documento,
          legivel: ocr.legivel,
        } : c));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        setComprovantes(prev => prev.map(c => c.id === entry.id ? { ...c, status: 'error', erro: msg } : c));
      }
    }
  };

  const handleAddBoleto = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    const entry: DocEntry = {
      id: crypto.randomUUID(),
      file,
      tipo: 'boleto_referencia',
      status: 'uploading',
    };
    setBoleto(entry);

    try {
      const url = await uploadFile(file, 'boleto');
      setBoleto(prev => prev ? { ...prev, status: 'validating', arquivo_url: url } : null);

      const ocr = await validateWithOCR(url);
      setBoleto(prev => prev ? { ...prev, status: 'done', legivel: ocr.legivel, cpf_detectado: ocr.cpf, placa_detectada: ocr.placa } : null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setBoleto(prev => prev ? { ...prev, status: 'error', erro: msg } : null);
    }
  };

  const removeComprovante = (id: string) => {
    setComprovantes(prev => prev.filter(c => c.id !== id));
  };

  const handleValidateAndSubmit = async () => {
    setValidationErrors([]);
    setIsValidating(true);
    const errors: string[] = [];
    const cpfLimpo = cpf.replace(/\D/g, '');

    // 1. Association name
    if (!associacaoOrigem.trim()) {
      errors.push('Informe o nome da associação de origem.');
    }

    // 2. Comprovantes count
    const comprovantesDone = comprovantes.filter(c => c.status === 'done');
    if (comprovantesDone.length < comprovantesExigidos) {
      errors.push(`São necessários pelo menos ${comprovantesExigidos} comprovantes de pagamento. Você enviou ${comprovantesDone.length}.`);
    }

    // 3. CPF match
    for (const comp of comprovantesDone) {
      if (comp.cpf_detectado) {
        const cpfDoc = comp.cpf_detectado.replace(/\D/g, '');
        if (cpfDoc !== cpfLimpo) {
          errors.push(`Comprovante "${comp.file.name}": CPF detectado (${comp.cpf_detectado}) difere do CPF do solicitante.`);
        }
      }
    }

    // 4. Placa match
    if (placa) {
      const placaLimpa = placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      for (const comp of comprovantesDone) {
        if (comp.placa_detectada) {
          const placaDoc = comp.placa_detectada.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
          if (placaDoc !== placaLimpa) {
            errors.push(`Comprovante "${comp.file.name}": Placa detectada (${comp.placa_detectada}) difere da placa do veículo (${placa}).`);
          }
        }
      }
    }

    // 5. Boleto
    if (!boleto || boleto.status !== 'done') {
      errors.push('O boleto de referência é obrigatório.');
    } else if (boleto.legivel === false) {
      errors.push('O boleto de referência não está legível. Envie uma imagem com melhor qualidade.');
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      setIsValidating(false);
      return;
    }

    // All good — create solicitação
    try {
      const allDocs = [
        ...comprovantesDone.map(c => ({
          tipo: 'comprovante_pagamento' as const,
          arquivo_url: c.arquivo_url!,
          nome_arquivo: c.file.name,
          cpf_detectado: c.cpf_detectado,
          placa_detectada: c.placa_detectada,
          legivel: c.legivel,
          validacao_ok: true,
        })),
        ...(boleto && boleto.arquivo_url ? [{
          tipo: 'boleto_referencia' as const,
          arquivo_url: boleto.arquivo_url,
          nome_arquivo: boleto.file.name,
          cpf_detectado: boleto.cpf_detectado,
          placa_detectada: boleto.placa_detectada,
          legivel: boleto.legivel,
          validacao_ok: true,
        }] : []),
      ];

      await criarSolicitacao.mutateAsync({
        cotacao_id: cotacaoId,
        associado_cpf: cpf,
        associado_nome: nome,
        veiculo_placa: placa,
        associacao_origem: associacaoOrigem.trim(),
        prazo_resposta_horas: prazoHoras,
        declaracao_cancelamento_concorrente: declaracaoCancelamento,
        documentos: allDocs,
      });

      toast.success('Solicitação de migração enviada para análise!');
    } catch (err) {
      toast.error('Erro ao criar solicitação de migração.');
      console.error(err);
    } finally {
      setIsValidating(false);
    }
  };

  const comprovantesDone = comprovantes.filter(c => c.status === 'done').length;
  const allUploaded = comprovantes.every(c => c.status === 'done' || c.status === 'error');
  const boletoReady = boleto?.status === 'done';

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Documentação de Migração
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Envie os comprovantes da associação anterior para análise.
        </p>
      </div>

      {/* Associação de origem */}
      <div className="space-y-2">
        <Label htmlFor="associacao-origem">Associação de Origem</Label>
        <Input
          id="associacao-origem"
          placeholder="Nome da associação onde o cliente está protegido atualmente"
          value={associacaoOrigem}
          onChange={e => setAssociacaoOrigem(e.target.value)}
        />
      </div>

      {/* Comprovantes de pagamento */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Comprovantes de Pagamento</Label>
            <Badge variant={comprovantesDone >= comprovantesExigidos ? 'default' : 'secondary'}>
              {comprovantesDone} / {comprovantesExigidos} enviados
            </Badge>
          </div>

          <DropzoneArea
            onDrop={handleAddComprovantes}
            label={`Arraste os comprovantes aqui (mínimo ${comprovantesExigidos})`}
            accept={{ 'image/*': ['.jpg', '.jpeg', '.png', '.webp'], 'application/pdf': ['.pdf'] }}
          />

          {comprovantes.length > 0 && (
            <div className="space-y-2">
              {comprovantes.map(comp => (
                <DocStatusRow key={comp.id} doc={comp} onRemove={() => removeComprovante(comp.id)} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Boleto de referência */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <Label className="text-sm font-medium">Boleto de Referência</Label>

          {!boleto ? (
            <DropzoneArea
              onDrop={handleAddBoleto}
              label="Arraste o boleto de referência aqui"
              accept={{ 'image/*': ['.jpg', '.jpeg', '.png', '.webp'], 'application/pdf': ['.pdf'] }}
              maxFiles={1}
            />
          ) : (
            <DocStatusRow doc={boleto} onRemove={() => setBoleto(null)} />
          )}
        </CardContent>
      </Card>

      {/* Declaração de cancelamento */}
      <div className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30">
        <Checkbox
          id="declaracao-cancelamento"
          checked={declaracaoCancelamento}
          onCheckedChange={(checked) => setDeclaracaoCancelamento(checked === true)}
          className="mt-0.5"
        />
        <label htmlFor="declaracao-cancelamento" className="text-sm leading-relaxed cursor-pointer">
          Declaro que o associado está cancelando ou já cancelou o vínculo com a associação anterior antes de ingressar na Praticcar.
        </label>
      </div>

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Problemas encontrados na validação</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4 mt-2 space-y-1">
              {validationErrors.map((err, i) => (
                <li key={i} className="text-sm">{err}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Submit button */}
      <Button
        onClick={handleValidateAndSubmit}
        disabled={isValidating || criarSolicitacao.isPending || !associacaoOrigem.trim() || comprovantesDone < comprovantesExigidos || !boletoReady || !declaracaoCancelamento}
        className="w-full"
        size="lg"
      >
        {isValidating || criarSolicitacao.isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Validando documentos...
          </>
        ) : (
          <>
            <CheckCircle className="h-4 w-4 mr-2" />
            Validar e Enviar para Análise
          </>
        )}
      </Button>
    </div>
  );
}

// ============================================
// Subcomponents
// ============================================

function SolicitacaoStatus({ solicitacao }: { solicitacao: any }) {
  const statusConfig = {
    pendente: { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800', label: 'Pendente de Análise' },
    aprovada: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800', label: 'Aprovada' },
    reprovada: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800', label: 'Reprovada' },
  };

  const config = statusConfig[solicitacao.status as keyof typeof statusConfig] || statusConfig.pendente;
  const Icon = config.icon;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Building2 className="h-5 w-5" />
        Solicitação de Migração
      </h3>

      <div className={`p-4 rounded-lg border ${config.bg}`}>
        <div className="flex items-center gap-3 mb-3">
          <Icon className={`h-6 w-6 ${config.color}`} />
          <div>
            <p className={`font-semibold ${config.color}`}>{config.label}</p>
            <p className="text-sm text-muted-foreground">
              Associação de origem: {solicitacao.associacao_origem}
            </p>
          </div>
        </div>

        {solicitacao.status === 'pendente' && (
          <p className="text-sm text-muted-foreground">
            Aguardando análise da diretoria. O prazo de resposta é de {solicitacao.prazo_resposta_horas}h.
            Enviada em {new Date(solicitacao.created_at).toLocaleString('pt-BR')}.
          </p>
        )}

        {solicitacao.status === 'aprovada' && (
          <p className="text-sm text-green-700 dark:text-green-400">
            Migração aprovada! Você pode avançar para a próxima etapa.
          </p>
        )}

        {solicitacao.status === 'reprovada' && (
          <div>
            <p className="text-sm text-red-700 dark:text-red-400">
              Motivo: {solicitacao.motivo_reprovacao || 'Não informado'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Corrija os documentos e envie novamente se necessário.
            </p>
          </div>
        )}
      </div>

      {/* Documents submitted */}
      {solicitacao.documentos && solicitacao.documentos.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium">Documentos enviados:</p>
          {solicitacao.documentos.map((doc: any) => (
            <div key={doc.id} className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span>{doc.tipo === 'comprovante_pagamento' ? 'Comprovante' : 'Boleto'}</span>
              <span>— {doc.nome_arquivo}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DropzoneArea({ onDrop, label, accept, maxFiles }: {
  onDrop: (files: File[]) => void;
  label: string;
  accept?: Record<string, string[]>;
  maxFiles?: number;
}) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles,
    maxSize: 10 * 1024 * 1024,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
        isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'
      }`}
    >
      <input {...getInputProps()} />
      <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-xs text-muted-foreground mt-1">JPG, PNG ou PDF — máx. 10MB</p>
    </div>
  );
}

function DocStatusRow({ doc, onRemove }: { doc: DocEntry; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded border bg-muted/30 text-sm">
      {doc.status === 'uploading' && <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />}
      {doc.status === 'validating' && <Loader2 className="h-4 w-4 animate-spin text-amber-500 flex-shrink-0" />}
      {doc.status === 'done' && <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />}
      {doc.status === 'error' && <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />}
      {doc.status === 'pending' && <FileUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />}

      <span className="truncate flex-1">{doc.file.name}</span>

      {doc.status === 'uploading' && <span className="text-xs text-muted-foreground">Enviando...</span>}
      {doc.status === 'validating' && <span className="text-xs text-amber-600">Validando OCR...</span>}
      {doc.status === 'error' && <span className="text-xs text-red-500">{doc.erro}</span>}
      {doc.status === 'done' && doc.cpf_detectado && (
        <Badge variant="outline" className="text-xs">CPF: {doc.cpf_detectado}</Badge>
      )}

      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onRemove}>
        <XCircle className="h-3 w-3" />
      </Button>
    </div>
  );
}
