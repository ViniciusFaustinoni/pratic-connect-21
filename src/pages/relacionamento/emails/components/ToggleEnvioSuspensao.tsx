import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useEmailSuspensaoConfig, useUpdateEmailSuspensaoConfig } from '@/hooks/emails-suspensao/useEmailSuspensao';
import { Skeleton } from '@/components/ui/skeleton';

export function ToggleEnvioSuspensao() {
  const { data: config, isLoading } = useEmailSuspensaoConfig();
  const update = useUpdateEmailSuspensaoConfig();

  if (isLoading) return <Skeleton className="h-20 w-full" />;
  if (!config) return null;

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 py-4">
        <div>
          <Label htmlFor="toggle-envio-suspensao" className="text-base font-medium">
            Enviar e-mail em suspensões
          </Label>
          <p className="text-sm text-muted-foreground mt-1">
            Quando ligado, as suspensões dispararão um e-mail para o cliente usando o template abaixo.
            A integração com os fluxos será ativada em fase posterior.
          </p>
        </div>
        <Switch
          id="toggle-envio-suspensao"
          checked={config.enabled}
          disabled={update.isPending}
          onCheckedChange={(enabled) => update.mutate({ id: config.id, enabled })}
        />
      </CardContent>
    </Card>
  );
}
