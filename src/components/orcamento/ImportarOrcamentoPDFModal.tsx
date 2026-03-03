import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileUp, Loader2, Upload, Trash2, CheckCircle } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAdicionarItem, type OrcamentoItem } from '@/hooks/useOrcamentoReparo';

interface ExtractedPeca {
  descricao: string;
  operacao?: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  origem?: string;
}

interface ExtractedServico {
  descricao: string;
  horas?: number;
  valor_unitario?: number;
  valor_total: number;
  tipo_servico?: string;
}

interface ExtractedData {
  pecas: ExtractedPeca[];
  servicos: ExtractedServico[];
  resumo: {
    total_pecas: number;
    total_mao_obra: number;
    total_geral: number;
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
  orcamentoId: string;
}

export function ImportarOrcamentoPDFModal({ open, onClose, orcamentoId }: Props) {
  const [step, setStep] = useState<'upload' | 'processing' | 'preview'>('upload');
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [importing, setImporting] = useState(false);
  const adicionarItem = useAdicionarItem();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Apenas arquivos PDF são aceitos');
      return;
    }

    setStep('processing');

    try {
      // Upload to storage
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const path = `orcamentos-pdf/${timestamp}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(path, file, { contentType: 'application/pdf' });

      if (uploadError) throw new Error(`Erro no upload: ${uploadError.message}`);

      // Get public URL
      const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(path);

      // Call extraction edge function
      const { data, error } = await supabase.functions.invoke('extract-orcamento-pdf', {
        body: { pdfUrl: urlData.publicUrl },
      });

      if (error) throw new Error(`Erro na extração: ${error.message}`);

      if (!data?.pecas && !data?.servicos) {
        throw new Error('Nenhum item extraído do PDF');
      }

      setExtractedData(data);
      setStep('preview');
      toast.success(`Extraídos ${data.pecas?.length || 0} peças e ${data.servicos?.length || 0} serviços`);
    } catch (err: any) {
      console.error('Extraction error:', err);
      toast.error(err.message || 'Erro ao processar PDF');
      setStep('upload');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    multiple: false,
  });

  const removePeca = (index: number) => {
    if (!extractedData) return;
    setExtractedData({
      ...extractedData,
      pecas: extractedData.pecas.filter((_, i) => i !== index),
    });
  };

  const removeServico = (index: number) => {
    if (!extractedData) return;
    setExtractedData({
      ...extractedData,
      servicos: extractedData.servicos.filter((_, i) => i !== index),
    });
  };

  const updatePeca = (index: number, field: keyof ExtractedPeca, value: string | number) => {
    if (!extractedData) return;
    const updated = [...extractedData.pecas];
    (updated[index] as any)[field] = value;
    if (field === 'quantidade' || field === 'valor_unitario') {
      updated[index].valor_total = updated[index].quantidade * updated[index].valor_unitario;
    }
    setExtractedData({ ...extractedData, pecas: updated });
  };

  const updateServico = (index: number, field: keyof ExtractedServico, value: string | number) => {
    if (!extractedData) return;
    const updated = [...extractedData.servicos];
    (updated[index] as any)[field] = value;
    setExtractedData({ ...extractedData, servicos: updated });
  };

  const handleImportar = async () => {
    if (!extractedData) return;
    setImporting(true);

    try {
      let successCount = 0;

      // Import peças
      for (const peca of extractedData.pecas) {
        await adicionarItem.mutateAsync({
          orcamentoId,
          item: {
            tipo: 'peca',
            descricao: peca.descricao,
            quantidade: peca.quantidade,
            valor_unitario: peca.valor_unitario,
            origem: (peca.origem as any) || null,
            observacao: peca.operacao === 'R&I' ? 'R&I (Remover & Instalar)' : null,
          } as Partial<OrcamentoItem>,
          motivo: 'Importado via PDF',
        });
        successCount++;
      }

      // Import serviços
      for (const servico of extractedData.servicos) {
        await adicionarItem.mutateAsync({
          orcamentoId,
          item: {
            tipo: 'mao_de_obra',
            descricao: servico.descricao,
            quantidade: 1,
            valor_unitario: servico.valor_total,
            observacao: servico.horas ? `${servico.horas}h` : null,
          } as Partial<OrcamentoItem>,
          motivo: 'Importado via PDF',
        });
        successCount++;
      }

      toast.success(`${successCount} itens importados com sucesso!`);
      handleClose();
    } catch (err: any) {
      console.error('Import error:', err);
      toast.error(`Erro ao importar: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setStep('upload');
    setExtractedData(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            Importar Orçamento via PDF
          </DialogTitle>
          <DialogDescription>
            Envie o PDF do orçamento e a IA extrairá automaticamente peças e serviços. Revise antes de confirmar.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'}`}
          >
            <input {...getInputProps()} />
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium">
              {isDragActive ? 'Solte o PDF aqui...' : 'Arraste o PDF ou clique para selecionar'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Apenas arquivos .pdf</p>
          </div>
        )}

        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Analisando PDF com IA...</p>
            <p className="text-xs text-muted-foreground">Isso pode levar alguns segundos</p>
          </div>
        )}

        {step === 'preview' && extractedData && (
          <>
            {/* Resumo */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="rounded-lg border p-2 text-center">
                <p className="text-xs text-muted-foreground">Peças</p>
                <p className="text-sm font-bold">R$ {extractedData.resumo.total_pecas?.toFixed(2)}</p>
              </div>
              <div className="rounded-lg border p-2 text-center">
                <p className="text-xs text-muted-foreground">Mão de Obra</p>
                <p className="text-sm font-bold">R$ {extractedData.resumo.total_mao_obra?.toFixed(2)}</p>
              </div>
              <div className="rounded-lg border p-2 text-center bg-primary/5">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-sm font-bold text-primary">R$ {extractedData.resumo.total_geral?.toFixed(2)}</p>
              </div>
            </div>

            <Tabs defaultValue="pecas">
              <TabsList>
                <TabsTrigger value="pecas">🔧 Peças ({extractedData.pecas.length})</TabsTrigger>
                <TabsTrigger value="servicos">🛠️ Serviços ({extractedData.servicos.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="pecas">
                <div className="max-h-[40vh] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="w-16">Op.</TableHead>
                        <TableHead className="w-16 text-right">Qtd</TableHead>
                        <TableHead className="w-28 text-right">Unitário</TableHead>
                        <TableHead className="w-28 text-right">Total</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {extractedData.pecas.map((peca, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <Input
                              value={peca.descricao}
                              onChange={(e) => updatePeca(i, 'descricao', e.target.value)}
                              className="h-7 text-xs"
                            />
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {peca.operacao || 'T'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={peca.quantidade}
                              onChange={(e) => updatePeca(i, 'quantidade', Number(e.target.value))}
                              className="h-7 text-xs text-right w-14"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={peca.valor_unitario}
                              onChange={(e) => updatePeca(i, 'valor_unitario', Number(e.target.value))}
                              className="h-7 text-xs text-right"
                            />
                          </TableCell>
                          <TableCell className="text-right text-xs font-medium">
                            R$ {peca.valor_total?.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removePeca(i)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="servicos">
                <div className="max-h-[40vh] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="w-20">Horas</TableHead>
                        <TableHead className="w-28 text-right">Valor Total</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {extractedData.servicos.map((servico, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <Input
                              value={servico.descricao}
                              onChange={(e) => updateServico(i, 'descricao', e.target.value)}
                              className="h-7 text-xs"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.1"
                              value={servico.horas || ''}
                              onChange={(e) => updateServico(i, 'horas', Number(e.target.value))}
                              className="h-7 text-xs w-16"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={servico.valor_total}
                              onChange={(e) => updateServico(i, 'valor_total', Number(e.target.value))}
                              className="h-7 text-xs text-right"
                            />
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeServico(i)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleClose} disabled={importing}>
                Cancelar
              </Button>
              <Button
                onClick={handleImportar}
                disabled={importing || (!extractedData.pecas.length && !extractedData.servicos.length)}
              >
                {importing ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Importando...</>
                ) : (
                  <><CheckCircle className="h-4 w-4 mr-1" /> Confirmar e Importar ({extractedData.pecas.length + extractedData.servicos.length} itens)</>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
