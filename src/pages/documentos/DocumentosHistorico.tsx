import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, FileText, Calendar, FileSignature, Clock, MoreHorizontal, Download, Eye, RefreshCw, MessageSquare, Check } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const mockHistorico = [
  { id: '1', data: '2026-01-16T14:30:00', associado: 'João da Silva', documento: 'Contrato de Filiação', categoria: 'Contratos', geradoPor: 'Carlos Vendedor', assinado: true },
  { id: '2', data: '2026-01-16T11:20:00', associado: 'Maria Santos', documento: 'Termo de Vistoria', categoria: 'Termos', geradoPor: 'Ana Analista', assinado: false },
  { id: '3', data: '2026-01-15T16:45:00', associado: 'Pedro Costa', documento: 'Declaração de Quitação', categoria: 'Declarações', geradoPor: 'Carlos Vendedor', assinado: false },
  { id: '4', data: '2026-01-15T09:10:00', associado: 'Ana Souza', documento: 'Ficha Cadastral', categoria: 'Fichas', geradoPor: 'Julia Cadastro', assinado: false },
  { id: '5', data: '2026-01-14T15:00:00', associado: 'Lucas Ferreira', documento: 'Contrato de Filiação', categoria: 'Contratos', geradoPor: 'Roberto Vendedor', assinado: true },
];

const mockEstatisticas = {
  total: 156,
  esteMes: 34,
  assinados: 89,
  pendentes: 12,
};

const categoriaCores: Record<string, string> = {
  'Contratos': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  'Termos': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  'Declarações': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  'Fichas': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  'Comunicados': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

export default function DocumentosHistorico() {
  const [busca, setBusca] = useState('');
  const [periodo, setPeriodo] = useState('todos');
  const [categoria, setCategoria] = useState('todos');

  const historicoFiltrado = mockHistorico.filter(item => {
    const matchBusca = busca === '' || 
      item.associado.toLowerCase().includes(busca.toLowerCase()) ||
      item.documento.toLowerCase().includes(busca.toLowerCase());
    
    const matchCategoria = categoria === 'todos' || item.categoria === categoria;
    
    return matchBusca && matchCategoria;
  });

  const handleAcao = (acao: string) => {
    toast.info(`${acao} - Em desenvolvimento`);
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
                <p className="text-2xl font-bold">{mockEstatisticas.total}</p>
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
                <p className="text-2xl font-bold">{mockEstatisticas.esteMes}</p>
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
                <p className="text-2xl font-bold">{mockEstatisticas.assinados}</p>
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
                <p className="text-2xl font-bold">{mockEstatisticas.pendentes}</p>
                <p className="text-sm text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
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
              {historicoFiltrado.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum documento encontrado
                  </TableCell>
                </TableRow>
              ) : (
                historicoFiltrado.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(item.data), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-medium">{item.associado}</TableCell>
                    <TableCell>{item.documento}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={categoriaCores[item.categoria] || ''}>
                        {item.categoria}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.geradoPor}</TableCell>
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
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleAcao('Ver PDF')}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAcao('Baixar')}>
                            <Download className="h-4 w-4 mr-2" />
                            Baixar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAcao('Reemitir')}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Reemitir
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAcao('Enviar por WhatsApp')}>
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Enviar por WhatsApp
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
