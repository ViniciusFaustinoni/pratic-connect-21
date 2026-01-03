import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ArrowLeft,
  Bell, 
  Shield, 
  HelpCircle, 
  FileText, 
  LogOut,
  ChevronRight,
  Smartphone,
  Info,
  Star,
  Fingerprint,
  Lock,
  Mail,
  MessageCircle,
  Monitor,
  Palette,
  Globe,
  MessageSquare,
  AlertTriangle,
  User
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useMyAssociado } from '@/hooks/useMyData';

export default function AppConfiguracoes() {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();
  const { data: associado } = useMyAssociado();
  
  // Notificações - carregar do profile
  const [notificacoes, setNotificacoes] = useState({
    push: true,
    email: true,
    whatsapp: true,
    sms: false,
  });

  // Carregar preferências de notificação do profile
  useEffect(() => {
    if (profile) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const profileData = profile as any;
      setNotificacoes({
        push: profileData.notif_novos_leads ?? true,
        email: profileData.notif_documentos_pendentes ?? true,
        whatsapp: profileData.notif_resumo_diario ?? true,
        sms: false,
      });
    }
  }, [profile]);

  // Segurança
  const [biometriaEnabled, setBiometriaEnabled] = useState(false);

  // Modais
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showSenhaModal, setShowSenhaModal] = useState(false);
  const [modalSobre, setModalSobre] = useState(false);

  // Form senha
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');

  // Handlers
  const handleLogout = async () => {
    setShowLogoutModal(false);
    await signOut();
    navigate('/app/login');
    toast.success('Você saiu da sua conta');
  };

  const handleTogglePush = async (checked: boolean) => {
    if (checked && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificacoes({ ...notificacoes, push: true });
        toast.success('Notificações push ativadas');
      } else {
        toast.error('Permissão de notificações negada');
        setNotificacoes({ ...notificacoes, push: false });
      }
    } else {
      setNotificacoes({ ...notificacoes, push: checked });
      if (!checked) {
        toast.info('Notificações push desativadas');
      }
    }
  };

  const handleAlterarSenha = () => {
    if (!senhaAtual || !novaSenha || !confirmarSenha) {
      toast.error('Preencha todos os campos');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      toast.error('As senhas não coincidem');
      return;
    }
    if (novaSenha.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    // Simular alteração
    setShowSenhaModal(false);
    toast.success('Senha alterada com sucesso!');
    setSenhaAtual('');
    setNovaSenha('');
    setConfirmarSenha('');
  };

  const handleAvaliar = () => {
    toast.info('Obrigado! O link da loja estará disponível em breve.');
  };

  const handleEmBreve = (funcionalidade: string) => {
    toast.info(`${funcionalidade} estará disponível em breve`);
  };

  // Dados do usuário
  const nomeUsuario = associado?.nome || profile?.nome || 'Usuário';
  const emailUsuario = associado?.email || profile?.email || '';
  const iniciais = nomeUsuario.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const dataAdesao = associado?.data_adesao 
    ? new Date(associado.data_adesao).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
    : 'Jan/2024';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Sticky */}
      <header className="sticky top-0 z-50 bg-white border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="font-semibold text-foreground">Configurações</span>
          <div className="w-10" />
        </div>
      </header>

      <div className="space-y-4 p-4 pb-24">
        {/* Card Perfil */}
        <Card 
          className="border-0 shadow-sm cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => navigate('/app/perfil')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={associado?.avatar_url || ''} />
                <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                  {iniciais}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="font-semibold text-foreground text-lg">{nomeUsuario}</div>
                <div className="text-sm text-muted-foreground">{emailUsuario}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Associado desde {dataAdesao}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        {/* Notificações */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
            Notificações
          </h2>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0 divide-y">
              {/* Push */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Bell className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground">Notificações Push</div>
                    <div className="text-sm text-muted-foreground">Alertas no celular</div>
                  </div>
                </div>
                <Switch
                  checked={notificacoes.push}
                  onCheckedChange={handleTogglePush}
                />
              </div>
              {/* E-mail */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Mail className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground">E-mail</div>
                    <div className="text-sm text-muted-foreground">Comunicados e boletos</div>
                  </div>
                </div>
                <Switch
                  checked={notificacoes.email}
                  onCheckedChange={async (checked) => {
                    setNotificacoes({ ...notificacoes, email: checked });
                    if (profile?.id) {
                      await supabase.from('profiles').update({ notif_documentos_pendentes: checked }).eq('id', profile.id);
                      toast.success(checked ? 'E-mail ativado' : 'E-mail desativado');
                    }
                  }}
                />
              </div>
              {/* WhatsApp */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <MessageCircle className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground">WhatsApp</div>
                    <div className="text-sm text-muted-foreground">Lembretes e alertas</div>
                  </div>
                </div>
                <Switch
                  checked={notificacoes.whatsapp}
                  onCheckedChange={async (checked) => {
                    setNotificacoes({ ...notificacoes, whatsapp: checked });
                    if (profile?.id) {
                      await supabase.from('profiles').update({ notif_resumo_diario: checked }).eq('id', profile.id);
                      toast.success(checked ? 'WhatsApp ativado' : 'WhatsApp desativado');
                    }
                  }}
                />
              </div>
              {/* SMS */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Smartphone className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground">SMS</div>
                    <div className="text-sm text-muted-foreground">Alertas urgentes</div>
                  </div>
                </div>
                <Switch
                  checked={notificacoes.sms}
                  onCheckedChange={(checked) => {
                    setNotificacoes({ ...notificacoes, sms: checked });
                    toast.info('SMS será implementado em breve');
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Segurança */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
            Segurança
          </h2>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0 divide-y">
              {/* Alterar Senha */}
              <button 
                className="flex w-full items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                onClick={() => setShowSenhaModal(true)}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Lock className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-foreground">Alterar Senha</div>
                    <div className="text-sm text-muted-foreground">Última alteração há 30 dias</div>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
              {/* Biometria */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Fingerprint className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground">Biometria / Face ID</div>
                    <div className="text-sm text-muted-foreground">Login rápido e seguro</div>
                  </div>
                </div>
                <Switch
                  checked={biometriaEnabled}
                  onCheckedChange={(checked) => {
                    setBiometriaEnabled(checked);
                    toast.success(checked ? 'Biometria ativada' : 'Biometria desativada');
                  }}
                />
              </div>
              {/* Sessões Ativas */}
              <button 
                className="flex w-full items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                onClick={() => handleEmBreve('Gerenciamento de sessões')}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Monitor className="h-5 w-5 text-gray-600" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-foreground">Sessões Ativas</div>
                    <div className="text-sm text-muted-foreground">2 dispositivos conectados</div>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            </CardContent>
          </Card>
        </div>

        {/* Preferências */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
            Preferências
          </h2>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0 divide-y">
              {/* Tema */}
              <button 
                className="flex w-full items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                onClick={() => handleEmBreve('Alteração de tema')}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-pink-100 rounded-lg">
                    <Palette className="h-5 w-5 text-pink-600" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-foreground">Tema</div>
                    <div className="text-sm text-muted-foreground">Claro</div>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
              {/* Idioma */}
              <button 
                className="flex w-full items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                onClick={() => handleEmBreve('Alteração de idioma')}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-100 rounded-lg">
                    <Globe className="h-5 w-5 text-cyan-600" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-foreground">Idioma</div>
                    <div className="text-sm text-muted-foreground">Português (Brasil)</div>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            </CardContent>
          </Card>
        </div>

        {/* Suporte */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
            Suporte
          </h2>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0 divide-y">
              {/* Central de Ajuda */}
              <button 
                className="flex w-full items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                onClick={() => window.open('https://wa.me/5500000000000?text=Olá! Preciso de ajuda com o app PRATIC.', '_blank')}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <HelpCircle className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-foreground">Central de Ajuda</div>
                    <div className="text-sm text-muted-foreground">Perguntas frequentes</div>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
              {/* Fale Conosco */}
              <button 
                className="flex w-full items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                onClick={() => window.open('https://wa.me/5500000000000?text=Olá! Gostaria de falar com um atendente.', '_blank')}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <MessageSquare className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-foreground">Fale Conosco</div>
                    <div className="text-sm text-muted-foreground">Chat com atendente</div>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
              {/* Avaliar App */}
              <button 
                className="flex w-full items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                onClick={handleAvaliar}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <Star className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-foreground">Avaliar o App</div>
                    <div className="text-sm text-muted-foreground">Sua opinião é importante</div>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            </CardContent>
          </Card>
        </div>

        {/* Sobre */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
            Sobre
          </h2>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0 divide-y">
              {/* Termos de Uso */}
              <button 
                className="flex w-full items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                onClick={() => window.open('/termos-de-uso', '_blank')}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <FileText className="h-5 w-5 text-gray-600" />
                  </div>
                  <span className="font-medium text-foreground">Termos de Uso</span>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
              {/* Política de Privacidade */}
              <button 
                className="flex w-full items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                onClick={() => window.open('/politica-privacidade', '_blank')}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Shield className="h-5 w-5 text-gray-600" />
                  </div>
                  <span className="font-medium text-foreground">Política de Privacidade</span>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
              {/* Versão do App */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Info className="h-5 w-5 text-gray-600" />
                  </div>
                  <span className="font-medium text-foreground">Versão do App</span>
                </div>
                <span className="text-muted-foreground font-mono">2.0.1</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Botão Sair */}
        <Button 
          variant="outline" 
          className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
          onClick={() => setShowLogoutModal(true)}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair da Conta
        </Button>

        {/* Copyright */}
        <p className="text-center text-xs text-muted-foreground pb-4">
          © 2024 PRATIC Proteção Veicular
        </p>
      </div>

      {/* Modal Confirmar Logout */}
      <Dialog open={showLogoutModal} onOpenChange={setShowLogoutModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Sair da Conta
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja sair? Você precisará fazer login novamente para acessar o app.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-3">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => setShowLogoutModal(false)}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              className="flex-1"
              onClick={handleLogout}
            >
              Sair
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Alterar Senha */}
      <Dialog open={showSenhaModal} onOpenChange={setShowSenhaModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Alterar Senha
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="senha-atual">Senha atual</Label>
              <Input 
                id="senha-atual"
                type="password" 
                placeholder="Digite sua senha atual"
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nova-senha">Nova senha</Label>
              <Input 
                id="nova-senha"
                type="password" 
                placeholder="Digite a nova senha"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmar-senha">Confirmar nova senha</Label>
              <Input 
                id="confirmar-senha"
                type="password" 
                placeholder="Confirme a nova senha"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="flex-row gap-3">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => {
                setShowSenhaModal(false);
                setSenhaAtual('');
                setNovaSenha('');
                setConfirmarSenha('');
              }}
            >
              Cancelar
            </Button>
            <Button 
              className="flex-1"
              onClick={handleAlterarSenha}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Sobre (mantido) */}
      <Dialog open={modalSobre} onOpenChange={setModalSobre}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sobre o PRATIC App</DialogTitle>
            <DialogDescription>
              Informações sobre o aplicativo
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="flex items-center justify-center">
              <div className="rounded-2xl bg-primary/10 p-4">
                <Shield className="h-12 w-12 text-primary" />
              </div>
            </div>

            <div className="text-center">
              <h3 className="text-lg font-bold text-foreground">PRATIC</h3>
              <p className="text-sm text-muted-foreground">Proteção Veicular</p>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Versão</span>
                <span className="font-medium">2.0.1</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Build</span>
                <span className="font-medium">2024.01.03</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Desenvolvido por</span>
                <span className="font-medium">PRATIC Tech</span>
              </div>
            </div>

            <div className="bg-muted rounded-lg p-3">
              <p className="text-xs text-muted-foreground text-center">
                © 2024 PRATIC Proteção Veicular. Todos os direitos reservados.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setModalSobre(false)} className="w-full">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
