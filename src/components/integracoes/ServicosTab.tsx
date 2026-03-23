import { useState, useCallback } from 'react';
import { CreditCard, MessageSquare, MapPin, FileSignature, Zap, CheckCircle, Mail, Search, Settings, Loader2, Building2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ConfigurarIntegracaoSheet } from './ConfigurarIntegracaoSheet';
import { useIntegracoesStatus } from '@/hooks/useIntegracoesStatus';
import { useTodasIntegracoesCredenciais, IntegracaoTipo } from '@/hooks/useIntegracaoCredenciais';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Servico {
  id: string;
  nome: string;
  desc: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  integracaoId?: string;
  integracaoTipo?: IntegracaoTipo;
  plataformaCodigo?: 'softruck' | 'rede_veiculos';
  configuravel?: boolean;
  sempreAtivo?: boolean;
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
        integracaoId: 'asaas',
        integracaoTipo: 'asaas',
        configuravel: true,
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
        integracaoId: 'whatsapp',
        integracaoTipo: 'whatsapp',
        configuravel: true,
      },
      {
        id: 'email',
        nome: 'Email SMTP',
        desc: 'Envio de cotações',
        icon: Mail,
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10',
        integracaoId: 'email',
        integracaoTipo: 'resend',
        configuravel: true,
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
        plataformaCodigo: 'rede_veiculos',
        integracaoTipo: 'rede_veiculos',
        configuravel: true,
      },
      {
        id: 'softruck',
        nome: 'Softruck',
        desc: 'Rastreamento e telemetria',
        icon: MapPin,
        color: 'text-orange-500',
        bgColor: 'bg-orange-500/10',
        plataformaCodigo: 'softruck',
        integracaoTipo: 'softruck',
        configuravel: true,
      },
      {
        id: 'fipe',
        nome: 'Tabela FIPE',
        desc: 'Consulta de valores',
        icon: Search,
        color: 'text-indigo-500',
        bgColor: 'bg-indigo-500/10',
        sempreAtivo: true,
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
        integracaoId: 'autentique',
        integracaoTipo: 'autentique',
        configuravel: true,
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
        sempreAtivo: true,
      },
    ],
  },
  {
    titulo: 'Gestão',
    emoji: '🏢',
    servicos: [
      {
        id: 'hinova',
        nome: 'SGA Hinova',
        desc: 'Sistema de gestão de associados',
        icon: Building2,
        color: 'text-cyan-500',
        bgColor: 'bg-cyan-500/10',
        integracaoId: 'hinova',
        integracaoTipo: 'hinova',
        configuravel: true,
      },
    ],
  },
];

interface ServicoCardProps {
  servico: Servico;
  status: { ativo: boolean; ultimaExecucao?: string };
  onConfigurar?: () => void;
  isLoading?: boolean;
}

function ServicoCard({ servico, status, onConfigurar, isLoading }: ServicoCardProps) {
  const Icon = servico.icon;
  const isAtivo = status.ativo;

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
          {isLoading ? (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
            </div>
          ) : (
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
          )}
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground mt-3 flex-1">
          {servico.desc}
        </p>

        {/* Last execution if available */}
        {status.ultimaExecucao && (
          <p className="text-xs text-muted-foreground mt-1">
            Último teste: {status.ultimaExecucao}
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
              {servico.configuravel && onConfigurar && (
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
              onClick={servico.configuravel ? onConfigurar : undefined}
              disabled={!servico.configuravel && !servico.sempreAtivo}
            >
              <Settings className="w-4 h-4" />
              {servico.configuravel ? 'Configurar' : 'Não configurado'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Tipo para armazenar rascunhos por integração
type DraftValues = Partial<Record<IntegracaoTipo, Record<string, string>>>;

export function ServicosTab() {
  // Sheet para todas as integrações (incluindo rastreadores)
  const [integracaoSheetOpen, setIntegracaoSheetOpen] = useState(false);
  
  // Seleções
  const [integracaoSelecionada, setIntegracaoSelecionada] = useState<IntegracaoTipo>('hinova');
  const [nomeIntegracao, setNomeIntegracao] = useState('');
  
  // Estado de rascunho para manter valores digitados entre abrir/fechar do sheet
  const [drafts, setDrafts] = useState<DraftValues>({});
  
  const integracoes = useIntegracoesStatus();
  const { data: credenciaisBanco, refetch: refetchCredenciais } = useTodasIntegracoesCredenciais();

  // Callback para atualizar o rascunho quando o usuário digita
  const handleValoresChange = useCallback((integracao: IntegracaoTipo, valores: Record<string, string>) => {
    setDrafts(prev => ({
      ...prev,
      [integracao]: valores,
    }));
  }, []);

  // Limpar draft de uma integração específica
  const clearDraft = useCallback((integracao: IntegracaoTipo) => {
    setDrafts(prev => {
      const newDrafts = { ...prev };
      delete newDrafts[integracao];
      return newDrafts;
    });
  }, []);

  // Função para obter status de cada serviço
  function getServicoStatus(servico: Servico): { ativo: boolean; ultimaExecucao?: string } {
    // Serviços sempre ativos
    if (servico.sempreAtivo) {
      return { ativo: true };
    }

    // Verificar primeiro se tem credenciais no banco
    const credencialBanco = credenciaisBanco?.find(c => c.integracao === servico.integracaoTipo);
    if (credencialBanco?.configurado) {
      return {
        ativo: true,
        ultimaExecucao: credencialBanco.testado_em 
          ? formatDistanceToNow(new Date(credencialBanco.testado_em), { addSuffix: true, locale: ptBR })
          : undefined
      };
    }

    // Rastreadores (usam teste de conexão)
    if (servico.plataformaCodigo === 'softruck') {
      return {
        ativo: integracoes.softruck.configurado,
        ultimaExecucao: integracoes.softruck.testado_em 
          ? formatDistanceToNow(new Date(integracoes.softruck.testado_em), { addSuffix: true, locale: ptBR })
          : undefined
      };
    }
    if (servico.plataformaCodigo === 'rede_veiculos') {
      return {
        ativo: integracoes.rede_veiculos.configurado && integracoes.rede_veiculos.testado,
        ultimaExecucao: integracoes.rede_veiculos.testado_em 
          ? formatDistanceToNow(new Date(integracoes.rede_veiculos.testado_em), { addSuffix: true, locale: ptBR })
          : undefined
      };
    }

    // Integrações por secret
    switch (servico.integracaoId) {
      case 'asaas':
        return { ativo: integracoes.asaas.configurado };
      case 'autentique':
        return { ativo: integracoes.autentique.configurado };
      case 'email':
        return { ativo: integracoes.email.configurado };
      case 'whatsapp':
        // WhatsApp precisa estar conectado (não apenas ter a API configurada)
        return { ativo: integracoes.whatsapp.conectado };
      case 'hinova':
        return { ativo: integracoes.hinova.configurado };
      default:
        return { ativo: false };
    }
  }

  function handleConfigurar(servico: Servico) {
    // Todas as integrações usam o mesmo sheet genérico (incluindo rastreadores)
    if (servico.integracaoTipo) {
      setIntegracaoSelecionada(servico.integracaoTipo);
      setNomeIntegracao(servico.nome);
      setIntegracaoSheetOpen(true);
    }
  }

  function handleIntegracaoSuccess() {
    // Limpar o rascunho da integração ao salvar/remover com sucesso
    clearDraft(integracaoSelecionada);
    integracoes.refetch();
    refetchCredenciais();
    setIntegracaoSheetOpen(false);
  }

  return (
    <>
      <div className="space-y-8">
        {categoriasBase.map((categoria) => (
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
                  status={getServicoStatus(servico)}
                  isLoading={integracoes.isLoading}
                  onConfigurar={servico.configuravel ? () => handleConfigurar(servico) : undefined}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Sheet para outras integrações */}
      <ConfigurarIntegracaoSheet
        open={integracaoSheetOpen}
        onOpenChange={setIntegracaoSheetOpen}
        integracao={integracaoSelecionada}
        nomeExibicao={nomeIntegracao}
        onSuccess={handleIntegracaoSuccess}
        initialValues={drafts[integracaoSelecionada] ?? {}}
        onValuesChange={(valores) => handleValoresChange(integracaoSelecionada, valores)}
      />
    </>
  );
}
