import { useNavigate } from 'react-router-dom';
import { User, LogOut, Settings, Bell, HelpCircle, Shield, Power } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useIniciarServico } from '@/hooks/useIniciarServico';
import { useTarefaAtual } from '@/hooks/useTarefaAtual';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

export default function InstaladorPerfil() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { emServico, encerrarServico } = useIniciarServico();
  const { data: tarefaAtual } = useTarefaAtual();

  const handleSignOut = async () => {
    await signOut();
    navigate('/instalador/login');
  };

  const handleEncerrarTurno = async () => {
    await encerrarServico();
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

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="p-4 space-y-4">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <User className="h-5 w-5 text-blue-400" />
          Perfil
        </h1>

        {/* Card do Perfil */}
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

        {/* Card do Menu */}
        <Card className="border-slate-700 bg-slate-800">
          <CardContent className="p-0">
            {menuItems.map((item, index) => (
              <div key={item.label}>
                <button
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-700/50 transition-colors"
                  onClick={item.onClick}
                >
                  <item.icon className="h-5 w-5 text-slate-400" />
                  <span className="text-sm text-white">{item.label}</span>
                </button>
                {index < menuItems.length - 1 && (
                  <Separator className="bg-slate-700" />
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Botão Encerrar Turno - apenas quando em serviço e sem tarefa ativa */}
        {emServico && !tarefaAtual && (
          <Button 
            variant="outline" 
            className="w-full border-orange-600 text-orange-400 hover:bg-orange-900/30 hover:text-orange-300"
            onClick={handleEncerrarTurno}
          >
            <Power className="h-4 w-4 mr-2" />
            Encerrar Turno
          </Button>
        )}

        {/* Botão Sair */}
        <Button 
          variant="outline" 
          className="w-full border-red-600 text-red-400 hover:bg-red-900/30 hover:text-red-300"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sair da Conta
        </Button>

        {/* Versão */}
        <p className="text-center text-xs text-slate-500">
          PRATIC Instalador v1.0.0
        </p>
      </div>
    </div>
  );
}
