import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { DevolverFilaDialog } from '@/components/monitoramento/DevolverFilaDialog';

interface Props {
  servicoId: string;
  servicoStatus: string;
  associadoNome?: string;
  veiculoPlaca?: string;
  profissionalNome?: string | null;
  profissionalIdAtual?: string | null;
  size?: 'sm' | 'default';
  variant?: 'outline' | 'ghost';
}

const ELEGIVEL = ['agendada', 'em_rota', 'em_andamento', 'imprevisto_pendente', 'pendente', 'reagendada', 'nao_compareceu'];

export function DevolverFilaButton({
  servicoId,
  servicoStatus,
  associadoNome,
  veiculoPlaca,
  profissionalNome,
  profissionalIdAtual,
  size = 'sm',
  variant = 'outline',
}: Props) {
  const permissions = usePermissions();
  const [open, setOpen] = useState(false);

  const podeUsar =
    permissions.isDiretor ||
    permissions.isAdminMaster ||
    permissions.isDesenvolvedor ||
    permissions.isCoordenadorMonitoramento ||
    (permissions as any).isAnalistaMonitoramento;

  if (!podeUsar) return null;
  if (!ELEGIVEL.includes(servicoStatus)) return null;
  // Só faz sentido se já existe um técnico atribuído
  if (!profissionalIdAtual) return null;

  return (
    <>
      <Button variant={variant} size={size} className="gap-1.5" onClick={() => setOpen(true)}>
        <RotateCcw className="h-3.5 w-3.5" />
        Devolver à fila
      </Button>
      <DevolverFilaDialog
        open={open}
        onOpenChange={setOpen}
        servico={{
          id: servicoId,
          associadoNome,
          veiculoPlaca,
          profissionalNome: profissionalNome ?? undefined,
          profissionalIdAtual,
        }}
      />
    </>
  );
}
