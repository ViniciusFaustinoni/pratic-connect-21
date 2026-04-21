import { useNotificacoesVendasRealtime, useLeadsRealtime } from '@/hooks/useNotificacoesVendas';
import { usePermissions } from '@/hooks/usePermissions';

/**
 * Componente que escuta notificações de vendas + leads em tempo real.
 *
 * Fase 5: montado apenas nas rotas do módulo de vendas (não global no AppLayout/Dashboard).
 * Ainda assim, blinda por permissão para evitar canais realtime para perfis sem vínculo
 * com vendas que possam acessar essas rotas (ex.: diretoria/admin observando).
 */
export function VendasNotificationListener() {
  const { isVendedor, isGerencia, isDiretor, isSuperAdmin, hasPermission } = usePermissions();

  const podeVerVendas =
    isVendedor ||
    isGerencia ||
    isDiretor ||
    isSuperAdmin ||
    hasPermission('isSupervisorVendas') ||
    hasPermission('isVendedorClt') ||
    hasPermission('isVendedorExterno');

  // Hooks devem ser chamados sempre na mesma ordem; gating interno por flag.
  useNotificacoesVendasRealtime(podeVerVendas);
  useLeadsRealtime(podeVerVendas);

  return null;
}
