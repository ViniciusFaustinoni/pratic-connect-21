import { useState, useEffect } from 'react';
import { Save, Settings, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useConfiguracoesEncaixe, useAtualizarConfiguracoesEncaixe } from '@/hooks/useEncaixesDisponiveis';
import { Skeleton } from '@/components/ui/skeleton';

export function ConfiguracoesEncaixe() {
  const { data: config, isLoading } = useConfiguracoesEncaixe();
  const atualizarConfig = useAtualizarConfiguracoesEncaixe();

  const [raioKm, setRaioKm] = useState('10');
  const [janelaHoras, setJanelaHoras] = useState('2');
  const [ativo, setAtivo] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (config) {
      setRaioKm(String(config.raioKm));
      setJanelaHoras(String(config.janelaHoras));
      setAtivo(config.ativo);
    }
  }, [config]);

  useEffect(() => {
    if (config) {
      const changed =
        String(config.raioKm) !== raioKm || String(config.janelaHoras) !== janelaHoras;
      setHasChanges(changed);
    }
  }, [raioKm, janelaHoras, config]);

  const handleToggleAtivo = async (checked: boolean) => {
    setAtivo(checked);
    await atualizarConfig.mutateAsync({
      chave: 'operacional_encaixe_ativo',
      valor: String(checked),
    });
  };

  const handleSave = async () => {
    if (String(config?.raioKm) !== raioKm) {
      await atualizarConfig.mutateAsync({
        chave: 'operacional_encaixe_raio_km',
        valor: raioKm,
      });
    }
    if (String(config?.janelaHoras) !== janelaHoras) {
      await atualizarConfig.mutateAsync({
        chave: 'operacional_encaixe_janela_horas',
        valor: janelaHoras,
      });
    }
    setHasChanges(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configurações de Encaixe
              </CardTitle>
              <CardDescription>
                Configure os parâmetros que controlam quando e como os vistoriadores podem assumir
                serviços próximos da sua localização.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${ativo ? 'text-primary' : 'text-muted-foreground'}`}>
                {ativo ? 'Ativo' : 'Desativado'}
              </span>
              <Switch
                checked={ativo}
                onCheckedChange={handleToggleAtivo}
                disabled={atualizarConfig.isPending}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className={`space-y-6 transition-opacity ${!ativo ? 'opacity-50 pointer-events-none' : ''}`}>
          {/* Raio máximo */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="raioKm">Raio máximo de encaixe</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>
                      Distância máxima em quilômetros que um serviço pode estar da última
                      localização do vistoriador para aparecer como encaixe disponível.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="raioKm"
                type="number"
                min="1"
                max="100"
                value={raioKm}
                onChange={(e) => setRaioKm(e.target.value)}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">km</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Recomendado: 5-15 km para áreas urbanas, 20-50 km para áreas rurais.
            </p>
          </div>

          {/* Janela de tempo */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="janelaHoras">Janela de disponibilidade</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>
                      O vistoriador só verá encaixes disponíveis se não tiver tarefas agendadas
                      nas próximas X horas.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="janelaHoras"
                type="number"
                min="1"
                max="8"
                value={janelaHoras}
                onChange={(e) => setJanelaHoras(e.target.value)}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">horas</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Se o vistoriador tiver uma tarefa agendada dentro dessa janela, não verá encaixes.
            </p>
          </div>

          {/* Botão salvar */}
          {hasChanges && (
            <Button
              onClick={handleSave}
              disabled={atualizarConfig.isPending}
              className="w-full sm:w-auto"
            >
              <Save className="mr-2 h-4 w-4" />
              {atualizarConfig.isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Explicação do funcionamento */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Como funciona o encaixe?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="flex gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
              1
            </div>
            <p>
              Ao criar um serviço (instalação ou vistoria), ative a opção{' '}
              <strong>"Permitir Encaixe"</strong>.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
              2
            </div>
            <p>
              Vistoriadores que estiverem <strong>sem tarefas nas próximas {janelaHoras} horas</strong>{' '}
              poderão ver esses serviços na aba "Encaixes".
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
              3
            </div>
            <p>
              Serão exibidos apenas serviços dentro de <strong>{raioKm} km</strong> da última
              localização do vistoriador.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
              4
            </div>
            <p>
              O vistoriador pode <strong>"Assumir"</strong> o serviço, que será automaticamente
              atribuído a ele.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
