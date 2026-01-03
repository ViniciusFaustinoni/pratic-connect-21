import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Receipt
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMyBoletos, type ResumoFinanceiro } from '@/hooks/useMyData';
import { CardBoleto, CardBoletoSkeleton, formatarValor, type BoletoData } from '@/components/app';

export default function AppBoletos() {
  const navigate = useNavigate();
  const { data: boletos = [], isLoading } = useMyBoletos();
  
  const [filtroAno, setFiltroAno] = useState<string>('todos');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');

  // Converter boletos para BoletoData (compatibilidade de tipos)
  const boletosData: BoletoData[] = useMemo(() => {
    return boletos.map(b => ({
      ...b,
      status: b.status as BoletoData['status']
    }));
  }, [boletos]);

  // Anos disponíveis para filtro
  const anosDisponiveis = useMemo(() => {
    const anos = new Set(boletosData.map(b => b.competenciaAno).filter(Boolean) as number[]);
    return Array.from(anos).sort((a, b) => b - a);
  }, [boletosData]);

  // Calcular resumo financeiro
  const resumo = useMemo<ResumoFinanceiro>(() => {
    const boletosAno = filtroAno === 'todos' 
      ? boletosData 
      : boletosData.filter(b => b.competenciaAno === parseInt(filtroAno));
    
    return {
      totalPago: boletosAno.filter(b => b.status === 'pago').reduce((acc, b) => acc + (b.valorPago || 0), 0),
      totalPendente: boletosAno.filter(b => b.status === 'pendente').reduce((acc, b) => acc + b.valorFinal, 0),
      totalVencido: boletosAno.filter(b => b.status === 'vencido').reduce((acc, b) => acc + b.valorFinal, 0),
      quantidadePago: boletosAno.filter(b => b.status === 'pago').length,
      quantidadePendente: boletosAno.filter(b => b.status === 'pendente').length,
      quantidadeVencido: boletosAno.filter(b => b.status === 'vencido').length,
    };
  }, [boletosData, filtroAno]);

  // Filtrar boletos
  const boletosFiltrados = useMemo(() => {
    let resultado = [...boletosData];

    if (filtroAno !== 'todos') {
      resultado = resultado.filter(b => b.competenciaAno === parseInt(filtroAno));
    }

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
  }, [boletosData, filtroAno, filtroStatus]);

  // Separar por status
  const boletosVencidos = boletosFiltrados.filter(b => b.status === 'vencido');
  const boletosPendentes = boletosFiltrados.filter(b => b.status === 'pendente');
  const boletosPagos = boletosFiltrados.filter(b => b.status === 'pago');

  if (isLoading) {
    return <BoletosLoading />;
  }

  return (
    <div className="space-y-4 p-4 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Meus Boletos</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie seus pagamentos
        </p>
      </div>

      {/* Resumo Financeiro */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <p className="text-sm font-medium text-muted-foreground mb-3">
            Resumo {filtroAno !== 'todos' ? filtroAno : 'Geral'}
          </p>
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

      {/* Filtros */}
      <div className="flex gap-2">
        <Select value={filtroAno} onValueChange={setFiltroAno}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os anos</SelectItem>
            {anosDisponiveis.map(ano => (
              <SelectItem key={ano} value={ano.toString()}>
                {ano}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="vencido">Vencidos</SelectItem>
            <SelectItem value="pago">Pagos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Boletos Vencidos */}
      {boletosVencidos.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm font-medium text-destructive">
              Vencidos ({boletosVencidos.length})
            </span>
          </div>
          <div className="space-y-2">
            {boletosVencidos.map(boleto => (
              <CardBoleto
                key={boleto.id}
                boleto={boleto}
                variacao="compacto"
                onClick={() => navigate(`/app/boletos/${boleto.id}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Boletos Pendentes */}
      {boletosPendentes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-600">
              Pendentes ({boletosPendentes.length})
            </span>
          </div>
          <div className="space-y-2">
            {boletosPendentes.map(boleto => (
              <CardBoleto
                key={boleto.id}
                boleto={boleto}
                variacao="compacto"
                onClick={() => navigate(`/app/boletos/${boleto.id}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Boletos Pagos */}
      {boletosPagos.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-600">
              Pagos ({boletosPagos.length})
            </span>
          </div>
          <div className="space-y-2">
            {boletosPagos.map(boleto => (
              <CardBoleto
                key={boleto.id}
                boleto={boleto}
                variacao="compacto"
                onClick={() => navigate(`/app/boletos/${boleto.id}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {boletosFiltrados.length === 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Receipt className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold text-foreground">Nenhum boleto encontrado</h3>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              Tente ajustar os filtros
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
          <Skeleton className="h-4 w-24 mb-3" />
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

      <div className="flex gap-2">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 flex-1" />
      </div>

      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        {[1, 2, 3, 4].map(i => (
          <CardBoletoSkeleton key={i} variacao="compacto" />
        ))}
      </div>
    </div>
  );
}
