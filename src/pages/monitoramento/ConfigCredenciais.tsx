import { useState, useEffect } from 'react';
import { 
  Shield, Eye, EyeOff, Save, 
  CheckCircle, XCircle, Loader2, RefreshCw,
  Key, User, Lock, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/usePermissions';
import { Navigate } from 'react-router-dom';

interface PlataformaConfig {
  id: string;
  plataforma: string;
  nome_exibicao: string;
  ambiente_atual: string;
  credenciais?: {
    configurado: boolean;
    testado_em?: string;
    teste_sucesso?: boolean;
    teste_mensagem?: string;
    public_key?: string;
    username?: string;
    bearer_token?: string;
  } | null;
}

export default function ConfigCredenciais() {
  const permissions = usePermissions();
  const [plataformas, setPlataformas] = useState<PlataformaConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [testando, setTestando] = useState<string | null>(null);
  
  // Estados para mostrar/ocultar senhas
  const [mostrarSenhas, setMostrarSenhas] = useState<Record<string, boolean>>({});

  // Forms para cada plataforma
  const [formSoftruck, setFormSoftruck] = useState({
    public_key: '',
    username: '',
    password: '',
  });

  const [formRedeVeiculos, setFormRedeVeiculos] = useState({
    bearer_token: '',
  });

  // Verificar permissão
  if (!permissions.isGerencia) {
    return <Navigate to="/dashboard" replace />;
  }

  // Carregar plataformas e credenciais
  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('rastreadores_config_plataformas')
        .select(`
          id, plataforma, nome_exibicao, ambiente_atual,
          rastreadores_credenciais(
            configurado, testado_em, teste_sucesso, teste_mensagem,
            public_key, username, bearer_token
          )
        `)
        .eq('ativa', true);

      if (error) throw error;

      const processedData = data?.map(p => ({
        ...p,
        credenciais: p.rastreadores_credenciais?.[0] || null,
      })) || [];
      
      setPlataformas(processedData);

      // Preencher forms com dados existentes (sem senhas)
      const softruck = processedData.find(p => p.plataforma === 'softruck');
      if (softruck?.credenciais) {
        setFormSoftruck({
          public_key: softruck.credenciais.public_key || '',
          username: softruck.credenciais.username || '',
          password: '', // Não carrega senha por segurança
        });
      }

      const redeVeiculos = processedData.find(p => p.plataforma === 'rede_veiculos');
      if (redeVeiculos?.credenciais?.bearer_token) {
        setFormRedeVeiculos({
          bearer_token: '••••••••••••••••', // Mascarado
        });
      }
    } catch (error: any) {
      toast.error(`Erro ao carregar: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const salvarCredenciais = async (plataforma_codigo: string) => {
    setSalvando(plataforma_codigo);
    try {
      let credenciais = {};
      
      if (plataforma_codigo === 'softruck') {
        if (!formSoftruck.public_key || !formSoftruck.username || !formSoftruck.password) {
          toast.error('Preencha todos os campos da Softruck');
          return;
        }
        credenciais = formSoftruck;
      } else if (plataforma_codigo === 'rede_veiculos') {
        if (!formRedeVeiculos.bearer_token || formRedeVeiculos.bearer_token.startsWith('••')) {
          toast.error('Informe o Token Bearer da Rede Veículos');
          return;
        }
        credenciais = formRedeVeiculos;
      }

      const { data, error } = await supabase.functions.invoke('rastreador-salvar-credenciais', {
        body: { plataforma_codigo, credenciais },
      });

      if (error) throw error;

      if (data.success) {
        toast.success(data.mensagem);
        carregarDados();
      } else {
        toast.error(data.mensagem);
      }
    } catch (error: any) {
      toast.error(`Erro: ${error.message}`);
    } finally {
      setSalvando(null);
    }
  };

  const testarConexao = async (plataforma_codigo: string) => {
    setTestando(plataforma_codigo);
    try {
      const { data, error } = await supabase.functions.invoke('rastreador-testar-conexao', {
        body: { plataforma_codigo },
      });

      if (error) throw error;

      if (data.success) {
        toast.success(data.mensagem);
      } else {
        toast.error(data.mensagem);
      }
      
      carregarDados();
    } catch (error: any) {
      toast.error(`Erro: ${error.message}`);
    } finally {
      setTestando(null);
    }
  };

  const getPlataforma = (codigo: string) => plataformas.find(p => p.plataforma === codigo);

  const StatusBadge = ({ plataforma }: { plataforma?: PlataformaConfig }) => {
    if (!plataforma?.credenciais) {
      return <Badge variant="outline">Não configurado</Badge>;
    }
    if (plataforma.credenciais.teste_sucesso) {
      return <Badge className="bg-green-500 hover:bg-green-600">Conectado</Badge>;
    }
    if (plataforma.credenciais.configurado === false && plataforma.credenciais.testado_em) {
      return <Badge variant="destructive">Falha na conexão</Badge>;
    }
    return <Badge variant="secondary">Pendente teste</Badge>;
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Credenciais de Rastreadores
          </h1>
          <p className="text-muted-foreground">
            Configure as credenciais de acesso às plataformas de rastreamento
          </p>
        </div>
        <Button variant="outline" onClick={carregarDados}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <Alert variant="destructive" className="border-amber-500 bg-amber-500/10">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Dados Sensíveis</AlertTitle>
        <AlertDescription>
          As credenciais são armazenadas de forma segura e apenas administradores têm acesso.
          Nunca compartilhe esses dados com terceiros.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="softruck" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="softruck" className="flex items-center gap-2">
            Softruck
            <StatusBadge plataforma={getPlataforma('softruck')} />
          </TabsTrigger>
          <TabsTrigger value="rede_veiculos" className="flex items-center gap-2">
            Rede Veículos
            <StatusBadge plataforma={getPlataforma('rede_veiculos')} />
          </TabsTrigger>
        </TabsList>

        {/* SOFTRUCK */}
        <TabsContent value="softruck">
          <Card>
            <CardHeader>
              <CardTitle>Softruck</CardTitle>
              <CardDescription>
                Plataforma com posição em tempo real e histórico de trajetos.
                Requer Public Key, Username e Password.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Public Key *
                </Label>
                <Input
                  placeholder="pk_xxxxxxxxxxxxxxxx"
                  value={formSoftruck.public_key}
                  onChange={(e) => setFormSoftruck({ ...formSoftruck, public_key: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Encontre no painel da Softruck em Configurações &gt; API
                </p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Username *
                </Label>
                <Input
                  placeholder="usuario@empresa.com"
                  value={formSoftruck.username}
                  onChange={(e) => setFormSoftruck({ ...formSoftruck, username: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Password *
                </Label>
                <div className="relative">
                  <Input
                    type={mostrarSenhas.softruck ? 'text' : 'password'}
                    placeholder="Senha de acesso à API"
                    value={formSoftruck.password}
                    onChange={(e) => setFormSoftruck({ ...formSoftruck, password: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setMostrarSenhas({ ...mostrarSenhas, softruck: !mostrarSenhas.softruck })}
                  >
                    {mostrarSenhas.softruck ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {getPlataforma('softruck')?.credenciais?.teste_mensagem && (
                <Alert variant={getPlataforma('softruck')?.credenciais?.teste_sucesso ? 'default' : 'destructive'}>
                  {getPlataforma('softruck')?.credenciais?.teste_sucesso ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <AlertDescription>
                    {getPlataforma('softruck')?.credenciais?.teste_mensagem}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => testarConexao('softruck')}
                disabled={testando === 'softruck'}
              >
                {testando === 'softruck' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Testar Conexão
              </Button>
              <Button
                onClick={() => salvarCredenciais('softruck')}
                disabled={salvando === 'softruck'}
              >
                {salvando === 'softruck' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar Credenciais
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* REDE VEÍCULOS */}
        <TabsContent value="rede_veiculos">
          <Card>
            <CardHeader>
              <CardTitle>Rede Veículos</CardTitle>
              <CardDescription>
                Plataforma com acionamento de roubo/furto.
                Requer apenas o Token Bearer.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Token Bearer *
                </Label>
                <div className="relative">
                  <Input
                    type={mostrarSenhas.rede_veiculos ? 'text' : 'password'}
                    placeholder="Token fornecido pela Rede Veículos"
                    value={formRedeVeiculos.bearer_token}
                    onChange={(e) => setFormRedeVeiculos({ bearer_token: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setMostrarSenhas({ ...mostrarSenhas, rede_veiculos: !mostrarSenhas.rede_veiculos })}
                  >
                    {mostrarSenhas.rede_veiculos ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Token fornecido pela Rede Veículos para acesso à API
                </p>
              </div>

              {getPlataforma('rede_veiculos')?.credenciais?.teste_mensagem && (
                <Alert variant={getPlataforma('rede_veiculos')?.credenciais?.teste_sucesso ? 'default' : 'destructive'}>
                  {getPlataforma('rede_veiculos')?.credenciais?.teste_sucesso ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <AlertDescription>
                    {getPlataforma('rede_veiculos')?.credenciais?.teste_mensagem}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => testarConexao('rede_veiculos')}
                disabled={testando === 'rede_veiculos'}
              >
                {testando === 'rede_veiculos' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Testar Conexão
              </Button>
              <Button
                onClick={() => salvarCredenciais('rede_veiculos')}
                disabled={salvando === 'rede_veiculos'}
              >
                {salvando === 'rede_veiculos' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar Credenciais
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
