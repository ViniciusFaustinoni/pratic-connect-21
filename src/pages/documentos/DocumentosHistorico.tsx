import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, FileText, Calendar, FileSignature, Clock, MoreHorizontal, Download, Eye, RefreshCw, MessageSquare, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useDocumentoGerados, useEstatisticasDocumentos, DocumentoGeradoView } from '@/hooks/useDocumentoGerados';
import { useDocumentoStorage } from '@/hooks/useDocumentoStorage';

const categoriaCores: Record<string, string> = {
  'Contratos': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  'Termos': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  'Declarações': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  'Fichas': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  'Comunicados': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

export default function DocumentosHistorico() {
  const navigate = useNavigate();
  const [busca, setBusca] = useState('');
  const [periodo, setPeriodo] = useState('todos');
  const [categoria, setCategoria] = useState('todos');

  // Hooks de dados reais
  const { data: historico, isLoading } = useDocumentoGerados({ busca, periodo, categoria });
  const { data: estatisticas, isLoading: loadingStats } = useEstatisticasDocumentos();
  const { downloadDocumento, downloading } = useDocumentoStorage();

  // Ações
  const handleVerPDF = (arquivoUrl: string | null) => {
    if (!arquivoUrl) {
      toast.error('Arquivo não disponível');
      return;
    }
    window.open(arquivoUrl, '_blank');
  };

  const handleBaixar = async (arquivoUrl: string | null, nomeArquivo: string | null) => {
    if (!arquivoUrl) {
      toast.error('Arquivo não disponível');
      return;
    }
    
    try {
      // Extrair path do URL
      const urlParts = arquivoUrl.split('/documentos/');
      if (urlParts[1]) {
        await downloadDocumento(urlParts[1], nomeArquivo || 'documento.pdf');
      } else {
        // Fallback: abrir URL diretamente
        const link = document.createElement('a');
        link.href = arquivoUrl;
        link.download = nomeArquivo || 'documento.pdf';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      toast.error('Erro ao baixar documento');
    }
  };

  const handleReemitir = (item: DocumentoGeradoView) => {
    if (!item.template_id || !item.associado_id) {
      toast.error('Dados insuficientes para reemitir');
      return;
    }
    navigate(`/documentos/gerar?template=${item.template_id}&associado=${item.associado_id}`);
  };

  const handleEnviarWhatsApp = (item: DocumentoGeradoView) => {
    if (!item.arquivo_url) {
      toast.error('Arquivo não disponível');
      return;
    }
    // Copiar link para clipboard
    navigator.clipboard.writeText(item.arquivo_url);
    toast.success('Link copiado! Cole no WhatsApp para enviar.');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Histórico de Documentos</h1>
        <p className="text-muted-foreground">Documentos gerados pelo sistema</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por associado ou documento..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hoje">Hoje</SelectItem>
            <SelectItem value="7dias">Últimos 7 dias</SelectItem>
            <SelectItem value="30dias">Últimos 30 dias</SelectItem>
            <SelectItem value="mes">Este mês</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>

        <Select value={categoria} onValueChange={setCategoria}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas categorias</SelectItem>
            <SelectItem value="Contratos">Contratos</SelectItem>
            <SelectItem value="Termos">Termos</SelectItem>
            <SelectItem value="Declarações">Declarações</SelectItem>
            <SelectItem value="Fichas">Fichas</SelectItem>
            <SelectItem value="Comunicados">Comunicados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                {loadingStats ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-2xl font-bold">{estatisticas?.total || 0}</p>
                )}
                <p className="text-sm text-muted-foreground">Total gerados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
                <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                {loadingStats ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-2xl font-bold">{estatisticas?.esteMes || 0}</p>
                )}
                <p className="text-sm text-muted-foreground">Este mês</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                <FileSignature className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                {loadingStats ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-2xl font-bold">{estatisticas?.assinados || 0}</p>
                )}
                <p className="text-sm text-muted-foreground">Assinados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900">
                <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                {loadingStats ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-2xl font-bold">{estatisticas?.pendentes || 0}</p>
                )}
                <p className="text-sm text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Associado</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Gerado por</TableHead>
                  <TableHead>Assinatura</TableHead>
                  <TableHead className="w-[60px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!historico || historico.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhum documento encontrado</p>
                      <p className="text-sm">Gere documentos pela opção "Gerar Documento"</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  historico.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(item.gerado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-medium">
                        {item.associado?.nome || 'N/A'}
                      </TableCell>
                      <TableCell>{item.template?.nome || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="secondary" 
                          className={categoriaCores[item.template?.categoria?.nome || ''] || ''}
                        >
                          {item.template?.categoria?.nome || 'Sem categoria'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.gerado_por_profile?.nome || 'Sistema'}
                      </TableCell>
                      <TableCell>
                        {item.assinado ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 gap-1">
                            <Check className="h-3 w-3" />
                            Assinado
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-muted-foreground">
                            Pendente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              {downloading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleVerPDF(item.arquivo_url)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Ver PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleBaixar(item.arquivo_url, item.arquivo_nome)}>
                              <Download className="h-4 w-4 mr-2" />
                              Baixar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleReemitir(item)}>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Reemitir
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEnviarWhatsApp(item)}>
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Copiar link WhatsApp
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
