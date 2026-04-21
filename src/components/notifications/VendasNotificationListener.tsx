import { useNotificacoesVendasRealtime, useLeadsRealtime } from '@/hooks/useNotificacoesVendas';
import { usePermissions } from '@/hooks/usePermissions';

/**
 * Componente que escuta notificações de vendas + leads em tempo real.
 *
 * Fase 5: montado apenas nas rotas do módulo de vendas (não global no AppLayout/Dashboard).
 * Ainda assim, blinda por permissão para evitar canais realtime para perfis sem vínculo
 * com vendas que possam acessar essas rotas (ex.: financeiro/RH visitando).
 */
export function VendasNotificationListener() {
  const {
    isVendedor,
    isGerencia,
    isDiretor,
    isDesenvolvedor,
    isAdminMaster,
    isSupervisorVendas,
    isVendedorClt,
    isVendedorExterno,
    isAnalistaMarketing,
  } = usePermissions();

  const podeVerVendas =
    isVendedor ||
    isGerencia ||
    isDiretor ||
    isDesenvolvedor ||
    isAdminMaster ||
    isSupervisorVendas ||
    isVendedorClt ||
    isVendedorExterno ||
    isAnalistaMarketing;

  // Hooks devem ser chamados sempre na mesma ordem; gating interno por flag.
  useNotificacoesVendasRealtime(podeVerVendas);
  useLeadsRealtime(podeVerVendas);

  return null;
}
