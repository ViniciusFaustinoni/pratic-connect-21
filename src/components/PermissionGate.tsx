import { ReactNode } from 'react';
import { usePermissions, PermissionKey, CotacaoPermissions } from '@/hooks/usePermissions';

type NestedPermissionPath = 
  | PermissionKey 
  | `cotacao.${keyof CotacaoPermissions}`;

interface PermissionGateProps {
  children: ReactNode;
  /** 
   * Caminho da permissão usando dot notation
   * Exemplos: "canManageUsers", "cotacao.canCreate", "isDiretor"
   */
  permission: NestedPermissionPath | NestedPermissionPath[];
  /** 
   * Modo de verificação quando permission é array
   * 'all' = todas devem ser true (AND)
   * 'any' = pelo menos uma deve ser true (OR)
   * @default 'all'
   */
  mode?: 'all' | 'any';
  /** Conteúdo alternativo quando não tem permissão */
  fallback?: ReactNode;
  /** Inverter a lógica (mostrar quando NÃO tem permissão) */
  invert?: boolean;
}

export function PermissionGate({ 
  children, 
  permission, 
  mode = 'all',
  fallback = null,
  invert = false,
}: PermissionGateProps) {
  const permissions = usePermissions();
  
  // Função para navegar no objeto de permissões usando dot notation
  const getPermissionValue = (path: string): boolean => {
    const value = path.split('.').reduce((obj: any, key: string) => {
      return obj?.[key];
    }, permissions);
    
    return Boolean(value);
  };
  
  // Verificar permissão(ões)
  let hasPermission: boolean;
  
  if (Array.isArray(permission)) {
    hasPermission = mode === 'all'
      ? permission.every(getPermissionValue)
      : permission.some(getPermissionValue);
  } else {
    hasPermission = getPermissionValue(permission);
  }
  
  // Aplicar inversão se necessário
  if (invert) {
    hasPermission = !hasPermission;
  }
  
  if (!hasPermission) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}
