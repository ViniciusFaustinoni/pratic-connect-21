import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Settings } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

const pathLabels: Record<string, string> = {
  'meu-perfil': 'Meu Perfil',
  'seguranca': 'Segurança',
  'notificacoes': 'Notificações',
  'usuarios': 'Usuários',
  'novo': 'Novo',
  'perfis': 'Perfis e Permissões',
  'logs': 'Logs de Auditoria',
  'empresa': 'Empresa',
  'integracoes': 'Integrações',
  'sistema': 'Sistema',
};

export function ConfiguracoesBreadcrumb() {
  const location = useLocation();
  const pathParts = location.pathname.split('/').filter(Boolean);
  
  // Skip first part (configuracoes) and build breadcrumb
  const breadcrumbParts = pathParts.slice(1);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/configuracoes" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
              <Settings className="h-3.5 w-3.5" />
              <span>Configurações</span>
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        
        {breadcrumbParts.map((part, index) => {
          const isLast = index === breadcrumbParts.length - 1;
          const path = `/configuracoes/${breadcrumbParts.slice(0, index + 1).join('/')}`;
          const label = pathLabels[part] || part;
          
          // Skip UUID parts (they're usually IDs)
          if (part.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            return null;
          }

          return (
            <BreadcrumbItem key={path}>
              <BreadcrumbSeparator>
                <ChevronRight className="h-3.5 w-3.5" />
              </BreadcrumbSeparator>
              {isLast ? (
                <BreadcrumbPage className="font-medium">
                  {label}
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link to={path} className="text-muted-foreground hover:text-foreground transition-colors">
                    {label}
                  </Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
