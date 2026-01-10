import { useState } from 'react';
import { Settings, Save, Loader2, Moon, Sun, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export default function Sistema() {
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    tema: 'dark',
    itensPorPagina: '20',
    formatoData: 'dd/MM/yyyy',
    notificacoesSom: true,
    autoLogout: '30',
  });

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 1000));
    toast.success('Configurações salvas!');
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Sistema</h1>
        <p className="text-sm text-muted-foreground">Preferências gerais do sistema</p>
      </div>

      {/* Aparência */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="w-5 h-5" />
            Aparência
          </CardTitle>
          <CardDescription>Personalize a interface do sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Tema</Label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'light', label: 'Claro', icon: Sun },
                { value: 'dark', label: 'Escuro', icon: Moon },
                { value: 'system', label: 'Sistema', icon: Monitor },
              ].map((theme) => (
                <button
                  key={theme.value}
                  onClick={() => setConfig({ ...config, tema: theme.value })}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors ${
                    config.tema === theme.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border/50 hover:border-border'
                  }`}
                >
                  <theme.icon className={`w-5 h-5 ${config.tema === theme.value ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className={`text-sm ${config.tema === theme.value ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                    {theme.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preferências */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Preferências</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Itens por página</Label>
              <Select value={config.itensPorPagina} onValueChange={(v) => setConfig({ ...config, itensPorPagina: v })}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 itens</SelectItem>
                  <SelectItem value="20">20 itens</SelectItem>
                  <SelectItem value="50">50 itens</SelectItem>
                  <SelectItem value="100">100 itens</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Formato de data</Label>
              <Select value={config.formatoData} onValueChange={(v) => setConfig({ ...config, formatoData: v })}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dd/MM/yyyy">DD/MM/AAAA</SelectItem>
                  <SelectItem value="MM/dd/yyyy">MM/DD/AAAA</SelectItem>
                  <SelectItem value="yyyy-MM-dd">AAAA-MM-DD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Logout automático</Label>
              <Select value={config.autoLogout} onValueChange={(v) => setConfig({ ...config, autoLogout: v })}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutos</SelectItem>
                  <SelectItem value="30">30 minutos</SelectItem>
                  <SelectItem value="60">1 hora</SelectItem>
                  <SelectItem value="120">2 horas</SelectItem>
                  <SelectItem value="0">Nunca</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border border-border/50">
            <div>
              <p className="font-medium">Som de notificações</p>
              <p className="text-sm text-muted-foreground">Tocar som ao receber notificações</p>
            </div>
            <Switch
              checked={config.notificacoesSom}
              onCheckedChange={(v) => setConfig({ ...config, notificacoesSom: v })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar configurações
        </Button>
      </div>
    </div>
  );
}
