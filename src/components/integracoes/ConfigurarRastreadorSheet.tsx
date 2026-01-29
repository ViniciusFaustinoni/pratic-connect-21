import { useState, useEffect } from 'react';
import { Eye, EyeOff, Loader2, CheckCircle, XCircle, ExternalLink, RefreshCw, Info } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ConfigurarRastreadorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plataforma: 'softruck' | 'rede_veiculos';
  onSuccess?: () => void;
}

interface CredencialStatus {
  configurado: boolean;
  testado_em: string | null;
  teste_sucesso: boolean;
  teste_mensagem: string | null;
}

export function ConfigurarRastreadorSheet({
  open,
  onOpenChange,
  plataforma,
  onSuccess,
}: ConfigurarRastreadorSheetProps) {
  const [testando, setTestando] = useState(false);
  const [status, setStatus] = useState<CredencialStatus | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  // Campos específicos por plataforma (não armazenamos valores, apenas para UI)
  const [credenciais, setCredenciais] = useState({
    public_key: '',
    username: '',
    password: '',
    enterprise_id: '',
    bearer_token: '',
  });

  const isSoftruck = plataforma === 'softruck';
  const titulo = isSoftruck ? 'Softruck' : 'Rede Veículos';

  // Buscar status atual
  useEffect(() => {
    if (open) {
      buscarStatus();
    }
  }, [open, plataforma]);

  async function buscarStatus() {
    try {
      const { data, error } = await supabase
        .from('rastreadores_credenciais')
        .select('configurado, testado_em, teste_sucesso, teste_mensagem')
        .eq('plataforma_id', (
          await supabase
            .from('rastreadores_config_plataformas')
            .select('id')
            .eq('plataforma', plataforma)
            .single()
        ).data?.id)
        .maybeSingle();

      if (!error && data) {
        setStatus(data);
      }
    } catch (err) {
      console.error('Erro ao buscar status:', err);
    }
  }

  async function testarConexao() {
    setTestando(true);
    try {
      const { data, error } = await supabase.functions.invoke('rastreador-testar-conexao', {
        body: { plataforma_codigo: plataforma },
      });

      if (error) throw error;

      if (data.success) {
        toast.success(data.mensagem || 'Conexão testada com sucesso!');
        setStatus({
          configurado: true,
          testado_em: new Date().toISOString(),
          teste_sucesso: true,
          teste_mensagem: data.mensagem,
        });
      } else {
        toast.error(data.mensagem || 'Falha ao testar conexão');
        setStatus({
          configurado: false,
          testado_em: new Date().toISOString(),
          teste_sucesso: false,
          teste_mensagem: data.mensagem,
        });
      }

      await buscarStatus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao testar conexão';
      toast.error(msg);
    } finally {
      setTestando(false);
    }
  }

  function togglePassword(field: string) {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  }

  const secretsUrl = 'https://supabase.com/dashboard/project/iyxdgmukrrdkffraptsx/settings/functions';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Configurar {titulo}
          </SheetTitle>
          <SheetDescription>
            Configure as credenciais de API para integração com {titulo}.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status atual */}
          {status && (
            <Alert variant={status.teste_sucesso ? 'default' : 'destructive'} className={status.teste_sucesso ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : ''}>
              <div className="flex items-start gap-2">
                {status.teste_sucesso ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <div className="flex-1">
                  <AlertDescription className="text-sm">
                    {status.teste_sucesso ? 'Conexão configurada com sucesso!' : 'Credenciais não configuradas ou inválidas'}
                  </AlertDescription>
                  {status.testado_em && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Último teste: {formatDistanceToNow(new Date(status.testado_em), { addSuffix: true, locale: ptBR })}
                    </p>
                  )}
                </div>
              </div>
            </Alert>
          )}

          {/* Instruções */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              As credenciais são armazenadas de forma segura nos <strong>Secrets</strong> do Supabase. 
              Configure os valores diretamente no painel e use o botão "Testar Conexão" para validar.
            </AlertDescription>
          </Alert>

          <Separator />

          {/* Campos por plataforma - apenas para referência */}
          {isSoftruck ? (
            <div className="space-y-4">
              <div className="text-sm font-medium text-foreground">Secrets necessários:</div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <code className="text-sm font-mono">SOFTRUCK_PUBLIC_KEY</code>
                    <p className="text-xs text-muted-foreground mt-1">Chave pública da API Softruck</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <code className="text-sm font-mono">SOFTRUCK_USERNAME</code>
                    <p className="text-xs text-muted-foreground mt-1">Usuário de acesso à API</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <code className="text-sm font-mono">SOFTRUCK_PASSWORD</code>
                    <p className="text-xs text-muted-foreground mt-1">Senha de acesso à API</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <code className="text-sm font-mono">SOFTRUCK_ENTERPRISE_ID</code>
                    <p className="text-xs text-muted-foreground mt-1">ID da empresa (opcional, descoberto automaticamente)</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm font-medium text-foreground">Secret necessário:</div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <code className="text-sm font-mono">REDE_VEICULOS_TOKEN</code>
                    <p className="text-xs text-muted-foreground mt-1">Token Bearer fornecido pela Rede Veículos</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Mensagem do último teste */}
          {status?.teste_mensagem && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs font-medium text-muted-foreground mb-1">Resultado do último teste:</p>
              <p className="text-sm">{status.teste_mensagem}</p>
            </div>
          )}

          {/* Botões de ação */}
          <div className="flex flex-col gap-3 pt-4">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => window.open(secretsUrl, '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
              Abrir Painel de Secrets
            </Button>

            <Button
              onClick={testarConexao}
              disabled={testando}
              className="w-full gap-2"
            >
              {testando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {testando ? 'Testando...' : 'Testar Conexão'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
