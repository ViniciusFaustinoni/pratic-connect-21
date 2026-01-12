import { useState, useCallback } from 'react';
import { Upload, Download, AlertCircle, CheckCircle2, X, FileSpreadsheet, Loader2 } from 'lucide-react';
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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';

interface ImportarUsuariosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface UsuarioImport {
  nome: string;
  telefone: string;
  email: string;
  senha: string;
  valido: boolean;
  erro?: string;
}

interface ImportResult {
  linha: number;
  email: string;
  sucesso: boolean;
  erro?: string;
}

const perfisDisponiveis = [
  { value: 'vendedor_clt', label: 'Vendedor CLT' },
  { value: 'vendedor_externo', label: 'Vendedor Externo' },
  { value: 'analista_cadastro', label: 'Analista Cadastro' },
  { value: 'instalador_vistoriador', label: 'Instalador/Vistoriador' },
  { value: 'analista_marketing', label: 'Analista Marketing' },
];

export function ImportarUsuariosDialog({ open, onOpenChange, onSuccess }: ImportarUsuariosDialogProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'result'>('upload');
  const [usuarios, setUsuarios] = useState<UsuarioImport[]>([]);
  const [perfilPadrao, setPerfilPadrao] = useState('vendedor_clt');
  const [progress, setProgress] = useState(0);
  const [resultados, setResultados] = useState<ImportResult[]>([]);
  const [totalSucesso, setTotalSucesso] = useState(0);
  const [totalErros, setTotalErros] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const resetState = () => {
    setStep('upload');
    setUsuarios([]);
    setProgress(0);
    setResultados([]);
    setTotalSucesso(0);
    setTotalErros(0);
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const downloadTemplate = () => {
    const template = [
      { nome: 'João Silva', telefone: '21999990000', email: 'joao@empresa.com', senha: 'Senha123!' },
      { nome: 'Maria Santos', telefone: '21888880000', email: 'maria@empresa.com', senha: 'Senha456!' },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Usuarios');
    XLSX.writeFile(wb, 'template-importacao-usuarios.xlsx');
  };

  const validateUsuario = (usuario: any, allEmails: string[]): UsuarioImport => {
    const nome = usuario.nome?.toString().trim() || '';
    const telefone = usuario.telefone?.toString().trim() || '';
    const email = usuario.email?.toString().toLowerCase().trim() || '';
    const senha = usuario.senha?.toString().trim() || '';
    
    let valido = true;
    let erro = '';

    if (!nome) {
      valido = false;
      erro = 'Nome vazio';
    } else if (!email) {
      valido = false;
      erro = 'Email vazio';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      valido = false;
      erro = 'Email inválido';
    } else if (allEmails.filter(e => e === email).length > 1) {
      valido = false;
      erro = 'Email duplicado no arquivo';
    } else if (!senha) {
      valido = false;
      erro = 'Senha vazia';
    } else if (senha.length < 6) {
      valido = false;
      erro = 'Senha muito curta (mín 6)';
    }

    return { nome, telefone, email, senha, valido, erro };
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);

        if (jsonData.length === 0) {
          toast.error('Planilha vazia');
          return;
        }

        // Primeiro passe: coletar todos os emails
        const allEmails = jsonData.map((row: any) => 
          row.email?.toString().toLowerCase().trim() || ''
        );

        // Segundo passe: validar cada usuário
        const usuariosValidados = jsonData.map((row: any) => 
          validateUsuario(row, allEmails)
        );

        setUsuarios(usuariosValidados);
        setStep('preview');
      } catch (error) {
        console.error('Erro ao processar arquivo:', error);
        toast.error('Erro ao processar arquivo');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
      processFile(file);
    } else {
      toast.error('Formato inválido. Use .xlsx, .xls ou .csv');
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleImport = async () => {
    const usuariosValidos = usuarios.filter(u => u.valido);
    if (usuariosValidos.length === 0) {
      toast.error('Nenhum usuário válido para importar');
      return;
    }

    setStep('importing');
    setProgress(0);

    try {
      const { data, error } = await supabase.functions.invoke('import-users', {
        body: {
          usuarios: usuariosValidos.map(u => ({
            nome: u.nome,
            telefone: u.telefone,
            email: u.email,
            senha: u.senha,
          })),
          perfilPadrao,
          tipo: 'funcionario',
        }
      });

      if (error) throw error;

      setResultados(data.resultados || []);
      setTotalSucesso(data.sucesso || 0);
      setTotalErros(data.erros || 0);
      setProgress(100);
      setStep('result');

      if (data.sucesso > 0) {
        toast.success(`${data.sucesso} usuário(s) importado(s) com sucesso!`);
        onSuccess?.();
      }
    } catch (error) {
      console.error('Erro na importação:', error);
      toast.error('Erro ao importar usuários');
      setStep('preview');
    }
  };

  const validCount = usuarios.filter(u => u.valido).length;
  const invalidCount = usuarios.filter(u => !u.valido).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Importar Usuários
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Faça upload de uma planilha com os dados dos usuários'}
            {step === 'preview' && 'Revise os dados antes de importar'}
            {step === 'importing' && 'Importando usuários...'}
            {step === 'result' && 'Resultado da importação'}
          </DialogDescription>
        </DialogHeader>

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-primary/50'
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">
                Arraste o arquivo aqui ou clique para selecionar
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Formatos aceitos: .xlsx, .xls, .csv
              </p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button variant="outline" asChild>
                  <span>Selecionar arquivo</span>
                </Button>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="font-medium">Baixar modelo de planilha</p>
                <p className="text-sm text-muted-foreground">
                  Use este modelo para preencher os dados corretamente
                </p>
              </div>
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="w-4 h-4 mr-2" />
                Baixar template
              </Button>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                A planilha deve conter as colunas: <strong>nome</strong>, <strong>telefone</strong>, <strong>email</strong> e <strong>senha</strong>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-4">
                <Badge variant="outline" className="bg-green-500/10 text-green-500">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {validCount} válidos
                </Badge>
                {invalidCount > 0 && (
                  <Badge variant="outline" className="bg-red-500/10 text-red-500">
                    <X className="w-3 h-3 mr-1" />
                    {invalidCount} com erro
                  </Badge>
                )}
              </div>
              <Select value={perfilPadrao} onValueChange={setPerfilPadrao}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Perfil padrão" />
                </SelectTrigger>
                <SelectContent>
                  {perfisDisponiveis.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ScrollArea className="h-[300px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuarios.map((usuario, idx) => (
                    <TableRow key={idx} className={!usuario.valido ? 'bg-red-500/5' : ''}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell>{usuario.nome || <span className="text-muted-foreground">-</span>}</TableCell>
                      <TableCell>{usuario.telefone || <span className="text-muted-foreground">-</span>}</TableCell>
                      <TableCell>{usuario.email || <span className="text-muted-foreground">-</span>}</TableCell>
                      <TableCell>
                        {usuario.valido ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-500">
                            OK
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-500/10 text-red-500">
                            {usuario.erro}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex justify-between">
              <Button variant="outline" onClick={resetState}>
                Voltar
              </Button>
              <Button onClick={handleImport} disabled={validCount === 0}>
                Importar {validCount} usuário(s)
              </Button>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === 'importing' && (
          <div className="py-8 space-y-4">
            <div className="flex items-center justify-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-lg">Importando usuários...</span>
            </div>
            <Progress value={progress} className="w-full" />
            <p className="text-center text-sm text-muted-foreground">
              Aguarde, isso pode levar alguns minutos
            </p>
          </div>
        )}

        {/* Step: Result */}
        {step === 'result' && (
          <div className="space-y-4">
            <div className="flex gap-4 justify-center">
              <div className="text-center p-4 bg-green-500/10 rounded-lg">
                <p className="text-3xl font-bold text-green-500">{totalSucesso}</p>
                <p className="text-sm text-muted-foreground">Importados</p>
              </div>
              <div className="text-center p-4 bg-red-500/10 rounded-lg">
                <p className="text-3xl font-bold text-red-500">{totalErros}</p>
                <p className="text-sm text-muted-foreground">Erros</p>
              </div>
            </div>

            {totalErros > 0 && (
              <ScrollArea className="h-[200px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Linha</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Erro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resultados.filter(r => !r.sucesso).map((resultado, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{resultado.linha}</TableCell>
                        <TableCell>{resultado.email}</TableCell>
                        <TableCell className="text-red-500">{resultado.erro}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}

            <div className="flex justify-end">
              <Button onClick={handleClose}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
