import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown } from 'lucide-react';
import { useTabelasPreco } from '@/hooks/usePlanos';
import { useProductLines } from '@/hooks/usePlans';
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

const ITEMS_PER_PAGE = 20;

function TabelaPrecosGeneric({ titulo }: TabelaPrecosProps) {
  const { data: tabelas, isLoading } = useTabelasPreco();
  const { data: productLines } = useProductLines();
  const [regiaoFiltro, setRegiaoFiltro] = useState('todas');
  const [linhaFiltro, setLinhaFiltro] = useState('todas');
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  // Build dynamic line labels from product_lines
  const linhaLabels: Record<string, string> = {};
  productLines?.forEach(pl => {
    if (pl.slug) linhaLabels[pl.slug] = pl.name;
  });

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

  // Paginar
  const tabelasVisiveis = tabelasFiltradas.slice(0, visibleCount);
  const temMais = tabelasFiltradas.length > visibleCount;

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
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-base">{titulo || 'Tabela de Preços'}</CardTitle>
            <CardDescription className="text-xs">
              Valores mensais por faixa FIPE • {tabelasFiltradas.length} faixas
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={regiaoFiltro} onValueChange={(v) => { setRegiaoFiltro(v); setVisibleCount(ITEMS_PER_PAGE); }}>
              <SelectTrigger className="w-[150px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REGIOES.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={linhaFiltro} onValueChange={(v) => { setLinhaFiltro(v); setVisibleCount(ITEMS_PER_PAGE); }}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as linhas</SelectItem>
                {linhasDisponiveis.map(slug => (
                  <SelectItem key={slug} value={slug}>
                    {linhaLabels[slug] || slug}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {tabelasFiltradas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum resultado para os filtros selecionados.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Faixa FIPE</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Linha</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Região</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Mensal</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Deságio</th>
                  </tr>
                </thead>
                <tbody>
                  {tabelasVisiveis.map((tabela) => {
                    const valorMensal = Number(tabela.valor_mensal);
                    return (
                      <tr key={tabela.id} className="border-b hover:bg-muted/50">
                        <td className="py-1.5 px-3 text-xs">
                          {formatarMoeda(Number(tabela.fipe_min))} - {formatarMoeda(Number(tabela.fipe_max))}
                        </td>
                        <td className="py-1.5 px-3 text-xs">
                          {linhaLabels[tabela.linha_slug || ''] || tabela.linha_slug || '-'}
                        </td>
                        <td className="py-1.5 px-3 text-xs">
                          {tabela.regiao?.toUpperCase() || '-'}
                        </td>
                        <td className="text-right py-1.5 px-3 text-xs font-medium">
                          {valorMensal > 0 ? formatarMoeda(valorMensal) : (
                            <span className="text-muted-foreground italic">Consulte</span>
                          )}
                        </td>
                        <td className="text-right py-1.5 px-3 text-xs">
                          {tabela.valor_desagio ? formatarMoeda(Number(tabela.valor_desagio)) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mostrar mais */}
            {temMais && (
              <div className="flex justify-center pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1"
                  onClick={() => setVisibleCount(prev => prev + ITEMS_PER_PAGE)}
                >
                  <ChevronDown className="h-3 w-3" />
                  Mostrar mais ({tabelasFiltradas.length - visibleCount} restantes)
                </Button>
              </div>
            )}
          </>
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
