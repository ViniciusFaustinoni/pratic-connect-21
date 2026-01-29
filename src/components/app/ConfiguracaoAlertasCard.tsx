import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Bell, Gauge, MapPin, Car, Loader2, AlertTriangle } from 'lucide-react';
import { useAtualizarPermissoesRastreador, PermissoesRastreador } from '@/hooks/useAtualizarPermissoesRastreador';

interface ConfiguracaoAlertasCardProps {
  veiculoId: string;
  associadoId: string;
  alertaVelocidadeAtivo?: boolean;
  alertaCercaAtivo?: boolean;
  alertaIgnicaoAtivo?: boolean;
  limiteVelocidade?: number;
  onSuccess?: () => void;
}

export function ConfiguracaoAlertasCard({
  veiculoId,
  associadoId,
  alertaVelocidadeAtivo = true,
  alertaCercaAtivo = true,
  alertaIgnicaoAtivo = true,
  limiteVelocidade = 80,
  onSuccess,
}: ConfiguracaoAlertasCardProps) {
  const [permissoes, setPermissoes] = useState<PermissoesRastreador>({
    alertaVelocidade: alertaVelocidadeAtivo,
    alertaCercaVirtual: alertaCercaAtivo,
    alertaIgnicao: alertaIgnicaoAtivo,
    limiteVelocidade: limiteVelocidade,
    pushNotifications: true,
  });

  const [hasChanges, setHasChanges] = useState(false);
  const atualizarPermissoes = useAtualizarPermissoesRastreador();

  useEffect(() => {
    const changed = 
      permissoes.alertaVelocidade !== alertaVelocidadeAtivo ||
      permissoes.alertaCercaVirtual !== alertaCercaAtivo ||
      permissoes.alertaIgnicao !== alertaIgnicaoAtivo ||
      permissoes.limiteVelocidade !== limiteVelocidade;
    
    setHasChanges(changed);
  }, [permissoes, alertaVelocidadeAtivo, alertaCercaAtivo, alertaIgnicaoAtivo, limiteVelocidade]);

  const handleSalvar = async () => {
    await atualizarPermissoes.mutateAsync({
      veiculoId,
      associadoId,
      permissoes,
    });
    setHasChanges(false);
    onSuccess?.();
  };

  const handleToggle = (key: keyof PermissoesRastreador) => (checked: boolean) => {
    setPermissoes(prev => ({ ...prev, [key]: checked }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Configuração de Alertas
        </CardTitle>
        <CardDescription>
          Configure suas preferências de notificações e alertas do rastreador
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Alerta de Velocidade */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent">
              <Gauge className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <Label className="text-base font-medium">Alerta de Velocidade</Label>
              <p className="text-sm text-muted-foreground">
                Receba notificações quando exceder o limite
              </p>
            </div>
          </div>
          <Switch
            checked={permissoes.alertaVelocidade}
            onCheckedChange={handleToggle('alertaVelocidade')}
          />
        </div>

        {/* Limite de Velocidade */}
        {permissoes.alertaVelocidade && (
          <div className="ml-12 flex items-center gap-3">
            <Label htmlFor="limite-velocidade" className="whitespace-nowrap">
              Limite:
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="limite-velocidade"
                type="number"
                min={30}
                max={200}
                value={permissoes.limiteVelocidade}
                onChange={(e) => setPermissoes(prev => ({ 
                  ...prev, 
                  limiteVelocidade: parseInt(e.target.value) || 80 
                }))}
                className="w-20"
              />
              <span className="text-muted-foreground">km/h</span>
            </div>
          </div>
        )}

        {/* Alerta de Cerca Virtual */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent">
              <MapPin className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <Label className="text-base font-medium">Alerta de Cerca Virtual</Label>
              <p className="text-sm text-muted-foreground">
                Notificações ao entrar/sair de áreas definidas
              </p>
            </div>
          </div>
          <Switch
            checked={permissoes.alertaCercaVirtual}
            onCheckedChange={handleToggle('alertaCercaVirtual')}
          />
        </div>

        {/* Alerta de Ignição */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent">
              <Car className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <Label className="text-base font-medium">Alerta de Ignição</Label>
              <p className="text-sm text-muted-foreground">
                Notificações quando o veículo ligar/desligar
              </p>
            </div>
          </div>
          <Switch
            checked={permissoes.alertaIgnicao}
            onCheckedChange={handleToggle('alertaIgnicao')}
          />
        </div>

        {/* Notificações Push */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent">
              <Bell className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <Label className="text-base font-medium">Notificações Push</Label>
              <p className="text-sm text-muted-foreground">
                Receber alertas no celular
              </p>
            </div>
          </div>
          <Switch
            checked={permissoes.pushNotifications}
            onCheckedChange={handleToggle('pushNotifications')}
          />
        </div>

        {/* Aviso de sincronização */}
        <div className="flex items-start gap-2 p-3 bg-muted rounded-lg border">
          <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            As alterações serão sincronizadas com a plataforma de rastreamento.
          </p>
        </div>

        {/* Botão Salvar */}
        {hasChanges && (
          <Button
            onClick={handleSalvar}
            disabled={atualizarPermissoes.isPending}
            className="w-full"
          >
            {atualizarPermissoes.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Alterações'
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
