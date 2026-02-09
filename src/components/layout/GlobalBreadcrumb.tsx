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
  // Dashboard
  '/dashboard': { label: 'Dashboard' },
  
  // Vendas
  '/vendas': { label: 'Vendas' },
  '/vendas/dashboard': { label: 'Dashboard' },
  '/vendas/leads': { label: 'Leads' },
  '/vendas/vendedores': { label: 'Histórico de Vendedores' },
  '/vendas/acompanhamento': { label: 'Acompanhamento' },
  '/vendas/cotacoes': { label: 'Cotações' },
  '/vendas/contratos': { label: 'Contratos' },
  '/vendas/metas': { label: 'Metas' },
  '/vendas/relatorios': { label: 'Relatórios' },
  '/vendas/distribuicao': { label: 'Distribuição' },
  
  // Cadastro
  '/cadastro': { label: 'Cadastro' },
  '/cadastro/associados': { label: 'Associados' },
  '/cadastro/veiculos': { label: 'Veículos' },
  '/cadastro/documentos': { label: 'Documentos' },
  '/cadastro/fila-documentos': { label: 'Fila de Documentos' },
  
  // Eventos
  '/eventos': { label: 'Eventos' },
  '/eventos/dashboard': { label: 'Dashboard' },
  '/eventos/sinistros': { label: 'Sinistros' },
  
  // Assistência 24h
  '/assistencia': { label: 'Assistência 24h' },
  '/assistencia/dashboard': { label: 'Dashboard' },
  '/assistencia/chamados': { label: 'Chamados' },
  '/assistencia/prestadores': { label: 'Prestadores' },
  
  // Financeiro
  '/financeiro': { label: 'Financeiro' },
  '/financeiro/dashboard': { label: 'Dashboard' },
  '/financeiro/cobrancas': { label: 'Cobranças' },
  '/financeiro/faturamento': { label: 'Faturamento Mensal' },
  '/financeiro/contas-pagar': { label: 'Contas a Pagar' },
  '/financeiro/extrato': { label: 'Extrato' },
  '/financeiro/extratos-bancarios': { label: 'Extratos Bancários' },
  '/financeiro/contas-bancarias': { label: 'Contas Bancárias' },
  
  // Cobrança
  '/cobranca': { label: 'Cobrança' },
  '/cobranca/dashboard': { label: 'Dashboard' },
  '/cobranca/fila': { label: 'Fila de Trabalho' },
  '/cobranca/inadimplentes': { label: 'Inadimplentes' },
  '/cobranca/regua': { label: 'Régua de Cobrança' },
  '/cobranca/negativacao': { label: 'Negativação' },
  '/cobranca/acordos': { label: 'Acordos' },
  '/cobranca/acordos/novo': { label: 'Novo Acordo' },
  
  // Contabilidade
  '/contabilidade': { label: 'Contabilidade' },
  '/contabilidade/dashboard': { label: 'Dashboard' },
  '/contabilidade/plano-contas': { label: 'Plano de Contas' },
  '/contabilidade/lancamentos': { label: 'Lançamentos' },
  '/contabilidade/lancamentos/novo': { label: 'Novo Lançamento' },
  '/contabilidade/balancete': { label: 'Balancete' },
  '/contabilidade/dre': { label: 'DRE' },
  '/contabilidade/fechamentos': { label: 'Fechamentos' },
  '/contabilidade/razao': { label: 'Razão' },
  
  // Jurídico
  '/juridico': { label: 'Jurídico' },
  '/juridico/dashboard': { label: 'Dashboard' },
  '/juridico/processos': { label: 'Processos' },
  '/juridico/processos/novo': { label: 'Novo Processo' },
  '/juridico/prazos': { label: 'Prazos' },
  '/juridico/audiencias': { label: 'Audiências' },
  '/juridico/advogados': { label: 'Advogados' },
  '/juridico/consultas': { label: 'Consultas' },
  
  // RH
  '/rh': { label: 'RH' },
  '/rh/dashboard': { label: 'Dashboard' },
  '/rh/funcionarios': { label: 'Funcionários' },
  '/rh/funcionarios/novo': { label: 'Novo Funcionário' },
  '/rh/jornadas': { label: 'Jornadas' },
  '/rh/ponto': { label: 'Controle de Ponto' },
  '/rh/ferias': { label: 'Férias' },
  '/rh/organograma': { label: 'Organograma' },
  '/rh/departamentos': { label: 'Departamentos' },
  '/rh/beneficios': { label: 'Benefícios' },
  
  // Monitoramento
  '/monitoramento': { label: 'Monitoramento' },
  '/monitoramento/equipe': { label: 'Equipe' },
  '/monitoramento/instalacoes': { label: 'Instalações' },
  '/monitoramento/rotas': { label: 'Rotas' },
  '/monitoramento/estoque': { label: 'Estoque' },
  '/monitoramento/rastreadores': { label: 'Rastreadores' },
  '/monitoramento/retiradas': { label: 'Retiradas' },
  '/monitoramento/mapa': { label: 'Mapa' },
  '/monitoramento/config-plataformas': { label: 'Plataformas' },
  
  '/monitoramento/calendario': { label: 'Calendário' },
  
  // Marketing
  '/marketing': { label: 'Marketing' },
  '/marketing/dashboard': { label: 'Dashboard' },
  '/marketing/campanhas': { label: 'Campanhas' },
  '/marketing/campanhas/nova': { label: 'Nova Campanha' },
  '/marketing/canais': { label: 'Canais' },
  '/marketing/indicacoes': { label: 'Indicações' },
  '/marketing/utms': { label: 'UTMs' },
  '/marketing/relatorios': { label: 'Relatórios' },
  
  // Diretoria
  '/diretoria': { label: 'Diretoria' },
  '/diretoria/dashboard': { label: 'Dashboard' },
  '/diretoria/produtos': { label: 'Produtos' },
  '/diretoria/precos': { label: 'Tabela de Preços' },
  '/diretoria/rateios': { label: 'Rateios' },
  '/diretoria/indicadores': { label: 'Indicadores' },
  '/diretoria/configuracoes': { label: 'Configurações' },
  '/diretoria/perfis': { label: 'Perfis de Acesso' },
  '/diretoria/usuarios': { label: 'Usuários' },
  '/diretoria/logs': { label: 'Logs de Auditoria' },
  '/diretoria/relatorios': { label: 'Relatórios' },
  
  // Oficinas
  '/oficinas': { label: 'Oficinas' },
  '/oficinas/lista': { label: 'Lista' },
  '/oficinas/ordens': { label: 'Ordens de Serviço' },
  
  // Documentos
  '/documentos': { label: 'Documentos' },
  '/documentos/gerar': { label: 'Gerar Documento' },
  '/documentos/historico': { label: 'Histórico' },
  '/documentos/templates': { label: 'Templates' },
  '/documentos/templates/novo': { label: 'Novo Template' },
  
  // Configurações
  '/configuracoes': { label: 'Configurações' },
};

// Rotas com IDs dinâmicos
const DYNAMIC_ROUTES: Record<string, RouteConfig> = {
  // Vendas
  '/vendas/leads/:id': {
    label: 'Lead',
    resolver: async (id: string) => {
      const { data } = await supabase.from('leads').select('nome').eq('id', id).single();
      return data?.nome || 'Lead';
    },
  },
  '/vendas/vendedores/:id': {
    label: 'Vendedor',
    resolver: async (id: string) => {
      const { data } = await supabase.from('profiles').select('nome').eq('user_id', id).single();
      return data?.nome || 'Vendedor';
    },
  },
  '/vendas/cotacoes/:id': {
    label: 'Cotação',
    resolver: async (id: string) => `Cotação #${id.slice(0, 8)}`,
  },
  
  // Cadastro
  '/cadastro/associados/:id': {
    label: 'Associado',
    resolver: async (id: string) => {
      const { data } = await supabase.from('associados').select('nome').eq('id', id).single();
      return data?.nome || 'Associado';
    },
  },
  
  // Eventos
  '/eventos/sinistros/:id': {
    label: 'Sinistro',
    resolver: async (id: string) => {
      const { data } = await supabase.from('sinistros').select('protocolo').eq('id', id).single();
      return data?.protocolo || 'Sinistro';
    },
  },
  
  // Assistência
  '/assistencia/chamados/:id': {
    label: 'Chamado',
    resolver: async (id: string) => {
      const { data } = await supabase.from('chamados_assistencia').select('protocolo').eq('id', id).single();
      return data?.protocolo || 'Chamado';
    },
  },
  '/assistencia/prestadores/:id': {
    label: 'Prestador',
    resolver: async (id: string) => {
      const { data } = await supabase.from('prestadores_assistencia').select('razao_social').eq('id', id).single();
      return data?.razao_social || 'Prestador';
    },
  },
  
  // Financeiro
  '/financeiro/cobrancas/:id': {
    label: 'Cobrança',
    resolver: async (id: string) => `Cobrança #${id.slice(0, 8)}`,
  },
  '/financeiro/extratos/:id': {
    label: 'Extrato',
    resolver: async (id: string) => {
      const { data } = await supabase.from('extratos_bancarios').select('arquivo_nome').eq('id', id).single();
      return data?.arquivo_nome || 'Extrato';
    },
  },
  
  // Cobrança
  '/cobranca/inadimplentes/:id': {
    label: 'Inadimplente',
    resolver: async (id: string) => {
      const { data } = await supabase.from('associados').select('nome').eq('id', id).single();
      return data?.nome || 'Inadimplente';
    },
  },
  '/cobranca/acordos/:id': {
    label: 'Acordo',
    resolver: async (id: string) => `Acordo #${id.slice(0, 8)}`,
  },
  
  // Contabilidade
  '/contabilidade/lancamentos/:id': {
    label: 'Lançamento',
    resolver: async (id: string) => `Lançamento #${id.slice(0, 8)}`,
  },
  '/contabilidade/razao/:id': {
    label: 'Razão',
    resolver: async (id: string) => `Razão #${id.slice(0, 8)}`,
  },
  
  // Jurídico
  '/juridico/processos/:id': {
    label: 'Processo',
    resolver: async (id: string) => {
      const { data } = await supabase.from('processos').select('numero').eq('id', id).single();
      return data?.numero || 'Processo';
    },
  },
  
  // RH
  '/rh/funcionarios/:id': {
    label: 'Funcionário',
    resolver: async (id: string) => {
      const { data } = await supabase.from('funcionarios').select('nome_completo').eq('id', id).single();
      return data?.nome_completo || 'Funcionário';
    },
  },
  
  // Monitoramento
  '/monitoramento/instalacoes/:id': {
    label: 'Instalação',
    resolver: async (id: string) => `Instalação #${id.slice(0, 8)}`,
  },
  
  // Marketing
  '/marketing/campanhas/:id': {
    label: 'Campanha',
    resolver: async (id: string) => {
      const { data } = await supabase.from('campanhas').select('nome').eq('id', id).single();
      return data?.nome || 'Campanha';
    },
  },
  
  // Diretoria
  '/diretoria/produtos/:id': {
    label: 'Produto',
    resolver: async (id: string) => {
      const { data } = await supabase.from('planos').select('nome').eq('id', id).single();
      return data?.nome || 'Produto';
    },
  },
  '/diretoria/usuarios/:id': {
    label: 'Usuário',
    resolver: async (id: string) => {
      const { data } = await supabase.from('profiles').select('nome').eq('id', id).single();
      return data?.nome || 'Usuário';
    },
  },
  
  // Oficinas
  '/oficinas/ordens/:id': {
    label: 'OS',
    resolver: async (id: string) => {
      const { data } = await supabase.from('ordens_servico').select('numero').eq('id', id).single();
      return data?.numero ? `OS #${data.numero}` : 'Ordem de Serviço';
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
      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      {isLast ? (
        <span className="font-medium text-foreground truncate max-w-[200px]">{label}</span>
      ) : (
        <Link
          to={path}
          className="text-muted-foreground transition-colors hover:text-foreground truncate max-w-[150px]"
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
    <nav className="flex items-center gap-1 text-sm overflow-hidden whitespace-nowrap" aria-label="Breadcrumb">
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
