import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, TrendingUp, Target, Filter, ChevronRight, History } from 'lucide-react';
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
import { useConsultores, useConsultoresContagem } from '@/hooks/useConsultores';
import { Skeleton } from '@/components/ui/skeleton';

export default function Consultores() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data: consultores = [], isLoading: loadingConsultores } = useConsultores();
  const { data: contagemLeads = {}, isLoading: loadingContagem } = useConsultoresContagem();

  const isLoading = loadingConsultores || loadingContagem;

  // Filtrar consultores
  const filteredConsultores = useMemo(() => {
    if (!search) return consultores;

    const searchLower = search.toLowerCase();
    return consultores.filter(
      (c) => c.nome?.toLowerCase().includes(searchLower)
    );
  }, [consultores, search]);

  // Estatísticas gerais
  const stats = useMemo(() => {
    const totalConsultores = consultores.length;
    const totalLeads = Object.values(contagemLeads).reduce((acc, c) => acc + c.total, 0);
    const totalGanhos = Object.values(contagemLeads).reduce((acc, c) => acc + c.ganhos, 0);
    const taxaConversao = totalLeads > 0 ? ((totalGanhos / totalLeads) * 100).toFixed(1) : '0';

    return { totalConsultores, totalLeads, totalGanhos, taxaConversao };
  }, [consultores, contagemLeads]);

  const handleVerHistorico = (consultorId: string) => {
    navigate(`/vendas/consultores/${consultorId}`);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="shrink-0 z-10 bg-gradient-to-b from-muted/50 to-background border-b border-border/50">
        <div className="px-6 py-6 space-y-6">
          {/* Title */}
          <div>
            <h1 className="text-2xl font-bold text-foreground">Histórico de Consultores</h1>
            <p className="text-muted-foreground">
              Acompanhe o desempenho e histórico de cada consultor
            </p>
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
                    <p className="text-sm text-muted-foreground">Total Consultores</p>
                    <p className="text-2xl font-bold">{stats.totalConsultores}</p>
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
        ) : filteredConsultores.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">Nenhum consultor encontrado</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {search
                ? 'Tente ajustar a busca'
                : 'Nenhum consultor cadastrado'}
            </p>
          </div>
        ) : (
          <Card className="border-border/50">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Consultor</TableHead>
                  <TableHead className="text-center">Leads</TableHead>
                  <TableHead className="text-center">Em Andamento</TableHead>
                  <TableHead className="text-center">Ganhos</TableHead>
                  <TableHead className="text-center">Perdidos</TableHead>
                  <TableHead className="text-center">Conversão</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConsultores.map((consultor) => {
                  const contagem = contagemLeads[consultor.id] || {
                    total: 0,
                    novos: 0,
                    emContato: 0,
                    cotacao: 0,
                    proposta: 0,
                    ganhos: 0,
                    perdidos: 0,
                  };
                  const emAndamento = contagem.novos + contagem.emContato + contagem.cotacao + contagem.proposta;
                  const taxaConv = contagem.total > 0 
                    ? ((contagem.ganhos / contagem.total) * 100).toFixed(0) 
                    : '0';

                  return (
                    <TableRow key={consultor.id} className="group">
                      <TableCell>
                        <div>
                          <p className="font-medium">{consultor.nome}</p>
                          {consultor.telefone && (
                            <p className="text-xs text-muted-foreground">{consultor.telefone}</p>
                          )}
                        </div>
                      </TableCell>
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
                          onClick={() => handleVerHistorico(consultor.id)}
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
