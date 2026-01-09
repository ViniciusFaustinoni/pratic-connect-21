import { useEffect, useState } from 'react';
import { Bell, Mail, MessageSquare, Volume2, FileText, User, DollarSign, Car, Megaphone, Loader2, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { 
  useNotificacoesPreferencias, 
  useUpdateNotificacoesPreferencias,
  NotificacoesPreferencias 
} from '@/hooks/useNotificacoesPreferencias';

export default function NotificacoesConfig() {
  const { data: preferencias, isLoading, tipoUsuario } = useNotificacoesPreferencias();
  const updatePreferencias = useUpdateNotificacoesPreferencias();
  
  const [settings, setSettings] = useState<Partial<NotificacoesPreferencias>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Sincronizar com dados do servidor
  useEffect(() => {
    if (preferencias) {
      setSettings({
        push_ativo: preferencias.push_ativo,
        email_ativo: preferencias.email_ativo,
        whatsapp_ativo: preferencias.whatsapp_ativo,
        notif_financeiro: preferencias.notif_financeiro,
        notif_veiculo: preferencias.notif_veiculo,
        notif_comunicados: preferencias.notif_comunicados,
        email_resumo_diario: preferencias.email_resumo_diario,
        email_alertas_criticos: preferencias.email_alertas_criticos,
        som_notificacao: preferencias.som_notificacao,
      });
      setHasChanges(false);
    }
  }, [preferencias]);

  const handleChange = (key: keyof NotificacoesPreferencias, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await updatePreferencias.mutateAsync(settings);
      toast.success('Preferências salvas com sucesso!');
      setHasChanges(false);
    } catch (error) {
      toast.error('Erro ao salvar preferências');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const NotificationRow = ({ 
    id, 
    label, 
    description,
    icon: Icon,
    iconColor = 'text-muted-foreground',
    iconBg = 'bg-muted'
  }: { 
    id: keyof NotificacoesPreferencias; 
    label: string; 
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    iconColor?: string;
    iconBg?: string;
  }) => (
    <div className="flex items-center justify-between py-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
        <div>
          <p className="font-medium text-sm">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch
        checked={settings[id] as boolean ?? false}
        onCheckedChange={(checked) => handleChange(id, checked)}
      />
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold">Notificações</h2>
        <p className="text-sm text-muted-foreground">Configure como você deseja receber alertas</p>
      </div>

      {/* Canais de Notificação */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Canais de Notificação
          </CardTitle>
          <CardDescription>Escolha por onde deseja receber alertas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Push</span>
              </div>
              <Switch 
                checked={settings.push_ativo ?? false}
                onCheckedChange={(checked) => handleChange('push_ativo', checked)}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Email</span>
              </div>
              <Switch 
                checked={settings.email_ativo ?? false}
                onCheckedChange={(checked) => handleChange('email_ativo', checked)}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">WhatsApp</span>
              </div>
              <Switch 
                checked={settings.whatsapp_ativo ?? false}
                onCheckedChange={(checked) => handleChange('whatsapp_ativo', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categorias de Notificação */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Categorias</CardTitle>
          <CardDescription>Escolha quais tipos de notificações deseja receber</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <NotificationRow
            id="notif_financeiro"
            label="Financeiro"
            description="Boletos, pagamentos e cobranças"
            icon={DollarSign}
            iconColor="text-green-600"
            iconBg="bg-green-100 dark:bg-green-900/30"
          />
          <Separator />
          <NotificationRow
            id="notif_veiculo"
            label="Veículo"
            description="Alertas do rastreador e instalações"
            icon={Car}
            iconColor="text-blue-600"
            iconBg="bg-blue-100 dark:bg-blue-900/30"
          />
          <Separator />
          <NotificationRow
            id="notif_comunicados"
            label="Comunicados"
            description="Novidades e informativos"
            icon={Megaphone}
            iconColor="text-purple-600"
            iconBg="bg-purple-100 dark:bg-purple-900/30"
          />
        </CardContent>
      </Card>

      {/* Preferências do Colaborador */}
      {tipoUsuario === 'colaborador' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preferências do Sistema</CardTitle>
            <CardDescription>Configurações específicas para colaboradores</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <NotificationRow
              id="email_resumo_diario"
              label="Resumo diário por email"
              description="Receba um resumo das atividades do dia"
              icon={Mail}
              iconColor="text-orange-600"
              iconBg="bg-orange-100 dark:bg-orange-900/30"
            />
            <Separator />
            <NotificationRow
              id="email_alertas_criticos"
              label="Alertas críticos por email"
              description="Notificações urgentes que precisam de atenção"
              icon={FileText}
              iconColor="text-red-600"
              iconBg="bg-red-100 dark:bg-red-900/30"
            />
            <Separator />
            <NotificationRow
              id="som_notificacao"
              label="Som de notificação"
              description="Reproduzir som ao receber novas notificações"
              icon={Volume2}
              iconColor="text-cyan-600"
              iconBg="bg-cyan-100 dark:bg-cyan-900/30"
            />
          </CardContent>
        </Card>
      )}

      {/* Botão Salvar */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={!hasChanges || updatePreferencias.isPending}
        >
          {updatePreferencias.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Salvar preferências
        </Button>
      </div>
    </div>
  );
}
