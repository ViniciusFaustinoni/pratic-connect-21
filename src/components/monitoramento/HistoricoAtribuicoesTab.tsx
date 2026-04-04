import { useState } from 'react';
import { useHistoricoAtribuicoes, FiltrosHistorico } from '@/hooks/useHistoricoAtribuicoes';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const tipoBadge: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  manual: { label: 'Manual', variant: 'default' },
  automatica: { label: 'Automática', variant: 'secondary' },
  encaixe: { label: 'Encaixe', variant: 'outline' },
};

export default function HistoricoAtribuicoesTab() {
  const [filtros, setFiltros] = useState<FiltrosHistorico>({});
  const { data, isLoading, page, setPage, pageSize } = useHistoricoAtribuicoes(filtros);

  const registros = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-muted-foreground">Data início</label>
          <Input
            type="date"
            className="w-40"
            value={filtros.dataInicio || ''}
            onChange={e => setFiltros(f => ({ ...f, dataInicio: e.target.value || undefined }))}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Data fim</label>
          <Input
            type="date"
            className="w-40"
            value={filtros.dataFim || ''}
            onChange={e => setFiltros(f => ({ ...f, dataFim: e.target.value || undefined }))}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Tipo</label>
          <Select
            value={filtros.tipoAtribuicao || 'todos'}
            onValueChange={v => setFiltros(f => ({ ...f, tipoAtribuicao: v === 'todos' ? undefined : v }))}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="automatica">Automática</SelectItem>
              <SelectItem value="encaixe">Encaixe</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : registros.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhuma atribuição encontrada</div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Serviço</TableHead>
                <TableHead>Associado / Placa</TableHead>
                <TableHead>Profissional</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Atribuído por</TableHead>
                <TableHead className="text-right">Distância</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registros.map((r: any) => {
                const badge = tipoBadge[r.tipo_atribuicao] || tipoBadge.automatica;
                const servico = r.servico as any;
                const assocNome = servico?.associado?.nome || '-';
                const placa = servico?.veiculo?.placa || '';
                const profNome = (r.profissional as any)?.nome || '-';
                const atribuidorNome = (r.atribuidor as any)?.nome || 'Sistema';

                return (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {r.created_at ? format(new Date(r.created_at), "dd/MM/yy HH:mm", { locale: ptBR }) : '-'}
                    </TableCell>
                    <TableCell className="capitalize text-xs">{servico?.tipo || '-'}</TableCell>
                    <TableCell className="text-xs">
                      <div>{assocNome}</div>
                      {placa && <span className="text-muted-foreground">{placa}</span>}
                    </TableCell>
                    <TableCell className="text-xs">{profNome}</TableCell>
                    <TableCell>
                      <Badge variant={badge.variant} className="text-xs">{badge.label}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{atribuidorNome}</TableCell>
                    <TableCell className="text-right text-xs">
                      {r.distancia_km != null ? `${Number(r.distancia_km).toFixed(1)} km` : '-'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Paginação */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{total} registro{total !== 1 ? 's' : ''}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="flex items-center px-2">{page + 1} / {totalPages || 1}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
