import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { 
  Upload, 
  FileSpreadsheet, 
  Check, 
  X, 
  AlertCircle,
  Download,
  Loader2,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  processarLinhaOficina,
  verificarDuplicadosNoArquivo,
  gerarTemplateOficinas,
  type OficinaImportProcessada,
  type OficinaImportRaw,
} from '@/lib/parseOficina';
import { useImportOficinas, type ImportSummary } from '@/hooks/useImportOficinas';

interface ImportarOficinasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type Step = 'upload' | 'preview' | 'importing' | 'result';
type FilterType = 'todas' | 'validas' | 'erros';

export function ImportarOficinasDialog({
  open,
  onOpenChange,
  onSuccess,
}: ImportarOficinasDialogProps) {
  const [step, setStep] = useState<Step>('upload');
  const [oficinas, setOficinas] = useState<OficinaImportProcessada[]>([]);
  const [progress, setProgress] = useState(0);
  const [resultado, setResultado] = useState<ImportSummary | null>(null);
  const [filter, setFilter] = useState<FilterType>('todas');
  const [fileName, setFileName] = useState<string>('');

  const { mutateAsync: importOficinas, isPending } = useImportOficinas();

  const resetState = () => {
    setStep('upload');
    setOficinas([]);
    setProgress(0);
    setResultado(null);
    setFilter('todas');
    setFileName('');
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const processFile = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<OficinaImportRaw>(worksheet, {
          raw: false,
          defval: '',
        });

        // Mapear colunas do Excel para nosso formato
        const dadosMapeados = jsonData.map((row, index) => {
          // Tentar encontrar as colunas por diferentes nomes possíveis
          const dadosNormalizados: OficinaImportRaw = {
            tipo: row['Tipo'] || row['tipo'] || row['TIPO'] || '',
            nome: row['Nome'] || row['nome'] || row['NOME'] || row['Razao Social'] || row['razao_social'] || '',
            cnpj: row['CNPJ'] || row['cnpj'] || row['Cnpj'] || '',
            cep: row['CEP'] || row['cep'] || row['Cep'] || '',
            endereco: row['Endereco'] || row['endereco'] || row['ENDERECO'] || row['Endereço'] || '',
            telefone: row['Telefone'] || row['telefone'] || row['TELEFONE'] || row['Tel'] || '',
            cidade: row['Cidade'] || row['cidade'] || row['CIDADE'] || '',
            estado: row['Estado'] || row['estado'] || row['ESTADO'] || row['UF'] || row['uf'] || '',
          };

          return processarLinhaOficina(dadosNormalizados, index + 2); // +2 porque linha 1 é header
        });

        // Verificar duplicados no arquivo
        const oficinasProcessadas = verificarDuplicadosNoArquivo(dadosMapeados);

        setOficinas(oficinasProcessadas);
        setStep('preview');
      } catch (error) {
        console.error('Erro ao processar arquivo:', error);
      }
    };

    reader.readAsBinaryString(file);
  }, []);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        processFile(acceptedFiles[0]);
      }
    },
    [processFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    multiple: false,
  });

  const handleDownloadTemplate = () => {
    const template = gerarTemplateOficinas();
    const worksheet = XLSX.utils.json_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
    XLSX.writeFile(workbook, 'template_oficinas.xlsx');
  };

  const handleImport = async () => {
    const oficinasValidas = oficinas.filter((o) => o.valida);
    if (oficinasValidas.length === 0) return;

    setStep('importing');
    setProgress(0);

    // Simular progresso
    const interval = setInterval(() => {
      setProgress((prev) => Math.min(prev + 10, 90));
    }, 200);

    try {
      const result = await importOficinas(oficinasValidas);
      clearInterval(interval);
      setProgress(100);
      setResultado(result);
      setStep('result');
      
      if (result.sucesso > 0) {
        onSuccess?.();
      }
    } catch (error) {
      clearInterval(interval);
      console.error('Erro na importação:', error);
    }
  };

  // Contadores
  const totalOficinas = oficinas.length;
  const oficinasValidas = oficinas.filter((o) => o.valida);
  const oficinasComErro = oficinas.filter((o) => !o.valida);

  // Filtrar para exibição
  const oficinasExibidas =
    filter === 'validas'
      ? oficinasValidas
      : filter === 'erros'
      ? oficinasComErro
      : oficinas;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {step === 'upload' && 'Importar Oficinas'}
            {step === 'preview' && 'Preview da Importação'}
            {step === 'importing' && 'Importando...'}
            {step === 'result' && 'Resultado da Importação'}
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Faça upload de um arquivo Excel (.xlsx, .xls) ou CSV com os dados das oficinas.'}
            {step === 'preview' && `Arquivo: ${fileName}`}
          </DialogDescription>
        </DialogHeader>

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="space-y-6 py-4">
            <div
              {...getRootProps()}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                isDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50'
              )}
            >
              <input {...getInputProps()} />
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              {isDragActive ? (
                <p className="text-lg font-medium">Solte o arquivo aqui...</p>
              ) : (
                <>
                  <p className="text-lg font-medium">Arraste o arquivo aqui</p>
                  <p className="text-muted-foreground">ou clique para selecionar</p>
                </>
              )}
              <p className="text-sm text-muted-foreground mt-2">
                .xlsx, .xls ou .csv
              </p>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Baixar template Excel
              </Button>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm font-medium mb-2">Colunas esperadas:</p>
              <p className="text-sm text-muted-foreground">
                Tipo, Nome, CNPJ, CEP, Endereco, Telefone, Cidade, Estado
              </p>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && (
          <div className="flex flex-col flex-1 min-h-0 space-y-4">
            {/* Resumo */}
            <div className="flex items-center gap-4 flex-wrap">
              <Badge variant="secondary" className="text-sm">
                <Check className="h-3 w-3 mr-1" />
                {oficinasValidas.length} válidas
              </Badge>
              <Badge variant="destructive" className="text-sm">
                <X className="h-3 w-3 mr-1" />
                {oficinasComErro.length} com erro
              </Badge>
              <Badge variant="outline" className="text-sm">
                Total: {totalOficinas}
              </Badge>

              <div className="ml-auto">
                <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    <SelectItem value="validas">Válidas</SelectItem>
                    <SelectItem value="erros">Com erro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tabela */}
            <ScrollArea className="flex-1 border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">#</TableHead>
                    <TableHead className="w-[80px]">Status</TableHead>
                    <TableHead>Razão Social</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>UF</TableHead>
                    <TableHead>Erros</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {oficinasExibidas.map((oficina) => (
                    <TableRow
                      key={oficina.linha}
                      className={cn(!oficina.valida && 'bg-destructive/5')}
                    >
                      <TableCell className="font-mono text-sm">
                        {oficina.linha}
                      </TableCell>
                      <TableCell>
                        {oficina.valida ? (
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        ) : (
                          <XCircle className="h-5 w-5 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {oficina.dados.razao_social || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {oficina.dados.cnpj || '-'}
                      </TableCell>
                      <TableCell>{oficina.dados.cidade || '-'}</TableCell>
                      <TableCell>{oficina.dados.estado || '-'}</TableCell>
                      <TableCell className="max-w-[200px]">
                        {oficina.erros.length > 0 && (
                          <span className="text-sm text-destructive">
                            {oficina.erros.join('; ')}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            {/* Ações */}
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Voltar
              </Button>
              <Button
                onClick={handleImport}
                disabled={oficinasValidas.length === 0 || isPending}
              >
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Importar {oficinasValidas.length} oficina(s)
              </Button>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === 'importing' && (
          <div className="py-12 space-y-6">
            <div className="space-y-2">
              <Progress value={progress} className="h-3" />
              <p className="text-center text-muted-foreground">
                Processando: {Math.round((progress / 100) * oficinasValidas.length)} de{' '}
                {oficinasValidas.length}
              </p>
            </div>
            <div className="flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </div>
        )}

        {/* Step: Result */}
        {step === 'result' && resultado && (
          <div className="space-y-6 py-4">
            {/* Resumo */}
            <div className="flex items-center justify-center gap-8">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 text-primary">
                  <CheckCircle2 className="h-8 w-8" />
                  <span className="text-3xl font-bold">{resultado.sucesso}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  oficina(s) importada(s)
                </p>
              </div>
              {resultado.erros > 0 && (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 text-destructive">
                    <XCircle className="h-8 w-8" />
                    <span className="text-3xl font-bold">{resultado.erros}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    com erro
                  </p>
                </div>
              )}
            </div>

            {/* Lista de erros */}
            {resultado.erros > 0 && (
              <div className="space-y-2">
                <p className="font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  Erros encontrados:
                </p>
                <ScrollArea className="h-[200px] border rounded-lg p-4">
                  <ul className="space-y-2 text-sm">
                    {resultado.resultados
                      .filter((r) => !r.sucesso)
                      .map((r) => (
                        <li key={r.linha} className="flex items-start gap-2">
                          <span className="text-muted-foreground">
                            Linha {r.linha}:
                          </span>
                          <span className="text-destructive">{r.erro}</span>
                        </li>
                      ))}
                  </ul>
                </ScrollArea>
              </div>
            )}

            {/* Botão fechar */}
            <div className="flex justify-end">
              <Button onClick={handleClose}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
