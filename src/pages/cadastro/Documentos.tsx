import { useState } from 'react';
import { Search, FileCheck, Clock, CheckCircle, XCircle, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
import { STATUS_DOCUMENTO_LABELS, TIPO_DOCUMENTO_LABELS, type StatusDocumento, type TipoDocumento } from '@/types/database';

const mockDocumentos = [
  {
    id: '1',
    tipo: 'cnh' as TipoDocumento,
    associado_nome: 'João Silva',
    nome_arquivo: 'cnh_joao_silva.pdf',
    status: 'aprovado' as StatusDocumento,
    created_at: '2024-01-15T10:00:00',
    analista_nome: 'Ana Analista',
    data_analise: '2024-01-15T14:00:00',
  },
  {
    id: '2',
    tipo: 'crlv' as TipoDocumento,
    associado_nome: 'João Silva',
    nome_arquivo: 'crlv_abc1234.pdf',
    status: 'aprovado' as StatusDocumento,
    created_at: '2024-01-15T10:05:00',
    analista_nome: 'Ana Analista',
    data_analise: '2024-01-15T14:10:00',
  },
  {
    id: '3',
    tipo: 'cnh' as TipoDocumento,
    associado_nome: 'Maria Santos',
    nome_arquivo: 'cnh_maria.jpg',
    status: 'pendente' as StatusDocumento,
    created_at: '2024-01-14T16:00:00',
  },
  {
    id: '4',
    tipo: 'foto_frontal_veiculo' as TipoDocumento,
    associado_nome: 'Pedro Oliveira',
    nome_arquivo: 'frontal_ghi9012.jpg',
    status: 'em_analise' as StatusDocumento,
    created_at: '2024-01-13T09:00:00',
  },
  {
    id: '5',
    tipo: 'comprovante_residencia' as TipoDocumento,
    associado_nome: 'Ana Costa',
    nome_arquivo: 'conta_luz_ana.pdf',
    status: 'reprovado' as StatusDocumento,
    created_at: '2024-01-12T11:00:00',
    analista_nome: 'Carlos Analista',
    data_analise: '2024-01-12T15:00:00',
    motivo_reprovacao: 'Documento com data superior a 90 dias',
  },
];

const statusConfig: Record<StatusDocumento, { color: string; icon: typeof FileCheck }> = {
  pendente: { color: 'bg-yellow-500 text-white', icon: Clock },
  em_analise: { color: 'bg-blue-500 text-white', icon: Eye },
  aprovado: { color: 'bg-green-500 text-white', icon: CheckCircle },
  reprovado: { color: 'bg-destructive text-destructive-foreground', icon: XCircle },
};

export default function Documentos() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tipoFilter, setTipoFilter] = useState<string>('all');

  const filteredDocumentos = mockDocumentos.filter((doc) => {
    const matchesSearch =
      doc.associado_nome.toLowerCase().includes(search.toLowerCase()) ||
      doc.nome_arquivo.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    const matchesTipo = tipoFilter === 'all' || doc.tipo === tipoFilter;
    return matchesSearch && matchesStatus && matchesTipo;
  });

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Stats
  const stats = {
    total: mockDocumentos.length,
    pendentes: mockDocumentos.filter((d) => d.status === 'pendente').length,
    emAnalise: mockDocumentos.filter((d) => d.status === 'em_analise').length,
    aprovados: mockDocumentos.filter((d) => d.status === 'aprovado').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Documentos</h1>
        <p className="text-muted-foreground">
          Analise e gerencie documentos enviados pelos associados
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <FileCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-yellow-500/10 p-2">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pendentes}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/10 p-2">
                <Eye className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.emAnalise}</p>
                <p className="text-xs text-muted-foreground">Em Análise</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-500/10 p-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.aprovados}</p>
                <p className="text-xs text-muted-foreground">Aprovados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por associado ou arquivo..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Tipo de documento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(TIPO_DOCUMENTO_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(STATUS_DOCUMENTO_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Documento</TableHead>
                <TableHead>Associado</TableHead>
                <TableHead>Arquivo</TableHead>
                <TableHead>Enviado em</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocumentos.map((doc) => {
                const status = statusConfig[doc.status];
                return (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <Badge variant="outline">{TIPO_DOCUMENTO_LABELS[doc.tipo]}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                          {doc.associado_nome.charAt(0)}
                        </div>
                        <span>{doc.associado_nome}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {doc.nome_arquivo}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(doc.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge className={status.color}>
                        <status.icon className="mr-1 h-3 w-3" />
                        {STATUS_DOCUMENTO_LABELS[doc.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {(doc.status === 'pendente' || doc.status === 'em_analise') && (
                          <>
                            <Button variant="ghost" size="sm" className="text-green-600">
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-destructive">
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
