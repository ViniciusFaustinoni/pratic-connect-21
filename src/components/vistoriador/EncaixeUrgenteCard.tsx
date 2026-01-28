import { useState, useEffect } from 'react';
import { format, differenceInSeconds, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Zap, Car, MapPin, Clock, Phone, MessageSquare, 
  Navigation, Loader2, X, CheckCircle 
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { 
  EncaixeUrgente,
  DadosServico,
  useReservarEncaixe,
  useConfirmarEncaixe,
  useDesistirEncaixe 
} from '@/hooks/useEncaixesUrgentes';
import { useNavigate } from 'react-router-dom';

interface EncaixeUrgenteCardProps {
  encaixe: EncaixeUrgente;
}

export function EncaixeUrgenteCard({ encaixe }: EncaixeUrgenteCardProps) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const reservarMutation = useReservarEncaixe();
  const confirmarMutation = useConfirmarEncaixe();
  const desistirMutation = useDesistirEncaixe();
  
  const [tempoRestante, setTempoRestante] = useState<string>('');

  const isReservadoPorMim = encaixe.reservado_por === profile?.id;
  const isReservadoPorOutro = encaixe.status === 'reservado' && !isReservadoPorMim;

  // Countdown para expiração
  useEffect(() => {
    if (!encaixe.expira_em || !isReservadoPorMim) return;

    const updateCountdown = () => {
      const agora = new Date();
      const expiracao = parseISO(encaixe.expira_em!);
      const segundos = differenceInSeconds(expiracao, agora);

      if (segundos <= 0) {
        setTempoRestante('Expirado');
        return;
      }

      const minutos = Math.floor(segundos / 60);
      const segs = segundos % 60;
      setTempoRestante(`${minutos}:${segs.toString().padStart(2, '0')}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [encaixe.expira_em, isReservadoPorMim]);

  const handleAceitarCorrida = () => {
    reservarMutation.mutate(encaixe.id);
  };

  const handleConfirmarIniciarRota = () => {
    confirmarMutation.mutate(encaixe.id, {
      onSuccess: () => {
        // Redirecionar para mapa ou home
        navigate('/instalador');
      },
    });
  };

  const handleDesistir = () => {
    desistirMutation.mutate(encaixe.id);
  };

  const handleWhatsApp = () => {
    const telefone = encaixe.telefone_cliente.replace(/\D/g, '');
    const primeiroNome = encaixe.nome_cliente.split(' ')[0];
    const texto = encodeURIComponent(
      `Olá ${primeiroNome}, sou o vistoriador da PRATIC. ` +
      `Vi que você reagendou e tenho disponibilidade agora. ` +
      `Posso ir realizar o serviço?`
    );
    window.open(`https://wa.me/55${telefone}?text=${texto}`, '_blank');
  };

  const dados: DadosServico = encaixe.dados_servico || {};
  const dataFormatada = dados.data 
    ? format(parseISO(dados.data), "dd/MM (EEEE)", { locale: ptBR })
    : 'Hoje';

  return (
    <Card className={`border-2 transition-all ${
      isReservadoPorMim 
        ? 'border-amber-500 bg-amber-500/10' 
        : isReservadoPorOutro
        ? 'border-slate-600 bg-slate-800/50 opacity-60'
        : 'border-amber-500/50 bg-slate-800 animate-pulse'
    }`}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Zap className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                Encaixe Urgente
              </h3>
              <p className="text-xs text-amber-400">
                Cliente reagendou • {dataFormatada}
              </p>
            </div>
          </div>
          
          {isReservadoPorMim && tempoRestante && (
            <Badge variant="outline" className="border-amber-500 text-amber-400 text-xs">
              <Clock className="h-3 w-3 mr-1" />
              {tempoRestante}
            </Badge>
          )}
          
          {isReservadoPorOutro && (
            <Badge variant="outline" className="border-slate-500 text-slate-400 text-xs">
              Reservado
            </Badge>
          )}
        </div>

        {/* Dados do serviço */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-slate-300">
            <span className="font-medium text-white">
              {encaixe.nome_cliente}
            </span>
            <Badge 
              variant="outline" 
              className={`text-xs ${
                dados.tipo === 'vistoria' 
                  ? 'border-purple-500 text-purple-400' 
                  : 'border-blue-500 text-blue-400'
              }`}
            >
              {dados.tipo || 'Vistoria'}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2 text-slate-400">
            <Car className="h-3.5 w-3.5" />
            <span className="text-xs">{dados.veiculo || 'Veículo não informado'}</span>
          </div>
          
          <div className="flex items-start gap-2 text-slate-400">
            <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span className="text-xs">{dados.endereco || 'Endereço não informado'}</span>
          </div>
          
          {(dados.hora || dados.periodo) && (
            <div className="flex items-center gap-2 text-slate-400">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-xs">
                {dados.hora?.slice(0, 5) || dados.periodo}
              </span>
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="pt-2 space-y-2">
          {/* Status: Disponível - Mostrar botão aceitar */}
          {encaixe.status === 'disponivel' && (
            <Button 
              onClick={handleAceitarCorrida}
              disabled={reservarMutation.isPending}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white"
            >
              {reservarMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Reservando...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Aceitar Corrida
                </>
              )}
            </Button>
          )}

          {/* Status: Reservado por mim - Mostrar WhatsApp e Confirmar */}
          {isReservadoPorMim && (
            <>
              <Button 
                onClick={handleWhatsApp}
                variant="outline"
                className="w-full border-green-500 text-green-400 hover:bg-green-500/10"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                WhatsApp com Cliente
              </Button>
              
              <Button 
                onClick={handleConfirmarIniciarRota}
                disabled={confirmarMutation.isPending}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                {confirmarMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Confirmando...
                  </>
                ) : (
                  <>
                    <Navigation className="h-4 w-4 mr-2" />
                    Confirmar e Iniciar Rota
                  </>
                )}
              </Button>
              
              <Button 
                onClick={handleDesistir}
                variant="ghost"
                disabled={desistirMutation.isPending}
                className="w-full text-slate-400 hover:text-slate-300"
              >
                <X className="h-4 w-4 mr-2" />
                Desistir
              </Button>
            </>
          )}

          {/* Status: Reservado por outro */}
          {isReservadoPorOutro && (
            <div className="flex items-center justify-center gap-2 text-slate-500 py-2">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">
                Reservado por {encaixe.reservado_por_nome || 'outro profissional'}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
