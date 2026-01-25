import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import {
  Clock,
  Eye,
  CheckCircle,
  XCircle,
  Search,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { usePropostasPendentes, usePropostaStats } from '@/hooks/usePropostasPendentes';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// ============================================
// COMPONENTE: KPI Card
// ============================================
interface KPICardProps {
  titulo: string;
  valor: number;
  icon: React.ReactNode;
  cor: string;
  loading?: boolean;
}

function KPICard({ titulo, valor, icon, cor, loading }: KPICardProps) {
  if (loading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-24 bg-muted" />
              <Skeleton className="h-8 w-16 bg-muted" />
            </div>
            <Skeleton className="h-10 w-10 rounded bg-muted" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card hover:border-border-hover transition-all duration-200">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{titulo}</p>
            <p className="text-3xl font-bold text-foreground">{valor}</p>
          </div>
          <div className={cn("p-3 rounded-lg", cor)}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// COMPONENTE: Status Badge
// ============================================
interface StatusBadgeProps {
  status: string | null;
  associadoStatus?: string | null;
  temDocumentoPendente?: boolean;
}

function StatusBadge({ status, associadoStatus, temDocumentoPendente }: StatusBadgeProps) {
  // Verificar se está aguardando documentos do cliente
  const aguardandoDocumentoCliente = 
    (associadoStatus === 'documentacao_pendente' || temDocumentoPendente) && 
    status === 'assinado';

  if (aguardandoDocumentoCliente) {
    return (
      <Badge variant="secondary" className="bg-orange-500/20 text-orange-400 border-orange-500">
        Aguardando Documento (Cliente)
      </Badge>
    );
  }

  const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    assinado: { label: 'Aguardando Análise', variant: 'secondary' },
    em_analise: { label: 'Em Análise', variant: 'default' },
    pendente_vistoria: { label: 'Pendente de Vistoria', variant: 'outline' },
    ativo: { label: 'Aprovado', variant: 'default' },
    reprovado: { label: 'Reprovado', variant: 'destructive' },
  };

  const statusConfig = config[status || ''] || { label: status || 'Desconhecido', variant: 'outline' };

  return (
    <Badge variant={statusConfig.variant} className={cn(
      status === 'assinado' && 'bg-warning/20 text-warning-foreground border-warning',
      status === 'em_analise' && 'bg-info/20 text-info-foreground border-info',
      status === 'pendente_vistoria' && 'bg-violet-500/20 text-violet-400 border-violet-500',
      status === 'ativo' && 'bg-success/20 text-success-foreground border-success',
    )}>
      {statusConfig.label}
    </Badge>
  );
}

// ============================================
// FUNÇÃO: Mascarar CPF
// ============================================
function maskCPF(cpf: string | null): string {
  if (!cpf) return '---';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return cpf;
  return `***.${clean.slice(3, 6)}.***-${clean.slice(9)}`;
}

// ============================================
// FUNÇÃO: Formatar valor
// ============================================
function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return 'R$ ---';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function PropostasPendentes() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  const { data: propostas, isLoading: propostasLoading, refetch } = usePropostasPendentes();
  const { data: stats, isLoading: statsLoading } = usePropostaStats();

  // Filtrar propostas
  const propostasFiltradas = propostas?.filter((proposta) => {
    // Filtro de busca
    const searchLower = search.toLowerCase();
    const matchSearch =
      !search ||
      proposta.cliente_nome?.toLowerCase().includes(searchLower) ||
      proposta.cliente_cpf?.includes(search) ||
      proposta.veiculo_placa?.toLowerCase().includes(searchLower);

    // Filtro de status
    const matchStatus = statusFilter === 'todos' || proposta.status === statusFilter;

    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Propostas Pendentes</h1>
          <p className="text-muted-foreground">
            Contratos assinados aguardando análise e aprovação
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          titulo="Aguardando Análise"
          valor={stats?.aguardando || 0}
          icon={<Clock className="h-5 w-5 text-white" />}
          cor="bg-warning"
          loading={statsLoading}
        />
        <KPICard
          titulo="Em Análise"
          valor={stats?.emAnalise || 0}
          icon={<Eye className="h-5 w-5 text-white" />}
          cor="bg-info"
          loading={statsLoading}
        />
        <KPICard
          titulo="Aprovados Hoje"
          valor={stats?.aprovadosHoje || 0}
          icon={<CheckCircle className="h-5 w-5 text-white" />}
          cor="bg-success"
          loading={statsLoading}
        />
        <KPICard
          titulo="Reprovados Hoje"
          valor={stats?.reprovadosHoje || 0}
          icon={<XCircle className="h-5 w-5 text-white" />}
          cor="bg-destructive"
          loading={statsLoading}
        />
      </div>

      {/* FILTROS */}
      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CPF ou placa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-background border-border"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px] bg-background border-border">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="assinado">Aguardando Análise</SelectItem>
                <SelectItem value="pendente_vistoria">Pendente de Vistoria</SelectItem>
                <SelectItem value="em_analise">Em Análise</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* TABELA */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <FileText className="h-5 w-5 text-purple-500" />
            Propostas
          </CardTitle>
          <CardDescription>
            {propostasFiltradas?.length || 0} proposta(s) encontrada(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {propostasLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full bg-muted" />
              ))}
            </div>
          ) : !propostasFiltradas || propostasFiltradas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Nenhuma proposta pendente</p>
              <p className="text-sm">Todas as propostas foram analisadas.</p>
            </div>
          ) : (
            <div className="rounded-md border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="text-foreground">Cliente</TableHead>
                    <TableHead className="text-foreground">CPF</TableHead>
                    <TableHead className="text-foreground">Veículo</TableHead>
                    <TableHead className="text-foreground">Plano</TableHead>
                    <TableHead className="text-foreground">Valor</TableHead>
                    <TableHead className="text-foreground">Assinado em</TableHead>
                    <TableHead className="text-foreground">Status</TableHead>
                    <TableHead className="text-foreground text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {propostasFiltradas.map((proposta) => (
                    <TableRow
                      key={proposta.id}
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => navigate(`/cadastro/propostas/${proposta.id}`)}
                    >
                      <TableCell className="font-medium text-foreground">
                        {proposta.cliente_nome || proposta.associado?.nome || '---'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {maskCPF(proposta.cliente_cpf || proposta.associado?.cpf)}
                      </TableCell>
                      <TableCell>
                        <div className="text-foreground">
                          {proposta.veiculo_modelo || '---'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {proposta.veiculo_placa || '---'}
                        </div>
                      </TableCell>
                      <TableCell className="text-foreground">
                        {proposta.plano?.nome || proposta.plano_nome || '---'}
                      </TableCell>
                      <TableCell className="text-foreground font-medium">
                        {formatCurrency(proposta.valor_mensal)}
                      </TableCell>
                      <TableCell>
                        <div className="text-foreground">
                          {proposta.data_assinatura
                            ? format(new Date(proposta.data_assinatura), 'dd/MM/yyyy', { locale: ptBR })
                            : '---'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {proposta.data_assinatura
                            ? `há ${formatDistanceToNow(new Date(proposta.data_assinatura), { locale: ptBR })}`
                            : ''}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge 
                          status={proposta.status}
                          associadoStatus={proposta.associado_status}
                          temDocumentoPendente={proposta.tem_documento_pendente}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {proposta.tem_documento_pendente ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-muted-foreground/30"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/cadastro/propostas/${proposta.id}`);
                            }}
                          >
                            <Eye className="mr-1 h-4 w-4" />
                            Ver Detalhes
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/cadastro/propostas/${proposta.id}`);
                            }}
                          >
                            <Eye className="mr-1 h-4 w-4" />
                            Analisar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
