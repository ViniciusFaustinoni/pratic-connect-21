import { useEffect } from 'react';
import { toast } from 'sonner';
import { PartyPopper, FileCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SignedLead {
  id: string;
  nome: string;
  plano_escolhido_nome?: string | null;
  plano_escolhido_valor?: number | null;
}

interface LeadSignatureListenerProps {
  onSignature?: (lead: SignedLead) => void;
}

export function LeadSignatureListener({ onSignature }: LeadSignatureListenerProps) {
  useEffect(() => {
    // Subscribe to leads table changes - specifically contrato_assinado updates
    const channel = supabase
      .channel('lead-signatures')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'leads',
          filter: 'etapa=eq.contrato_assinado',
        },
        (payload) => {
          const newLead = payload.new as SignedLead;
          const oldLead = payload.old as { etapa?: string };
          
          // Only show toast if the lead just changed TO contrato_assinado
          if (oldLead.etapa !== 'contrato_assinado') {
            showSignatureToast(newLead);
            onSignature?.(newLead);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onSignature]);

  return null;
}

function showSignatureToast(lead: SignedLead) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);

  toast.custom(
    (t) => (
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-4 rounded-lg shadow-xl max-w-md animate-in slide-in-from-top-5 duration-300">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
              <PartyPopper className="h-5 w-5" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <FileCheck className="h-4 w-4" />
              <span className="font-semibold">Proposta Assinada!</span>
            </div>
            <p className="text-sm text-white/90 mb-2">
              O lead <strong>{lead.nome}</strong> assinou a proposta
            </p>
            {lead.plano_escolhido_nome && (
              <div className="text-xs bg-white/10 rounded px-2 py-1 inline-flex items-center gap-2">
                <span>{lead.plano_escolhido_nome}</span>
                {lead.plano_escolhido_valor && (
                  <>
                    <span>•</span>
                    <span className="font-semibold">
                      {formatCurrency(lead.plano_escolhido_valor)}/mês
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    {
      duration: 8000,
      position: 'top-right',
    }
  );
}

// Export function to manually trigger the toast (useful for testing)
export { showSignatureToast };
