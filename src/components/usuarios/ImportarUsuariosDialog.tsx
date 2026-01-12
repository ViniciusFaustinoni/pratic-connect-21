import { useState, useCallback } from 'react';
import { Upload, Download, AlertCircle, CheckCircle2, X, FileSpreadsheet, Loader2, ClipboardPaste, Edit3 } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  perfil: string;
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
  { value: 'vendedor_clt', label: 'Vendedor CLT', shortLabel: 'CLT' },
  { value: 'vendedor_externo', label: 'Vendedor Externo', shortLabel: 'EXT' },
  { value: 'agencia', label: 'Agência', shortLabel: 'AGE' },
  { value: 'analista_cadastro', label: 'Analista Cadastro', shortLabel: 'CAD' },
  { value: 'instalador_vistoriador', label: 'Instalador/Vistoriador', shortLabel: 'INS' },
  { value: 'analista_marketing', label: 'Analista Marketing', shortLabel: 'MKT' },
];

// Palavras que indicam que é uma agência/empresa
const palavrasAgencia = [
  'LTDA', 'VEICULOS', 'VEÍCULOS', 'MOTORS', 'MOTOR\'S', 'CAR', 'AUTOMOVEIS', 
  'AUTOMÓVEIS', 'COMERCIO', 'COMÉRCIO', 'MOTOS', 'AUTO ', 'AUTOS', 'CARRO',
  'MULTIMARCAS', 'SEMINOVOS', 'CRM', 'POWERCRM', 'PRATIC '
];

function identificarTipo(nome: string): string {
  const upper = nome.toUpperCase();
  const isAgencia = palavrasAgencia.some(palavra => upper.includes(palavra));
  return isAgencia ? 'agencia' : 'vendedor_clt';
}

function gerarEmail(nome: string): string {
  // Remove acentos
  const semAcento = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Remove palavras comuns de empresas
  const limpo = semAcento
    .replace(/\bLTDA\b/gi, '')
    .replace(/\bME\b/gi, '')
    .replace(/\bEIRELI\b/gi, '')
    .replace(/\bS\/A\b/gi, '')
    .replace(/\bCOMERCIO\b/gi, '')
    .replace(/\bDE\b/gi, '')
    .replace(/\bDA\b/gi, '')
    .replace(/\bDO\b/gi, '')
    .replace(/\bDOS\b/gi, '')
    .replace(/\bDAS\b/gi, '')
    .trim();
  
  const partes = limpo.toLowerCase().split(/\s+/).filter(p => p.length > 0);
  
  if (partes.length === 0) return '';
  if (partes.length === 1) return `${partes[0]}@praticcar.org`;
  
  // Para pessoas: primeiro.ultimo@praticcar.org
  // Para empresas: juntotudo@praticcar.org
  const isEmpresa = palavrasAgencia.some(p => nome.toUpperCase().includes(p));
  
  if (isEmpresa) {
    return `${partes.join('')}@praticcar.org`;
  }
  
  return `${partes[0]}.${partes[partes.length - 1]}@praticcar.org`;
}

function gerarTelefone(index: number): string {
  return `21900${String(index + 1).padStart(6, '0')}`;
}

export function ImportarUsuariosDialog({ open, onOpenChange, onSuccess }: ImportarUsuariosDialogProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'result'>('upload');
  const [mode, setMode] = useState<'file' | 'paste'>('file');
  const [usuarios, setUsuarios] = useState<UsuarioImport[]>([]);
  const [perfilPadrao, setPerfilPadrao] = useState('vendedor_clt');
  const [progress, setProgress] = useState(0);
  const [resultados, setResultados] = useState<ImportResult[]>([]);
  const [totalSucesso, setTotalSucesso] = useState(0);
  const [totalErros, setTotalErros] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [listaNomes, setListaNomes] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const resetState = () => {
    setStep('upload');
    setUsuarios([]);
    setProgress(0);
    setResultados([]);
    setTotalSucesso(0);
    setTotalErros(0);
    setListaNomes('');
    setEditingIndex(null);
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

  const exportarLista = () => {
    const dadosExport = usuarios.map(u => ({
      nome: u.nome,
      telefone: u.telefone,
      email: u.email,
      senha: u.senha,
      tipo: perfisDisponiveis.find(p => p.value === u.perfil)?.label || u.perfil,
    }));
    const ws = XLSX.utils.json_to_sheet(dadosExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Usuarios');
    XLSX.writeFile(wb, 'lista-usuarios-gerada.xlsx');
    toast.success('Lista exportada com sucesso!');
  };

  const validateUsuario = (usuario: Partial<UsuarioImport>, allEmails: string[]): UsuarioImport => {
    const nome = usuario.nome?.toString().trim() || '';
    const telefone = usuario.telefone?.toString().trim() || '';
    const email = usuario.email?.toString().toLowerCase().trim() || '';
    const senha = usuario.senha?.toString().trim() || '';
    const perfil = usuario.perfil || perfilPadrao;
    
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
      erro = 'Email duplicado';
    } else if (!senha) {
      valido = false;
      erro = 'Senha vazia';
    } else if (senha.length < 6) {
      valido = false;
      erro = 'Senha curta';
    }

    return { nome, telefone, email, senha, perfil, valido, erro };
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

        const allEmails = jsonData.map((row: any) => 
          row.email?.toString().toLowerCase().trim() || ''
        );

        const usuariosValidados = jsonData.map((row: any) => 
          validateUsuario({ ...row, perfil: perfilPadrao }, allEmails)
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

  const processarListaNomes = () => {
    const nomes = listaNomes
      .split('\n')
      .map(n => n.trim())
      .filter(n => n.length > 0);

    if (nomes.length === 0) {
      toast.error('Cole pelo menos um nome na lista');
      return;
    }

    const senhaPadrao = 'Pratic2026!';
    
    const usuariosGerados = nomes.map((nome, idx) => ({
      nome,
      telefone: gerarTelefone(idx),
      email: gerarEmail(nome),
      senha: senhaPadrao,
      perfil: identificarTipo(nome),
    }));

    const allEmails = usuariosGerados.map(u => u.email);
    const usuariosValidados = usuariosGerados.map(u => validateUsuario(u, allEmails));

    setUsuarios(usuariosValidados);
    setStep('preview');
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

  const atualizarUsuario = (index: number, campo: keyof UsuarioImport, valor: string) => {
    setUsuarios(prev => {
      const novos = [...prev];
      novos[index] = { ...novos[index], [campo]: valor };
      
      // Revalidar
      const allEmails = novos.map(u => u.email);
      novos[index] = validateUsuario(novos[index], allEmails);
      
      return novos;
    });
  };

  const definirTipoTodos = (tipo: string) => {
    setUsuarios(prev => prev.map(u => ({ ...u, perfil: tipo })));
    toast.success(`Todos definidos como ${perfisDisponiveis.find(p => p.value === tipo)?.label}`);
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
            perfil: u.perfil,
          })),
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

  // Contagem por tipo
  const countByType = usuarios.reduce((acc, u) => {
    acc[u.perfil] = (acc[u.perfil] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Importar Usuários
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Faça upload de uma planilha ou cole uma lista de nomes'}
            {step === 'preview' && 'Revise e edite os dados antes de importar'}
            {step === 'importing' && 'Importando usuários...'}
            {step === 'result' && 'Resultado da importação'}
          </DialogDescription>
        </DialogHeader>

        {/* Step: Upload */}
        {step === 'upload' && (
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'file' | 'paste')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="file" className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload Planilha
              </TabsTrigger>
              <TabsTrigger value="paste" className="flex items-center gap-2">
                <ClipboardPaste className="w-4 h-4" />
                Colar Lista de Nomes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="space-y-4">
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
            </TabsContent>

            <TabsContent value="paste" className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Cole a lista de nomes (um por linha):</label>
                <Textarea
                  value={listaNomes}
                  onChange={(e) => setListaNomes(e.target.value)}
                  placeholder="ADRIANA DA SILVA LEANDRO&#10;ADRIANO DA SILVA VIEIRA&#10;AUTO RIO MOTORS LTDA&#10;..."
                  className="h-[200px] font-mono text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg text-sm">
                <div>
                  <p className="font-medium">Domínio do email:</p>
                  <p className="text-muted-foreground">@praticcar.org</p>
                </div>
                <div>
                  <p className="font-medium">Senha padrão:</p>
                  <p className="text-muted-foreground">Pratic2026!</p>
                </div>
                <div>
                  <p className="font-medium">Telefone:</p>
                  <p className="text-muted-foreground">21900000001, 002, ...</p>
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Empresas (LTDA, VEÍCULOS, MOTORS, etc.) serão identificadas automaticamente como <strong>Agência</strong>
                </AlertDescription>
              </Alert>

              <Button onClick={processarListaNomes} className="w-full" disabled={!listaNomes.trim()}>
                Gerar Lista ({listaNomes.split('\n').filter(n => n.trim()).length} nomes)
              </Button>
            </TabsContent>
          </Tabs>
        )}

        {/* Step: Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex gap-2 flex-wrap">
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
                {Object.entries(countByType).map(([tipo, count]) => (
                  <Badge key={tipo} variant="outline" className="bg-muted">
                    {perfisDisponiveis.find(p => p.value === tipo)?.shortLabel || tipo}: {count}
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Select onValueChange={definirTipoTodos}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Definir todos como" />
                  </SelectTrigger>
                  <SelectContent>
                    {perfisDisponiveis.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={exportarLista}>
                  <Download className="w-4 h-4 mr-1" />
                  Exportar
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[350px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead className="min-w-[180px]">Nome</TableHead>
                    <TableHead className="min-w-[120px]">Telefone</TableHead>
                    <TableHead className="min-w-[200px]">Email</TableHead>
                    <TableHead className="w-[100px]">Tipo</TableHead>
                    <TableHead className="w-20">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuarios.map((usuario, idx) => (
                    <TableRow key={idx} className={!usuario.valido ? 'bg-red-500/5' : ''}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell>
                        {editingIndex === idx ? (
                          <Input
                            value={usuario.nome}
                            onChange={(e) => atualizarUsuario(idx, 'nome', e.target.value)}
                            onBlur={() => setEditingIndex(null)}
                            autoFocus
                            className="h-8"
                          />
                        ) : (
                          <div 
                            className="cursor-pointer hover:bg-muted px-2 py-1 rounded flex items-center gap-1"
                            onClick={() => setEditingIndex(idx)}
                          >
                            {usuario.nome || <span className="text-muted-foreground">-</span>}
                            <Edit3 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          value={usuario.telefone}
                          onChange={(e) => atualizarUsuario(idx, 'telefone', e.target.value)}
                          className="h-8 w-[110px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={usuario.email}
                          onChange={(e) => atualizarUsuario(idx, 'email', e.target.value)}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Select 
                          value={usuario.perfil} 
                          onValueChange={(v) => atualizarUsuario(idx, 'perfil', v)}
                        >
                          <SelectTrigger className="h-8 w-[90px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {perfisDisponiveis.map(p => (
                              <SelectItem key={p.value} value={p.value}>
                                {p.shortLabel}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {usuario.valido ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-500">
                            OK
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-500/10 text-red-500 text-xs">
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
