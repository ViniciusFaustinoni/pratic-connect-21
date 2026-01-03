import { useNavigate } from 'react-router-dom';
import { 
  Car, 
  MapPin, 
  FileText, 
  LifeBuoy, 
  AlertTriangle
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { 
  useMyAssociado, 
  useMyVehicles, 
  useMyVehicleWithTracker,
  useMyPendingDocuments 
} from '@/hooks/useMyData';

// Import card components
import { 
  CardVeiculo, 
  CardBoleto, 
  CardAcessoRapido,
  CardPlano,
  ListaAlertas,
  CardTudoEmDia
} from '@/components/app';

// Mock de boleto (tabela não existe ainda)
const mockBoleto = {
  id: '1',
  competencia: 'Janeiro/2026',
  vencimento: '10/01/2026',
  valor: 189.90,
  status: 'pendente' as const,
  pixCopiaCola: '00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-426614174000'
};

// Configuração dos acessos rápidos
const acessosRapidos = [
  { 
    icon: LifeBuoy, 
    label: 'Assistência', 
    rota: '/app/assistencia',
    cor: 'text-red-600',
    bgCor: 'bg-red-50'
  },
  { 
    icon: FileText, 
    label: 'Boletos', 
    rota: '/app/boletos',
    cor: 'text-blue-600',
    bgCor: 'bg-blue-50'
  },
  { 
    icon: MapPin, 
    label: 'Mapa', 
    rota: '/app/rastreamento',
    cor: 'text-green-600',
    bgCor: 'bg-green-50'
  },
  { 
    icon: AlertTriangle, 
    label: 'Sinistros', 
    rota: '/app/sinistros',
    cor: 'text-orange-600',
    bgCor: 'bg-orange-50'
  },
];

export default function AppHome() {
  const { profile } = useAuth();
  const { data: associado, isLoading: loadingAssociado } = useMyAssociado();
  const { data: veiculos, isLoading: loadingVeiculos } = useMyVehicles();
  const { data: rastreador } = useMyVehicleWithTracker();
  const { data: docsPendentes, isLoading: loadingDocs } = useMyPendingDocuments();

  const veiculo = veiculos?.[0];
  const isLoading = loadingAssociado || loadingVeiculos;

  const getPrimeiroNome = (nome: string) => nome.split(' ')[0];

  // Montar alertas
  const alertas: Array<{
    id: string;
    tipo: 'documento' | 'boleto' | 'aviso' | 'veiculo' | 'urgente';
    titulo: string;
    descricao: string;
    rota: string;
  }> = [];

  if (docsPendentes && docsPendentes.length > 0) {
    alertas.push({
      id: 'docs',
      tipo: 'documento',
      titulo: 'Documentos pendentes',
      descricao: `${docsPendentes.length} documento(s) precisam de atenção`,
      rota: '/app/documentos'
    });
  }

  if (isLoading) {
    return <HomeLoading />;
  }

  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      {/* Saudação */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">
          Olá, {profile?.nome ? getPrimeiroNome(profile.nome) : 'Associado'}! 👋
        </h1>
      </div>

      {/* Card do Veículo */}
      {veiculo && (
        <CardVeiculo 
          veiculo={veiculo} 
          rastreador={rastreador}
        />
      )}

      {/* Sem veículo */}
      {!veiculo && !loadingVeiculos && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Car className="h-5 w-5" />
              <p className="text-sm">Nenhum veículo cadastrado</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Card do Plano */}
      {associado?.planos && (
        <CardPlano 
          plano={associado.planos}
          dataAdesao={associado.created_at}
          compacto
          onClick={() => navigate('/app/perfil')}
        />
      )}

      {/* Card do Próximo Boleto */}
      <CardBoleto boleto={mockBoleto} />

      {/* Acesso Rápido */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Acesso Rápido
        </h2>
        <CardAcessoRapido itens={acessosRapidos} colunas={4} />
      </div>

      {/* Alertas */}
      <ListaAlertas alertas={alertas} />

      {/* Tudo em dia */}
      {alertas.length === 0 && !loadingDocs && (
        <CardTudoEmDia />
      )}
    </div>
  );
}

// Loading state
function HomeLoading() {
  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      {/* Saudação */}
      <div className="space-y-1">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Card veículo */}
      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-3 p-4">
          <Skeleton className="h-5 w-28" />
          <div className="flex justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>

      {/* Card plano */}
      <Card className="border-0 shadow-sm">
        <CardContent className="flex items-center gap-3 p-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </CardContent>
      </Card>

      {/* Card boleto */}
      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-3 p-4">
          <Skeleton className="h-5 w-28" />
          <div className="flex justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 flex-1" />
          </div>
        </CardContent>
      </Card>

      {/* Acesso rápido */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
