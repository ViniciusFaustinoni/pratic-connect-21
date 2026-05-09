import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2 } from 'lucide-react';
import { useEnriquecerVeiculo } from '@/hooks/useEnriquecerVeiculo';

interface Props {
  veiculo: {
    id: string;
    placa?: string | null;
    marca?: string | null;
    modelo?: string | null;
    ano_modelo?: number | null;
    ano_fabricacao?: number | null;
    cor?: string | null;
    combustivel?: string | null;
    valor_fipe?: number | null;
    codigo_fipe?: string | null;
  } | null | undefined;
  size?: 'sm' | 'default';
  variant?: 'outline' | 'ghost' | 'secondary';
}

/**
 * Botão "Atualizar dados via placa": só aparece quando algum dado-chave do
 * veículo está vazio (cor, combustível, FIPE, ano). Dispara plate-lookup +
 * fipe-lookup via hook compartilhado.
 */
export function EnriquecerVeiculoButton({ veiculo, size = 'sm', variant = 'outline' }: Props) {
  const { enriquecer, loading, precisaEnriquecer } = useEnriquecerVeiculo();
  if (!veiculo?.id) return null;
  if (!precisaEnriquecer(veiculo)) return null;

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={() => enriquecer(veiculo as any)}
      disabled={loading}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
      Atualizar dados via placa
    </Button>
  );
}
