import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircle, 
  Clock, 
  Receipt
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useMyBoletos, type ResumoFinanceiro } from '@/hooks/useMyData';
import { CardBoleto, CardBoletoSkeleton, formatarValor, type BoletoData } from '@/components/app';
import { AlertaCotacaoCancelada } from '@/components/app/AlertaCotacaoCancelada';
import { useCotacaoCanceladaPorPagamento, useCobrancaAdesaoVencida } from '@/hooks/useCotacaoCancelada';
import { useAssociado } from '@/contexts/AssociadoContext';

const FILTROS = [
  { value: 'todos', label: 'Todos' },
  { value: 'pendente', label: 'Pendentes' },
  { value: 'pago', label: 'Pagos' },
  { value: 'vencido', label: 'Vencidos' },
] as const;

export default function AppBoletos() {
  const navigate = useNavigate();
  const { data: boletos = [], isLoading } = useMyBoletos();
  const { associado } = useAssociado();
  
  // Verificar cotação cancelada por falta de pagamento
  const { data: cotacaoCancelada } = useCotacaoCanceladaPorPagamento(associado?.id);
  const { data: cobrancaAdesaoVencida } = useCobrancaAdesaoVencida(associado?.id);
  
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');

  // Converter boletos para BoletoData (compatibilidade de tipos)
  const boletosData: BoletoData[] = useMemo(() => {
    return boletos.map(b => ({
      ...b,
      status: b.status as BoletoData['status']
    }));
  }, [boletos]);

  // Contagem por status
  const getContagem = (status: string) => {
    if (status === 'todos') return boletosData.length;
    return boletosData.filter(b => b.status === status).length;
  };

  // Calcular resumo financeiro
  const resumo = useMemo<ResumoFinanceiro>(() => {
    return {
      totalPago: boletosData.filter(b => b.status === 'pago').reduce((acc, b) => acc + (b.valorPago || 0), 0),
      totalPendente: boletosData.filter(b => b.status === 'pendente').reduce((acc, b) => acc + b.valorFinal, 0),
      totalVencido: boletosData.filter(b => b.status === 'vencido').reduce((acc, b) => acc + b.valorFinal, 0),
      quantidadePago: boletosData.filter(b => b.status === 'pago').length,
      quantidadePendente: boletosData.filter(b => b.status === 'pendente').length,
      quantidadeVencido: boletosData.filter(b => b.status === 'vencido').length,
    };
  }, [boletosData]);

  // Filtrar boletos
  const boletosFiltrados = useMemo(() => {
    let resultado = [...boletosData];

    if (filtroStatus !== 'todos') {
      resultado = resultado.filter(b => b.status === filtroStatus);
    }

    // Ordenar: vencidos primeiro, depois pendentes, depois pagos
    resultado.sort((a, b) => {
      const ordemStatus: Record<string, number> = { vencido: 0, pendente: 1, processando: 2, pago: 3, cancelado: 4 };
      if (ordemStatus[a.status] !== ordemStatus[b.status]) {
        return ordemStatus[a.status] - ordemStatus[b.status];
      }
      const anoMesA = (a.competenciaAno || 0) * 12 + (a.competenciaMes || 0);
      const anoMesB = (b.competenciaAno || 0) * 12 + (b.competenciaMes || 0);
      return anoMesB - anoMesA;
    });

    return resultado;
  }, [boletosData, filtroStatus]);

  if (isLoading) {
    return <BoletosLoading />;
  }

  return (
    <div className="space-y-4 p-4 pb-24">
      {/* ALERTA DE COTAÇÃO CANCELADA POR FALTA DE PAGAMENTO */}
      {(cotacaoCancelada || cobrancaAdesaoVencida) && (
        <AlertaCotacaoCancelada
          motivo={cotacaoCancelada?.motivo_cancelamento || 'Taxa de adesão vencida. Sua contratação está pendente.'}
          data={cotacaoCancelada?.cancelada_em || undefined}
          variante="card"
        />
      )}

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Meus Boletos</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie suas mensalidades
        </p>
      </div>

      {/* Resumo Financeiro */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-600">
                <CheckCircle className="h-4 w-4" />
                <span className="text-xs font-medium">Pago</span>
              </div>
              <p className="text-lg font-bold text-foreground">
                {formatarValor(resumo.totalPago)}
              </p>
              <p className="text-xs text-muted-foreground">
                {resumo.quantidadePago} boleto{resumo.quantidadePago !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-amber-600">
                <Clock className="h-4 w-4" />
                <span className="text-xs font-medium">Em Aberto</span>
              </div>
              <p className="text-lg font-bold text-foreground">
                {formatarValor(resumo.totalPendente + resumo.totalVencido)}
              </p>
              <p className="text-xs text-muted-foreground">
                {resumo.quantidadePendente + resumo.quantidadeVencido} boleto{(resumo.quantidadePendente + resumo.quantidadeVencido) !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs de Filtro - Scroll Horizontal */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {FILTROS.map(filtro => (
          <button
            key={filtro.value}
            onClick={() => setFiltroStatus(filtro.value)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0",
              filtroStatus === filtro.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {filtro.label}
            <span className="ml-1.5 text-xs opacity-80">
              ({getContagem(filtro.value)})
            </span>
          </button>
        ))}
      </div>

      {/* Lista de Boletos */}
      {boletosFiltrados.length > 0 ? (
        <div className="space-y-2">
          {boletosFiltrados.map(boleto => (
            <CardBoleto
              key={boleto.id}
              boleto={boleto}
              variacao="compacto"
              onClick={() => navigate(`/app/boletos/${boleto.id}`)}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Receipt className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold text-foreground">Nenhum boleto encontrado</h3>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              {filtroStatus === 'todos' 
                ? 'Você ainda não possui boletos' 
                : 'Nenhum boleto com este status'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Loading state
function BoletosLoading() {
  return (
    <div className="space-y-4 p-4 pb-24">
      <div className="space-y-1">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-24" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-24" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs skeleton */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-10 w-24 rounded-full flex-shrink-0" />
        ))}
      </div>

      <div className="space-y-2">
        {[1, 2, 3, 4].map(i => (
          <CardBoletoSkeleton key={i} variacao="compacto" />
        ))}
      </div>
    </div>
  );
}
