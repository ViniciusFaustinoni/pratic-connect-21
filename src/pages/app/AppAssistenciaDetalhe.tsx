import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Phone, MapPin, Clock, User, Star } from 'lucide-react';

export default function AppAssistenciaDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Mock data
  const chamado = {
    id,
    protocolo: 'ASS-20260102-0001',
    tipo: 'Guincho',
    status: 'em_atendimento' as 'aberto' | 'em_atendimento' | 'concluido',
    dataAbertura: new Date(2026, 0, 2, 14, 30),
    descricao: 'Veículo não liga após tentar dar partida',
    origem: {
      endereco: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
    },
    prestador: {
      nome: 'Auto Socorro Silva',
      telefone: '(11) 99999-9999',
      tempoEstimado: '25 min',
    },
  };

  const getStatusBadge = (status: typeof chamado.status) => {
    switch (status) {
      case 'em_atendimento':
        return <Badge className="bg-blue-500">Em Atendimento</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

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
      <Card className="border-0 bg-primary text-primary-foreground shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
              <User className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">{chamado.prestador.nome}</p>
              <p className="text-sm opacity-80">Prestador de serviço</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-lg bg-white/10 p-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Tempo estimado</span>
            </div>
            <span className="font-bold">{chamado.prestador.tempoEstimado}</span>
          </div>
          <Button 
            className="mt-3 w-full bg-white text-primary hover:bg-white/90"
            onClick={() => window.open(`tel:${chamado.prestador.telefone.replace(/\D/g, '')}`)}
          >
            <Phone className="mr-2 h-4 w-4" />
            Ligar para o Prestador
          </Button>
        </CardContent>
      </Card>

      {/* Chamado Details */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Detalhes do Chamado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Tipo de Serviço</p>
            <p className="font-medium text-foreground">{chamado.tipo}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Descrição</p>
            <p className="font-medium text-foreground">{chamado.descricao}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Data de Abertura</p>
            <p className="font-medium text-foreground">
              {formatDateTime(chamado.dataAbertura)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Location */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4 text-primary" />
            Local do Atendimento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-foreground">{chamado.origem.endereco}</p>
          {/* Map placeholder */}
          <div className="mt-3 flex h-32 items-center justify-center rounded-lg bg-muted">
            <p className="text-sm text-muted-foreground">Mapa em desenvolvimento</p>
          </div>
        </CardContent>
      </Card>

      {/* Rating (for concluded chamados) */}
      {chamado.status === 'concluido' && (
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
    </div>
  );
}
