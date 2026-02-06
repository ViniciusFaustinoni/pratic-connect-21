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
  User,
  MapPin,
  Key,
  Gauge,
  Clock,
  BarChart3,
  Sun,
  Moon,
  Code,
  ExternalLink,
  Gift
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
import { useNotificacoesPreferencias, useUpdateNotificacoesPreferencias } from '@/hooks/useNotificacoesPreferencias';
import { useRastreadorPreferencias, useUpdateRastreadorPreferencias } from '@/hooks/useRastreadorPreferencias';
import { useTheme } from 'next-themes';
import { CreditCard, Car, AlertTriangle as AlertTriangleIcon, Megaphone } from 'lucide-react';

export default function AppConfiguracoes() {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();
  const { data: associado } = useMyAssociado();
  const { theme, setTheme } = useTheme();
  
  // Notificações - usar hook de preferências
  const { data: preferencias, isLoading: loadingPreferencias } = useNotificacoesPreferencias();
  const updatePreferencias = useUpdateNotificacoesPreferencias();
  
  // Rastreador preferências
  const { data: rastreadorPrefs, isLoading: loadingRastreador } = useRastreadorPreferencias();
  const updateRastreadorPrefs = useUpdateRastreadorPreferencias();
  
  const handleUpdatePreferencia = async (key: string, value: boolean) => {
    try {
      await updatePreferencias.mutateAsync({ [key]: value });
      toast.success(value ? 'Ativado' : 'Desativado');
    } catch {
      toast.error('Erro ao salvar preferência');
    }
  };

  const handleUpdateRastreador = (updates: Record<string, unknown>) => {
    updateRastreadorPrefs.mutate(updates as any);
  };

  const handleTogglePush = async (checked: boolean) => {
    if (checked && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        await handleUpdatePreferencia('push_ativo', true);
      } else {
        toast.error('Permissão de notificações negada');
      }
    } else {
      await handleUpdatePreferencia('push_ativo', checked);
    }
  };

  // Segurança
  const [biometriaEnabled, setBiometriaEnabled] = useState(false);

  // Modais
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showSenhaModal, setShowSenhaModal] = useState(false);
  const [showLicencasModal, setShowLicencasModal] = useState(false);
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

  // Estado de loading para alteração de senha
  const [isAlterandoSenha, setIsAlterandoSenha] = useState(false);

  // Handler de senha REAL - chama Supabase Auth
  const handleAlterarSenha = async () => {
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

    setIsAlterandoSenha(true);
    
    try {
      // Chamar Supabase Auth para alterar a senha
      const { error } = await supabase.auth.updateUser({ 
        password: novaSenha 
      });
      
      if (error) {
        console.error('Erro ao alterar senha:', error);
        toast.error(error.message || 'Erro ao alterar senha');
        return;
      }
      
      setShowSenhaModal(false);
      toast.success('Senha alterada com sucesso!');
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      toast.error('Erro ao alterar senha. Tente novamente.');
    } finally {
      setIsAlterandoSenha(false);
    }
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

  // Licenças de software
  const licencas = [
    { name: 'React', license: 'MIT', url: 'https://reactjs.org' },
    { name: 'Tailwind CSS', license: 'MIT', url: 'https://tailwindcss.com' },
    { name: 'Radix UI', license: 'MIT', url: 'https://radix-ui.com' },
    { name: 'Lucide Icons', license: 'ISC', url: 'https://lucide.dev' },
    { name: 'React Query', license: 'MIT', url: 'https://tanstack.com/query' },
    { name: 'Supabase', license: 'Apache 2.0', url: 'https://supabase.com' },
    { name: 'Framer Motion', license: 'MIT', url: 'https://www.framer.com/motion' },
    { name: 'React Router', license: 'MIT', url: 'https://reactrouter.com' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header Sticky */}
      <header className="sticky top-0 z-50 bg-background border-b border-border">
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
          className="border-0 shadow-sm cursor-pointer hover:bg-muted/50 transition-colors"
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

        {/* Notificações - Canais */}
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
                  checked={preferencias?.push_ativo ?? true}
                  onCheckedChange={handleTogglePush}
                  disabled={loadingPreferencias}
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
                  checked={preferencias?.email_ativo ?? true}
                  onCheckedChange={(checked) => handleUpdatePreferencia('email_ativo', checked)}
                  disabled={loadingPreferencias}
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
                  checked={preferencias?.whatsapp_ativo ?? false}
                  onCheckedChange={(checked) => handleUpdatePreferencia('whatsapp_ativo', checked)}
                  disabled={loadingPreferencias}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Notificações - Categorias */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
            Categorias
          </h2>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0 divide-y">
              {/* Financeiro */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CreditCard className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground">Financeiro</div>
                    <div className="text-sm text-muted-foreground">Boletos e pagamentos</div>
                  </div>
                </div>
                <Switch
                  checked={preferencias?.notif_financeiro ?? true}
                  onCheckedChange={(checked) => handleUpdatePreferencia('notif_financeiro', checked)}
                  disabled={loadingPreferencias}
                />
              </div>
              {/* Veículo */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Car className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground">Veículo</div>
                    <div className="text-sm text-muted-foreground">Instalação e rastreamento</div>
                  </div>
                </div>
                <Switch
                  checked={preferencias?.notif_veiculo ?? true}
                  onCheckedChange={(checked) => handleUpdatePreferencia('notif_veiculo', checked)}
                  disabled={loadingPreferencias}
                />
              </div>
              {/* Comunicados */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Megaphone className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground">Comunicados</div>
                    <div className="text-sm text-muted-foreground">Avisos da associação</div>
                  </div>
                </div>
                <Switch
                  checked={preferencias?.notif_comunicados ?? true}
                  onCheckedChange={(checked) => handleUpdatePreferencia('notif_comunicados', checked)}
                  disabled={loadingPreferencias}
                />
              </div>
              {/* Novidades e Promoções */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-pink-100 rounded-lg">
                    <Gift className="h-5 w-5 text-pink-600" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground">Novidades e promoções</div>
                    <div className="text-sm text-muted-foreground">Ofertas e novos recursos</div>
                  </div>
                </div>
                <Switch
                  checked={rastreadorPrefs?.novidades_promocoes ?? true}
                  onCheckedChange={(checked) => handleUpdateRastreador({ novidades_promocoes: checked })}
                  disabled={loadingRastreador}
                />
              </div>
              {/* Segurança - Sempre ativa */}
              <div className="flex items-center justify-between p-4 bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <AlertTriangleIcon className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground">Segurança</div>
                    <div className="text-sm text-muted-foreground">Assistência e sinistros</div>
                    <div className="text-xs text-amber-600 mt-1">⚠️ Sempre ativa por segurança</div>
                  </div>
                </div>
                <Switch
                  checked={true}
                  disabled={true}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alertas do Rastreador */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
            Alertas do Rastreador
          </h2>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0 divide-y">
              {/* Cerca Virtual */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-teal-100 rounded-lg">
                      <MapPin className="h-5 w-5 text-teal-600" />
                    </div>
                    <div>
                      <div className="font-medium text-foreground">Cerca Virtual</div>
                      <div className="text-sm text-muted-foreground">Alerta quando sair da área</div>
                    </div>
                  </div>
                  <Switch
                    checked={rastreadorPrefs?.alerta_cerca_ativo ?? true}
                    onCheckedChange={(checked) => handleUpdateRastreador({ alerta_cerca_ativo: checked })}
                    disabled={loadingRastreador}
                  />
                </div>
                {rastreadorPrefs?.alerta_cerca_ativo && (
                  <Button 
                    variant="link" 
                    className="mt-2 h-auto p-0 text-primary text-sm"
                    onClick={() => navigate('/app/rastreamento?tab=cerca')}
                  >
                    Configurar cerca <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>

              {/* Alerta de Ignição */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Key className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground">Alerta de Ignição</div>
                    <div className="text-sm text-muted-foreground">Quando ligar/desligar o veículo</div>
                  </div>
                </div>
                <Switch
                  checked={rastreadorPrefs?.alerta_ignicao_ativo ?? false}
                  onCheckedChange={(checked) => handleUpdateRastreador({ alerta_ignicao_ativo: checked })}
                  disabled={loadingRastreador}
                />
              </div>

              {/* Alerta de Velocidade */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <Gauge className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <div className="font-medium text-foreground">Alerta de Velocidade</div>
                      <div className="text-sm text-muted-foreground">Quando exceder o limite</div>
                    </div>
                  </div>
                  <Switch
                    checked={rastreadorPrefs?.alerta_velocidade_ativo ?? false}
                    onCheckedChange={(checked) => handleUpdateRastreador({ alerta_velocidade_ativo: checked })}
                    disabled={loadingRastreador}
                  />
                </div>
                {rastreadorPrefs?.alerta_velocidade_ativo && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Limite:</span>
                    <Input
                      type="number"
                      value={rastreadorPrefs?.velocidade_limite ?? 80}
                      onChange={(e) => handleUpdateRastreador({ velocidade_limite: parseInt(e.target.value) || 80 })}
                      className="w-20 h-8 text-center"
                      min={20}
                      max={200}
                    />
                    <span className="text-sm text-muted-foreground">km/h</span>
                  </div>
                )}
              </div>

              {/* Horário dos Alertas */}
              <div className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Clock className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground">Horário dos Alertas</div>
                    <div className="text-sm text-muted-foreground">Quando receber notificações</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {[
                    { value: 'sempre', label: 'Sempre' },
                    { value: 'comercial', label: 'Comercial' },
                    { value: 'noturno', label: 'Só à noite' },
                  ].map((opt) => (
                    <Button
                      key={opt.value}
                      variant={rastreadorPrefs?.horario_alerta === opt.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleUpdateRastreador({ horario_alerta: opt.value })}
                      disabled={loadingRastreador}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Privacidade */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
            Privacidade
          </h2>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0 divide-y">
              {/* Compartilhar Localização */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <MapPin className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground">Compartilhar localização</div>
                    <div className="text-sm text-muted-foreground">Permitir rastreamento do veículo</div>
                  </div>
                </div>
                <Switch
                  checked={rastreadorPrefs?.compartilhar_localizacao ?? true}
                  onCheckedChange={(checked) => handleUpdateRastreador({ compartilhar_localizacao: checked })}
                  disabled={loadingRastreador}
                />
              </div>

              {/* Dados Anônimos */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <BarChart3 className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground">Dados de uso anônimos</div>
                    <div className="text-sm text-muted-foreground">Ajudar a melhorar o app</div>
                  </div>
                </div>
                <Switch
                  checked={rastreadorPrefs?.dados_anonimos ?? true}
                  onCheckedChange={(checked) => handleUpdateRastreador({ dados_anonimos: checked })}
                  disabled={loadingRastreador}
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
                className="flex w-full items-center justify-between p-4 hover:bg-muted/50 transition-colors"
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
                className="flex w-full items-center justify-between p-4 hover:bg-muted/50 transition-colors"
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

        {/* Aparência */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
            Aparência
          </h2>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-pink-100 rounded-lg">
                  <Palette className="h-5 w-5 text-pink-600" />
                </div>
                <div>
                  <div className="font-medium text-foreground">Tema</div>
                  <div className="text-sm text-muted-foreground">Aparência do aplicativo</div>
                </div>
              </div>
              <div className="flex gap-2">
                {[
                  { value: 'light', label: 'Claro', icon: Sun },
                  { value: 'dark', label: 'Escuro', icon: Moon },
                  { value: 'system', label: 'Sistema', icon: Monitor },
                ].map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <Button
                      key={opt.value}
                      variant={theme === opt.value ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1"
                      onClick={() => setTheme(opt.value)}
                    >
                      <Icon className="h-4 w-4 mr-1" />
                      {opt.label}
                    </Button>
                  );
                })}
              </div>
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
                className="flex w-full items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                onClick={() => navigate('/app/ajuda')}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <HelpCircle className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-foreground">Perguntas Frequentes</div>
                    <div className="text-sm text-muted-foreground">FAQ e central de ajuda</div>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
              {/* Fale Conosco */}
              <button 
                className="flex w-full items-center justify-between p-4 hover:bg-muted/50 transition-colors"
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
                className="flex w-full items-center justify-between p-4 hover:bg-muted/50 transition-colors"
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
                className="flex w-full items-center justify-between p-4 hover:bg-muted/50 transition-colors"
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
                className="flex w-full items-center justify-between p-4 hover:bg-muted/50 transition-colors"
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
              {/* Licenças de Software */}
              <button 
                className="flex w-full items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                onClick={() => setShowLicencasModal(true)}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Code className="h-5 w-5 text-gray-600" />
                  </div>
                  <span className="font-medium text-foreground">Licenças de Software</span>
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

      {/* Modal Licenças de Software */}
      <Dialog open={showLicencasModal} onOpenChange={setShowLicencasModal}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Licenças de Software</DialogTitle>
            <DialogDescription>
              Bibliotecas de código aberto utilizadas neste aplicativo
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 py-4">
            {licencas.map((lib) => (
              <div 
                key={lib.name} 
                className="flex justify-between items-center py-3 border-b last:border-0"
              >
                <div>
                  <p className="font-medium text-foreground">{lib.name}</p>
                  <p className="text-xs text-muted-foreground">{lib.license}</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => window.open(lib.url, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowLicencasModal(false)} className="w-full">
              Fechar
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
