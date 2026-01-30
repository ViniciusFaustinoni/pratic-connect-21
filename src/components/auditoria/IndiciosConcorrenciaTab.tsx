import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Building2,
  AlertTriangle,
  Eye,
  Check,
  X,
  Clock,
  Mail,
  Search,
  Plus,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  useIndiciosConcorrencia,
  useVendedoresConflito,
  useConcorrenciaStats,
  useAnalisarIndicio,
  type IndiciosConcorrencia as IndicioType,
} from '@/hooks/useIndiciosConcorrencia';
import { CadastroAssociacoesModal } from './CadastroAssociacoesModal';
import { RiskScoreIndicator } from './VendedorRiskBadge';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/usePermissions';

const TIPO_INDICIO_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  email_corporativo: { label: 'Email Corporativo', icon: Mail, color: 'text-red-500' },
  padrao_multi_organizacao: { label: 'Multi-Organização', icon: Building2, color: 'text-orange-500' },
  horario_atipico: { label: 'Horário Atípico', icon: Clock, color: 'text-purple-500' },
  telefone_duplicado: { label: 'Telefone Duplicado', icon: AlertTriangle, color: 'text-amber-500' },
  cliente_migrado: { label: 'Cliente Migrado', icon: Building2, color: 'text-blue-500' },
};

export function IndiciosConcorrenciaTab() {
  const { isDiretor, isDesenvolvedor, isAdminMaster } = usePermissions();
  const canManageConcorrentes = isDiretor || isDesenvolvedor || isAdminMaster;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('pendente');
  const [showCadastroModal, setShowCadastroModal] = useState(false);
  const [selectedIndicio, setSelectedIndicio] = useState<IndicioType | null>(null);
  const [analiseObservacoes, setAnaliseObservacoes] = useState('');

  const { data: stats, isLoading: loadingStats } = useConcorrenciaStats();
  const { data: indicios = [], isLoading: loadingIndicios, refetch } = useIndiciosConcorrencia({
    status: statusFilter === 'todos' ? undefined : statusFilter,
  });
  const { data: vendedoresConflito = [], isLoading: loadingVendedores } = useVendedoresConflito();
  const analisarIndicio = useAnalisarIndicio();

  const handleAnalisar = async (status: 'analisado' | 'confirmado' | 'ignorado') => {
    if (!selectedIndicio) return;

    try {
      await analisarIndicio.mutateAsync({
        indicioId: selectedIndicio.id,
        status,
        observacoes: analiseObservacoes,
      });
      toast.success(`Indício ${status === 'confirmado' ? 'confirmado' : status === 'ignorado' ? 'ignorado' : 'analisado'} com sucesso!`);
      setSelectedIndicio(null);
      setAnaliseObservacoes('');
      refetch();
    } catch (error) {
      toast.error('Erro ao atualizar indício');
    }
  };

  const filteredIndicios = indicios.filter((indicio) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      indicio.vendedor?.nome?.toLowerCase().includes(searchLower) ||
      indicio.descricao?.toLowerCase().includes(searchLower) ||
      indicio.associacao_concorrente?.nome?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {loadingStats ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Building2 className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Indícios</p>
                  <p className="text-2xl font-bold">{stats?.totalIndicios || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                  <p className="text-2xl font-bold text-amber-600">{stats?.indiciosPendentes || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Confirmados</p>
                  <p className="text-2xl font-bold text-red-600">{stats?.indiciosConfirmados || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <Eye className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Vendedores</p>
                  <p className="text-2xl font-bold text-orange-600">{stats?.vendedoresComConflito || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="analisado">Analisado</SelectItem>
              <SelectItem value="confirmado">Confirmado</SelectItem>
              <SelectItem value="ignorado">Ignorado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {canManageConcorrentes && (
          <Button onClick={() => setShowCadastroModal(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Gerenciar Concorrentes
          </Button>
        )}
      </div>

      {/* Indicios Table */}
      {loadingIndicios ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : filteredIndicios.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">Nenhum indício encontrado</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {statusFilter === 'pendente'
                ? 'Não há indícios pendentes de análise'
                : 'Nenhum indício corresponde aos filtros'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Vendedor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Concorrente</TableHead>
                <TableHead className="text-center">Score</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredIndicios.map((indicio) => {
                const config = TIPO_INDICIO_CONFIG[indicio.tipo_indicio] || {
                  label: indicio.tipo_indicio,
                  icon: AlertTriangle,
                  color: 'text-muted-foreground',
                };
                const Icon = config.icon;

                return (
                  <TableRow key={indicio.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={indicio.vendedor?.avatar_url || undefined} />
                          <AvatarFallback>
                            {indicio.vendedor?.nome?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">
                          {indicio.vendedor?.nome || 'Desconhecido'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${config.color}`} />
                        <span className="text-sm">{config.label}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <span className="text-sm text-muted-foreground truncate block">
                        {indicio.descricao}
                      </span>
                    </TableCell>
                    <TableCell>
                      {indicio.associacao_concorrente ? (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                          {indicio.associacao_concorrente.nome}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <RiskScoreIndicator score={indicio.score_risco || 0} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(indicio.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          indicio.status === 'pendente'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                            : indicio.status === 'confirmado'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                            : indicio.status === 'analisado'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-muted'
                        }
                      >
                        {indicio.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedIndicio(indicio)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Analisar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Vendedores com Conflito */}
      {vendedoresConflito.length > 0 && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Vendedores com Conflitos Identificados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {vendedoresConflito.slice(0, 5).map((vendedor) => (
                <div
                  key={vendedor.vendedor_id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium">{vendedor.nome}</p>
                      <p className="text-sm text-muted-foreground">{vendedor.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium">{vendedor.total_indicios} indícios</p>
                      <p className="text-xs text-muted-foreground">
                        {vendedor.indicios_confirmados} confirmados
                      </p>
                    </div>
                    <RiskScoreIndicator score={vendedor.score_total} />
                    {vendedor.associacoes_envolvidas && vendedor.associacoes_envolvidas.length > 0 && (
                      <div className="flex gap-1">
                        {vendedor.associacoes_envolvidas.slice(0, 2).map((assoc, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {assoc}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal Análise */}
      <Dialog open={!!selectedIndicio} onOpenChange={(open) => !open && setSelectedIndicio(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Analisar Indício</DialogTitle>
            <DialogDescription>
              Revise os dados e defina o status deste indício de conflito de interesse.
            </DialogDescription>
          </DialogHeader>

          {selectedIndicio && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Vendedor:</span>
                  <span>{selectedIndicio.vendedor?.nome}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Tipo:</span>
                  <span>
                    {TIPO_INDICIO_CONFIG[selectedIndicio.tipo_indicio]?.label ||
                      selectedIndicio.tipo_indicio}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Score:</span>
                  <RiskScoreIndicator score={selectedIndicio.score_risco} />
                </div>
                {selectedIndicio.associacao_concorrente && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Concorrente:</span>
                    <Badge variant="outline">{selectedIndicio.associacao_concorrente.nome}</Badge>
                  </div>
                )}
              </div>

              <div>
                <Label>Descrição</Label>
                <p className="text-sm text-muted-foreground mt-1">{selectedIndicio.descricao}</p>
              </div>

              {selectedIndicio.dados_evidencia && (
                <div>
                  <Label>Evidências</Label>
                  <pre className="mt-1 p-3 rounded-lg bg-muted text-xs overflow-auto max-h-32">
                    {JSON.stringify(selectedIndicio.dados_evidencia, null, 2)}
                  </pre>
                </div>
              )}

              <div>
                <Label htmlFor="observacoes">Observações da Análise</Label>
                <Textarea
                  id="observacoes"
                  value={analiseObservacoes}
                  onChange={(e) => setAnaliseObservacoes(e.target.value)}
                  placeholder="Adicione observações sobre a análise..."
                  className="mt-1"
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleAnalisar('ignorado')}
              disabled={analisarIndicio.isPending}
            >
              <X className="h-4 w-4 mr-1" />
              Ignorar
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleAnalisar('analisado')}
              disabled={analisarIndicio.isPending}
            >
              <Eye className="h-4 w-4 mr-1" />
              Analisado
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleAnalisar('confirmado')}
              disabled={analisarIndicio.isPending}
            >
              <Check className="h-4 w-4 mr-1" />
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Cadastro Concorrentes */}
      <CadastroAssociacoesModal
        open={showCadastroModal}
        onOpenChange={setShowCadastroModal}
      />
    </div>
  );
}
