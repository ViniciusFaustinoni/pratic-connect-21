import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useNewLeadFlow } from '@/hooks/useNewLeadFlow';
import { UploadStep } from './new-lead-flow/UploadStep';
import { ProcessingStep } from './new-lead-flow/ProcessingStep';
import { ConfirmationStep } from './new-lead-flow/ConfirmationStep';
import { SuccessStep } from './new-lead-flow/SuccessStep';

interface NewLeadAdvancedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function NewLeadAdvancedModal({ open, onOpenChange, onSuccess }: NewLeadAdvancedModalProps) {
  const flow = useNewLeadFlow();

  const handleClose = () => {
    flow.reset();
    onOpenChange(false);
  };

  const handleSuccess = () => {
    onSuccess?.();
    handleClose();
  };

  const getStepTitle = () => {
    switch (flow.state.step) {
      case 'upload':
        return 'Novo Lead - Dados Iniciais';
      case 'processing':
        return 'Processando Dados...';
      case 'confirmation':
        return 'Confirmar Dados do Lead';
      case 'success':
        return 'Lead Criado com Sucesso!';
      default:
        return 'Novo Lead';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getStepTitle()}</DialogTitle>
        </DialogHeader>

        {flow.state.step === 'upload' && (
          <UploadStep
            state={flow.state}
            updateState={flow.updateState}
            lookupPlate={flow.lookupPlate}
            onCancel={handleClose}
            onNext={() => flow.updateState({ step: 'confirmation' })}
          />
        )}

        {flow.state.step === 'processing' && (
          <ProcessingStep status={flow.state.processingStatus} />
        )}

        {flow.state.step === 'confirmation' && (
          <ConfirmationStep
            state={flow.state}
            updateState={flow.updateState}
            onBack={() => flow.updateState({ step: 'upload' })}
            onSubmit={flow.createLead}
            isSubmitting={flow.isSubmitting}
          />
        )}

        {flow.state.step === 'success' && (
          <SuccessStep
            leadId={flow.state.createdLeadId}
            token={flow.state.publicQuoteToken}
            telefone={flow.state.telefone}
            onClose={handleSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
