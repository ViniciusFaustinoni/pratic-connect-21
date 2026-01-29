import { useState } from 'react';
import { CreditCard, MessageSquare, MapPin, FileSignature, Zap, CheckCircle, Mail, Search, ExternalLink, Settings } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ConfigurarRastreadorSheet } from './ConfigurarRastreadorSheet';
import { useRastreadorStatus } from '@/hooks/useRastreadorStatus';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Servico {
  id: string;
  nome: string;
  desc: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  ativo: boolean;
  ultimaExecucao?: string;
  plataformaCodigo?: 'softruck' | 'rede_veiculos';
  configuravel?: boolean;
}

interface CategoriaServicos {
  titulo: string;
  emoji: string;
  servicos: Servico[];
}

const categoriasBase: CategoriaServicos[] = [
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
        id: 'rede_veiculos',
        nome: 'Rede Veículos',
        desc: 'Rastreamento em tempo real',
        icon: MapPin,
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10',
        ativo: false,
        plataformaCodigo: 'rede_veiculos',
        configuravel: true,
      },
      {
        id: 'softruck',
        nome: 'Softruck',
        desc: 'Rastreamento e telemetria',
        icon: MapPin,
        color: 'text-orange-500',
        bgColor: 'bg-orange-500/10',
        ativo: false,
        plataformaCodigo: 'softruck',
        configuravel: true,
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

function ServicoCard({ 
  servico, 
  onConfigurar 
}: { 
  servico: Servico & { statusRastreador?: { configurado: boolean; teste_sucesso: boolean; testado_em: string | null } };
  onConfigurar?: () => void;
}) {
  const Icon = servico.icon;
  
  // Determinar status real para plataformas rastreadores
  const isRastreador = servico.configuravel && servico.plataformaCodigo;
  const statusConfig = servico.statusRastreador;
  const isAtivo = isRastreador 
    ? (statusConfig?.configurado && statusConfig?.teste_sucesso) 
    : servico.ativo;
  
  const ultimaExecucao = isRastreador && statusConfig?.testado_em
    ? formatDistanceToNow(new Date(statusConfig.testado_em), { addSuffix: true, locale: ptBR })
    : servico.ultimaExecucao;

  return (
    <Card className={cn(
      "border-border/50 min-h-[160px] transition-all duration-200 hover:shadow-md hover:border-primary/30",
      isAtivo && "ring-1 ring-green-500/20"
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
            isAtivo 
              ? "bg-green-500/10 text-green-500" 
              : "bg-red-500/10 text-red-500"
          )}>
            <span className={cn(
              "h-2 w-2 rounded-full",
              isAtivo ? "bg-green-500 animate-pulse" : "bg-red-500"
            )} />
            {isAtivo ? 'ON' : 'OFF'}
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground mt-3 flex-1">
          {servico.desc}
        </p>

        {/* Last execution if available */}
        {ultimaExecucao && (
          <p className="text-xs text-muted-foreground mt-1">
            {isRastreador ? 'Último teste:' : 'Última execução:'} {ultimaExecucao}
          </p>
        )}

        {/* Action Button */}
        <div className="mt-4 pt-4 border-t border-border/50">
          {isAtivo ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="gap-2 text-green-500 hover:text-green-600 hover:bg-green-500/10">
                <CheckCircle className="w-4 h-4" />
                Configurado
              </Button>
              {isRastreador && onConfigurar && (
                <Button variant="outline" size="sm" className="gap-2" onClick={onConfigurar}>
                  <Settings className="w-4 h-4" />
                  Editar
                </Button>
              )}
            </div>
          ) : (
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={isRastreador ? onConfigurar : undefined}
            >
              {isRastreador ? <Settings className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
              Configurar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ServicosTab() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [plataformaSelecionada, setPlataformaSelecionada] = useState<'softruck' | 'rede_veiculos'>('softruck');
  
  const { data: statusRastreadores, refetch: refetchStatus } = useRastreadorStatus();

  // Enriquecer serviços com status real dos rastreadores
  const categoriasEnriquecidas = categoriasBase.map(cat => ({
    ...cat,
    servicos: cat.servicos.map(servico => {
      if (servico.plataformaCodigo) {
        const status = statusRastreadores?.find(s => s.plataforma === servico.plataformaCodigo);
        return {
          ...servico,
          statusRastreador: status ? {
            configurado: status.configurado,
            teste_sucesso: status.teste_sucesso,
            testado_em: status.testado_em,
          } : undefined,
        };
      }
      return servico;
    }),
  }));

  function handleConfigurar(plataforma: 'softruck' | 'rede_veiculos') {
    setPlataformaSelecionada(plataforma);
    setSheetOpen(true);
  }

  function handleSheetSuccess() {
    refetchStatus();
    setSheetOpen(false);
  }

  return (
    <>
      <div className="space-y-8">
        {categoriasEnriquecidas.map((categoria) => (
          <div key={categoria.titulo} className="space-y-4">
            {/* Section Title */}
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <span>{categoria.emoji}</span>
              {categoria.titulo}
            </h2>

            {/* Services Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoria.servicos.map((servico) => (
                <ServicoCard 
                  key={servico.id} 
                  servico={servico}
                  onConfigurar={servico.plataformaCodigo ? () => handleConfigurar(servico.plataformaCodigo!) : undefined}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <ConfigurarRastreadorSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        plataforma={plataformaSelecionada}
        onSuccess={handleSheetSuccess}
      />
    </>
  );
}
