import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  User, Briefcase, Building2, Plus, Phone, Mail, 
  Edit, Eye, Scale, Search, Users, BarChart3, Clock
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

import { supabase } from '@/integrations/supabase/client';
import { useAdvogados } from '@/hooks/useAdvogados';
import { 
  TIPO_ADVOGADO_LABELS, 
  ESPECIALIDADE_LABELS,
  ESPECIALIDADES_ADVOGADO,
  TipoAdvogado 
} from '@/types/juridico';

interface AdvogadosFilters {
  busca: string;
  tipo: 'todos' | TipoAdvogado;
  especialidade: string;
  apenasAtivos: boolean;
}

export default function AdvogadosList() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<AdvogadosFilters>({
    busca: '',
    tipo: 'todos',
    especialidade: 'todos',
    apenasAtivos: true,
  });

  const { advogados, isLoading } = useAdvogados({
    ativo: filters.apenasAtivos ? true : undefined,
    tipo: filters.tipo !== 'todos' ? filters.tipo : undefined,
  });

  const { data: contagemProcessos = {} } = useQuery({
    queryKey: ['advogados-processos-count'],
    queryFn: async () => {
      const { data } = await supabase
        .from('processos')
        .select('advogado_id')
        .eq('status', 'ativo');
      
      const contagem: Record<string, number> = {};
      data?.forEach(p => {
        if (p.advogado_id) {
          contagem[p.advogado_id] = (contagem[p.advogado_id] || 0) + 1;
        }
      });
      return contagem;
    }
  });

  // Pareceres do mês por advogado
  const { data: pareceresMap = {} } = useQuery({
    queryKey: ['advogados-pareceres-mes'],
    queryFn: async () => {
      const inicioMes = startOfMonth(new Date()).toISOString();
      const fimMes = endOfMonth(new Date()).toISOString();
      const { data } = await supabase
        .from('consultas_juridicas')
        .select('respondido_por')
        .gte('respondido_em', inicioMes)
        .lte('respondido_em', fimMes)
        .not('respondido_por', 'is', null);
      const map: Record<string, number> = {};
      data?.forEach(c => {
        if (c.respondido_por) map[c.respondido_por] = (map[c.respondido_por] || 0) + 1;
      });
      return map;
    }
  });

  // Próximo prazo por advogado
  const { data: proximoPrazoMap = {} } = useQuery({
    queryKey: ['advogados-proximo-prazo'],
    queryFn: async () => {
      const { data: processosData } = await supabase
        .from('processos')
        .select('id, advogado_id')
        .eq('status', 'ativo')
        .not('advogado_id', 'is', null);
      
      if (!processosData?.length) return {};

      const advProcessos: Record<string, string[]> = {};
      processosData.forEach(p => {
        if (p.advogado_id) {
          if (!advProcessos[p.advogado_id]) advProcessos[p.advogado_id] = [];
          advProcessos[p.advogado_id].push(p.id);
        }
      });

      const allIds = processosData.map(p => p.id);
      const { data: prazosData } = await supabase
        .from('processos_prazos')
        .select('processo_id, data_fim')
        .in('processo_id', allIds)
        .eq('status', 'pendente')
        .gte('data_fim', new Date().toISOString())
        .order('data_fim', { ascending: true });

      const map: Record<string, string> = {};
      Object.entries(advProcessos).forEach(([advId, pIds]) => {
        const prazo = prazosData?.find(pr => pIds.includes(pr.processo_id));
        if (prazo) map[advId] = prazo.data_fim;
      });
      return map;
    }
  });

  const advogadosFiltrados = useMemo(() => {
    let filtered = advogados;
    
    if (filters.busca) {
      const termo = filters.busca.toLowerCase();
      filtered = filtered.filter(adv => 
        adv.nome.toLowerCase().includes(termo) ||
        adv.oab?.toLowerCase().includes(termo) ||
        adv.email?.toLowerCase().includes(termo)
      );
    }

    if (filters.especialidade !== 'todos') {
      filtered = filtered.filter(adv => 
        adv.especialidades?.includes(filters.especialidade)
      );
    }
    
    return filtered;
  }, [advogados, filters.busca, filters.especialidade]);

  // KPI calculations
  const totalAtivos = advogados.filter(a => a.ativo).length;
  const internos = advogados.filter(a => a.tipo === 'interno' && a.ativo).length;
  const terceirizados = advogados.filter(a => (a.tipo === 'externo' || a.tipo === 'escritorio') && a.ativo).length;
  const totalProcessosAtivos = Object.values(contagemProcessos).reduce((s, v) => s + v, 0);
  const cargaMedia = totalAtivos > 0 ? (totalProcessosAtivos / totalAtivos).toFixed(1) : '0';

  const getTipoBadge = (tipo: TipoAdvogado) => {
    const colors: Record<TipoAdvogado, string> = {
      interno: 'bg-green-100 text-green-800',
      externo: 'bg-blue-100 text-blue-800',
      escritorio: 'bg-purple-100 text-purple-800',
    };
    return colors[tipo];
  };

  const getTipoIcon = (tipo: TipoAdvogado) => {
    const icons: Record<TipoAdvogado, React.ReactNode> = {
      interno: <User className="h-5 w-5" />,
      externo: <Briefcase className="h-5 w-5" />,
      escritorio: <Building2 className="h-5 w-5" />,
    };
    return icons[tipo];
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Advogados e Escritórios</h1>
          <p className="text-muted-foreground">
            {advogadosFiltrados.length} advogado(s) encontrado(s)
          </p>
        </div>
        <Button onClick={() => navigate('/juridico/advogados/novo')}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Advogado
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalAtivos}</p>
              <p className="text-xs text-muted-foreground">Total Ativos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100">
              <User className="h-5 w-5 text-green-700" />
            </div>
            <div>
              <p className="text-2xl font-bold">{internos}</p>
              <p className="text-xs text-muted-foreground">Internos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <Building2 className="h-5 w-5 text-purple-700" />
            </div>
            <div>
              <p className="text-2xl font-bold">{terceirizados}</p>
              <p className="text-xs text-muted-foreground">Terceirizados</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100">
              <BarChart3 className="h-5 w-5 text-orange-700" />
            </div>
            <div>
              <p className="text-2xl font-bold">{cargaMedia}</p>
              <p className="text-xs text-muted-foreground">Carga Média</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[250px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, OAB, email..."
            value={filters.busca}
            onChange={(e) => setFilters(f => ({ ...f, busca: e.target.value }))}
            className="pl-10"
          />
        </div>

        <Select
          value={filters.tipo}
          onValueChange={(v) => setFilters(f => ({ ...f, tipo: v as 'todos' | TipoAdvogado }))}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {Object.entries(TIPO_ADVOGADO_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.especialidade}
          onValueChange={(v) => setFilters(f => ({ ...f, especialidade: v }))}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Especialidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas especialidades</SelectItem>
            {ESPECIALIDADES_ADVOGADO.map((esp) => (
              <SelectItem key={esp} value={esp}>{ESPECIALIDADE_LABELS[esp]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Switch
            id="ativos"
            checked={filters.apenasAtivos}
            onCheckedChange={(c) => setFilters(f => ({ ...f, apenasAtivos: c }))}
          />
          <Label htmlFor="ativos">Apenas ativos</Label>
        </div>
      </div>

      {/* Grid de Cards */}
      {advogadosFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Scale className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Nenhum advogado cadastrado</h3>
          <p className="text-muted-foreground mb-4">
            Comece cadastrando o primeiro advogado ou escritório
          </p>
          <Button onClick={() => navigate('/juridico/advogados/novo')}>
            <Plus className="mr-2 h-4 w-4" />
            Cadastrar Advogado
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {advogadosFiltrados.map((advogado) => {
            const qtdProcessos = contagemProcessos[advogado.id] || 0;
            const especialidades = advogado.especialidades || [];
            const tipo = advogado.tipo as TipoAdvogado;
            const pareceresMes = pareceresMap[advogado.id] || 0;
            const proximoPrazo = proximoPrazoMap[advogado.id];
            const diasProximoPrazo = proximoPrazo ? differenceInDays(new Date(proximoPrazo), new Date()) : null;

            return (
              <Card key={advogado.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-4">
                  {/* Header do Card */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${getTipoBadge(tipo)}`}>
                        {getTipoIcon(tipo)}
                      </div>
                      <div>
                        <h3 className="font-semibold">{advogado.nome}</h3>
                        {advogado.oab && (
                          <p className="text-sm text-muted-foreground">
                            OAB {advogado.oab}/{advogado.oab_estado || '??'}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant={advogado.ativo ? 'default' : 'secondary'}>
                      {advogado.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>

                  {/* Tipo Badge */}
                  <Badge className={getTipoBadge(tipo)} variant="secondary">
                    {TIPO_ADVOGADO_LABELS[tipo]}
                  </Badge>

                  {/* Especialidades */}
                  {especialidades.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {especialidades.slice(0, 4).map((esp) => (
                        <Badge key={esp} variant="outline" className="text-xs">
                          {ESPECIALIDADE_LABELS[esp] || esp}
                        </Badge>
                      ))}
                      {especialidades.length > 4 && (
                        <Badge variant="outline" className="text-xs">
                          +{especialidades.length - 4}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-muted/50 rounded-lg p-2 text-center">
                      <p className={`text-lg font-bold ${qtdProcessos > 15 ? 'text-destructive' : ''}`}>{qtdProcessos}</p>
                      <p className="text-xs text-muted-foreground">Processos</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold">{pareceresMes}</p>
                      <p className="text-xs text-muted-foreground">Pareceres</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2 text-center">
                      {proximoPrazo ? (
                        <>
                          <p className={`text-lg font-bold ${diasProximoPrazo !== null && diasProximoPrazo <= 3 ? 'text-destructive' : ''}`}>
                            {diasProximoPrazo}d
                          </p>
                          <p className="text-xs text-muted-foreground">Prazo</p>
                        </>
                      ) : (
                        <>
                          <p className="text-lg font-bold">-</p>
                          <p className="text-xs text-muted-foreground">Prazo</p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Contato */}
                  <div className="space-y-1 text-sm">
                    {advogado.telefone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span>{advogado.telefone}</span>
                      </div>
                    )}
                    {advogado.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{advogado.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate(`/juridico/advogados/${advogado.id}`)}
                    >
                      <Eye className="mr-1 h-4 w-4" />
                      Ver
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate(`/juridico/advogados/${advogado.id}/editar`)}
                    >
                      <Edit className="mr-1 h-4 w-4" />
                      Editar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
