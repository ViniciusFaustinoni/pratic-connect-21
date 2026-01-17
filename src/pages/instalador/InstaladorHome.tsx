import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfWeek, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  CalendarDays, Loader2, AlertCircle, CheckCircle2, Play, 
  Navigation, Phone, MessageSquare, WifiOff,
  ChevronRight, Clock, Car
} from 'lucide-react';
import { useInstaladorInstalacoes, useIniciarInstalacao, useEstatisticasInstalador } from '@/hooks/useInstaladorInstalacoes';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function InstaladorHome() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [data] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const { data: instalacoes, isLoading, error, refetch } = useInstaladorInstalacoes(data);
  const { data: estatisticas } = useEstatisticasInstalador();
  const iniciarMutation = useIniciarInstalacao();

  // Monitorar status online/offline
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Conexão restaurada! Sincronizando dados...');
      refetch();
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Você está offline. Dados em cache serão usados.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refetch]);

  // Salvar cache quando dados carregam
  useEffect(() => {
    if (instalacoes) {
      localStorage.setItem('instalacoes_cache', JSON.stringify(instalacoes));
      localStorage.setItem('instalacoes_cache_time', new Date().toISOString());
    }
  }, [instalacoes]);

  // Saudação dinâmica
  const getSaudacao = (): string => {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return 'Bom dia';
    if (hora >= 12 && hora < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  // Próxima instalação (primeira não concluída/cancelada)
  const proximaInstalacao = useMemo(() => 
    instalacoes?.find(i => !['concluida', 'cancelada'].includes(i.status)),
    [instalacoes]
  );

  const handleIniciar = (id: string, status: string) => {
    if (status === 'em_andamento') {
      navigate(`/instalador/instalacao/${id}`);
    } else {
      iniciarMutation.mutate(id, {
        onSuccess: () => {
          navigate(`/instalador/instalacao/${id}`);
        },
      });
    }
  };

  const handleRefresh = async () => {
    await refetch();
    toast.success('Dados atualizados!');
  };

  // Ações rápidas
  const abrirMapa = (endereco: string) => {
    const enderecoFormatado = encodeURIComponent(endereco);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${enderecoFormatado}`, '_blank');
  };

  const ligar = (telefone: string) => {
    window.open(`tel:${telefone}`, '_self');
  };

  const abrirWhatsApp = (telefone: string, nomeCliente: string) => {
    const numero = telefone?.replace(/\D/g, '');
    const mensagem = encodeURIComponent(
      `Olá ${nomeCliente}, sou o instalador da PRATIC. Estou a caminho para realizar a instalação do rastreador.`
    );
    window.open(`https://wa.me/55${numero}?text=${mensagem}`, '_blank');
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'agendada': 'bg-blue-500',
      'em_rota': 'bg-purple-500',
      'em_andamento': 'bg-orange-500',
      'concluida': 'bg-green-500',
      'cancelada': 'bg-red-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'agendada': 'Agendada',
      'em_rota': 'Em Rota',
      'em_andamento': 'Em Andamento',
      'concluida': 'Concluída',
      'cancelada': 'Cancelada',
    };
    return labels[status] || status;
  };

  // Montar endereço completo
  const getEnderecoCompleto = (inst: typeof instalacoes extends (infer T)[] | undefined ? T : never) => {
    if (!inst) return '';
    const partes = [
      inst.logradouro,
      inst.numero,
      inst.bairro,
      inst.cidade,
      inst.uf
    ].filter(Boolean);
    return partes.join(', ');
  };

  const dataFormatada = format(data, "EEEE, dd 'de' MMMM", { locale: ptBR });
  const dataCapitalized = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);
  const primeiroNome = profile?.nome?.split(' ')[0] || 'Instalador';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-slate-400">Carregando instalações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Banner Offline */}
      {!isOnline && (
        <div className="bg-yellow-600 text-yellow-100 px-4 py-2 flex items-center gap-2 text-sm">
          <WifiOff className="h-4 w-4" />
          <span>Modo Offline - Dados serão sincronizados quando conectar</span>
        </div>
      )}

      <div className="p-4 space-y-4">
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

        {/* Mini Stats */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-slate-800 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-white">{estatisticas?.hoje || 0}</p>
            <p className="text-xs text-slate-400">Hoje</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-white">{estatisticas?.semana || 0}</p>
            <p className="text-xs text-slate-400">Semana</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-white">{estatisticas?.mes || 0}</p>
            <p className="text-xs text-slate-400">Mês</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-orange-400">{estatisticas?.pendentes || 0}</p>
            <p className="text-xs text-slate-400">Pendentes</p>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <Card className="border-red-800 bg-red-900/20">
            <CardContent className="flex items-center gap-3 p-4">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <span className="text-sm text-red-300">Erro ao carregar instalações</span>
            </CardContent>
          </Card>
        )}

        {/* Card Próxima Instalação Destacado */}
        {proximaInstalacao ? (
          <Card className="border-blue-600 bg-gradient-to-br from-blue-900/50 to-slate-800">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-blue-400 uppercase tracking-wide">
                  Próxima Instalação
                </span>
                <Badge className={`${getStatusColor(proximaInstalacao.status)} text-white text-xs`}>
                  {getStatusLabel(proximaInstalacao.status)}
                </Badge>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white">
                  {proximaInstalacao.associados?.nome || 'Cliente'}
                </h3>
                <div className="flex items-center gap-1 text-slate-400 text-sm mt-1">
                  <Car className="h-4 w-4" />
                  <span>
                    {proximaInstalacao.veiculos?.marca} {proximaInstalacao.veiculos?.modelo} • {proximaInstalacao.veiculos?.placa}
                  </span>
                </div>
              </div>

              {getEnderecoCompleto(proximaInstalacao) && (
                <div className="flex items-start gap-2 text-slate-300 text-sm">
                  <Navigation className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{getEnderecoCompleto(proximaInstalacao)}</span>
                </div>
              )}

              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Clock className="h-4 w-4" />
                <span>Período: {proximaInstalacao.periodo === 'manha' ? 'Manhã' : 'Tarde'}</span>
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center gap-2 pt-2">
                <Button 
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={() => handleIniciar(proximaInstalacao.id, proximaInstalacao.status)}
                  disabled={iniciarMutation.isPending}
                >
                  <Play className="h-4 w-4 mr-2" />
                  {proximaInstalacao.status === 'em_andamento' ? 'Continuar' : 'Iniciar'}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  onClick={() => {
                    const endereco = getEnderecoCompleto(proximaInstalacao);
                    if (endereco) abrirMapa(endereco);
                  }}
                  disabled={!getEnderecoCompleto(proximaInstalacao)}
                  title="Abrir no Maps"
                >
                  <Navigation className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  onClick={() => proximaInstalacao.associados?.telefone && ligar(proximaInstalacao.associados.telefone)}
                  disabled={!proximaInstalacao.associados?.telefone}
                  title="Ligar"
                >
                  <Phone className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="border-green-600 text-green-400 hover:bg-green-900/30"
                  onClick={() => {
                    const tel = proximaInstalacao.associados?.whatsapp || proximaInstalacao.associados?.telefone;
                    if (tel) abrirWhatsApp(tel, proximaInstalacao.associados?.nome || 'Cliente');
                  }}
                  disabled={!proximaInstalacao.associados?.telefone && !proximaInstalacao.associados?.whatsapp}
                  title="WhatsApp"
                >
                  <MessageSquare className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : instalacoes && instalacoes.length > 0 ? (
          <Card className="border-green-700 bg-green-900/20">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <h3 className="mt-4 text-lg font-semibold text-white">Tudo certo!</h3>
              <p className="mt-1 text-center text-sm text-slate-400">
                Todas as instalações do dia foram concluídas.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {/* Lista de Instalações do Dia */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-slate-300">
            Instalações de Hoje ({instalacoes?.length || 0})
          </h2>

          {instalacoes && instalacoes.length > 0 ? (
            <div className="space-y-2">
              {instalacoes.map((inst, index) => (
                <Card 
                  key={inst.id} 
                  className="border-slate-700 bg-slate-800 hover:bg-slate-750 cursor-pointer transition-colors"
                  onClick={() => navigate(`/instalador/instalacao/${inst.id}`)}
                >
                  <CardContent className="flex items-center gap-3 p-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      inst.status === 'concluida' 
                        ? 'bg-green-600 text-white' 
                        : 'bg-slate-700 text-slate-300'
                    }`}>
                      {inst.status === 'concluida' ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {inst.associados?.nome || 'Cliente'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {inst.veiculos?.placa} • {inst.periodo === 'manha' ? 'Manhã' : 'Tarde'}
                      </p>
                    </div>
                    <Badge 
                      variant="secondary" 
                      className={`${getStatusColor(inst.status)} text-white text-xs shrink-0`}
                    >
                      {getStatusLabel(inst.status)}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-slate-500" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-slate-700 bg-slate-800">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
                <h3 className="mt-4 text-lg font-semibold text-white">Tudo certo!</h3>
                <p className="mt-1 text-center text-sm text-slate-400">
                  Você não tem instalações agendadas para hoje.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

      </div>
    </div>
  );
}
