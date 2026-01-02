import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FileText, Calculator, Send, Check, X, Loader2 } from 'lucide-react';
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
import type { StatusCotacao } from '@/types/database';
import { useCotacoes, useUpdateCotacao } from '@/hooks/useCotacoes';
import { CotacaoFormDialog } from '@/components/cotacoes/CotacaoFormDialog';
import { ContratoWizard } from '@/components/contratos/ContratoWizard';
import { toast } from 'sonner';

const statusConfig: Record<StatusCotacao, { label: string; color: string; icon: typeof FileText }> = {
  rascunho: { label: 'Rascunho', color: 'bg-muted text-muted-foreground', icon: FileText },
  enviada: { label: 'Enviada', color: 'bg-primary text-primary-foreground', icon: Send },
  aceita: { label: 'Aceita', color: 'bg-green-500 text-white', icon: Check },
  recusada: { label: 'Recusada', color: 'bg-destructive text-destructive-foreground', icon: X },
  expirada: { label: 'Expirada', color: 'bg-muted text-muted-foreground', icon: FileText },
};

export default function Cotacoes() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCotacaoForm, setShowCotacaoForm] = useState(false);
  const [showContratoWizard, setShowContratoWizard] = useState(false);
  const [selectedCotacaoId, setSelectedCotacaoId] = useState<string>('');

  const { data: cotacoes, isLoading } = useCotacoes();
  const updateCotacao = useUpdateCotacao();

  const filteredCotacoes = (cotacoes || []).filter((cotacao) => {
    const matchesSearch =
      cotacao.numero.toLowerCase().includes(search.toLowerCase()) ||
      (cotacao.leads?.nome?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesStatus = statusFilter === 'all' || cotacao.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleMarkAsEnviada = async (id: string) => {
    try {
      await updateCotacao.mutateAsync({ id, status: 'enviada' });
      toast.success('Cotação marcada como enviada');
    } catch (error) {
      toast.error('Erro ao atualizar cotação');
    }
  };

  const handleOpenContratoWizard = (cotacaoId: string) => {
    setSelectedCotacaoId(cotacaoId);
    setShowContratoWizard(true);
  };

  // Stats
  const stats = {
    total: cotacoes?.length || 0,
    enviadas: cotacoes?.filter((c) => c.status === 'enviada').length || 0,
    aceitas: cotacoes?.filter((c) => c.status === 'aceita').length || 0,
    taxa: cotacoes && cotacoes.length > 0
      ? Math.round(
          (cotacoes.filter((c) => c.status === 'aceita').length /
            cotacoes.filter((c) => c.status !== 'rascunho').length) *
            100
        ) || 0
      : 0,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cotações</h1>
          <p className="text-muted-foreground">
            Gerencie cotações e acompanhe propostas enviadas
          </p>
        </div>
        <Button className="gap-2" onClick={() => setShowCotacaoForm(true)}>
          <Plus className="h-4 w-4" />
          Nova Cotação
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Calculator className="h-5 w-5 text-primary" />
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
              <div className="rounded-lg bg-blue-500/10 p-2">
                <Send className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.enviadas}</p>
                <p className="text-xs text-muted-foreground">Enviadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-500/10 p-2">
                <Check className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.aceitas}</p>
                <p className="text-xs text-muted-foreground">Aceitas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accent/10 p-2">
                <FileText className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.taxa}%</p>
                <p className="text-xs text-muted-foreground">Taxa Conversão</p>
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
            placeholder="Buscar por número ou cliente..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(statusConfig).map(([key, value]) => (
              <SelectItem key={key} value={key}>
                {value.label}
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
                <TableHead>Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Valor FIPE</TableHead>
                <TableHead>Mensal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-32">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCotacoes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhuma cotação encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredCotacoes.map((cotacao) => {
                  const status = statusConfig[cotacao.status];
                  return (
                    <TableRow 
                      key={cotacao.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/vendas/cotacoes/${cotacao.id}`)}
                    >
                      <TableCell className="font-mono text-sm">{cotacao.numero}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                            {cotacao.leads?.nome?.charAt(0) || '?'}
                          </div>
                          <span>{cotacao.leads?.nome || 'Cliente não informado'}</span>
                        </div>
                      </TableCell>
                      <TableCell>{cotacao.planos?.nome || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatCurrency(cotacao.valor_fipe)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(cotacao.valor_total_mensal)}
                      </TableCell>
                      <TableCell>
                        <Badge className={status.color}>
                          <status.icon className="mr-1 h-3 w-3" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(cotacao.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          {cotacao.status === 'rascunho' && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleMarkAsEnviada(cotacao.id)}
                            >
                              Enviar
                            </Button>
                          )}
                          {cotacao.status === 'enviada' && (
                            <Button 
                              size="sm"
                              onClick={() => handleOpenContratoWizard(cotacao.id)}
                            >
                              Aceitar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CotacaoFormDialog open={showCotacaoForm} onOpenChange={setShowCotacaoForm} />
      <ContratoWizard 
        open={showContratoWizard} 
        onOpenChange={setShowContratoWizard} 
        cotacaoId={selectedCotacaoId}
      />
    </div>
  );
}
