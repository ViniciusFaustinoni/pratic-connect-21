import { LeadDetailModal } from '@/components/leads/LeadDetailModal';
import { LeadEditarModal } from '@/components/leads/LeadEditarModal';
import { useLeadModals } from '@/contexts/LeadModalsContext';

/**
 * Renders the global lead detail/edit modals controlled by LeadModalsContext.
 * Mount once near the top of the authenticated tree.
 */
export function LeadModalsHost() {
  const { detailLeadId, editLeadId, closeLeadDetail, closeLeadEdit } = useLeadModals();

  return (
    <>
      <LeadDetailModal
        leadId={detailLeadId}
        open={!!detailLeadId}
        onClose={closeLeadDetail}
      />
      <LeadEditarModal
        leadId={editLeadId}
        open={!!editLeadId}
        onClose={closeLeadEdit}
      />
    </>
  );
}
