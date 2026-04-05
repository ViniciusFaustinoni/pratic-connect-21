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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  RefreshCw,
  Car,
} from 'lucide-react';
import { usePlataformasOptions } from '@/hooks/usePlataformasCRUD';

interface ImportarRastreadoresDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RastreadorImportRow {
  imei: string;
  placa?: string;
  local_instalacao?: string;
  numero_serie?: string;
  chip_iccid?: string;
  id_plataforma?: string;
  nota_fiscal?: string;
  fornecedor?: string;
  // Resolved
  veiculo_id?: string;
  veiculo_encontrado?: boolean;
  // Validation state
  acao?: 'criar' | 'atualizar';
  valido?: boolean;
  erros?: string[];
  avisos?: string[];
  linha?: number;
}

type ImportStep = 'selecionar_plataforma' | 'upload' | 'preview' | 'importing' | 'result';

export function ImportarRastreadoresDialog({
  open,
  onOpenChange,
}: ImportarRastreadoresDialogProps) {
  const queryClient = useQueryClient();
  const { data: plataformas } = usePlataformasOptions();

  const [step, setStep] = useState<ImportStep>('selecionar_plataforma');
  const [plataformaSelecionada, setPlataformaSelecionada] = useState('');
  const [dados, setDados] = useState<RastreadorImportRow[]>([]);
  const [progresso, setProgresso] = useState(0);
  const [resultado, setResultado] = useState<{ sucesso: number; atualizados: number; erros: number }>({ sucesso: 0, atualizados: 0, erros: 0 });

  const validarDados = useCallback(async (rows: RastreadorImportRow[]): Promise<RastreadorImportRow[]> => {
    const uniqueImeis = [...new Set(rows.map(r => r.imei).filter(Boolean))];
    const placaRegex = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;
    const uniquePlacas = [...new Set(
      rows
        .map(r => r.placa ? r.placa.toUpperCase().replace(/[^A-Z0-9]/g, '') : '')
        .filter(p => p && placaRegex.test(p))
    )];

    // Fetch existing trackers by IMEI (batch in chunks of 100)
    let existentesList: { id: string; imei: string; veiculo_id: string | null }[] = [];
    for (let i = 0; i < uniqueImeis.length; i += 100) {
      const chunk = uniqueImeis.slice(i, i + 100);
      const { data } = await supabase
        .from('rastreadores')
        .select('id, imei, veiculo_id')
        .in('imei', chunk);
      if (data) existentesList.push(...(data as any[]));
    }
    const existentesMap = new Map(existentesList.map(r => [r.imei, r]));

    // Fetch vehicles by plate (batch in chunks of 100)
    let veiculosList: { id: string; placa: string }[] = [];
    for (let i = 0; i < uniquePlacas.length; i += 100) {
      const chunk = uniquePlacas.slice(i, i + 100);
      const { data } = await supabase
        .from('veiculos')
        .select('id, placa')
        .in('placa', chunk);
      if (data) veiculosList.push(...(data as any[]));
    }
    const veiculosMap = new Map(veiculosList.map(v => [v.placa.toUpperCase(), v.id]));

    const imeisNoArquivo = new Map<string, number>();

    return rows.map((row, index) => {
      const erros: string[] = [];
      const avisos: string[] = [];
      const linha = index + 2;

      // Validate IMEI
      if (!row.imei) {
        erros.push('IMEI é obrigatório');
      } else {
        const imeiLimpo = row.imei.replace(/\D/g, '');
        if (imeiLimpo.length < 15 || imeiLimpo.length > 17) {
          erros.push('IMEI deve ter 15-17 dígitos');
        } else if (imeisNoArquivo.has(imeiLimpo)) {
          erros.push(`IMEI duplicado (linha ${imeisNoArquivo.get(imeiLimpo)})`);
        } else {
          imeisNoArquivo.set(imeiLimpo, linha);
        }
        row.imei = imeiLimpo;
      }

      // Determine action: create or update
      const existente = row.imei ? existentesMap.get(row.imei) : undefined;
      const acao: 'criar' | 'atualizar' = existente ? 'atualizar' : 'criar';

      // Resolve vehicle by plate
      let veiculo_id: string | undefined;
      let veiculo_encontrado = false;
      if (row.placa) {
        const placaNorm = row.placa.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (!placaRegex.test(placaNorm)) {
          // Not a valid Brazilian plate format — ignore silently
          row.placa = undefined;
        } else {
          const vid = veiculosMap.get(placaNorm);
          if (vid) {
            veiculo_id = vid;
            veiculo_encontrado = true;
          } else {
            avisos.push('Placa não encontrada no sistema');
          }
        }
      }

      return {
        ...row,
        veiculo_id,
        veiculo_encontrado,
        acao,
        valido: erros.length === 0,
        erros,
        avisos,
        linha,
      };
    });
  }, []);

  const processarArquivo = useCallback(async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

      const rows: RastreadorImportRow[] = jsonData.map((row) => {
        const imei = String(row.imei || row.Imei || row.IMEI || '').trim();
        const placa = String(row.placa || row.Placa || row.PLACA || '').trim() || undefined;
        const localRaw = String(
          row['Local da instalação do equipamento'] ||
          row.local_instalacao ||
          row['Local Instalação'] ||
          row['local instalacao'] ||
          ''
        ).trim();
        const local_instalacao = localRaw && localRaw.toLowerCase() !== 'não informado' ? localRaw : undefined;

        // Also support old format fields
        const numero_serie = String(row.numero_serie || row['Número de Série'] || '').trim() || undefined;
        const chip_iccid = String(row.chip_iccid || row.ICCID || '').trim() || undefined;
        const id_plataforma = String(row.id_plataforma || row['ID Plataforma'] || '').trim() || undefined;
        const nota_fiscal = String(row.nota_fiscal || row['Nota Fiscal'] || row.NF || '').trim() || undefined;
        const fornecedor = String(row.fornecedor || row.Fornecedor || '').trim() || undefined;

        return { imei, placa, local_instalacao, numero_serie, chip_iccid, id_plataforma, nota_fiscal, fornecedor };
      });

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
      let atualizados = 0;
      let erros = 0;

      for (let i = 0; i < dadosValidos.length; i++) {
        const item = dadosValidos[i];
        try {
          const status = item.veiculo_id ? 'instalado' : 'estoque';

          if (item.acao === 'atualizar') {
            // Update existing tracker
            const updateData: Record<string, unknown> = {
              plataforma: plataformaSelecionada,
            };
            if (item.veiculo_id) updateData.veiculo_id = item.veiculo_id;
            if (item.local_instalacao) updateData.local_instalacao = item.local_instalacao;
            if (item.veiculo_id) updateData.status = 'instalado';

            const { error: updateError } = await supabase
              .from('rastreadores')
              .update(updateData)
              .eq('imei', item.imei);

            if (updateError) throw updateError;
            atualizados++;
          } else {
            // Insert new tracker
            const codigo = gerarCodigo();
            const { data: rastreador, error: insertError } = await supabase
              .from('rastreadores')
              .insert({
                codigo,
                imei: item.imei,
                numero_serie: item.numero_serie || null,
                plataforma: plataformaSelecionada,
                chip_iccid: item.chip_iccid || null,
                id_plataforma: item.id_plataforma || null,
                veiculo_id: item.veiculo_id || null,
                local_instalacao: item.local_instalacao || null,
                status,
              })
              .select('id')
              .single();

            if (insertError) throw insertError;

            // Create stock movement record
            await supabase.from('estoque_movimentacoes').insert({
              tipo: 'entrada',
              quantidade: 1,
              status_anterior: null,
              status_novo: status,
              rastreador_id: rastreador.id,
              nota_fiscal: item.nota_fiscal || null,
              fornecedor: item.fornecedor || null,
              observacoes: `Importação em lote - ${plataformaSelecionada}`,
            });

            sucesso++;
          }
        } catch (err) {
          console.error('Erro ao importar rastreador:', err);
          erros++;
        }

        setProgresso(Math.round(((i + 1) / dadosValidos.length) * 100));
      }

      return { sucesso, atualizados, erros };
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
        Placa: 'ABC1D23',
        Imei: '123456789012345',
        'Local da instalação do equipamento': 'Painel',
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
    setStep('selecionar_plataforma');
    setPlataformaSelecionada('');
    setDados([]);
    setProgresso(0);
    setResultado({ sucesso: 0, atualizados: 0, erros: 0 });
    onOpenChange(false);
  };

  const dadosValidos = dados.filter(d => d.valido);
  const dadosInvalidos = dados.filter(d => !d.valido);
  const dadosNovos = dadosValidos.filter(d => d.acao === 'criar');
  const dadosAtualizar = dadosValidos.filter(d => d.acao === 'atualizar');

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Rastreadores em Lote
          </DialogTitle>
          <DialogDescription>
            Importe múltiplos rastreadores através de arquivo Excel ou CSV
          </DialogDescription>
        </DialogHeader>

        {step === 'selecionar_plataforma' && (
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Selecione a plataforma para o lote</label>
              <Select value={plataformaSelecionada} onValueChange={setPlataformaSelecionada}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha a plataforma..." />
                </SelectTrigger>
                <SelectContent>
                  {plataformas?.map(p => (
                    <SelectItem key={p.codigo} value={p.codigo}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Todos os rastreadores importados serão vinculados a esta plataforma.
              </p>
            </div>
            <div className="flex justify-end">
              <Button disabled={!plataformaSelecionada} onClick={() => setStep('upload')}>
                Continuar
              </Button>
            </div>
          </div>
        )}

        {step === 'upload' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">{plataformas?.find(p => p.codigo === plataformaSelecionada)?.nome}</Badge>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setStep('selecionar_plataforma')}>
                Alterar
              </Button>
            </div>

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
              <h4 className="font-medium mb-2">Colunas aceitas:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li><strong>Imei</strong> (obrigatório) - IMEI do rastreador (15-17 dígitos)</li>
                <li><strong>Placa</strong> - Placa do veículo para vínculo automático</li>
                <li><strong>Local da instalação do equipamento</strong> - Local de instalação (opcional)</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2">
                Se o IMEI já existir no sistema, o rastreador será atualizado em vez de duplicado.
              </p>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">{plataformas?.find(p => p.codigo === plataformaSelecionada)?.nome}</Badge>
              {dadosNovos.length > 0 && (
                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {dadosNovos.length} novos
                </Badge>
              )}
              {dadosAtualizar.length > 0 && (
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
                  <RefreshCw className="h-3 w-3 mr-1" />
                  {dadosAtualizar.length} atualizar
                </Badge>
              )}
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
                    <TableHead>Placa</TableHead>
                    <TableHead>IMEI</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead>Veículo</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dados.map((item, index) => (
                    <TableRow key={index} className={!item.valido ? 'bg-red-500/5' : ''}>
                      <TableCell className="font-mono text-xs">{item.linha}</TableCell>
                      <TableCell className="font-mono text-xs">{item.placa || '-'}</TableCell>
                      <TableCell className="font-mono text-xs">{item.imei || '-'}</TableCell>
                      <TableCell className="text-xs">{item.local_instalacao || '-'}</TableCell>
                      <TableCell>
                        {item.placa ? (
                          item.veiculo_encontrado ? (
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 text-xs">
                              <Car className="h-3 w-3 mr-1" />
                              Encontrado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30 text-xs">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Não encontrado
                            </Badge>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {!item.valido ? (
                          <div className="flex flex-col gap-1">
                            {item.erros?.map((erro, i) => (
                              <Badge key={i} variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30 text-xs">
                                <AlertCircle className="h-3 w-3 mr-1 shrink-0" />
                                {erro}
                              </Badge>
                            ))}
                          </div>
                        ) : item.acao === 'atualizar' ? (
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 text-xs">
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Atualizar
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Novo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removerLinha(index)}>
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => { setStep('upload'); setDados([]); }}>
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
              <p className="text-sm text-muted-foreground">Não feche esta janela</p>
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
                {resultado.sucesso > 0 && (
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-600">{resultado.sucesso}</p>
                    <p className="text-sm text-muted-foreground">Novos</p>
                  </div>
                )}
                {resultado.atualizados > 0 && (
                  <div className="text-center">
                    <p className="text-3xl font-bold text-blue-600">{resultado.atualizados}</p>
                    <p className="text-sm text-muted-foreground">Atualizados</p>
                  </div>
                )}
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
