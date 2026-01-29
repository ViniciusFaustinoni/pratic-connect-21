import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TIPO_PROCESSO_LABELS, STATUS_PROCESSO_LABELS, TipoProcesso, StatusProcesso } from '@/types/juridico';

interface GraficosJuridicoProps {
  processos: Array<{
    tipo: string;
    status: string;
    natureza: string;
    valor_causa?: number;
  }>;
}

const CORES_TIPO = [
  'hsl(217, 91%, 60%)',  // blue
  'hsl(25, 95%, 53%)',   // orange
  'hsl(0, 84%, 60%)',    // red
  'hsl(142, 71%, 45%)',  // green
  'hsl(48, 96%, 53%)',   // yellow
  'hsl(262, 83%, 58%)',  // purple
  'hsl(199, 89%, 48%)',  // cyan
  'hsl(220, 14%, 46%)',  // gray
];

const CORES_STATUS = {
  ativo: 'hsl(217, 91%, 60%)',
  suspenso: 'hsl(48, 96%, 53%)',
  arquivado: 'hsl(220, 14%, 46%)',
  encerrado_procedente: 'hsl(142, 71%, 45%)',
  encerrado_improcedente: 'hsl(0, 84%, 60%)',
  acordo: 'hsl(262, 83%, 58%)',
  desistencia: 'hsl(25, 95%, 53%)',
  extinto: 'hsl(220, 9%, 46%)',
};

export function GraficoProcessosPorTipo({ processos }: GraficosJuridicoProps) {
  const data = useMemo(() => {
    const agrupado: Record<string, number> = {};
    processos.forEach((p) => {
      agrupado[p.tipo] = (agrupado[p.tipo] || 0) + 1;
    });
    return Object.entries(agrupado).map(([tipo, count]) => ({
      name: TIPO_PROCESSO_LABELS[tipo as TipoProcesso] || tipo,
      value: count,
    }));
  }, [processos]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Processos por Tipo</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[200px]">
          <p className="text-sm text-muted-foreground">Nenhum dado disponível</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Processos por Tipo</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={70}
              paddingAngle={2}
              dataKey="value"
              label={({ name, value }) => `${name}: ${value}`}
              labelLine={false}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={CORES_TIPO[index % CORES_TIPO.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function GraficoProcessosPorStatus({ processos }: GraficosJuridicoProps) {
  const data = useMemo(() => {
    const agrupado: Record<string, number> = {};
    processos.forEach((p) => {
      agrupado[p.status] = (agrupado[p.status] || 0) + 1;
    });
    return Object.entries(agrupado).map(([status, count]) => ({
      name: STATUS_PROCESSO_LABELS[status as StatusProcesso] || status,
      value: count,
      fill: CORES_STATUS[status as keyof typeof CORES_STATUS] || 'hsl(220, 14%, 46%)',
    }));
  }, [processos]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Processos por Status</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[200px]">
          <p className="text-sm text-muted-foreground">Nenhum dado disponível</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Processos por Status</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
            <XAxis type="number" hide />
            <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface ValorEmDisputaCardProps {
  valorRisco: number;
  valorAReceber: number;
  processosPassivos: number;
  processosAtivos: number;
}

export function ValorEmDisputaCard({ 
  valorRisco, 
  valorAReceber, 
  processosPassivos, 
  processosAtivos 
}: ValorEmDisputaCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card className="border-l-4 border-l-amber-500">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Valor em Disputa</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs text-muted-foreground">Risco (como Réu)</p>
            <p className="text-lg font-bold text-red-600">{formatCurrency(valorRisco)}</p>
            <p className="text-xs text-muted-foreground">{processosPassivos} processos</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">A Receber (como Autor)</p>
            <p className="text-lg font-bold text-green-600">{formatCurrency(valorAReceber)}</p>
            <p className="text-xs text-muted-foreground">{processosAtivos} processos</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
