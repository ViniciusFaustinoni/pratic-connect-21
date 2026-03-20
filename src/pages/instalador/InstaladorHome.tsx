import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, Loader2, WifiOff, Phone, Map, MessageSquare, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useTarefaAtual } from '@/hooks/useTarefaAtual';
import { BotaoIniciarServico } from '@/components/vistoriador/BotaoIniciarServico';
import { TarefaAtualCard } from '@/components/vistoriador/TarefaAtualCard';
import { EncaixeUrgenteCard } from '@/components/vistoriador/EncaixeUrgenteCard';
import { useEncaixesUrgentes } from '@/hooks/useEncaixesUrgentes';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { JornadaStatusBar } from '@/components/vistoriador/JornadaStatusBar';
import { AlmocoBloqueioOverlay } from '@/components/vistoriador/AlmocoBloqueioOverlay';
import { useIniciarServico } from '@/hooks/useIniciarServico';
import { useAlocacaoDiaria } from '@/hooks/useAlocacaoDiaria';
import { useServicosRealtime } from '@/hooks/useServicosRealtime';
import { useGarantirTurno } from '@/hooks/useGarantirTurno';

export default function InstaladorHome() {
  // Realtime: receber tarefas instantaneamente
  useServicosRealtime();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { data: tarefaAtual, isLoading } = useTarefaAtual();
  const { data: encaixesUrgentes = [], isLoading: isLoadingEncaixes } = useEncaixesUrgentes();
  const { emServico } = useIniciarServico();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Verificar alocação diária (rota ou base)
  const { isBase: isVistoriadorBase } = useAlocacaoDiaria();

  // Monitorar status online/offline
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Saudação dinâmica
  const getSaudacao = (): string => {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return 'Bom dia';
    if (hora >= 12 && hora < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const ligarCoordenador = () => {
    window.location.href = 'tel:+5521970048549';
  };

  const dataFormatada = format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR });
  const dataCapitalized = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);
  const primeiroNome = profile?.nome?.split(' ')[0] || 'Instalador';

  if (isLoading) {
    return (
      <div className="flex-1 bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-slate-400">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Overlay de bloqueio durante almoço */}
      <AlmocoBloqueioOverlay />
      
      <div className="bg-slate-900">
      {/* Banner Offline */}
      {!isOnline && (
        <div className="bg-yellow-600 text-yellow-100 px-4 py-2 flex items-center gap-2 text-sm">
          <WifiOff className="h-4 w-4" />
          <span>Modo Offline - Conecte-se para receber tarefas</span>
        </div>
      )}

      <div className="p-4 space-y-6">
        {/* Header com Saudação */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-slate-400 text-sm">{getSaudacao()},</p>
            <h1 className="text-xl font-bold text-white">{primeiroNome}</h1>
            <div className="mt-1 flex items-center gap-2 text-slate-400">
              <CalendarDays className="h-4 w-4" />
              <span className="text-sm">{dataCapitalized}</span>
            </div>
          </div>
          <Avatar className="h-12 w-12 bg-blue-600">
            <AvatarFallback className="bg-blue-600 text-white font-semibold">
              {primeiroNome.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Barra de Status da Jornada */}
        {emServico && <JornadaStatusBar className="mb-4" />}

        {/* Conteúdo Principal: Tarefa Atual ou Botão Iniciar */}
        {tarefaAtual ? (
          <TarefaAtualCard tarefa={tarefaAtual} />
        ) : (
          <BotaoIniciarServico />
        )}

        {/* Encaixes Urgentes - Sistema Uber */}
        {encaixesUrgentes.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" />
              Encaixes Urgentes ({encaixesUrgentes.length})
            </h2>
            {encaixesUrgentes.map(encaixe => (
              <EncaixeUrgenteCard key={encaixe.id} encaixe={encaixe} />
            ))}
          </div>
        )}

        {/* Ações Rápidas */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-slate-300">Ações Rápidas</h2>
          <div className="grid grid-cols-2 gap-3">
            <Card 
              className="border-slate-700 bg-slate-800 hover:bg-slate-750 cursor-pointer transition-colors"
              onClick={() => navigate('/instalador/tarefas')}
            >
              <CardContent className="flex flex-col items-center justify-center p-4 gap-2">
                <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center">
                  <CalendarDays className="h-5 w-5 text-blue-400" />
                </div>
                <span className="text-sm text-slate-300">Minhas Tarefas</span>
              </CardContent>
            </Card>
            
            {!isVistoriadorBase && (
              <Card 
                className="border-slate-700 bg-slate-800 hover:bg-slate-750 cursor-pointer transition-colors"
                onClick={() => navigate('/instalador/mapa')}
              >
                <CardContent className="flex flex-col items-center justify-center p-4 gap-2">
                  <div className="w-10 h-10 rounded-full bg-purple-600/20 flex items-center justify-center">
                    <Map className="h-5 w-5 text-purple-400" />
                  </div>
                  <span className="text-sm text-slate-300">Ver no Mapa</span>
                </CardContent>
              </Card>
            )}
            
            <Card 
              className="border-slate-700 bg-slate-800 hover:bg-slate-750 cursor-pointer transition-colors"
              onClick={ligarCoordenador}
            >
              <CardContent className="flex flex-col items-center justify-center p-4 gap-2">
                <div className="w-10 h-10 rounded-full bg-green-600/20 flex items-center justify-center">
                  <Phone className="h-5 w-5 text-green-400" />
                </div>
                <span className="text-sm text-slate-300">Ligar Coordenador</span>
              </CardContent>
            </Card>
            
            <Card 
              className="border-slate-700 bg-slate-800 hover:bg-slate-750 cursor-pointer transition-colors"
               onClick={() => {
                 window.location.href = 'https://wa.me/5521970048549?text=Olá, preciso de suporte.';
               }}
            >
              <CardContent className="flex flex-col items-center justify-center p-4 gap-2">
                <div className="w-10 h-10 rounded-full bg-emerald-600/20 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-emerald-400" />
                </div>
                <span className="text-sm text-slate-300">WhatsApp Suporte</span>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
