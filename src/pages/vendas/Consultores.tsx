import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, TrendingUp, Target, Filter, ChevronRight, Phone, Mail } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useVendedores } from '@/hooks/useVendedores';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

// Contagem de leads por vendedor
function useLeadsContagem() {
  return useQuery({
    queryKey: ['leads-contagem-vendedor'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('vendedor_id, etapa')
        .not('vendedor_id', 'is', null);

      if (error) throw error;

      // Agrupar por vendedor
      const contagem: Record<string, {
        total: number;
        novos: number;
        emContato: number;
        cotacao: number;
        proposta: number;
        ganhos: number;
        perdidos: number;
      }> = {};

      data?.forEach((lead) => {
        if (!lead.vendedor_id) return;
        
        if (!contagem[lead.vendedor_id]) {
          contagem[lead.vendedor_id] = {
            total: 0,
            novos: 0,
            emContato: 0,
            cotacao: 0,
            proposta: 0,
            ganhos: 0,
            perdidos: 0,
          };
        }

        contagem[lead.vendedor_id].total++;

        switch (lead.etapa) {
          case 'novo':
            contagem[lead.vendedor_id].novos++;
            break;
          case 'contato':
          case 'qualificado':
            contagem[lead.vendedor_id].emContato++;
            break;
          case 'cotacao_enviada':
          case 'negociacao':
            contagem[lead.vendedor_id].cotacao++;
            break;
          case 'contrato_enviado':
          case 'contrato_assinado':
          case 'vistoria_agendada':
          case 'instalacao_agendada':
            contagem[lead.vendedor_id].proposta++;
            break;
          case 'ganho':
            contagem[lead.vendedor_id].ganhos++;
            break;
          case 'perdido':
            contagem[lead.vendedor_id].perdidos++;
            break;
        }
      });

      return contagem;
    },
  });
}

const ROLE_LABELS: Record<string, string> = {
  vendedor_clt: 'CLT',
  vendedor_externo: 'Externo',
  supervisor_vendas: 'Supervisor',
  gerente_comercial: 'Gerente',
  diretor: 'Diretor',
};

const ROLE_COLORS: Record<string, string> = {
  vendedor_clt: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  vendedor_externo: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  supervisor_vendas: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  gerente_comercial: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  diretor: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
};

export default function Consultores() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<string>('todos');

  const { data: vendedores = [], isLoading: loadingVendedores } = useVendedores();
  const { data: contagemLeads = {}, isLoading: loadingContagem } = useLeadsContagem();

  const isLoading = loadingVendedores || loadingContagem;

  // Filtrar vendedores
  const filteredVendedores = useMemo(() => {
    let result = vendedores;

    // Filtro por busca
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (v) =>
          v.nome?.toLowerCase().includes(searchLower) ||
          v.email?.toLowerCase().includes(searchLower)
      );
    }

    // Filtro por role
    if (filterRole !== 'todos') {
      result = result.filter((v) => v.roles?.includes(filterRole));
    }

    return result;
  }, [vendedores, search, filterRole]);

  // Estatísticas gerais
  const stats = useMemo(() => {
    const totalVendedores = vendedores.length;
    const totalLeads = Object.values(contagemLeads).reduce((acc, c) => acc + c.total, 0);
    const totalGanhos = Object.values(contagemLeads).reduce((acc, c) => acc + c.ganhos, 0);
    const taxaConversao = totalLeads > 0 ? ((totalGanhos / totalLeads) * 100).toFixed(1) : '0';

    return { totalVendedores, totalLeads, totalGanhos, taxaConversao };
  }, [vendedores, contagemLeads]);

  const getInitials = (nome: string) => {
    return nome
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const handleVerLeads = (vendedorId: string) => {
    // Navegar para leads filtrado por este vendedor
    navigate(`/vendas/leads?vendedor=${vendedorId}`);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="shrink-0 z-10 bg-gradient-to-b from-muted/50 to-background border-b border-border/50">
        <div className="px-6 py-6 space-y-6">
          {/* Title */}
          <div>
            <h1 className="text-2xl font-bold text-foreground">Consultores</h1>
            <p className="text-muted-foreground">
              Gerencie sua equipe de vendas e acompanhe o desempenho
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
                placeholder="Buscar por nome ou email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="vendedor_clt">CLT</SelectItem>
                <SelectItem value="vendedor_externo">Externo</SelectItem>
                <SelectItem value="supervisor_vendas">Supervisor</SelectItem>
                <SelectItem value="gerente_comercial">Gerente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto px-6 py-5">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : filteredVendedores.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">Nenhum consultor encontrado</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {search || filterRole !== 'todos'
                ? 'Tente ajustar os filtros'
                : 'Cadastre consultores no sistema'}
            </p>
          </div>
        ) : (
          <Card className="border-border/50">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Consultor</TableHead>
                  <TableHead>Tipo</TableHead>
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
                  const contagem = contagemLeads[vendedor.id] || {
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
                    <TableRow key={vendedor.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={vendedor.avatar_url || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {getInitials(vendedor.nome || 'U')}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{vendedor.nome}</p>
                            <p className="text-xs text-muted-foreground">{vendedor.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {vendedor.roles?.map((role) => (
                            <Badge
                              key={role}
                              variant="secondary"
                              className={ROLE_COLORS[role] || 'bg-muted'}
                            >
                              {ROLE_LABELS[role] || role}
                            </Badge>
                          ))}
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
                          onClick={() => handleVerLeads(vendedor.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Ver Leads
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
