import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Phone, MapPin, Clock, User, Star, AlertCircle } from 'lucide-react';
import { useChamado } from '@/hooks/useMyData';
import type { Tables } from '@/integrations/supabase/types';

type Chamado = Tables<'chamados_assistencia'>;

export default function AppAssistenciaDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: chamado, isLoading } = useChamado(id);

  const getStatusBadge = (status: Chamado['status']) => {
    switch (status) {
      case 'aberto':
        return <Badge className="bg-yellow-500">Aberto</Badge>;
      case 'em_atendimento':
        return <Badge className="bg-blue-500">Em Atendimento</Badge>;
      case 'em_deslocamento':
        return <Badge className="bg-purple-500">Em Deslocamento</Badge>;
      case 'concluido':
        return <Badge className="bg-green-500">Concluído</Badge>;
      case 'cancelado':
        return <Badge variant="secondary">Cancelado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Skeleton className="h-8 w-32" />
        </div>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!chamado) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Chamado</h1>
        </div>
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold text-foreground">Chamado não encontrado</h3>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              Este chamado não existe ou foi removido
            </p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/app/assistencia')}>
              Voltar para Assistência
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">Chamado</h1>
          <p className="text-sm text-muted-foreground">#{chamado.protocolo}</p>
        </div>
        {getStatusBadge(chamado.status)}
      </div>

      {/* Prestador Info */}
      {chamado.prestador_nome && (
        <Card className="border-0 bg-primary text-primary-foreground shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
                <User className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">{chamado.prestador_nome}</p>
                <p className="text-sm opacity-80">Prestador de serviço</p>
              </div>
            </div>
            {chamado.prestador_telefone && (
              <Button 
                className="mt-3 w-full bg-white text-primary hover:bg-white/90"
                onClick={() => window.open(`tel:${chamado.prestador_telefone?.replace(/\D/g, '')}`)}
              >
                <Phone className="mr-2 h-4 w-4" />
                Ligar para o Prestador
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Chamado Details */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Detalhes do Chamado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Tipo de Serviço</p>
            <p className="font-medium text-foreground">{chamado.tipo_servico}</p>
          </div>
          {chamado.descricao && (
            <div>
              <p className="text-sm text-muted-foreground">Descrição</p>
              <p className="font-medium text-foreground">{chamado.descricao}</p>
            </div>
          )}
          <div>
            <p className="text-sm text-muted-foreground">Data de Abertura</p>
            <p className="font-medium text-foreground">
              {formatDateTime(chamado.data_abertura)}
            </p>
          </div>
          {chamado.data_conclusao && (
            <div>
              <p className="text-sm text-muted-foreground">Data de Conclusão</p>
              <p className="font-medium text-foreground">
                {formatDateTime(chamado.data_conclusao)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Location */}
      {chamado.origem_logradouro && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-primary" />
              Local do Atendimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground">
              {chamado.origem_logradouro}
              {chamado.origem_cidade && ` - ${chamado.origem_cidade}`}
              {chamado.origem_uf && `/${chamado.origem_uf}`}
            </p>
            {/* Map placeholder */}
            <div className="mt-3 flex h-32 items-center justify-center rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">Mapa em desenvolvimento</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rating (for concluded chamados) */}
      {chamado.status === 'concluido' && !chamado.avaliacao_nota && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Avalie o Atendimento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} className="p-1">
                  <Star className="h-8 w-8 text-muted-foreground hover:text-yellow-500" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Show rating if already rated */}
      {chamado.avaliacao_nota && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sua Avaliação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-8 w-8 ${
                    star <= (chamado.avaliacao_nota || 0) 
                      ? 'fill-yellow-500 text-yellow-500' 
                      : 'text-muted-foreground'
                  }`}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
