import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  Building, MapPin, Star, TrendingUp, Phone, MessageCircle, 
  Eye, Plus, Search
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { OficinaFormDialog } from '@/components/oficinas/OficinaFormDialog';
import { OficinaDetailDrawer } from '@/components/oficinas/OficinaDetailDrawer';
import { 
  STATUS_OFICINA_LABELS, 
  STATUS_OFICINA_COLORS, 
  ESPECIALIDADES_OFICINA,
  ESPECIALIDADE_LABELS,
  type Oficina,
  type StatusOficina 
} from '@/types/database';

interface Filters {
  busca: string;
  cidade: string;
  especialidade: string;
  status: StatusOficina | 'todos';
}

export default function OficinasList() {
  const [filters, setFilters] = useState<Filters>({
    busca: '',
    cidade: '',
    especialidade: '',
    status: 'todos',
  });
  const [formOpen, setFormOpen] = useState(false);
  const [selectedOficina, setSelectedOficina] = useState<Oficina | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Buscar oficinas
  const { data: oficinas = [], isLoading } = useQuery({
    queryKey: ['oficinas', filters],
    queryFn: async () => {
      let query = supabase
        .from('oficinas')
        .select('*')
        .order('nome_fantasia', { ascending: true });

      if (filters.status && filters.status !== 'todos') {
        query = query.eq('status', filters.status);
      }
      if (filters.cidade) {
        query = query.ilike('cidade', `%${filters.cidade}%`);
      }
      if (filters.especialidade) {
        query = query.contains('especialidades', [filters.especialidade]);
      }
      if (filters.busca) {
        query = query.or(`nome_fantasia.ilike.%${filters.busca}%,razao_social.ilike.%${filters.busca}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Oficina[];
    },
  });

  // KPIs
  const kpis = useMemo(() => {
    const ativas = oficinas.filter((o) => o.status === 'ativo');
    const emSP = oficinas.filter((o) => o.estado === 'SP');
    const notaMedia = ativas.length > 0
      ? ativas.reduce((acc, o) => acc + (o.nota_media || 0), 0) / ativas.length
      : 0;
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const novasMes = oficinas.filter((o) => new Date(o.created_at!) >= inicioMes);
    
    return {
      totalAtivas: ativas.length,
      emSP: emSP.length,
      notaMedia: notaMedia.toFixed(1),
      novasMes: novasMes.length,
    };
  }, [oficinas]);

  // Cidades únicas para filtro
  const cidades = useMemo(() => {
    const set = new Set(oficinas.map((o) => o.cidade).filter(Boolean));
    return Array.from(set).sort();
  }, [oficinas]);

  const handleViewDetails = (oficina: Oficina) => {
    setSelectedOficina(oficina);
    setDrawerOpen(true);
  };

  const renderStars = (nota: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star
          key={i}
          className={`h-4 w-4 ${
            i <= nota ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'
          }`}
        />
      );
    }
    return stars;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/dashboard">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink>Oficina</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Credenciadas</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Oficinas Credenciadas</h1>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Oficina
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ativas</CardTitle>
            <Building className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.totalAtivas}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em São Paulo</CardTitle>
            <MapPin className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.emSP}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nota Média</CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.notaMedia}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Novas no Mês</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.novasMes}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={filters.busca}
            onChange={(e) => setFilters({ ...filters, busca: e.target.value })}
            className="pl-9"
          />
        </div>

        <Select
          value={filters.cidade || 'todas'}
          onValueChange={(v) => setFilters({ ...filters, cidade: v === 'todas' ? '' : v })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Cidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as cidades</SelectItem>
            {cidades.map((cidade) => (
              <SelectItem key={cidade} value={cidade}>
                {cidade}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.especialidade || 'todas'}
          onValueChange={(v) => setFilters({ ...filters, especialidade: v === 'todas' ? '' : v })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Especialidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            {ESPECIALIDADES_OFICINA.map((esp) => (
              <SelectItem key={esp} value={esp}>
                {ESPECIALIDADE_LABELS[esp]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status}
          onValueChange={(v) => setFilters({ ...filters, status: v as StatusOficina | 'todos' })}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="ativo">Ativas</SelectItem>
            <SelectItem value="inativo">Inativas</SelectItem>
            <SelectItem value="suspenso">Suspensas</SelectItem>
            <SelectItem value="bloqueado">Bloqueadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid de Cards */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : oficinas.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Nenhuma oficina encontrada
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {oficinas.map((oficina) => (
            <Card key={oficina.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="text-base line-clamp-1">
                      {oficina.nome_fantasia || oficina.razao_social}
                    </CardTitle>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {oficina.cidade}/{oficina.estado}
                    </div>
                  </div>
                  <Badge className={STATUS_OFICINA_COLORS[oficina.status]}>
                    {STATUS_OFICINA_LABELS[oficina.status]}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="flex-1 space-y-4">
                {/* Contatos */}
                <div className="flex gap-2">
                  {oficina.telefone && (
                    <a
                      href={`tel:${oficina.telefone}`}
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <Phone className="h-4 w-4" />
                      {oficina.telefone}
                    </a>
                  )}
                  {oficina.whatsapp && (
                    <a
                      href={`https://wa.me/55${oficina.whatsapp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 hover:text-green-700"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </a>
                  )}
                </div>

                {/* Especialidades */}
                {oficina.especialidades && oficina.especialidades.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {oficina.especialidades.slice(0, 3).map((esp) => (
                      <Badge key={esp} variant="secondary" className="text-xs">
                        {ESPECIALIDADE_LABELS[esp as keyof typeof ESPECIALIDADE_LABELS] || esp}
                      </Badge>
                    ))}
                    {oficina.especialidades.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{oficina.especialidades.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Nota */}
                <div className="flex items-center gap-1">
                  {renderStars(oficina.nota_media || 0)}
                  <span className="ml-1 text-sm text-muted-foreground">
                    ({oficina.total_avaliacoes || 0})
                  </span>
                </div>

                {/* Botão */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => handleViewDetails(oficina)}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Ver detalhes
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <OficinaFormDialog open={formOpen} onOpenChange={setFormOpen} />
      <OficinaDetailDrawer
        oficina={selectedOficina}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
