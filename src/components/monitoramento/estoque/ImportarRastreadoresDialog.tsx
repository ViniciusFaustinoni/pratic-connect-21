import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Trash2,
} from 'lucide-react';
import { usePlataformasOptions } from '@/hooks/usePlataformasCRUD';

interface ImportarRastreadoresDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RastreadorImportRow {
  imei: string;
  numero_serie?: string;
  plataforma: string;
  chip_iccid?: string;
  id_plataforma?: string;
  nota_fiscal?: string;
  fornecedor?: string;
  // Validation state
  valido?: boolean;
  erros?: string[];
  linha?: number;
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'result';

export function ImportarRastreadoresDialog({
  open,
  onOpenChange,
}: ImportarRastreadoresDialogProps) {
  const queryClient = useQueryClient();
  const { data: plataformas } = usePlataformasOptions();
  
  const [step, setStep] = useState<ImportStep>('upload');
  const [dados, setDados] = useState<RastreadorImportRow[]>([]);
  const [progresso, setProgresso] = useState(0);
  const [resultado, setResultado] = useState<{ sucesso: number; erros: number }>({ sucesso: 0, erros: 0 });

  const plataformasValidas = plataformas?.map(p => p.codigo) || [];

  const validarDados = useCallback(async (rows: RastreadorImportRow[]): Promise<RastreadorImportRow[]> => {
    // Fetch existing IMEIs and serial numbers
    const { data: existentes } = await supabase
      .from('rastreadores')
      .select('imei, numero_serie');

    const imeisExistentes = new Set(existentes?.map(r => r.imei) || []);
    const seriesExistentes = new Set(existentes?.map(r => r.numero_serie).filter(Boolean) || []);
    const imeisNoArquivo = new Map<string, number>();

    return rows.map((row, index) => {
      const erros: string[] = [];
      const linha = index + 2; // +2 because of header and 0-index

      // Validate IMEI
      if (!row.imei) {
        erros.push('IMEI é obrigatório');
      } else {
        const imeiLimpo = row.imei.replace(/\D/g, '');
        if (imeiLimpo.length < 15 || imeiLimpo.length > 17) {
          erros.push('IMEI deve ter 15-17 dígitos');
        } else if (imeisExistentes.has(imeiLimpo)) {
          erros.push('IMEI já existe no sistema');
        } else if (imeisNoArquivo.has(imeiLimpo)) {
          erros.push(`IMEI duplicado (linha ${imeisNoArquivo.get(imeiLimpo)})`);
        } else {
          imeisNoArquivo.set(imeiLimpo, linha);
        }
        row.imei = imeiLimpo;
      }

      // Validate platform
      if (!row.plataforma) {
        erros.push('Plataforma é obrigatória');
      } else if (plataformasValidas.length > 0 && !plataformasValidas.includes(row.plataforma.toLowerCase())) {
        erros.push(`Plataforma inválida. Use: ${plataformasValidas.join(', ')}`);
      } else {
        row.plataforma = row.plataforma.toLowerCase();
      }

      // Validate serial number (if provided)
      if (row.numero_serie && seriesExistentes.has(row.numero_serie)) {
        erros.push('Número de série já existe');
      }

      return {
        ...row,
        valido: erros.length === 0,
        erros,
        linha,
      };
    });
  }, [plataformasValidas]);

  const processarArquivo = useCallback(async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

      const rows: RastreadorImportRow[] = jsonData.map((row) => ({
        imei: String(row.imei || row.IMEI || '').trim(),
        numero_serie: String(row.numero_serie || row['Número de Série'] || row['numero serie'] || '').trim() || undefined,
        plataforma: String(row.plataforma || row.Plataforma || '').trim().toLowerCase(),
        chip_iccid: String(row.chip_iccid || row['ICCID'] || row['Chip ICCID'] || '').trim() || undefined,
        id_plataforma: String(row.id_plataforma || row['ID Plataforma'] || '').trim() || undefined,
        nota_fiscal: String(row.nota_fiscal || row['Nota Fiscal'] || row['NF'] || '').trim() || undefined,
        fornecedor: String(row.fornecedor || row.Fornecedor || '').trim() || undefined,
      }));

      const dadosValidados = await validarDados(rows);
      setDados(dadosValidados);
      setStep('preview');
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      toast.error('Erro ao processar arquivo. Verifique o formato.');
    }
  }, [validarDados]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        processarArquivo(acceptedFiles[0]);
      }
    },
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
  });

  const gerarCodigo = () => {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `RAT-${timestamp}-${random}`;
  };

  const importarMutation = useMutation({
    mutationFn: async () => {
      const dadosValidos = dados.filter(d => d.valido);
      let sucesso = 0;
      let erros = 0;

      for (let i = 0; i < dadosValidos.length; i++) {
        const item = dadosValidos[i];
        try {
          const codigo = gerarCodigo();
          
          // Insert tracker
          const { data: rastreador, error: insertError } = await supabase
            .from('rastreadores')
            .insert({
              codigo,
              imei: item.imei,
              numero_serie: item.numero_serie || null,
              plataforma: item.plataforma,
              chip_iccid: item.chip_iccid || null,
              id_plataforma: item.id_plataforma || null,
              status: 'estoque',
            })
            .select('id')
            .single();

          if (insertError) throw insertError;

          // Create stock movement record
          await supabase.from('estoque_movimentacoes').insert({
            tipo: 'entrada',
            quantidade: 1,
            status_anterior: null,
            status_novo: 'estoque',
            rastreador_id: rastreador.id,
            nota_fiscal: item.nota_fiscal || null,
            fornecedor: item.fornecedor || null,
            observacoes: 'Importação em lote',
          });

          sucesso++;
        } catch (err) {
          console.error('Erro ao importar rastreador:', err);
          erros++;
        }

        setProgresso(Math.round(((i + 1) / dadosValidos.length) * 100));
      }

      return { sucesso, erros };
    },
    onSuccess: (result) => {
      setResultado(result);
      setStep('result');
      queryClient.invalidateQueries({ queryKey: ['rastreadores'] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-movimentacoes'] });
    },
    onError: (error) => {
      console.error('Erro na importação:', error);
      toast.error('Erro durante a importação');
    },
  });

  const baixarTemplate = () => {
    const template = [
      {
        imei: '123456789012345',
        numero_serie: 'SN001234',
        plataforma: 'softruck',
        chip_iccid: '89551234567890123456',
        id_plataforma: '12345',
        nota_fiscal: 'NF-001',
        fornecedor: 'Fornecedor Exemplo',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rastreadores');
    XLSX.writeFile(wb, 'template-importacao-rastreadores.xlsx');
  };

  const removerLinha = (index: number) => {
    setDados(prev => prev.filter((_, i) => i !== index));
  };

  const handleClose = () => {
    if (importarMutation.isPending) return;
    setStep('upload');
    setDados([]);
    setProgresso(0);
    setResultado({ sucesso: 0, erros: 0 });
    onOpenChange(false);
  };

  const dadosValidos = dados.filter(d => d.valido);
  const dadosInvalidos = dados.filter(d => !d.valido);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Rastreadores em Lote
          </DialogTitle>
          <DialogDescription>
            Importe múltiplos rastreadores de uma vez através de arquivo Excel ou CSV
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
              `}
            >
              <input {...getInputProps()} />
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              {isDragActive ? (
                <p className="text-lg">Solte o arquivo aqui...</p>
              ) : (
                <div>
                  <p className="text-lg mb-2">Arraste um arquivo ou clique para selecionar</p>
                  <p className="text-sm text-muted-foreground">
                    Formatos aceitos: .xlsx, .xls, .csv
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-center">
              <Button variant="outline" onClick={baixarTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Baixar Template
              </Button>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-medium mb-2">Colunas do template:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li><strong>imei</strong> (obrigatório) - IMEI do rastreador (15-17 dígitos)</li>
                <li><strong>plataforma</strong> (obrigatório) - Código da plataforma (ex: softruck)</li>
                <li><strong>numero_serie</strong> - Número de série do fabricante</li>
                <li><strong>chip_iccid</strong> - ICCID do chip SIM</li>
                <li><strong>id_plataforma</strong> - ID na plataforma externa</li>
                <li><strong>nota_fiscal</strong> - Número da nota fiscal</li>
                <li><strong>fornecedor</strong> - Nome do fornecedor</li>
              </ul>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {dadosValidos.length} válidos
              </Badge>
              {dadosInvalidos.length > 0 && (
                <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
                  <XCircle className="h-3 w-3 mr-1" />
                  {dadosInvalidos.length} com erros
                </Badge>
              )}
            </div>

            <ScrollArea className="flex-1 border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Linha</TableHead>
                    <TableHead>IMEI</TableHead>
                    <TableHead>Plataforma</TableHead>
                    <TableHead>Nº Série</TableHead>
                    <TableHead>Nota Fiscal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dados.map((item, index) => (
                    <TableRow key={index} className={!item.valido ? 'bg-red-500/5' : ''}>
                      <TableCell className="font-mono text-xs">{item.linha}</TableCell>
                      <TableCell className="font-mono">{item.imei || '-'}</TableCell>
                      <TableCell>{item.plataforma || '-'}</TableCell>
                      <TableCell>{item.numero_serie || '-'}</TableCell>
                      <TableCell>{item.nota_fiscal || '-'}</TableCell>
                      <TableCell>
                        {item.valido ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            OK
                          </Badge>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {item.erros?.map((erro, i) => (
                              <Badge key={i} variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30 text-xs">
                                <AlertCircle className="h-3 w-3 mr-1 shrink-0" />
                                {erro}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => removerLinha(index)}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Voltar
              </Button>
              <Button
                onClick={() => {
                  setStep('importing');
                  importarMutation.mutate();
                }}
                disabled={dadosValidos.length === 0}
              >
                Importar {dadosValidos.length} rastreador{dadosValidos.length !== 1 ? 'es' : ''}
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-8 space-y-6">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
              <p className="text-lg font-medium">Importando rastreadores...</p>
              <p className="text-sm text-muted-foreground">
                Não feche esta janela
              </p>
            </div>
            <Progress value={progresso} className="h-2" />
            <p className="text-center text-sm text-muted-foreground">{progresso}%</p>
          </div>
        )}

        {step === 'result' && (
          <div className="py-8 space-y-6">
            <div className="text-center">
              <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Importação Concluída!</h3>
              <div className="flex justify-center gap-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600">{resultado.sucesso}</p>
                  <p className="text-sm text-muted-foreground">Importados</p>
                </div>
                {resultado.erros > 0 && (
                  <div className="text-center">
                    <p className="text-3xl font-bold text-red-600">{resultado.erros}</p>
                    <p className="text-sm text-muted-foreground">Erros</p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-center">
              <Button onClick={handleClose}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
