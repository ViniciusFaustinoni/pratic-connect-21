import { ArrowLeft, Settings, Bell, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export default function InstaladorConfiguracoes() {
  const navigate = useNavigate();
  
  // Estados das configurações (em produção, persistir no banco/localStorage)
  const [notifNovasTarefas, setNotifNovasTarefas] = useState(true);
  const [notifEncaixes, setNotifEncaixes] = useState(true);
  const [gpsAltaPrecisao, setGpsAltaPrecisao] = useState(true);
  const [gpsBackground, setGpsBackground] = useState(true);
  const [temaEscuro, setTemaEscuro] = useState(true);

  return (
    <div className="bg-slate-900">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-slate-400 hover:text-white"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings className="h-5 w-5 text-blue-400" />
            Configurações
          </h1>
        </div>

        {/* Notificações */}
        <Card className="border-slate-700 bg-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Bell className="h-4 w-4 text-blue-400" />
              Notificações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="notif-tarefas" className="text-sm text-slate-300">
                Receber alertas de novas tarefas
              </Label>
              <Switch 
                id="notif-tarefas"
                checked={notifNovasTarefas}
                onCheckedChange={setNotifNovasTarefas}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="notif-encaixes" className="text-sm text-slate-300">
                Receber alertas de encaixes urgentes
              </Label>
              <Switch 
                id="notif-encaixes"
                checked={notifEncaixes}
                onCheckedChange={setNotifEncaixes}
              />
            </div>
          </CardContent>
        </Card>

        {/* Localização */}
        <Card className="border-slate-700 bg-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-green-400" />
              Localização
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="gps-precisao" className="text-sm text-slate-300">
                GPS de alta precisão
              </Label>
              <Switch 
                id="gps-precisao"
                checked={gpsAltaPrecisao}
                onCheckedChange={setGpsAltaPrecisao}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="gps-background" className="text-sm text-slate-300">
                Atualização em segundo plano
              </Label>
              <Switch 
                id="gps-background"
                checked={gpsBackground}
                onCheckedChange={setGpsBackground}
              />
            </div>
          </CardContent>
        </Card>

        {/* Aparência */}
        <Card className="border-slate-700 bg-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Palette className="h-4 w-4 text-purple-400" />
              Aparência
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Label htmlFor="tema-escuro" className="text-sm text-slate-300">
                Tema escuro
              </Label>
              <Switch 
                id="tema-escuro"
                checked={temaEscuro}
                onCheckedChange={setTemaEscuro}
              />
            </div>
          </CardContent>
        </Card>

        {/* Versão */}
        <p className="text-center text-xs text-slate-500 pt-4">
          PRATIC Instalador v1.0.0
        </p>
      </div>
    </div>
  );
}
