import { useNavigate } from 'react-router-dom';
import { User, LogOut, Settings, Bell, HelpCircle, Shield, ChevronRight, TrendingUp, TrendingDown, Calendar, Clock, AlertTriangle, History } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useIniciarServico } from '@/hooks/useIniciarServico';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getHojeBrasilia } from '@/lib/date-utils';
import { format, startOfMonth } from 'date-fns';
import { HistoricoJornadas } from '@/components/vistoriador/HistoricoJornadas';

function formatarMinutos(minutos: number): string {
  const horas = Math.floor(Math.abs(minutos) / 60);
  const mins = Math.abs(minutos) % 60;
  if (horas === 0) return `${mins}min`;
  return mins > 0 ? `${horas}h ${mins}min` : `${horas}h`;
}

export default function InstaladorPerfil() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { emServico } = useIniciarServico();

  // Config: exibir saldo e limite débito
  const { data: configJornada } = useQuery({
    queryKey: ['config-jornada-perfil'],
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', ['jornada_exibir_saldo_vistoriador', 'jornada_limite_debito_horas']);
      const map = Object.fromEntries((data || []).map(d => [d.chave, d.valor]));
      return {
        exibirSaldo: map.jornada_exibir_saldo_vistoriador !== 'false',
        limiteDebito: parseFloat(map.jornada_limite_debito_horas || '0'),
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  // Saldo atual: último turno encerrado
  const { data: saldoData } = useQuery({
    queryKey: ['saldo-vistoriador', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const { data } = await supabase
        .from('turnos_profissionais')
        .select('minutos_extras, minutos_faltantes, saldo_anterior_minutos')
        .eq('profissional_id', profile.id)
        .eq('status', 'encerrado')
        .order('data', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) return { saldo: 0 };
      const saldoDoDia = (data.minutos_extras || 0) - (data.minutos_faltantes || 0);
      return { saldo: saldoDoDia + (data.saldo_anterior_minutos || 0) };
    },
    enabled: !!profile?.id,
    staleTime: 1000 * 60 * 2,
  });

  // Resumo do mês
  const { data: resumoMes } = useQuery({
    queryKey: ['resumo-mes-vistoriador', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const inicioMes = format(startOfMonth(getHojeBrasilia()), 'yyyy-MM-dd');
      const { data } = await supabase
        .from('turnos_profissionais')
        .select('minutos_trabalhados')
        .eq('profissional_id', profile.id)
        .gte('data', inicioMes)
        .eq('status', 'encerrado');
      const dias = data?.length || 0;
      const totalMinutos = data?.reduce((acc, t) => acc + (t.minutos_trabalhados || 0), 0) || 0;
      return { dias, totalMinutos };
    },
    enabled: !!profile?.id,
    staleTime: 1000 * 60 * 5,
  });

  const handleSignOut = async () => {
    await signOut();
    navigate('/instalador/login');
  };

  const getIniciais = () => {
    if (!profile?.nome) return 'I';
    const partes = profile.nome.split(' ');
    if (partes.length >= 2) {
      return `${partes[0][0]}${partes[1][0]}`.toUpperCase();
    }
    return partes[0][0].toUpperCase();
  };

  const menuItems = [
    { icon: Settings, label: 'Configurações', onClick: () => navigate('/instalador/configuracoes') },
    { icon: Bell, label: 'Notificações', onClick: () => navigate('/instalador/notificacoes') },
    { icon: HelpCircle, label: 'Ajuda e Suporte', onClick: () => navigate('/instalador/ajuda') },
    { icon: Shield, label: 'Privacidade', onClick: () => window.open('/politica-privacidade', '_blank') },
  ];

  const saldo = saldoData?.saldo ?? 0;
  const limiteDebito = configJornada?.limiteDebito ?? 0;
  const debitoBloqueado = limiteDebito > 0 && saldo < 0 && Math.abs(saldo) > limiteDebito * 60;

  return (
    <div className="bg-slate-900">
      <div className="p-4 space-y-4">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <User className="h-5 w-5 text-blue-400" />
          Perfil
        </h1>

        {/* Card do Perfil — fixo acima das abas */}
        <Card className="border-slate-700 bg-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-blue-600 text-white text-lg font-semibold">
                  {getIniciais()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-white">
                  {profile?.nome || 'Instalador'}
                </h2>
                <p className="text-sm text-slate-400">{profile?.email}</p>
                <p className="text-xs text-blue-400 mt-1">Instalador/Vistoriador</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="perfil" className="w-full">
          <TabsList className="w-full bg-slate-800 border border-slate-700">
            <TabsTrigger value="perfil" className="flex-1 data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">
              <User className="h-4 w-4 mr-1.5" />
              Meu Perfil
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex-1 data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">
              <History className="h-4 w-4 mr-1.5" />
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* Aba Meu Perfil */}
          <TabsContent value="perfil" className="space-y-4 mt-4">
            {/* Minha Jornada */}
            <Card className="border-slate-700 bg-slate-800">
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-400" />
                  Minha Jornada
                </h3>

                {configJornada?.exibirSaldo && (
                  <div className="flex items-center justify-between rounded-lg bg-slate-700/50 p-3">
                    <span className="text-sm text-slate-300">Saldo atual</span>
                    <div className="flex items-center gap-1">
                      {saldo >= 0 ? (
                        <>
                          <TrendingUp className="h-4 w-4 text-green-400" />
                          <span className="text-sm font-semibold text-green-400">
                            + {formatarMinutos(saldo)} de crédito
                          </span>
                        </>
                      ) : (
                        <>
                          <TrendingDown className="h-4 w-4 text-red-400" />
                          <span className="text-sm font-semibold text-red-400">
                            - {formatarMinutos(Math.abs(saldo))} de débito
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-slate-700/50 p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <Calendar className="h-3 w-3 text-slate-400" />
                      <p className="text-xs text-slate-400">Dias trabalhados</p>
                    </div>
                    <p className="text-lg font-bold text-white">{resumoMes?.dias ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-slate-700/50 p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <Clock className="h-3 w-3 text-slate-400" />
                      <p className="text-xs text-slate-400">Total mês</p>
                    </div>
                    <p className="text-lg font-bold text-white">
                      {formatarMinutos(resumoMes?.totalMinutos ?? 0)}
                    </p>
                  </div>
                </div>

                {debitoBloqueado && (
                  <div className="rounded-lg bg-red-900/30 border border-red-500/50 p-3 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-300">
                      Seu débito está acima do limite. Você não poderá iniciar novos turnos até regularizar.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Menu */}
            <Card className="border-slate-700 bg-slate-800">
              <CardContent className="p-0">
                {menuItems.map((item, index) => (
                  <div key={item.label}>
                    <button
                      type="button"
                      className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-700/50 active:bg-slate-600/50 transition-colors min-h-[56px] touch-manipulation"
                      onClick={item.onClick}
                    >
                      <item.icon className="h-5 w-5 text-slate-400" />
                      <span className="text-sm text-white flex-1">{item.label}</span>
                      <ChevronRight className="h-4 w-4 text-slate-500" />
                    </button>
                    {index < menuItems.length - 1 && (
                      <Separator className="bg-slate-700" />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Button 
              variant="outline" 
              className="w-full border-red-600 text-red-400 hover:bg-red-900/30 hover:text-red-300"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair da Conta
            </Button>

            <p className="text-center text-xs text-slate-500">
              PRATIC Instalador v1.0.0
            </p>
          </TabsContent>

          {/* Aba Histórico */}
          <TabsContent value="historico" className="mt-4">
            <HistoricoJornadas exibirSaldo={configJornada?.exibirSaldo ?? true} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
