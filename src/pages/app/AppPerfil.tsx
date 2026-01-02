import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useMyAssociado, useMyVehicles } from '@/hooks/useMyData';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Car,
  FileText,
  ChevronRight,
  Edit
} from 'lucide-react';
import { Link } from 'react-router-dom';

const STATUS_LABELS: Record<string, string> = {
  em_analise: 'Em Análise',
  documentacao_pendente: 'Documentação Pendente',
  aguardando_instalacao: 'Aguardando Instalação',
  ativo: 'Ativo',
  inadimplente: 'Inadimplente',
  suspenso: 'Suspenso',
  cancelado: 'Cancelado',
};

export default function AppPerfil() {
  const { profile } = useAuth();
  const { data: associado, isLoading: associadoLoading } = useMyAssociado();
  const { data: vehicles, isLoading: vehiclesLoading } = useMyVehicles();

  const isLoading = associadoLoading || vehiclesLoading;
  const vehicle = vehicles?.[0];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ativo':
        return <Badge className="bg-green-500">Ativo</Badge>;
      case 'inadimplente':
        return <Badge className="bg-red-500">Inadimplente</Badge>;
      case 'suspenso':
        return <Badge className="bg-yellow-500">Suspenso</Badge>;
      case 'cancelado':
        return <Badge variant="secondary">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{STATUS_LABELS[status] || status}</Badge>;
    }
  };

  const formatAddress = () => {
    if (!associado) return 'Endereço não cadastrado';
    const parts = [
      associado.logradouro,
      associado.numero,
      associado.bairro,
      associado.cidade,
      associado.uf,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Endereço não cadastrado';
  };

  const formatCpf = (cpf: string) => {
    // Mask CPF for privacy
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '***.$2.***-**');
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Meu Perfil</h1>
        <Button variant="outline" size="sm">
          <Edit className="mr-2 h-4 w-4" />
          Editar
        </Button>
      </div>

      {/* Profile Header */}
      <Card className="border-0 shadow-sm">
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <User className="h-8 w-8 text-primary" />
          </div>
          {isLoading ? (
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          ) : (
            <div className="flex-1">
              <h2 className="text-lg font-bold text-foreground">
                {associado?.nome || profile?.nome || 'Associado'}
              </h2>
              <p className="text-sm text-muted-foreground">
                CPF: {associado?.cpf ? formatCpf(associado.cpf) : '***.***.***-**'}
              </p>
              {associado && getStatusBadge(associado.status)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contact Info */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Contato</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Mail className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">E-mail</p>
              {isLoading ? (
                <Skeleton className="h-5 w-40" />
              ) : (
                <p className="font-medium text-foreground">
                  {associado?.email || profile?.email || 'Não cadastrado'}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Phone className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Telefone</p>
              {isLoading ? (
                <Skeleton className="h-5 w-32" />
              ) : (
                <p className="font-medium text-foreground">
                  {associado?.telefone || profile?.telefone || 'Não cadastrado'}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <MapPin className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Endereço</p>
              {isLoading ? (
                <Skeleton className="h-5 w-48" />
              ) : (
                <p className="font-medium text-foreground">{formatAddress()}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vehicle Info */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Car className="h-4 w-4 text-primary" />
            Meu Veículo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : vehicle ? (
            <div className="rounded-lg bg-muted p-4">
              <p className="text-xl font-bold tracking-wider text-foreground">
                {vehicle.placa}
              </p>
              <p className="text-sm text-muted-foreground">
                {vehicle.marca} {vehicle.modelo} - {vehicle.ano_fabricacao}/{vehicle.ano_modelo}
              </p>
            </div>
          ) : (
            <div className="rounded-lg bg-muted p-4 text-center">
              <p className="text-muted-foreground">Nenhum veículo cadastrado</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan Info */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" />
            Meu Plano
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-foreground">
                  {associado?.planos?.nome || 'Plano não definido'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Associado desde {associado?.created_at 
                    ? new Date(associado.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
                    : '-'}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents */}
      <Link to="/app/documentos">
        <Card className="border-0 shadow-sm transition-shadow hover:shadow-md">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Meus Documentos</p>
                <p className="text-sm text-muted-foreground">CNH, CRLV e outros</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
