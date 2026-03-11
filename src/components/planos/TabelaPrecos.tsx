import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useTabelasPreco } from '@/hooks/usePlanos';
import { formatarMoeda } from '@/utils/format';

interface TabelaPrecosProps {
  titulo?: string;
}

const REGIOES = [
  { value: 'todas', label: 'Todas as regiões' },
  { value: 'rj', label: 'Rio de Janeiro' },
  { value: 'lagos', label: 'Região dos Lagos' },
  { value: 'sp', label: 'São Paulo' },
];

const LINHA_LABELS: Record<string, string> = {
  select: 'Select',
  lancamento: 'Lançamento',
  especial: 'Especial',
  advanced: 'Advanced',
  eletrico: 'Elétrico',
};

function TabelaPrecosGeneric({ titulo }: TabelaPrecosProps) {
  const { data: tabelas, isLoading } = useTabelasPreco();
  const [regiaoFiltro, setRegiaoFiltro] = useState('todas');
  const [linhaFiltro, setLinhaFiltro] = useState('todas');

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const tabelasOrdenadas = tabelas?.sort((a, b) => 
    Number(a.fipe_min) - Number(b.fipe_min)
  ) || [];

  // Extrair linhas disponíveis
  const linhasDisponiveis = [...new Set(tabelasOrdenadas.map(t => t.linha_slug).filter(Boolean))] as string[];

  // Aplicar filtros
  const tabelasFiltradas = tabelasOrdenadas.filter(t => {
    if (regiaoFiltro !== 'todas' && t.regiao !== regiaoFiltro) return false;
    if (linhaFiltro !== 'todas' && t.linha_slug !== linhaFiltro) return false;
    return true;
  });

  if (tabelasOrdenadas.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{titulo || 'Tabela de Preços'}</CardTitle>
          <CardDescription>Nenhuma tabela de preços disponível</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>{titulo || 'Tabela de Preços'}</CardTitle>
            <CardDescription>Valores mensais por faixa FIPE</CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={regiaoFiltro} onValueChange={setRegiaoFiltro}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REGIOES.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={linhaFiltro} onValueChange={setLinhaFiltro}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as linhas</SelectItem>
                {linhasDisponiveis.map(slug => (
                  <SelectItem key={slug} value={slug}>
                    {LINHA_LABELS[slug] || slug}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {tabelasFiltradas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum resultado para os filtros selecionados.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">Faixa FIPE</th>
                  <th className="text-left py-2 px-3">Linha</th>
                  <th className="text-left py-2 px-3">Região</th>
                  <th className="text-right py-2 px-3">Valor Mensal</th>
                  <th className="text-right py-2 px-3">Valor Deságio</th>
                </tr>
              </thead>
              <tbody>
                {tabelasFiltradas.map((tabela) => {
                  const valorMensal = Number(tabela.valor_mensal);

                  return (
                    <tr key={tabela.id} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-3">
                        {formatarMoeda(Number(tabela.fipe_min))} - {formatarMoeda(Number(tabela.fipe_max))}
                      </td>
                      <td className="py-2 px-3">
                        {LINHA_LABELS[tabela.linha_slug || ''] || tabela.linha_slug || '-'}
                      </td>
                      <td className="py-2 px-3">
                        {tabela.regiao?.toUpperCase() || '-'}
                      </td>
                      <td className="text-right py-2 px-3 font-medium">
                        {valorMensal > 0 ? formatarMoeda(valorMensal) : (
                          <span className="text-xs text-muted-foreground italic">Consulte um consultor</span>
                        )}
                      </td>
                      <td className="text-right py-2 px-3">
                        {tabela.valor_desagio ? formatarMoeda(Number(tabela.valor_desagio)) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TabelaPrecosCarros({ titulo }: TabelaPrecosProps) {
  return <TabelaPrecosGeneric titulo={titulo || 'Tabela de Preços - Carros'} />;
}

export function TabelaPrecosMotos() {
  return <TabelaPrecosGeneric titulo="Tabela de Preços - Motos" />;
}

export function TabelaPrecosEletricos() {
  return <TabelaPrecosGeneric titulo="Tabela de Preços - Elétricos" />;
}
