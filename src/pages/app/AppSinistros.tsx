import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertTriangle, 
  Plus, 
  ChevronRight, 
  Clock, 
  CheckCircle,
  XCircle,
  DollarSign
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMySinistros } from '@/hooks/useMyData';
import type { Tables } from '@/integrations/supabase/types';

type Sinistro = Tables<'sinistros'>;

const TIPO_LABELS: Record<string, string> = {
  roubo: 'Roubo',
  furto: 'Furto',
  colisao: 'Colisão',
  incendio: 'Incêndio',
  alagamento: 'Alagamento',
  outro: 'Outro',
};

export default function AppSinistros() {
  const { data: sinistros, isLoading } = useMySinistros();

  const getStatusBadge = (status: Sinistro['status']) => {
    switch (status) {
      case 'em_analise':
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
            <Clock className="mr-1 h-3 w-3" />
            Em Análise
          </Badge>
        );
      case 'aprovado':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700">
            <CheckCircle className="mr-1 h-3 w-3" />
            Aprovado
          </Badge>
        );
      case 'reprovado':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700">
            <XCircle className="mr-1 h-3 w-3" />
            Reprovado
          </Badge>
        );
      case 'indenizado':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700">
            <DollarSign className="mr-1 h-3 w-3" />
            Indenizado
          </Badge>
        );
      case 'cancelado':
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700">
            <XCircle className="mr-1 h-3 w-3" />
            Cancelado
          </Badge>
        );
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Sinistros</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie suas ocorrências
          </p>
        </div>
        <Button asChild>
          <Link to="/app/sinistros/novo">
            <Plus className="mr-2 h-4 w-4" />
            Novo
          </Link>
        </Button>
      </div>

      {/* Info Card */}
      <Card className="border-0 bg-amber-50 shadow-sm">
        <CardContent className="flex items-start gap-3 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">Importante</p>
            <p>Em caso de roubo ou furto, registre o Boletim de Ocorrência antes de abrir o sinistro.</p>
          </div>
        </CardContent>
      </Card>

      {/* Sinistros List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !sinistros || sinistros.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold text-foreground">Nenhum sinistro</h3>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              Esperamos que você nunca precise usar isso
            </p>
            <Button asChild className="mt-4">
              <Link to="/app/sinistros/novo">
                <Plus className="mr-2 h-4 w-4" />
                Abrir Sinistro
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sinistros.map((sinistro) => (
            <Card key={sinistro.id} className="border-0 shadow-sm">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-foreground">
                      #{sinistro.protocolo}
                    </p>
                    {getStatusBadge(sinistro.status)}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{TIPO_LABELS[sinistro.tipo] || sinistro.tipo}</span>
                    <span>•</span>
                    <span>{formatDate(sinistro.data_ocorrencia)}</span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
