import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Bell, 
  Shield, 
  HelpCircle, 
  FileText, 
  LogOut,
  ChevronRight,
  Smartphone,
  Info,
  Trash2,
  Star,
  Fingerprint,
  ExternalLink
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function AppConfiguracoes() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  
  const [notificacoes, setNotificacoes] = useState({
    push: true,
    email: true,
    sms: false,
  });

  const [modalSobre, setModalSobre] = useState(false);
  const [limpandoCache, setLimpandoCache] = useState(false);

  const handleLogout = async () => {
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

  const handleLimparCache = async () => {
    setLimpandoCache(true);
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      // Clear localStorage except for essential auth data
      const keysToKeep = ['sb-iyxdgmukrrdkffraptsx-auth-token'];
      Object.keys(localStorage).forEach(key => {
        if (!keysToKeep.some(k => key.includes(k))) {
          localStorage.removeItem(key);
        }
      });
      toast.success('Cache limpo com sucesso');
    } catch (error) {
      toast.error('Erro ao limpar cache');
    } finally {
      setLimpandoCache(false);
    }
  };

  const handleAvaliar = () => {
    // Would open app store/play store
    toast.info('Obrigado! O link da loja estará disponível em breve.');
  };

  return (
    <div className="space-y-4 p-4 pb-24">
      <h1 className="text-xl font-bold text-foreground">Configurações</h1>

      {/* Notifications */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
            <Bell className="h-4 w-4 text-primary" />
            Notificações
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Notificações Push</p>
                <p className="text-sm text-muted-foreground">Alertas no celular</p>
              </div>
              <Switch
                checked={notificacoes.push}
                onCheckedChange={handleTogglePush}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">E-mail</p>
                <p className="text-sm text-muted-foreground">Receber por e-mail</p>
              </div>
              <Switch
                checked={notificacoes.email}
                onCheckedChange={(checked) => 
                  setNotificacoes({ ...notificacoes, email: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">SMS</p>
                <p className="text-sm text-muted-foreground">Receber por SMS</p>
              </div>
              <Switch
                checked={notificacoes.sms}
                onCheckedChange={(checked) => 
                  setNotificacoes({ ...notificacoes, sms: checked })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-1 p-4">
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-foreground">
            <Shield className="h-4 w-4 text-primary" />
            Segurança
          </h2>
          <button 
            className="flex w-full items-center justify-between rounded-lg p-3 transition-colors hover:bg-muted"
            onClick={() => navigate('/app/redefinir-senha')}
          >
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium text-foreground">Alterar Senha</span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
          <button 
            className="flex w-full items-center justify-between rounded-lg p-3 transition-colors hover:bg-muted"
            onClick={() => toast.info('Biometria estará disponível em breve')}
          >
            <div className="flex items-center gap-3">
              <Fingerprint className="h-5 w-5 text-muted-foreground" />
              <div className="text-left">
                <span className="font-medium text-foreground block">Biometria</span>
                <span className="text-xs text-muted-foreground">Em breve</span>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </CardContent>
      </Card>

      {/* Support */}
      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-1 p-4">
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-foreground">
            <HelpCircle className="h-4 w-4 text-primary" />
            Suporte
          </h2>
          <button 
            className="flex w-full items-center justify-between rounded-lg p-3 transition-colors hover:bg-muted"
            onClick={() => window.open('https://wa.me/5500000000000?text=Olá! Preciso de ajuda com o app PRATIC.', '_blank')}
          >
            <div className="flex items-center gap-3">
              <HelpCircle className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium text-foreground">Central de Ajuda</span>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </button>
          <button 
            className="flex w-full items-center justify-between rounded-lg p-3 transition-colors hover:bg-muted"
            onClick={() => window.open('/termos-de-uso', '_blank')}
          >
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium text-foreground">Termos de Uso</span>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </button>
          <button 
            className="flex w-full items-center justify-between rounded-lg p-3 transition-colors hover:bg-muted"
            onClick={() => window.open('/politica-privacidade', '_blank')}
          >
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium text-foreground">Política de Privacidade</span>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </button>
        </CardContent>
      </Card>

      {/* App Info */}
      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-1 p-4">
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-foreground">
            <Info className="h-4 w-4 text-primary" />
            Aplicativo
          </h2>
          <button 
            className="flex w-full items-center justify-between rounded-lg p-3 transition-colors hover:bg-muted"
            onClick={() => setModalSobre(true)}
          >
            <div className="flex items-center gap-3">
              <Info className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium text-foreground">Sobre o App</span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
          <button 
            className="flex w-full items-center justify-between rounded-lg p-3 transition-colors hover:bg-muted"
            onClick={handleLimparCache}
            disabled={limpandoCache}
          >
            <div className="flex items-center gap-3">
              <Trash2 className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium text-foreground">
                {limpandoCache ? 'Limpando...' : 'Limpar Cache'}
              </span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
          <button 
            className="flex w-full items-center justify-between rounded-lg p-3 transition-colors hover:bg-muted"
            onClick={handleAvaliar}
          >
            <div className="flex items-center gap-3">
              <Star className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium text-foreground">Avaliar o App</span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </CardContent>
      </Card>

      {/* Logout */}
      <Button 
        variant="destructive" 
        className="w-full"
        onClick={handleLogout}
      >
        <LogOut className="mr-2 h-4 w-4" />
        Sair da Conta
      </Button>

      {/* Version */}
      <p className="text-center text-xs text-muted-foreground">
        PRATIC App v1.0.0
      </p>

      {/* Modal Sobre */}
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
                <span className="font-medium">1.0.0</span>
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
