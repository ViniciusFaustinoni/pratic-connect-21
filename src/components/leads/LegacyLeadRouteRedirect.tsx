import { useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useLeadModals } from '@/contexts/LeadModalsContext';
import { Loader2 } from 'lucide-react';

interface LegacyLeadRouteRedirectProps {
  edit?: boolean;
}

/**
 * Backward-compat shim for the removed routes:
 *   /vendas/leads/:id        → opens detail modal on /vendas/leads
 *   /vendas/leads/:id/editar → opens detail + edit modal on /vendas/leads
 */
export function LegacyLeadRouteRedirect({ edit = false }: LegacyLeadRouteRedirectProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { openLeadDetail, openLeadEdit } = useLeadModals();

  useEffect(() => {
    if (!id) {
      navigate('/vendas/leads', { replace: true });
      return;
    }
    openLeadDetail(id);
    if (edit) openLeadEdit(id);
    navigate('/vendas/leads', { replace: true });
  }, [id, edit, openLeadDetail, openLeadEdit, navigate, location.pathname]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
