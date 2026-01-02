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
  Smartphone
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function AppConfiguracoes() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  
  const [notificacoes, setNotificacoes] = useState({
    push: true,
    email: true,
    sms: false,
  });

  const handleLogout = async () => {
    await signOut();
    navigate('/app/login');
    toast.success('Você saiu da sua conta');
  };

  return (
    <div className="space-y-4 p-4">
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
                onCheckedChange={(checked) => 
                  setNotificacoes({ ...notificacoes, push: checked })
                }
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
        <CardContent className="space-y-3 p-4">
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-foreground">
            <Shield className="h-4 w-4 text-primary" />
            Segurança
          </h2>
          <button className="flex w-full items-center justify-between rounded-lg p-2 transition-colors hover:bg-muted">
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium text-foreground">Alterar Senha</span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </CardContent>
      </Card>

      {/* Support */}
      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-3 p-4">
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-foreground">
            <HelpCircle className="h-4 w-4 text-primary" />
            Suporte
          </h2>
          <button className="flex w-full items-center justify-between rounded-lg p-2 transition-colors hover:bg-muted">
            <div className="flex items-center gap-3">
              <HelpCircle className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium text-foreground">Central de Ajuda</span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
          <button className="flex w-full items-center justify-between rounded-lg p-2 transition-colors hover:bg-muted">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium text-foreground">Termos de Uso</span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
          <button className="flex w-full items-center justify-between rounded-lg p-2 transition-colors hover:bg-muted">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium text-foreground">Política de Privacidade</span>
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
    </div>
  );
}
