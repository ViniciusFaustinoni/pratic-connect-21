import { CreditCard, MessageSquare, MapPin, FileSignature, Zap, CheckCircle, Mail, Search, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Servico {
  id: string;
  nome: string;
  desc: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  ativo: boolean;
  ultimaExecucao?: string;
}

interface CategoriaServicos {
  titulo: string;
  emoji: string;
  servicos: Servico[];
}

const categorias: CategoriaServicos[] = [
  {
    titulo: 'Pagamentos',
    emoji: '💳',
    servicos: [
      {
        id: 'asaas',
        nome: 'ASAAS',
        desc: 'Boletos, Pix e cobranças',
        icon: CreditCard,
        color: 'text-green-500',
        bgColor: 'bg-green-500/10',
        ativo: false,
      },
    ],
  },
  {
    titulo: 'Comunicação',
    emoji: '💬',
    servicos: [
      {
        id: 'whatsapp',
        nome: 'WhatsApp',
        desc: 'Mensagens automáticas',
        icon: MessageSquare,
        color: 'text-emerald-500',
        bgColor: 'bg-emerald-500/10',
        ativo: false,
      },
      {
        id: 'email',
        nome: 'Email SMTP',
        desc: 'Envio de cotações',
        icon: Mail,
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10',
        ativo: false,
      },
    ],
  },
  {
    titulo: 'Veículos',
    emoji: '🚗',
    servicos: [
      {
        id: 'rastreadores',
        nome: 'Rede Veículos',
        desc: 'Rastreamento em tempo real',
        icon: MapPin,
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10',
        ativo: false,
      },
      {
        id: 'fipe',
        nome: 'Tabela FIPE',
        desc: 'Consulta de valores',
        icon: Search,
        color: 'text-indigo-500',
        bgColor: 'bg-indigo-500/10',
        ativo: true,
      },
    ],
  },
  {
    titulo: 'Documentos',
    emoji: '📝',
    servicos: [
      {
        id: 'autentique',
        nome: 'Autentique',
        desc: 'Assinatura digital',
        icon: FileSignature,
        color: 'text-purple-500',
        bgColor: 'bg-purple-500/10',
        ativo: false,
      },
    ],
  },
  {
    titulo: 'Automação',
    emoji: '⚡',
    servicos: [
      {
        id: 'n8n',
        nome: 'n8n',
        desc: 'Workflows e automações',
        icon: Zap,
        color: 'text-orange-500',
        bgColor: 'bg-orange-500/10',
        ativo: true,
        ultimaExecucao: 'há 5 min',
      },
    ],
  },
];

function ServicoCard({ servico }: { servico: Servico }) {
  const Icon = servico.icon;

  return (
    <Card className={cn(
      "border-border/50 min-h-[160px] transition-all duration-200 hover:shadow-md hover:border-primary/30",
      servico.ativo && "ring-1 ring-green-500/20"
    )}>
      <CardContent className="p-5 h-full flex flex-col">
        {/* Header with Icon, Name and Status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={cn("p-2.5 rounded-lg", servico.bgColor)}>
              <Icon className={cn("w-5 h-5", servico.color)} />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{servico.nome}</h3>
            </div>
          </div>
          
          {/* Status Badge */}
          <div className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
            servico.ativo 
              ? "bg-green-500/10 text-green-500" 
              : "bg-red-500/10 text-red-500"
          )}>
            <span className={cn(
              "h-2 w-2 rounded-full",
              servico.ativo ? "bg-green-500 animate-pulse" : "bg-red-500"
            )} />
            {servico.ativo ? 'ON' : 'OFF'}
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground mt-3 flex-1">
          {servico.desc}
        </p>

        {/* Last execution if available */}
        {servico.ultimaExecucao && (
          <p className="text-xs text-muted-foreground mt-1">
            Última execução: {servico.ultimaExecucao}
          </p>
        )}

        {/* Action Button */}
        <div className="mt-4 pt-4 border-t border-border/50">
          {servico.ativo ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="gap-2 text-green-500 hover:text-green-600 hover:bg-green-500/10">
                <CheckCircle className="w-4 h-4" />
                Configurado
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                Ver Logs
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="gap-2">
              <ExternalLink className="w-4 h-4" />
              Configurar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ServicosTab() {
  return (
    <div className="space-y-8">
      {categorias.map((categoria) => (
        <div key={categoria.titulo} className="space-y-4">
          {/* Section Title */}
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <span>{categoria.emoji}</span>
            {categoria.titulo}
          </h2>

          {/* Services Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoria.servicos.map((servico) => (
              <ServicoCard key={servico.id} servico={servico} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
