import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  ChevronRight, 
  Copy, 
  Receipt
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useMyBoletos, type Boleto, type ResumoFinanceiro } from '@/hooks/useMyData';

export default function AppBoletos() {
  const navigate = useNavigate();
  const { data: boletos = [], isLoading } = useMyBoletos();
  
  const [filtroAno, setFiltroAno] = useState<string>('todos');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');

  // Anos disponíveis para filtro
  const anosDisponiveis = useMemo(() => {
    const anos = new Set(boletos.map(b => b.competenciaAno));
    return Array.from(anos).sort((a, b) => b - a);
  }, [boletos]);

  // Calcular resumo financeiro
  const resumo = useMemo<ResumoFinanceiro>(() => {
    const boletosAno = filtroAno === 'todos' 
      ? boletos 
      : boletos.filter(b => b.competenciaAno === parseInt(filtroAno));
    
    return {
      totalPago: boletosAno.filter(b => b.status === 'pago').reduce((acc, b) => acc + (b.valorPago || 0), 0),
      totalPendente: boletosAno.filter(b => b.status === 'pendente').reduce((acc, b) => acc + b.valorFinal, 0),
      totalVencido: boletosAno.filter(b => b.status === 'vencido').reduce((acc, b) => acc + b.valorFinal, 0),
      quantidadePago: boletosAno.filter(b => b.status === 'pago').length,
      quantidadePendente: boletosAno.filter(b => b.status === 'pendente').length,
      quantidadeVencido: boletosAno.filter(b => b.status === 'vencido').length,
    };
  }, [boletos, filtroAno]);

  // Filtrar boletos
  const boletosFiltrados = useMemo(() => {
    let resultado = [...boletos];

    if (filtroAno !== 'todos') {
      resultado = resultado.filter(b => b.competenciaAno === parseInt(filtroAno));
    }

    if (filtroStatus !== 'todos') {
      resultado = resultado.filter(b => b.status === filtroStatus);
    }

    // Ordenar: vencidos primeiro, depois pendentes, depois pagos
    resultado.sort((a, b) => {
      const ordemStatus = { vencido: 0, pendente: 1, pago: 2, cancelado: 3 };
      if (ordemStatus[a.status] !== ordemStatus[b.status]) {
        return ordemStatus[a.status] - ordemStatus[b.status];
      }
      return (b.competenciaAno * 12 + b.competenciaMes) - (a.competenciaAno * 12 + a.competenciaMes);
    });

    return resultado;
  }, [boletos, filtroAno, filtroStatus]);

  // Separar por status
  const boletosVencidos = boletosFiltrados.filter(b => b.status === 'vencido');
  const boletosPendentes = boletosFiltrados.filter(b => b.status === 'pendente');
  const boletosPagos = boletosFiltrados.filter(b => b.status === 'pago');

  const copiarPix = async (pix: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(pix);
      toast.success('Código Pix copiado!');
    } catch {
      toast.error('Erro ao copiar. Tente novamente.');
    }
  };

  const formatarValor = (valor: number) => {
    return valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

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
              <BoletoCard
                key={boleto.id}
                boleto={boleto}
                onCopiarPix={copiarPix}
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
              <BoletoCard
                key={boleto.id}
                boleto={boleto}
                onCopiarPix={copiarPix}
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
              <BoletoCard
                key={boleto.id}
                boleto={boleto}
                onCopiarPix={copiarPix}
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

// Componente Card do Boleto
interface BoletoCardProps {
  boleto: Boleto;
  onCopiarPix: (pix: string, e: React.MouseEvent) => void;
  onClick: () => void;
}

function BoletoCard({ boleto, onCopiarPix, onClick }: BoletoCardProps) {
  const statusConfig = {
    pendente: {
      badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
      label: 'Pendente',
      icon: Clock,
      cardBorder: 'border-l-amber-500',
      showPagar: true
    },
    vencido: {
      badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      label: 'Vencido',
      icon: AlertTriangle,
      cardBorder: 'border-l-red-500',
      showPagar: true
    },
    pago: {
      badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
      label: 'Pago',
      icon: CheckCircle,
      cardBorder: 'border-l-emerald-500',
      showPagar: false
    },
    cancelado: {
      badge: 'bg-muted text-muted-foreground',
      label: 'Cancelado',
      icon: FileText,
      cardBorder: 'border-l-muted',
      showPagar: false
    }
  };

  const config = statusConfig[boleto.status];

  const formatarValor = (valor: number) => {
    return valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  return (
    <Card 
      className={`border-0 border-l-4 shadow-sm cursor-pointer hover:bg-accent/50 transition-colors ${config.cardBorder}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Info do Boleto */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-foreground">{boleto.competencia}</h3>
              <Badge variant="secondary" className={config.badge}>
                {config.label}
              </Badge>
            </div>
            
            <p className="text-sm text-muted-foreground">
              {boleto.status === 'pago' ? (
                <>Pago em {boleto.dataPagamento}</>
              ) : (
                <>Vence em {boleto.dataVencimento}</>
              )}
            </p>

            {/* Mostrar diferença se houver juros */}
            {boleto.valorPago && boleto.valorPago !== boleto.valorOriginal && (
              <p className="text-xs text-muted-foreground">
                Original: {formatarValor(boleto.valorOriginal)}
              </p>
            )}
          </div>

          {/* Valor e Ações */}
          <div className="flex flex-col items-end gap-2">
            <p className="text-lg font-bold text-foreground">
              {formatarValor(boleto.status === 'pago' ? (boleto.valorPago || boleto.valorFinal) : boleto.valorFinal)}
            </p>
            
            {config.showPagar && boleto.pixCopiaCola && (
              <Button 
                size="sm" 
                variant="outline"
                className="h-8"
                onClick={(e) => onCopiarPix(boleto.pixCopiaCola!, e)}
              >
                <Copy className="h-3 w-3 mr-1.5" />
                Copiar Pix
              </Button>
            )}

            {boleto.status === 'pago' && (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Alerta para vencidos */}
        {boleto.status === 'vencido' && (
          <div className="mt-3 p-2 bg-destructive/10 rounded-md">
            <p className="text-xs text-destructive">
              ⚠️ Este boleto está vencido. Podem haver juros e multa.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
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
          <Card key={i} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-40" />
                </div>
                <div className="space-y-2 flex flex-col items-end">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-8 w-24" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
