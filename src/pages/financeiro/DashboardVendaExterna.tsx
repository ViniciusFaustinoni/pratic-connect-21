import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboardVendaExterna, VendedorResumo } from '@/hooks/useDashboardVendaExterna';
import { AnteciparParcelasModal } from '@/components/financeiro/AnteciparParcelasModal';
import { PagamentoLoteModal } from '@/components/financeiro/PagamentoLoteModal';
import { ExportarRelatorioVendaExternaModal } from '@/components/financeiro/ExportarRelatorioVendaExternaModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatarMoeda } from '@/utils/format';
import { format } from 'date-fns';
import { CalendarDays, Clock, AlertTriangle, CheckCircle2, FileDown, Eye, DollarSign, Zap, Loader2, RotateCcw } from 'lucide-react';

type Filtro = 'todos' | 'com_saldo' | 'devedor' | 'antecipacao' | 'zerado';
type FiltroTipo = 'todos' | 'Vendedor' | 'Agência' | 'Supervisor';

const TIPO_BADGE_CLASSES: Record<string, string> = {
  'Vendedor': 'bg-blue-100 text-blue-700 border-blue-200',
  'Agência': 'bg-purple-100 text-purple-700 border-purple-200',
  'Supervisor': 'bg-orange-100 text-orange-700 border-orange-200',
  'Outro': 'bg-gray-100 text-gray-700 border-gray-200',
};

export default function DashboardVendaExterna() {
  const navigate = useNavigate();
  const { cards, isLoadingCards, vendedores, isLoadingVendedores, useParcelasPendentes, useParcelasAPagar, anteciparParcelas, registrarPagamentoLote } = useDashboardVendaExterna();
  
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [anteciparVendedor, setAnteciparVendedor] = useState<VendedorResumo | null>(null);
  const [pagarVendedor, setPagarVendedor] = useState<VendedorResumo | null>(null);
  const [showExportar, setShowExportar] = useState(false);

  // Filter vendors
  const filtrados = vendedores.filter(v => {
    if (busca && !v.vendedor_nome.toLowerCase().includes(busca.toLowerCase())) return false;
    if (filtro === 'com_saldo' && v.a_pagar_mes <= 0) return false;
    if (filtro === 'devedor' && v.saldo_atual >= 0) return false;
    if (filtro === 'antecipacao' && v.antecipacoes_abertas <= 0) return false;
    if (filtro === 'zerado' && v.saldo_atual !== 0) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Venda Externa</h1>
          <p className="text-muted-foreground">Gestão de comissões de vendedores externos</p>
        </div>
        <Button variant="outline" onClick={() => setShowExportar(true)}>
          <FileDown className="h-4 w-4 mr-1" /> Exportar relatório
        </Button>
      </div>

      {/* 4 Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <SummaryCard
          title="A pagar este mês"
          value={cards?.a_pagar_mes}
          subtitle={cards ? `${cards.a_pagar_parcelas} parcelas de ${cards.a_pagar_vendedores} vendedores` : ''}
          icon={<CalendarDays className="h-4 w-4" />}
          color="text-blue-600"
          bgColor="bg-blue-50"
          loading={isLoadingCards}
        />
        <SummaryCard
          title="Antecipações em aberto"
          value={cards?.antecipacoes_abertas}
          subtitle={cards ? `${cards.antecipacoes_count} antecipações ativas` : ''}
          icon={<Clock className="h-4 w-4" />}
          color="text-orange-600"
          bgColor="bg-orange-50"
          loading={isLoadingCards}
        />
        <SummaryCard
          title="Débitos pendentes"
          value={cards?.debitos_pendentes}
          subtitle={cards ? `${cards.debitos_count} débitos em abatimento` : ''}
          icon={<AlertTriangle className="h-4 w-4" />}
          color="text-destructive"
          bgColor="bg-red-50"
          loading={isLoadingCards}
        />
        <SummaryCard
          title="Total pago no mês"
          value={cards?.total_pago_mes}
          subtitle={cards ? `${cards.total_pago_count} pagamentos realizados` : ''}
          icon={<CheckCircle2 className="h-4 w-4" />}
          color="text-green-600"
          bgColor="bg-green-50"
          loading={isLoadingCards}
        />
        <SummaryCard
          title="Estornos no mês"
          value={cards?.estornos_mes}
          subtitle={cards ? `${cards.estornos_count} estornos realizados` : ''}
          icon={<RotateCcw className="h-4 w-4" />}
          color="text-destructive"
          bgColor="bg-red-50"
          loading={isLoadingCards}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <Input
          placeholder="Buscar vendedor..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="w-64"
        />
        <Select value={filtro} onValueChange={v => setFiltro(v as Filtro)}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="com_saldo">Com saldo a pagar</SelectItem>
            <SelectItem value="devedor">Com saldo devedor</SelectItem>
            <SelectItem value="antecipacao">Com antecipação em aberto</SelectItem>
            <SelectItem value="zerado">Zerado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Vendors Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Saldo atual</TableHead>
                <TableHead className="text-right">A pagar este mês</TableHead>
                <TableHead className="text-right">Antecipações</TableHead>
                <TableHead className="text-right">Débitos</TableHead>
                <TableHead>Próxima parcela</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingVendedores ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
              ) : filtrados.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum vendedor encontrado</TableCell></TableRow>
              ) : filtrados.map(v => (
                <TableRow key={v.vendedor_id}>
                  <TableCell className="font-medium">{v.vendedor_nome}</TableCell>
                  <TableCell className="text-right">
                    <span className={v.saldo_atual > 0 ? 'text-green-600 font-semibold' : v.saldo_atual < 0 ? 'text-destructive font-semibold' : 'text-muted-foreground'}>
                      {formatarMoeda(v.saldo_atual)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{formatarMoeda(v.a_pagar_mes)}</TableCell>
                  <TableCell className="text-right">
                    {v.antecipacoes_abertas > 0 ? (
                      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">{formatarMoeda(v.antecipacoes_abertas)}</Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {v.debitos_abatimento > 0 ? (
                      <Badge variant="destructive">{formatarMoeda(v.debitos_abatimento)}</Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    {v.proxima_parcela_data ? format(new Date(v.proxima_parcela_data), 'dd/MM/yyyy') : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/financeiro/venda-externa/${v.vendedor_id}`)} title="Ver extrato">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setPagarVendedor(v)} title="Pagar" disabled={v.a_pagar_mes <= 0}>
                        <DollarSign className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setAnteciparVendedor(v)} title="Antecipar">
                        <Zap className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modals */}
      {anteciparVendedor && (
        <AnteciparModalWrapper
          vendedor={anteciparVendedor}
          onClose={() => setAnteciparVendedor(null)}
          useParcelasPendentes={useParcelasPendentes}
          anteciparParcelas={anteciparParcelas}
        />
      )}

      {pagarVendedor && (
        <PagarModalWrapper
          vendedor={pagarVendedor}
          onClose={() => setPagarVendedor(null)}
          useParcelasAPagar={useParcelasAPagar}
          registrarPagamentoLote={registrarPagamentoLote}
        />
      )}

      <ExportarRelatorioVendaExternaModal
        open={showExportar}
        onClose={() => setShowExportar(false)}
        vendedores={vendedores}
      />
    </div>
  );
}

// Wrapper components to use hooks conditionally
function AnteciparModalWrapper({ vendedor, onClose, useParcelasPendentes, anteciparParcelas }: {
  vendedor: VendedorResumo;
  onClose: () => void;
  useParcelasPendentes: (id: string) => any;
  anteciparParcelas: any;
}) {
  const { data: parcelas, isLoading } = useParcelasPendentes(vendedor.vendedor_id);
  return (
    <AnteciparParcelasModal
      open
      onClose={onClose}
      vendedorNome={vendedor.vendedor_nome}
      parcelas={parcelas || []}
      isLoading={isLoading}
      onConfirm={(ids) => {
        anteciparParcelas.mutate({ parcelaIds: ids, vendedorNome: vendedor.vendedor_nome }, { onSuccess: onClose });
      }}
      isSaving={anteciparParcelas.isPending}
    />
  );
}

function PagarModalWrapper({ vendedor, onClose, useParcelasAPagar, registrarPagamentoLote }: {
  vendedor: VendedorResumo;
  onClose: () => void;
  useParcelasAPagar: (id: string) => any;
  registrarPagamentoLote: any;
}) {
  const { data: parcelas, isLoading } = useParcelasAPagar(vendedor.vendedor_id);
  return (
    <PagamentoLoteModal
      open
      onClose={onClose}
      vendedorNome={vendedor.vendedor_nome}
      parcelas={parcelas || []}
      isLoading={isLoading}
      onConfirm={(data) => {
        registrarPagamentoLote.mutate({ ...data, vendedorNome: vendedor.vendedor_nome }, { onSuccess: onClose });
      }}
      isSaving={registrarPagamentoLote.isPending}
    />
  );
}

// Summary Card Component
function SummaryCard({ title, value, subtitle, icon, color, bgColor, loading }: {
  title: string; value?: number; subtitle: string; icon: React.ReactNode;
  color: string; bgColor: string; loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`p-2 rounded-full ${bgColor} ${color}`}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${color}`}>
          {loading ? '...' : formatarMoeda(value || 0)}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
