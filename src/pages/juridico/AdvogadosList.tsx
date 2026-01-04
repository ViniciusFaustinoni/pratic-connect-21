import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  User, Briefcase, Building2, Plus, Phone, Mail, 
  Edit, Eye, Scale, Search 
} from 'lucide-react';

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
  TipoAdvogado 
} from '@/types/juridico';

interface AdvogadosFilters {
  busca: string;
  tipo: 'todos' | TipoAdvogado;
  apenasAtivos: boolean;
}

export default function AdvogadosList() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<AdvogadosFilters>({
    busca: '',
    tipo: 'todos',
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

  const advogadosFiltrados = useMemo(() => {
    if (!filters.busca) return advogados;
    
    const termo = filters.busca.toLowerCase();
    return advogados.filter(adv => 
      adv.nome.toLowerCase().includes(termo) ||
      adv.oab?.toLowerCase().includes(termo) ||
      adv.email?.toLowerCase().includes(termo)
    );
  }, [advogados, filters.busca]);

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
        <div className="flex gap-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-32" />
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

                  {/* Processos Ativos */}
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold">{qtdProcessos}</p>
                    <p className="text-sm text-muted-foreground">Processos ativos</p>
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
