import { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDropzone } from 'react-dropzone';
import { AlertCircle, CheckCircle, Clock, FileUp, Loader2, Upload, XCircle, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useMigracaoConfig } from '@/hooks/useConteudosSistema';
import { useVerificarBloqueiosMigracao, useCriarSolicitacaoMigracaoDireta } from '@/hooks/useSolicitacaoMigracao';
import { useQuery } from '@tanstack/react-query';

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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cpfInicial?: string;
  consultorIdInicial?: string;
}

function useConsultoresDisponiveis() {
  return useQuery({
    queryKey: ['consultores-disponiveis'],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['vendedor_clt', 'vendedor_externo']);
      
      if (!roles || roles.length === 0) return [];
      
      const userIds = [...new Set(roles.map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nome, user_id')
        .in('user_id', userIds)
        .order('nome');
      
      return profiles || [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

function formatCPF(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function MigracaoDiretaDialog({ open, onOpenChange, cpfInicial, consultorIdInicial }: Props) {
  const [cpf, setCpf] = useState(cpfInicial || '');
  const [nome, setNome] = useState('');
  const [placa, setPlaca] = useState('');
  const [associacaoOrigem, setAssociacaoOrigem] = useState('');
  const [consultorId, setConsultorId] = useState<string>(consultorIdInicial || 'sem_consultor');
  const [comprovantes, setComprovantes] = useState<DocEntry[]>([]);
  const [boleto, setBoleto] = useState<DocEntry | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [declaracaoCancelamento, setDeclaracaoCancelamento] = useState(false);

  const { data: migracaoConfig, isLoading: loadingConfig } = useMigracaoConfig();
  const { data: bloqueio, isLoading: loadingBloqueio } = useVerificarBloqueiosMigracao(cpf);
  const { data: consultores } = useConsultoresDisponiveis();
  const criarSolicitacao = useCriarSolicitacaoMigracaoDireta();

  const comprovantesExigidos = migracaoConfig?.comprovantes ?? 3;
  const prazoHoras = migracaoConfig?.prazo_horas ?? 48;
  const prazoMaxComprovanteMeses = migracaoConfig?.prazo_max_comprovante_meses ?? 3;

  const cpfLimpo = cpf.replace(/\D/g, '');
  const cpfValido = cpfLimpo.length === 11;

  const resetForm = () => {
    setCpf(cpfInicial || '');
    setNome('');
    setPlaca('');
    setAssociacaoOrigem('');
    setConsultorId(consultorIdInicial || 'sem_consultor');
    setComprovantes([]);
    setBoleto(null);
    setValidationErrors([]);
    setDeclaracaoCancelamento(false);
  };

  // Sync props when dialog opens
  useEffect(() => {
    if (open) {
      if (cpfInicial) setCpf(cpfInicial);
      if (consultorIdInicial) setConsultorId(consultorIdInicial);
    }
  }, [open, cpfInicial, consultorIdInicial]);

  const uploadFile = async (file: File, tipo: string): Promise<string> => {
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `migracao/direta/${cpfLimpo}/${tipo}/${timestamp}_${safeName}`;
    const { data, error } = await supabase.storage.from('documentos').upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) throw new Error('Erro ao enviar arquivo.');
    const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  const validateWithOCR = async (url: string): Promise<{ cpf?: string; placa?: string; data_documento?: string; legivel: boolean }> => {
    try {
      const { data, error } = await supabase.functions.invoke('document-ocr', {
        body: { url, tipoEsperado: 'comprovante_pagamento' },
      });
      if (error) return { legivel: false };
      return { cpf: data?.cpf, placa: data?.placa, data_documento: data?.data_documento, legivel: data?.legivel !== false };
    } catch {
      return { legivel: false };
    }
  };

  const handleAddComprovantes = async (files: File[]) => {
    const newEntries: DocEntry[] = files.map(f => ({
      id: crypto.randomUUID(), file: f, tipo: 'comprovante_pagamento' as const, status: 'pending' as const,
    }));
    setComprovantes(prev => [...prev, ...newEntries]);

    for (const entry of newEntries) {
      setComprovantes(prev => prev.map(c => c.id === entry.id ? { ...c, status: 'uploading' } : c));
      try {
        const url = await uploadFile(entry.file, 'comprovante');
        setComprovantes(prev => prev.map(c => c.id === entry.id ? { ...c, status: 'validating', arquivo_url: url } : c));
        const ocr = await validateWithOCR(url);
        setComprovantes(prev => prev.map(c => c.id === entry.id ? { ...c, status: 'done', cpf_detectado: ocr.cpf, placa_detectada: ocr.placa, data_documento: ocr.data_documento, legivel: ocr.legivel } : c));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        setComprovantes(prev => prev.map(c => c.id === entry.id ? { ...c, status: 'error', erro: msg } : c));
      }
    }
  };

  const handleAddBoleto = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    const entry: DocEntry = { id: crypto.randomUUID(), file, tipo: 'boleto_referencia', status: 'uploading' };
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

  const handleSubmit = async () => {
    setValidationErrors([]);
    setIsValidating(true);
    const errors: string[] = [];

    if (!cpfValido) errors.push('CPF inválido.');
    if (!nome.trim()) errors.push('Informe o nome do cliente.');
    if (!associacaoOrigem.trim()) errors.push('Informe a associação de origem.');

    const comprovantesDone = comprovantes.filter(c => c.status === 'done');
    if (comprovantesDone.length < comprovantesExigidos) {
      errors.push(`São necessários pelo menos ${comprovantesExigidos} comprovantes. Enviados: ${comprovantesDone.length}.`);
    }

    for (const comp of comprovantesDone) {
      if (comp.cpf_detectado) {
        const cpfDoc = comp.cpf_detectado.replace(/\D/g, '');
        if (cpfDoc !== cpfLimpo) {
          errors.push(`Comprovante "${comp.file.name}": CPF detectado (${comp.cpf_detectado}) difere do CPF informado.`);
        }
      }
    }

    if (!boleto || boleto.status !== 'done') {
      errors.push('O boleto de referência é obrigatório.');
    } else if (boleto.legivel === false) {
      errors.push('O boleto não está legível. Envie uma imagem com melhor qualidade.');
    }

    // Prazo de antiguidade dos comprovantes
    const limiteData = new Date();
    limiteData.setMonth(limiteData.getMonth() - prazoMaxComprovanteMeses);
    for (const comp of comprovantesDone) {
      if (comp.data_documento) {
        const dataDoc = new Date(comp.data_documento);
        if (!isNaN(dataDoc.getTime()) && dataDoc < limiteData) {
          errors.push(`Comprovante "${comp.file.name}": documento fora do prazo aceito (máximo ${prazoMaxComprovanteMeses} meses).`);
        }
      }
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      setIsValidating(false);
      return;
    }

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
        ...(boleto?.arquivo_url ? [{
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
        associado_cpf: cpf,
        associado_nome: nome.trim(),
        veiculo_placa: placa.trim() || undefined,
        associacao_origem: associacaoOrigem.trim(),
        prazo_resposta_horas: prazoHoras,
        consultor_id: consultorId !== 'sem_consultor' ? consultorId : undefined,
        declaracao_cancelamento_concorrente: declaracaoCancelamento,
        documentos: allDocs,
      });

      toast.success('Solicitação de migração direta enviada para análise!');
      resetForm();
      onOpenChange(false);
    } catch (err) {
      toast.error('Erro ao criar solicitação de migração.');
      console.error(err);
    } finally {
      setIsValidating(false);
    }
  };

  const comprovantesDone = comprovantes.filter(c => c.status === 'done').length;
  const boletoReady = boleto?.status === 'done';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Nova Solicitação de Migração — Entrada Direta
          </DialogTitle>
          <DialogDescription>
            Cadastre uma migração sem necessidade de cotação prévia.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Dados do cliente */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cpf-direto">CPF *</Label>
              <Input
                id="cpf-direto"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={e => setCpf(formatCPF(e.target.value))}
                maxLength={14}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nome-direto">Nome do Cliente *</Label>
              <Input id="nome-direto" placeholder="Nome completo" value={nome} onChange={e => setNome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="placa-direto">Placa do Veículo</Label>
              <Input id="placa-direto" placeholder="ABC1D23" value={placa} onChange={e => setPlaca(e.target.value.toUpperCase())} maxLength={7} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="assoc-origem">Associação de Origem *</Label>
              <Input id="assoc-origem" placeholder="Nome da associação anterior" value={associacaoOrigem} onChange={e => setAssociacaoOrigem(e.target.value)} />
            </div>
          </div>

          {/* Consultor opcional */}
          <div className="space-y-1.5">
            <Label>Consultor (opcional)</Label>
            <Select value={consultorId} onValueChange={setConsultorId}>
              <SelectTrigger>
                <SelectValue placeholder="Sem consultor vinculado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sem_consultor">Sem consultor vinculado</SelectItem>
                {consultores?.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bloqueio */}
          {cpfValido && loadingBloqueio && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Verificando elegibilidade...
            </div>
          )}
          {bloqueio?.bloqueado && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Vínculo Ativo</AlertTitle>
              <AlertDescription>{bloqueio.mensagem}</AlertDescription>
            </Alert>
          )}

          {/* Comprovantes */}
          {!bloqueio?.bloqueado && (
            <>
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Comprovantes de Pagamento</Label>
                    <Badge variant={comprovantesDone >= comprovantesExigidos ? 'default' : 'secondary'}>
                      {comprovantesDone} / {comprovantesExigidos}
                    </Badge>
                  </div>
                  <DropzoneArea onDrop={handleAddComprovantes} label={`Arraste os comprovantes (mínimo ${comprovantesExigidos})`} />
                  {comprovantes.length > 0 && (
                    <div className="space-y-2">
                      {comprovantes.map(comp => (
                        <DocStatusRow key={comp.id} doc={comp} onRemove={() => setComprovantes(prev => prev.filter(c => c.id !== comp.id))} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4 space-y-3">
                  <Label className="text-sm font-medium">Boleto de Referência</Label>
                  {!boleto ? (
                    <DropzoneArea onDrop={handleAddBoleto} label="Arraste o boleto de referência" maxFiles={1} />
                  ) : (
                    <DocStatusRow doc={boleto} onRemove={() => setBoleto(null)} />
                  )}
                </CardContent>
              </Card>

              {/* Declaração de cancelamento */}
              <div className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30">
                <Checkbox
                  id="declaracao-cancelamento-direta"
                  checked={declaracaoCancelamento}
                  onCheckedChange={(checked) => setDeclaracaoCancelamento(checked === true)}
                  className="mt-0.5"
                />
                <label htmlFor="declaracao-cancelamento-direta" className="text-sm leading-relaxed cursor-pointer">
                  Declaro que o associado está cancelando ou já cancelou o vínculo com a associação anterior antes de ingressar na Praticcar.
                </label>
              </div>
            </>
          )}

          {/* Errors */}
          {validationErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Problemas encontrados</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4 mt-2 space-y-1">
                  {validationErrors.map((err, i) => <li key={i} className="text-sm">{err}</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleSubmit}
            disabled={isValidating || criarSolicitacao.isPending || !cpfValido || !nome.trim() || !associacaoOrigem.trim() || comprovantesDone < comprovantesExigidos || !boletoReady || bloqueio?.bloqueado || !declaracaoCancelamento}
            className="w-full"
            size="lg"
          >
            {isValidating || criarSolicitacao.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Validando...</>
            ) : (
              <><CheckCircle className="h-4 w-4 mr-2" />Enviar para Análise</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Subcomponents (same pattern as MigracaoStepForm)
function DropzoneArea({ onDrop, label, maxFiles }: { onDrop: (files: File[]) => void; label: string; maxFiles?: number }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, maxFiles, maxSize: 10 * 1024 * 1024,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'], 'application/pdf': ['.pdf'] },
  });
  return (
    <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'}`}>
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
      {doc.status === 'done' && doc.cpf_detectado && <Badge variant="outline" className="text-xs">CPF: {doc.cpf_detectado}</Badge>}
      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onRemove}>
        <XCircle className="h-3 w-3" />
      </Button>
    </div>
  );
}
