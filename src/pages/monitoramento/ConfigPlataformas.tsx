import { useState } from 'react';
import { 
  Settings, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CheckCircle, 
  XCircle,
  Loader2,
  Server,
  Shield,
  MapPin,
  History,
  AlertTriangle,
  Lock,
  Webhook
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { usePlataformasConfig, useUpdatePlataformaConfig, usePlataformasEstatisticas } from '@/hooks/usePlataformasConfig';
import { useTestarConexaoPlataforma } from '@/hooks/useRastreadorAuth';
import { useSyncRastreadores } from '@/hooks/useRastreadorPosicao';

export default function ConfigPlataformas() {
  const { data: plataformas, isLoading } = usePlataformasConfig();
  const { data: estatisticas } = usePlataformasEstatisticas();
  const updateConfig = useUpdatePlataformaConfig();
  const testarConexao = useTestarConexaoPlataforma();
  const syncRastreadores = useSyncRastreadores();
  
  const [testingPlatform, setTestingPlatform] = useState<string | null>(null);
  const [syncingPlatform, setSyncingPlatform] = useState<string | null>(null);

  const handleTestarConexao = async (codigo: string) => {
    setTestingPlatform(codigo);
    try {
      await testarConexao.mutateAsync(codigo as 'softruck' | 'rede_veiculos');
    } finally {
      setTestingPlatform(null);
    }
  };

  const handleSincronizar = async (codigo: string) => {
    setSyncingPlatform(codigo);
    try {
      await syncRastreadores.mutateAsync(codigo as 'softruck' | 'rede_veiculos');
    } finally {
      setSyncingPlatform(null);
    }
  };

  const handleToggleAtiva = (id: string, ativa: boolean) => {
    updateConfig.mutate({ id, updates: { ativa } });
  };

  const handleChangeAmbiente = (id: string, ambiente: 'sandbox' | 'producao') => {
    updateConfig.mutate({ id, updates: { ambiente_atual: ambiente } });
  };

  const getPlataformaIcon = (codigo: string) => {
    switch (codigo) {
      case 'softruck':
        return <Server className="h-6 w-6 text-blue-500" />;
      case 'rede_veiculos':
        return <Shield className="h-6 w-6 text-green-500" />;
      default:
        return <Server className="h-6 w-6" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configuração de Plataformas</h1>
          <p className="text-muted-foreground">
            Gerencie as integrações com plataformas de rastreamento
          </p>
        </div>
        <Button 
          onClick={() => syncRastreadores.mutate(undefined)}
          disabled={syncRastreadores.isPending}
        >
          {syncRastreadores.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Sincronizar Todas
        </Button>
      </div>

      {/* Plataformas */}
      <div className="grid gap-6">
        {plataformas?.map((plataforma) => {
          const stats = estatisticas?.[plataforma.codigo] || { total: 0, ativos: 0, online: 0 };
          const isTesting = testingPlatform === plataforma.codigo;
          const isSyncing = syncingPlatform === plataforma.codigo;

          return (
            <Card key={plataforma.id} className={!plataforma.ativa ? 'opacity-60' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    {getPlataformaIcon(plataforma.codigo)}
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {plataforma.nome}
                        {plataforma.ativa ? (
                          <Badge variant="default" className="bg-green-500">
                            <Wifi className="h-3 w-3 mr-1" />
                            Ativa
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <WifiOff className="h-3 w-3 mr-1" />
                            Inativa
                          </Badge>
                        )}
                        <Badge variant="outline">
                          {plataforma.ambiente === 'producao' ? 'Produção' : 'Sandbox'}
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        {plataforma.auth_type === 'oauth_jwt' ? 'OAuth JWT' : 'Bearer Token Fixo'}
                        {' • '}
                        {stats.total} rastreador(es) cadastrado(s)
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={plataforma.ativa}
                      onCheckedChange={(checked) => handleToggleAtiva(plataforma.id, checked)}
                    />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Funcionalidades Suportadas */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Funcionalidades</Label>
                  <div className="flex flex-wrap gap-2">
                    {plataforma.suporta_posicao_tempo_real && (
                      <Badge variant="outline" className="gap-1">
                        <MapPin className="h-3 w-3" />
                        Tempo Real
                      </Badge>
                    )}
                    {plataforma.suporta_historico && (
                      <Badge variant="outline" className="gap-1">
                        <History className="h-3 w-3" />
                        Histórico
                      </Badge>
                    )}
                    {plataforma.suporta_acionamento_roubo && (
                      <Badge variant="outline" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Acionamento Roubo
                      </Badge>
                    )}
                    {plataforma.suporta_bloqueio && (
                      <Badge variant="outline" className="gap-1">
                        <Lock className="h-3 w-3" />
                        Bloqueio
                      </Badge>
                    )}
                    {plataforma.suporta_webhooks && (
                      <Badge variant="outline" className="gap-1">
                        <Webhook className="h-3 w-3" />
                        Webhooks
                      </Badge>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Configurações */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Ambiente</Label>
                    <Select
                      value={plataforma.ambiente}
                      onValueChange={(value) => handleChangeAmbiente(plataforma.id, value as 'sandbox' | 'producao')}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sandbox">Sandbox (Testes)</SelectItem>
                        <SelectItem value="producao">Produção</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>URL da API</Label>
                    <div className="text-sm text-muted-foreground bg-muted p-2 rounded-md font-mono truncate">
                      {plataforma.ambiente === 'producao' 
                        ? plataforma.api_url_producao 
                        : plataforma.api_url_sandbox}
                    </div>
                  </div>
                </div>

                {/* Estatísticas */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{stats.total}</div>
                    <div className="text-xs text-muted-foreground">Total</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{stats.ativos}</div>
                    <div className="text-xs text-muted-foreground">Instalados</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{stats.online}</div>
                    <div className="text-xs text-muted-foreground">Online</div>
                  </div>
                </div>

                <Separator />

                {/* Ações */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleTestarConexao(plataforma.codigo)}
                    disabled={isTesting || !plataforma.ativa}
                  >
                    {isTesting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Testar Conexão
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleSincronizar(plataforma.codigo)}
                    disabled={isSyncing || !plataforma.ativa}
                  >
                    {isSyncing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Sincronizar Agora
                  </Button>
                </div>

                {/* Aviso de Secrets */}
                {plataforma.codigo === 'softruck' && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-700 dark:text-amber-400 text-sm">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Secrets necessários:</strong> SOFTRUCK_PUBLIC_KEY, SOFTRUCK_USERNAME, SOFTRUCK_PASSWORD
                      <br />
                      Configure em: Supabase Dashboard → Project Settings → Edge Functions → Secrets
                    </div>
                  </div>
                )}
                {plataforma.codigo === 'rede_veiculos' && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-700 dark:text-amber-400 text-sm">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Secret necessário:</strong> REDE_VEICULOS_TOKEN
                      <br />
                      Configure em: Supabase Dashboard → Project Settings → Edge Functions → Secrets
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {(!plataformas || plataformas.length === 0) && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Settings className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhuma plataforma configurada</h3>
              <p className="text-muted-foreground text-center">
                As plataformas de rastreamento ainda não foram configuradas no banco de dados.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
