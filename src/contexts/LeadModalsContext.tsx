import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface LeadModalsState {
  detailLeadId: string | null;
  editLeadId: string | null;
  openLeadDetail: (leadId: string) => void;
  openLeadEdit: (leadId: string) => void;
  closeLeadDetail: () => void;
  closeLeadEdit: () => void;
  closeAll: () => void;
}

const LeadModalsContext = createContext<LeadModalsState | null>(null);

export function LeadModalsProvider({ children }: { children: ReactNode }) {
  const [detailLeadId, setDetailLeadId] = useState<string | null>(null);
  const [editLeadId, setEditLeadId] = useState<string | null>(null);

  const openLeadDetail = useCallback((leadId: string) => setDetailLeadId(leadId), []);
  const openLeadEdit = useCallback((leadId: string) => setEditLeadId(leadId), []);
  const closeLeadDetail = useCallback(() => setDetailLeadId(null), []);
  const closeLeadEdit = useCallback(() => setEditLeadId(null), []);
  const closeAll = useCallback(() => {
    setDetailLeadId(null);
    setEditLeadId(null);
  }, []);

  const value = useMemo<LeadModalsState>(
    () => ({
      detailLeadId,
      editLeadId,
      openLeadDetail,
      openLeadEdit,
      closeLeadDetail,
      closeLeadEdit,
      closeAll,
    }),
    [detailLeadId, editLeadId, openLeadDetail, openLeadEdit, closeLeadDetail, closeLeadEdit, closeAll]
  );

  return <LeadModalsContext.Provider value={value}>{children}</LeadModalsContext.Provider>;
}

export function useLeadModals() {
  const ctx = useContext(LeadModalsContext);
  if (!ctx) {
    throw new Error('useLeadModals must be used within a LeadModalsProvider');
  }
  return ctx;
}
