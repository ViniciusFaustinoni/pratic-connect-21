import { Link } from 'react-router-dom';
import {
  BarChart3, Wallet, Layers, PieChart, Scale, Receipt, TrendingUp, CreditCard,
  Database, ClipboardCheck, FileText, List, Building2, Network, MessageCircle,
  LineChart, Users,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { usePermissions } from '@/hooks/usePermissions';

interface Item {
  title: string;
  desc: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  gestao?: boolean; // exige gestão financeira (diretoria/sócios)
}

interface Secao { titulo: string; itens: Item[]; }

const SECOES: Secao[] = [
  {
    titulo: 'Visão geral',
    itens: [
      { title: 'Dashboard', desc: 'Indicadores gerais do financeiro', url: '/financeiro', icon: BarChart3 },
      { title: 'Fluxo de Caixa', desc: 'A receber × a pagar e saldo projetado', url: '/financeiro/fluxo-caixa', icon: Wallet },
      { title: 'Visão Financeira', desc: 'Consolidada por setor × por empresa', url: '/financeiro/visao', icon: Layers },
      { title: 'Dashboard Executivo', desc: 'KPIs, custo do risco, top fornecedores', url: '/financeiro/dashboard-executivo', icon: LineChart, gestao: true },
    ],
  },
  {
    titulo: 'Relatórios',
    itens: [
      { title: 'Custos e Receitas', desc: 'Relatório por grupo + exportar PDF/Excel', url: '/financeiro/relatorio-custos-receitas', icon: PieChart },
      { title: 'DRE Gerencial', desc: 'Resultado mês a mês com margem', url: '/financeiro/dre', icon: BarChart3, gestao: true },
    ],
  },
  {
    titulo: 'Lançamentos & operação',
    itens: [
      { title: 'Contas a Pagar', desc: 'Despesas e pagamentos', url: '/financeiro/contas-pagar', icon: CreditCard },
      { title: 'Importar Despesas', desc: 'Subir Excel/CSV do sistema de gestão', url: '/financeiro/importar', icon: Database },
      { title: 'Receitas', desc: 'Entradas por categoria', url: '/financeiro/receitas', icon: TrendingUp },
      { title: 'Solicitações Financeiras', desc: 'Pedidos de pagamento/reembolso (3 sócios)', url: '/financeiro/solicitacoes', icon: ClipboardCheck },
      { title: 'Cobranças (Faturas)', desc: 'Faturas e régua de cobrança', url: '/financeiro/cobrancas', icon: Receipt },
      { title: 'Faturamento', desc: 'Geração mensal de faturas', url: '/financeiro/faturamento', icon: FileText },
      { title: 'Extrato', desc: 'Movimentações e conciliação', url: '/financeiro/extrato', icon: List },
      { title: 'Chat Cobrança', desc: 'Atendimento de cobrança', url: '/cobranca/chat', icon: MessageCircle },
    ],
  },
  {
    titulo: 'Resultado & sócios',
    itens: [
      { title: 'Distribuição de Lucro', desc: 'Fechamento mensal e DL por sócio', url: '/financeiro/distribuicao', icon: Scale, gestao: true },
    ],
  },
  {
    titulo: 'Multi-empresa & configuração',
    itens: [
      { title: 'Empresas & Rateio', desc: 'Associação + LTDAs e de/para setor', url: '/financeiro/empresas', icon: Network, gestao: true },
      { title: 'Contas Bancárias', desc: 'Bancos e saldos', url: '/financeiro/contas-bancarias', icon: Building2 },
      { title: 'Venda Externa', desc: 'Gestão de conta de vendedores', url: '/financeiro/venda-externa', icon: Users },
    ],
  },
];

export default function CentralFinanceira() {
  const { canGestaoFinanceira } = usePermissions();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Central do Financeiro</h1>
        <p className="text-muted-foreground">Acesso rápido a todas as funcionalidades financeiras</p>
      </div>

      {SECOES.map((secao) => {
        const itens = secao.itens.filter((i) => !i.gestao || canGestaoFinanceira);
        if (itens.length === 0) return null;
        return (
          <section key={secao.titulo} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{secao.titulo}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {itens.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.url} to={item.url}>
                    <Card className="h-full transition-colors hover:bg-muted/50 hover:border-primary/40">
                      <CardContent className="p-4 flex items-start gap-3">
                        <div className="rounded-md bg-primary/10 p-2">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium leading-tight">{item.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
