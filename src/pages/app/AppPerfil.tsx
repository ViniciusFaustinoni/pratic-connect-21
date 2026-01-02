import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
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

export default function AppPerfil() {
  const { profile } = useAuth();

  // Mock data - will be replaced with real data
  const associado = {
    nome: profile?.nome || 'Associado',
    cpf: '***.***.***-00',
    email: profile?.email || '',
    telefone: profile?.telefone || '(11) 99999-9999',
    endereco: 'Av. Paulista, 1000 - São Paulo/SP',
    plano: 'Proteção Total',
    status: 'ativo' as const,
    dataCadastro: new Date(2025, 5, 15),
  };

  const veiculo = {
    placa: 'ABC-1234',
    modelo: 'Fiat Uno 1.0',
    ano: '2022/2023',
  };

  const getStatusBadge = (status: typeof associado.status) => {
    switch (status) {
      case 'ativo':
        return <Badge className="bg-green-500">Ativo</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
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
          <div className="flex-1">
            <h2 className="text-lg font-bold text-foreground">{associado.nome}</h2>
            <p className="text-sm text-muted-foreground">CPF: {associado.cpf}</p>
            {getStatusBadge(associado.status)}
          </div>
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
              <p className="font-medium text-foreground">{associado.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Phone className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Telefone</p>
              <p className="font-medium text-foreground">{associado.telefone}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <MapPin className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Endereço</p>
              <p className="font-medium text-foreground">{associado.endereco}</p>
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
          <div className="rounded-lg bg-muted p-4">
            <p className="text-xl font-bold tracking-wider text-foreground">
              {veiculo.placa}
            </p>
            <p className="text-sm text-muted-foreground">
              {veiculo.modelo} - {veiculo.ano}
            </p>
          </div>
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
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-foreground">{associado.plano}</p>
              <p className="text-sm text-muted-foreground">
                Associado desde {associado.dataCadastro.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
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
