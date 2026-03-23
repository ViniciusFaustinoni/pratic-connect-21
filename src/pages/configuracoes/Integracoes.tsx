import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plug, MessageSquare, CreditCard, MapPin, FileSignature, Zap, Mail,
  Search, Building2, CheckCircle, XCircle, Key, Inbox, ArrowRight,
  Loader2, Settings, ExternalLink, HeartPulse,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useIntegracoesStatus } from '@/hooks/useIntegracoesStatus';
import { useTodasIntegracoesCredenciais, IntegracaoTipo } from '@/hooks/useIntegracaoCredenciais';
import { useApiKeys } from '@/hooks/useApiKeys';
import { useApiLeadsConfig } from '@/hooks/useApiLeadsConfig';
import { useAllLatestHealthChecks } from '@/hooks/useIntegracaoHealthCheck';
import { ConfigurarIntegracaoSheet } from '@/components/integracoes/ConfigurarIntegracaoSheet';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Types ──────────────────────────────────────────────
interface IntegracaoCard {
  id: string;
  nome: string;
  descricao: string;
  icon: React.ElementType;
  // Navigation to sub-page
  href?: string;
  // Or open config sheet
  integracaoTipo?: IntegracaoTipo;
  // Status helpers
  statusKey?: string;
  plataformaCodigo?: 'softruck' | 'rede_veiculos';
  sempreAtivo?: boolean;
  // Extra info line
  extraInfo?: (ctx: StatusContext) => string | null;
}

interface Categoria {
  titulo: string;
  icone: string;
  items: IntegracaoCard[];
}

interface StatusContext {
  integracoes: ReturnType<typeof useIntegracoesStatus>;
  credenciais: any[];
  apiKeysCount: number;
  leadsAtivas: number;
  healthChecks: Record<string, any>;
}

// ── Data ──────────────────────────────────────────────
const categorias: Categoria[] = [
  {
    titulo: 'Comunicação',
    icone: '💬',
    items: [
      {
        id: 'whatsapp',
        nome: 'WhatsApp Business',
        descricao: 'Evolution API ou API Oficial da Meta',
        icon: MessageSquare,
        href: '/configuracoes/integracoes/whatsapp',
        statusKey: 'whatsapp',
      },
      {
        id: 'email',
        nome: 'Email SMTP',
        descricao: 'Envio de cotações e notificações',
        icon: Mail,
        integracaoTipo: 'resend',
        statusKey: 'email',
      },
    ],
  },
  {
    titulo: 'Pagamentos',
    icone: '💳',
    items: [
      {
        id: 'asaas',
        nome: 'ASAAS',
        descricao: 'Boletos, Pix e cobranças recorrentes',
        icon: CreditCard,
        integracaoTipo: 'asaas',
        statusKey: 'asaas',
        extraInfo: (ctx) => ctx.integracoes.asaas.ambiente
          ? `Ambiente: ${ctx.integracoes.asaas.ambiente}`
          : null,
      },
    ],
  },
  {
    titulo: 'Rastreamento',
    icone: '📍',
    items: [
      {
        id: 'rede_veiculos',
        nome: 'Rede Veículos',
        descricao: 'Rastreamento em tempo real',
        icon: MapPin,
        integracaoTipo: 'rede_veiculos',
        plataformaCodigo: 'rede_veiculos',
      },
      {
        id: 'softruck',
        nome: 'Softruck',
        descricao: 'Rastreamento e telemetria',
        icon: MapPin,
        integracaoTipo: 'softruck',
        plataformaCodigo: 'softruck',
      },
    ],
  },
  {
    titulo: 'Documentos & Gestão',
    icone: '📝',
    items: [
      {
        id: 'autentique',
        nome: 'Autentique',
        descricao: 'Assinatura digital de contratos',
        icon: FileSignature,
        integracaoTipo: 'autentique',
        statusKey: 'autentique',
      },
      {
        id: 'hinova',
        nome: 'SGA Hinova',
        descricao: 'Sistema de gestão de associados',
        icon: Building2,
        href: '/configuracoes/integracoes/sga-hinova',
        integracaoTipo: 'hinova',
        statusKey: 'hinova',
      },
    ],
  },
  {
    titulo: 'Automação & Developers',
    icone: '⚡',
    items: [
      {
        id: 'n8n',
        nome: 'n8n',
        descricao: 'Workflows e automações',
        icon: Zap,
        sempreAtivo: true,
      },
      {
        id: 'api-keys',
        nome: 'Chaves de API',
        descricao: 'Gerencie credenciais de acesso',
        icon: Key,
        href: '/configuracoes/integracoes/api-keys',
        extraInfo: (ctx) => ctx.apiKeysCount > 0 ? `${ctx.apiKeysCount} chave(s) ativa(s)` : null,
      },
    ],
  },
  {
    titulo: 'Captação de Leads',
    icone: '📥',
    items: [
      {
        id: 'fontes-leads',
        nome: 'Fontes de Leads',
        descricao: 'Configure origens de leads via API',
        icon: Inbox,
        href: '/configuracoes/integracoes/fontes-leads',
        extraInfo: (ctx) => ctx.leadsAtivas > 0 ? `${ctx.leadsAtivas} fonte(s) ativa(s)` : null,
      },
    ],
  },
];

// ── Status resolver ──────────────────────────────────
function resolveStatus(
  card: IntegracaoCard,
  ctx: StatusContext,
): { ativo: boolean; ultimoTeste?: string } {
  if (card.sempreAtivo) return { ativo: true };

  // Sub-pages that are "always configured" (they manage their own status)
  if (card.href && !card.statusKey && !card.plataformaCodigo) {
    return { ativo: true };
  }

  // Credential from banco
  const cred = ctx.credenciais?.find((c: any) => c.integracao === card.integracaoTipo);
  if (cred?.configurado) {
    return {
      ativo: true,
      ultimoTeste: cred.testado_em
        ? formatDistanceToNow(new Date(cred.testado_em), { addSuffix: true, locale: ptBR })
        : undefined,
    };
  }

  // Rastreadores
  if (card.plataformaCodigo === 'softruck') {
    const s = ctx.integracoes.softruck;
    return {
      ativo: s.configurado,
      ultimoTeste: s.testado_em
        ? formatDistanceToNow(new Date(s.testado_em), { addSuffix: true, locale: ptBR })
        : undefined,
    };
  }
  if (card.plataformaCodigo === 'rede_veiculos') {
    const r = ctx.integracoes.rede_veiculos;
    return {
      ativo: r.configurado && r.testado,
      ultimoTeste: r.testado_em
        ? formatDistanceToNow(new Date(r.testado_em), { addSuffix: true, locale: ptBR })
        : undefined,
    };
  }

  // Secrets
  switch (card.statusKey) {
    case 'asaas': return { ativo: ctx.integracoes.asaas.configurado };
    case 'autentique': return { ativo: ctx.integracoes.autentique.configurado };
    case 'email': return { ativo: ctx.integracoes.email.configurado };
    case 'whatsapp': return { ativo: ctx.integracoes.whatsapp.conectado };
    case 'hinova': return { ativo: ctx.integracoes.hinova.configurado };
    default: return { ativo: false };
  }
}

// ── Summary bar ──────────────────────────────────────
function SummaryBar({ ctx }: { ctx: StatusContext }) {
  const allCards = categorias.flatMap(c => c.items);
  const conectados = allCards.filter(c => resolveStatus(c, ctx).ativo).length;
  const pendentes = allCards.length - conectados;

  return (
    <div className="flex flex-wrap gap-4">
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400">
        <CheckCircle className="h-4 w-4" />
        <span className="text-sm font-medium">{conectados} conectado{conectados !== 1 ? 's' : ''}</span>
      </div>
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-muted-foreground">
        <XCircle className="h-4 w-4" />
        <span className="text-sm font-medium">{pendentes} pendente{pendentes !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}

// ── Integration card ─────────────────────────────────
function IntegracaoCardUI({
  card,
  ctx,
  onConfigurar,
}: {
  card: IntegracaoCard;
  ctx: StatusContext;
  onConfigurar: (card: IntegracaoCard) => void;
}) {
  const navigate = useNavigate();
  const { ativo, ultimoTeste } = resolveStatus(card, ctx);
  const Icon = card.icon;
  const extra = card.extraInfo?.(ctx);
  const isLoading = ctx.integracoes.isLoading;

  // Health check data
  const hc = ctx.healthChecks[card.id];
  const healthLabel = hc
    ? (hc.conexao_ok ? 'Online' : 'Offline')
    : null;
  const healthTime = hc?.created_at
    ? formatDistanceToNow(new Date(hc.created_at), { addSuffix: true, locale: ptBR })
    : null;

  const handleClick = () => {
    if (card.href) {
      navigate(card.href);
    } else if (card.integracaoTipo) {
      onConfigurar(card);
    }
  };

  return (
    <Card
      className={cn(
        "group border-border/50 transition-all duration-200 cursor-pointer",
        "hover:shadow-md hover:border-primary/20 hover:-translate-y-0.5",
        ativo && "ring-1 ring-green-500/20",
      )}
      onClick={handleClick}
    >
      <CardContent className="p-5">
        {/* Row: Icon + Info + Status */}
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={cn(
            "flex-shrink-0 h-11 w-11 rounded-xl flex items-center justify-center",
            ativo ? "bg-primary/10" : "bg-muted",
          )}>
            <Icon className={cn("h-5 w-5", ativo ? "text-primary" : "text-muted-foreground")} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground truncate">{card.nome}</h3>
              {/* Status */}
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              ) : (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] px-1.5 py-0",
                    ativo
                      ? "border-green-500/30 text-green-600 bg-green-500/10 dark:text-green-400"
                      : "border-muted-foreground/30 text-muted-foreground bg-muted",
                  )}
                >
                  {card.sempreAtivo ? 'Ativo' : ativo ? 'Conectado' : 'Pendente'}
                </Badge>
              )}
              {/* Health check indicator */}
              {hc && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={cn(
                        "h-2 w-2 rounded-full flex-shrink-0",
                        hc.conexao_ok ? "bg-green-500" : "bg-destructive"
                      )} />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      <p>{healthLabel} — {healthTime}</p>
                      {hc.erro_mensagem && <p className="text-destructive">{hc.erro_mensagem}</p>}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{card.descricao}</p>
            {(extra || ultimoTeste) && (
              <p className="text-xs text-muted-foreground mt-1">
                {extra || (ultimoTeste && `Último teste: ${ultimoTeste}`)}
              </p>
            )}
          </div>

          {/* Arrow */}
          <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main component ───────────────────────────────────
type DraftValues = Partial<Record<IntegracaoTipo, Record<string, string>>>;

export default function Integracoes() {
  const navigate = useNavigate();
  const integracoes = useIntegracoesStatus();
  const { data: credenciais, refetch: refetchCredenciais } = useTodasIntegracoesCredenciais();
  const { data: apiKeys } = useApiKeys();
  const { data: leadsConfig } = useApiLeadsConfig();
  const { data: healthChecks } = useAllLatestHealthChecks();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedTipo, setSelectedTipo] = useState<IntegracaoTipo>('hinova');
  const [selectedNome, setSelectedNome] = useState('');
  const [drafts, setDrafts] = useState<DraftValues>({});

  const ctx: StatusContext = {
    integracoes,
    credenciais: credenciais || [],
    apiKeysCount: apiKeys?.filter(k => k.ativa).length || 0,
    leadsAtivas: leadsConfig?.filter(l => l.ativo).length || 0,
    healthChecks: healthChecks || {},
  };

  const handleConfigurar = useCallback((card: IntegracaoCard) => {
    if (card.integracaoTipo) {
      setSelectedTipo(card.integracaoTipo);
      setSelectedNome(card.nome);
      setSheetOpen(true);
    }
  }, []);

  const handleSuccess = useCallback(() => {
    setDrafts(prev => {
      const n = { ...prev };
      delete n[selectedTipo];
      return n;
    });
    integracoes.refetch();
    refetchCredenciais();
    setSheetOpen(false);
  }, [selectedTipo, integracoes, refetchCredenciais]);

  const handleValoresChange = useCallback((valores: Record<string, string>) => {
    setDrafts(prev => ({ ...prev, [selectedTipo]: valores }));
  }, [selectedTipo]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Plug className="h-6 w-6 text-primary" />
            Integrações
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Conecte e gerencie todos os serviços externos em um só lugar
          </p>
        </div>
        <SummaryBar ctx={ctx} />
      </div>

      {/* Categories */}
      {categorias.map((cat) => (
        <section key={cat.titulo} className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <span>{cat.icone}</span>
            {cat.titulo}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cat.items.map((card) => (
              <IntegracaoCardUI
                key={card.id}
                card={card}
                ctx={ctx}
                onConfigurar={handleConfigurar}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Config Sheet (for simple integrations) */}
      <ConfigurarIntegracaoSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        integracao={selectedTipo}
        nomeExibicao={selectedNome}
        onSuccess={handleSuccess}
        initialValues={drafts[selectedTipo] ?? {}}
        onValuesChange={handleValoresChange}
      />
    </div>
  );
}
