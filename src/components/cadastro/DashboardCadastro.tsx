import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText,
  Clock,
  CheckCircle,
  ArrowRight,
  Shield,
  Eye,
  User,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentosQueue, useDocumentosStats } from '@/hooks/useDocumentosQueue';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';


// ============================================
// COMPONENTE: CARD DE KPI
// ============================================
interface KPICardProps {
  titulo: string;
  valor: number | string;
  icon: React.ReactNode;
  cor: string;
  loading?: boolean;
}

function KPICard({ titulo, valor, icon, cor, loading }: KPICardProps) {
  if (loading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-24 bg-muted" />
              <Skeleton className="h-8 w-16 bg-muted" />
            </div>
            <Skeleton className="h-10 w-10 rounded bg-muted" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card hover:border-border-hover transition-all duration-200">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{titulo}</p>
            <p className="text-3xl font-bold text-foreground">{valor}</p>
          </div>
          <div className={cn("p-3 rounded-lg", cor)}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// COMPONENTE: BANNER DE BOAS-VINDAS
// ============================================
interface WelcomeBannerProps {
  nome: string;
}

function WelcomeBanner({ nome }: WelcomeBannerProps) {
  const getSaudacao = () => {
    const hora = new Date().getHours();
    if (hora < 12) return 'Bom dia';
    if (hora < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border-hover bg-gradient-to-r from-purple-900 via-violet-800 to-purple-900 p-6">
      {/* Glow effect */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-purple-400/10 rounded-full blur-3xl" />
      
      {/* Decorative icon */}
      <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-10">
        <FileText className="h-32 w-32 text-white" />
      </div>
      
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <Badge className="bg-purple-500/30 text-purple-200 border-purple-400/30">
            Analista de Cadastro
          </Badge>
        </div>
        <h1 className="text-2xl font-bold text-white">
          {getSaudacao()}, {nome}! 👋
        </h1>
        <p className="text-white/80 mt-1">
          Gerencie documentos e associados da sua fila de trabalho.
        </p>
      </div>
    </div>
  );
}

// ============================================
// COMPONENTE: LISTA DE DOCUMENTOS PENDENTES
// ============================================
function DocumentosPendentes() {
  const navigate = useNavigate();
  const { data: documentos, isLoading } = useDocumentosQueue({ 
    status: 'pendente', 
    orderBy: 'oldest'
  });

  if (isLoading) {
    return (
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Fila de Documentos</CardTitle>
          <CardDescription>Documentos aguardando sua análise</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 w-full bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const pendentes = documentos?.slice(0, 5) || [];

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Clock className="h-5 w-5 text-warning" />
              Fila de Documentos
            </CardTitle>
            <CardDescription>
              {pendentes.length > 0 
                ? `${documentos?.length || 0} documentos aguardando análise`
                : 'Nenhum documento pendente'}
            </CardDescription>
          </div>
          <Button 
            variant="outline"
            size="sm"
            className="border-border hover:border-border-hover"
            onClick={() => navigate('/cadastro/documentos')}
          >
            Ver Todos <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {pendentes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 text-success" />
            <p>Parabéns! Sua fila está vazia.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendentes.map((doc) => (
              <div 
                key={doc.id}
                className="flex items-center justify-between p-3 rounded-lg bg-card-hover border border-border hover:border-border-hover transition-colors cursor-pointer"
                onClick={() => navigate(`/cadastro/documentos/${doc.id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <FileText className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {doc.associados?.nome || 'Sem associado'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {doc.tipo} • {doc.veiculos?.placa || 'Sem veículo'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    há {formatDistanceToNow(new Date(doc.created_at), { locale: ptBR })}
                  </span>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {pendentes.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <Button 
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => {
                const primeiro = pendentes[0];
                if (primeiro) navigate(`/cadastro/documentos/${primeiro.id}`);
              }}
            >
              <FileText className="mr-2 h-4 w-4" />
              Analisar Próximo Documento
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// COMPONENTE PRINCIPAL: DASHBOARD CADASTRO
// ============================================
export function DashboardCadastro() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const { data: stats, isLoading: statsLoading } = useDocumentosStats();

  // Calcular métricas
  const pendentes = stats?.pendentes || 0;
  const emAnalise = stats?.emAnalise || 0;
  const aprovados = stats?.aprovados || 0;
  const reprovados = stats?.reprovados || 0;
  const total = aprovados + reprovados;
  const taxaAprovacao = total > 0 ? Math.round((aprovados / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* BANNER */}
      <WelcomeBanner nome={profile?.nome?.split(' ')[0] || 'Analista'} />

      {/* KPIs - Grid de 4 */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          titulo="Documentos Pendentes"
          valor={pendentes}
          icon={<Clock className="h-5 w-5 text-white" />}
          cor="bg-warning"
          loading={statsLoading}
        />
        <KPICard
          titulo="Em Análise"
          valor={emAnalise}
          icon={<Eye className="h-5 w-5 text-white" />}
          cor="bg-info"
          loading={statsLoading}
        />
        <KPICard
          titulo="Aprovados"
          valor={aprovados}
          icon={<CheckCircle className="h-5 w-5 text-white" />}
          cor="bg-success"
          loading={statsLoading}
        />
        <KPICard
          titulo="Taxa de Aprovação"
          valor={`${taxaAprovacao}%`}
          icon={<Shield className="h-5 w-5 text-white" />}
          cor="bg-purple-600"
          loading={statsLoading}
        />
      </div>

      {/* CONTEÚDO PRINCIPAL */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Documentos Pendentes */}
        <DocumentosPendentes />

        {/* Ações Rápidas */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Ações Rápidas</CardTitle>
            <CardDescription>Acesso direto às principais funcionalidades</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full justify-start h-auto py-4 border-border hover:border-purple-500 hover:bg-purple-500/10"
              onClick={() => navigate('/cadastro/propostas')}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <CheckCircle className="h-5 w-5 text-purple-500" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-foreground">Propostas Pendentes</p>
                  <p className="text-sm text-muted-foreground">Analisar contratos assinados</p>
                </div>
              </div>
            </Button>

            <Button 
              variant="outline" 
              className="w-full justify-start h-auto py-4 border-border hover:border-purple-500 hover:bg-purple-500/10"
              onClick={() => navigate('/cadastro/documentos')}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <FileText className="h-5 w-5 text-purple-500" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-foreground">Fila de Documentos</p>
                  <p className="text-sm text-muted-foreground">Analisar documentos pendentes</p>
                </div>
              </div>
            </Button>

            <Button 
              variant="outline" 
              className="w-full justify-start h-auto py-4 border-border hover:border-purple-500 hover:bg-purple-500/10"
              onClick={() => navigate('/cadastro/associados')}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Shield className="h-5 w-5 text-purple-500" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-foreground">Associados</p>
                  <p className="text-sm text-muted-foreground">Consultar e editar cadastros</p>
                </div>
              </div>
            </Button>

            <Button 
              variant="outline" 
              className="w-full justify-start h-auto py-4 border-border hover:border-muted-foreground hover:bg-muted/50"
              onClick={() => navigate('/perfil')}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-foreground">Meu Perfil</p>
                  <p className="text-sm text-muted-foreground">Configurações da conta</p>
                </div>
              </div>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}