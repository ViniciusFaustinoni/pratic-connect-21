import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, Car, Clock, Loader2, User, ChevronRight } from 'lucide-react';
import {
  useFilaBaseHoje,
  usePegarVistoriaBase,
  type VistoriaBaseFila,
} from '@/hooks/useFilaBaseHoje';
import { toast } from 'sonner';
import { normalizePeriodo, PERIODO_LABEL, PERIODO_FAIXA } from '@/lib/periodo-utils';

export function FilaBaseSection() {
  const navigate = useNavigate();
  const { data, isLoading } = useFilaBaseHoje(true);
  const pegar = usePegarVistoriaBase();

  if (isLoading) {
    return (
      <Card className="border-slate-700 bg-slate-800">
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
        </CardContent>
      </Card>
    );
  }

  const disponiveis = data?.disponiveis || [];
  const minhas = data?.minhas || [];

  const handlePegar = async (item: VistoriaBaseFila) => {
    try {
      const id = await pegar.mutateAsync(item.id);
      toast.success('Vistoria atribuída a você');
      navigate(`/instalador/vistoria/${id}`);
    } catch {
      // toast já tratado no hook
    }
  };

  const handleContinuar = (item: VistoriaBaseFila) => {
    navigate(`/instalador/vistoria/${item.id}`);
  };

  if (disponiveis.length === 0 && minhas.length === 0) {
    return (
      <Card className="border-slate-700 bg-slate-800">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Building2 className="h-10 w-10 text-slate-600" />
          <h3 className="mt-3 text-base font-semibold text-white">
            Sem vistorias na base hoje
          </h3>
          <p className="mt-1 text-center text-sm text-slate-400">
            Quando um cliente agendar para hoje na base, ela aparece aqui.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {minhas.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide">
            Minhas vistorias na base ({minhas.length})
          </h3>
          {minhas.map((item) => (
            <FilaItemCard
              key={item.id}
              item={item}
              actionLabel="Continuar"
              actionVariant="default"
              onAction={() => handleContinuar(item)}
              loading={false}
            />
          ))}
        </div>
      )}

      {disponiveis.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide">
            Disponíveis ({disponiveis.length})
          </h3>
          {disponiveis.map((item) => (
            <FilaItemCard
              key={item.id}
              item={item}
              actionLabel="Pegar e iniciar"
              actionVariant="secondary"
              onAction={() => handlePegar(item)}
              loading={pegar.isPending && pegar.variables === item.id}
              disabled={pegar.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface FilaItemCardProps {
  item: VistoriaBaseFila;
  actionLabel: string;
  actionVariant: 'default' | 'secondary';
  onAction: () => void;
  loading: boolean;
  disabled?: boolean;
}

function FilaItemCard({
  item,
  actionLabel,
  actionVariant,
  onAction,
  loading,
  disabled,
}: FilaItemCardProps) {
  const veiculoInfo =
    item.veiculo_descricao && item.veiculo_placa
      ? `${item.veiculo_descricao} • ${item.veiculo_placa}`
      : item.veiculo_placa || item.veiculo_descricao || 'Veículo não informado';

  const periodo = normalizePeriodo(item.horario);
  const periodoLabel = `${PERIODO_LABEL[periodo]} (${PERIODO_FAIXA[periodo]})`;

  return (
    <Card className="border-slate-700 bg-slate-800">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-600/20 flex items-center justify-center shrink-0">
            <Building2 className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-white truncate">
                {item.cliente_nome || 'Cliente'}
              </p>
              <Badge
                variant="outline"
                className="text-[10px] border-emerald-500 text-emerald-400 shrink-0"
              >
                BASE
              </Badge>
            </div>
            <div className="flex items-center gap-1 text-slate-400 text-xs mt-1">
              <Car className="h-3 w-3" />
              <span className="truncate">{veiculoInfo}</span>
            </div>
            <div className="flex items-center gap-3 text-slate-500 text-xs mt-1">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {horario}
              </span>
              {item.cliente_telefone && (
                <span className="flex items-center gap-1 truncate">
                  <User className="h-3 w-3" />
                  {item.cliente_telefone}
                </span>
              )}
            </div>
          </div>
        </div>
        <Button
          size="sm"
          variant={actionVariant}
          className="w-full"
          onClick={onAction}
          disabled={loading || disabled}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              {actionLabel}
              <ChevronRight className="h-4 w-4 ml-1" />
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
