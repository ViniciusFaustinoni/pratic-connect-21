import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

interface RouteConfig {
  label: string;
  resolver?: (id: string) => Promise<string>;
}

const ROUTE_CONFIG: Record<string, RouteConfig> = {
  '/dashboard': { label: 'Dashboard' },
  '/vendas': { label: 'Vendas' },
  '/vendas/dashboard': { label: 'Dashboard de Vendas' },
  '/vendas/leads': { label: 'Leads' },
  '/vendas/acompanhamento': { label: 'Acompanhamento' },
  '/vendas/cotacoes': { label: 'Cotador' },
  '/vendas/contratos': { label: 'Contratos' },
  '/vendas/metas': { label: 'Metas' },
  '/vendas/relatorios': { label: 'Relatórios' },
  '/cadastro': { label: 'Cadastro' },
  '/cadastro/associados': { label: 'Associados' },
  '/cadastro/veiculos': { label: 'Veículos' },
  '/cadastro/documentos': { label: 'Documentos' },
  '/monitoramento': { label: 'Monitoramento' },
  '/monitoramento/instalacoes': { label: 'Instalações' },
  '/monitoramento/rotas': { label: 'Rotas' },
  '/monitoramento/estoque': { label: 'Estoque' },
  '/monitoramento/rastreadores': { label: 'Rastreadores' },
  '/configuracoes': { label: 'Configurações' },
};

// Rotas com IDs dinâmicos
const DYNAMIC_ROUTES: Record<string, RouteConfig> = {
  '/vendas/leads/:id': {
    label: 'Lead',
    resolver: async (id: string) => {
      const { data } = await supabase.from('leads').select('nome').eq('id', id).single();
      return data?.nome || 'Lead';
    },
  },
  '/cadastro/associados/:id': {
    label: 'Associado',
    resolver: async (id: string) => {
      const { data } = await supabase.from('associados').select('nome').eq('id', id).single();
      return data?.nome || 'Associado';
    },
  },
};

// Verifica se uma string é um UUID válido
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Hook para resolver nome de entidade por ID
function useEntityName(path: string, id: string | null) {
  return useQuery({
    queryKey: ['breadcrumb-entity', path, id],
    queryFn: async () => {
      if (!id) return null;
      
      // Encontrar configuração de rota dinâmica correspondente
      for (const [pattern, config] of Object.entries(DYNAMIC_ROUTES)) {
        const basePath = pattern.replace('/:id', '');
        if (path.startsWith(basePath) && config.resolver) {
          return await config.resolver(id);
        }
      }
      return null;
    },
    enabled: !!id && isUUID(id),
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
  });
}

interface BreadcrumbItemProps {
  path: string;
  segment: string;
  isLast: boolean;
  previousPath: string;
}

function BreadcrumbItem({ path, segment, isLast, previousPath }: BreadcrumbItemProps) {
  const isId = isUUID(segment);
  const { data: entityName, isLoading } = useEntityName(previousPath, isId ? segment : null);

  // Determinar o label
  let label: string;
  if (isId && entityName) {
    label = entityName;
  } else if (isId && isLoading) {
    return (
      <div className="flex items-center gap-1">
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <Skeleton className="h-4 w-20" />
      </div>
    );
  } else if (isId) {
    label = 'Detalhes';
  } else {
    label = ROUTE_CONFIG[path]?.label || segment.charAt(0).toUpperCase() + segment.slice(1);
  }

  return (
    <div className="flex items-center gap-1">
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
      {isLast ? (
        <span className="font-medium text-foreground">{label}</span>
      ) : (
        <Link
          to={path}
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          {label}
        </Link>
      )}
    </div>
  );
}

export function GlobalBreadcrumb() {
  const location = useLocation();
  const pathParts = location.pathname.split('/').filter(Boolean);

  if (pathParts.length === 0) return null;

  return (
    <nav className="flex items-center gap-1 text-sm" aria-label="Breadcrumb">
      <Link
        to="/dashboard"
        className="flex items-center text-muted-foreground transition-colors hover:text-foreground"
      >
        <Home className="h-4 w-4" />
      </Link>

      {pathParts.map((segment, index) => {
        const path = '/' + pathParts.slice(0, index + 1).join('/');
        const previousPath = '/' + pathParts.slice(0, index).join('/');
        const isLast = index === pathParts.length - 1;

        return (
          <BreadcrumbItem
            key={path}
            path={path}
            segment={segment}
            isLast={isLast}
            previousPath={previousPath}
          />
        );
      })}
    </nav>
  );
}
