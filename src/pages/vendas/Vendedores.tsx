import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, TrendingUp, Target, ChevronRight, History, Plus, Shield } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useVendedores, useVendedoresContagem } from '@/hooks/useVendedores';
import { useVendedoresRisco } from '@/hooks/useAuditoriaVendedores';
import { Skeleton } from '@/components/ui/skeleton';
import { VendedorRiskBadge } from '@/components/auditoria/VendedorRiskBadge';
import { useAuth } from '@/contexts/AuthContext';

export default function Vendedores() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { roles } = useAuth();

  const { data: vendedores = [], isLoading: loadingVendedores } = useVendedores();
  const { data: contagemLeads = {}, isLoading: loadingContagem } = useVendedoresContagem();
  const { data: vendedoresRisco = [] } = useVendedoresRisco();

  const isLoading = loadingVendedores || loadingContagem;
  
  // Check if user can access audit via dynamic permissions
  const { hasPerm } = usePermissions();
  const canAccessAudit = hasPerm('canViewAudit');

  // Filtrar vendedores
  const filteredVendedores = useMemo(() => {
    if (!search) return vendedores;

    const searchLower = search.toLowerCase();
    return vendedores.filter(
      (v) => v.nome?.toLowerCase().includes(searchLower)
    );
  }, [vendedores, search]);

  // Estatísticas gerais
  const stats = useMemo(() => {
    const totalVendedores = vendedores.length;
    const totalLeads = Object.values(contagemLeads).reduce((acc, c) => acc + c.total, 0);
    const totalGanhos = Object.values(contagemLeads).reduce((acc, c) => acc + c.ganhos, 0);
    const taxaConversao = totalLeads > 0 ? ((totalGanhos / totalLeads) * 100).toFixed(1) : '0';

    return { totalVendedores, totalLeads, totalGanhos, taxaConversao };
  }, [vendedores, contagemLeads]);

  const handleVerHistorico = (vendedorId: string) => {
    navigate(`/vendas/vendedores/${vendedorId}`);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="shrink-0 z-10 bg-gradient-to-b from-muted/50 to-background border-b border-border/50">
        <div className="px-6 py-6 space-y-6">
          {/* Title */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Histórico de Vendedores</h1>
              <p className="text-muted-foreground">
                Acompanhe o desempenho e histórico de cada vendedor
              </p>
            </div>
            <div className="flex gap-2">
              {canAccessAudit && (
                <Button variant="outline" onClick={() => navigate('/auditoria/vendedores')}>
                  <Shield className="w-4 h-4 mr-2" />
                  Auditoria
                </Button>
              )}
              <Button onClick={() => navigate('/configuracoes/usuarios/novo?perfil=vendedor_clt')}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Vendedor
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Vendedores</p>
                    <p className="text-2xl font-bold">{stats.totalVendedores}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Target className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Leads</p>
                    <p className="text-2xl font-bold">{stats.totalLeads}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Conversões</p>
                    <p className="text-2xl font-bold">{stats.totalGanhos}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <TrendingUp className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Taxa Conversão</p>
                    <p className="text-2xl font-bold">{stats.taxaConversao}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto px-6 py-5">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : filteredVendedores.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">Nenhum vendedor encontrado</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {search
                ? 'Tente ajustar a busca'
                : 'Nenhum vendedor cadastrado'}
            </p>
          </div>
        ) : (
          <Card className="border-border/50">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Vendedor</TableHead>
                  {canAccessAudit && <TableHead className="text-center">Status</TableHead>}
                  <TableHead className="text-center">Leads</TableHead>
                  <TableHead className="text-center">Em Andamento</TableHead>
                  <TableHead className="text-center">Ganhos</TableHead>
                  <TableHead className="text-center">Perdidos</TableHead>
                  <TableHead className="text-center">Conversão</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVendedores.map((vendedor) => {
                  const contagem = contagemLeads[vendedor.user_id] || {
                    total: 0,
                    novos: 0,
                    emContato: 0,
                    cotacao: 0,
                    negociacao: 0,
                    ganhos: 0,
                    perdidos: 0,
                  };
                  const emAndamento = contagem.novos + contagem.emContato + contagem.cotacao + contagem.negociacao;
                  const taxaConv = contagem.total > 0 
                    ? ((contagem.ganhos / contagem.total) * 100).toFixed(0) 
                    : '0';
                  
                  // Find monitoring status
                  const monitoramento = vendedoresRisco.find(
                    (v: any) => v.vendedor_id === vendedor.user_id
                  );

                  return (
                    <TableRow key={vendedor.id} className="group">
                      <TableCell>
                        <div>
                          <p className="font-medium">{vendedor.nome}</p>
                          {vendedor.telefone && (
                            <p className="text-xs text-muted-foreground">{vendedor.telefone}</p>
                          )}
                        </div>
                      </TableCell>
                      {canAccessAudit && (
                        <TableCell className="text-center">
                          <VendedorRiskBadge 
                            status={monitoramento?.status_monitoramento || 'normal'} 
                            scoreRisco={monitoramento?.score_risco_acumulado}
                            compact
                          />
                        </TableCell>
                      )}
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-mono">
                          {contagem.total}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-blue-600 dark:text-blue-400 font-medium">
                          {emAndamento}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-green-600 dark:text-green-400 font-medium">
                          {contagem.ganhos}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-red-600 dark:text-red-400 font-medium">
                          {contagem.perdidos}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant="secondary"
                          className={
                            Number(taxaConv) >= 30 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : Number(taxaConv) >= 15
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                              : 'bg-muted'
                          }
                        >
                          {taxaConv}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleVerHistorico(vendedor.user_id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <History className="h-4 w-4 mr-1" />
                          Ver Histórico
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
