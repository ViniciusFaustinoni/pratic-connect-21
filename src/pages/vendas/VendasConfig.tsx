import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Settings, Key, Bell, Copy, Eye, EyeOff, Plus, Trash2, 
  Code, Users, RefreshCw, AlertCircle, Check
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import DistribuicaoConfig from './DistribuicaoConfig';

// Hook para buscar API Keys
function useApiKeys() {
  return useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

export default function VendasConfig() {
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [novaKeyModal, setNovaKeyModal] = useState(false);
  const [novaKeyNome, setNovaKeyNome] = useState('');
  
  const { data: apiKeys, isLoading: loadingKeys, refetch: refetchKeys } = useApiKeys();

  // Notificações config (mock por enquanto)
  const [notifConfig, setNotifConfig] = useState({
    novoLead: true,
    contratoAssinado: true,
    contratoRecusado: true,
    lembreteFollowup: true,
    horasSemContato: 24,
  });

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('Chave copiada!');
  };

  const handleToggleShowKey = (id: string) => {
    setShowKey((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const maskKey = (key: string) => {
    if (key.length <= 8) return '••••••••';
    return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4);
  };

  const handleDeleteKey = async (id: string) => {
    const { error } = await supabase
      .from('api_keys')
      .update({ ativa: false })
      .eq('id', id);

    if (error) {
      toast.error('Erro ao desativar chave');
    } else {
      toast.success('Chave desativada');
      refetchKeys();
    }
  };

  const handleCreateKey = async () => {
    if (!novaKeyNome.trim()) {
      toast.error('Digite um nome para a chave');
      return;
    }

    // Gerar chave aleatória
    const novaChave = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const { error } = await supabase
      .from('api_keys')
      .insert({
        nome: novaKeyNome,
        key_hash: novaChave, // Em produção, usar hash
        key_prefix: novaChave.substring(0, 8),
      });

    if (error) {
      toast.error('Erro ao criar chave');
    } else {
      toast.success('Chave criada com sucesso');
      setNovaKeyModal(false);
      setNovaKeyNome('');
      refetchKeys();
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações de Vendas</h1>
        <p className="text-muted-foreground">Configure distribuição de leads, APIs de integração e notificações</p>
      </div>

      {/* TABS */}
      <Tabs defaultValue="distribuicao" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="distribuicao" className="gap-2">
            <Users className="h-4 w-4" />
            Distribuição
          </TabsTrigger>
          <TabsTrigger value="apis" className="gap-2">
            <Key className="h-4 w-4" />
            APIs
          </TabsTrigger>
          <TabsTrigger value="notificacoes" className="gap-2">
            <Bell className="h-4 w-4" />
            Notificações
          </TabsTrigger>
        </TabsList>

        {/* ABA DISTRIBUIÇÃO */}
        <TabsContent value="distribuicao">
          <DistribuicaoConfig />
        </TabsContent>

        {/* ABA APIs */}
        <TabsContent value="apis" className="space-y-6">
          {/* Chaves de API */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Chaves de API</CardTitle>
                <CardDescription>Gerencie as chaves de acesso para integrações externas</CardDescription>
              </div>
              <Dialog open={novaKeyModal} onOpenChange={setNovaKeyModal}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Chave
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Nova Chave de API</DialogTitle>
                  </DialogHeader>
                  <div className="py-4 space-y-4">
                    <div>
                      <Label>Nome da chave</Label>
                      <Input
                        placeholder="Ex: Integração Google Ads"
                        value={novaKeyNome}
                        onChange={(e) => setNovaKeyNome(e.target.value)}
                        className="mt-2"
                      />
                    </div>
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        A chave será exibida apenas uma vez. Guarde-a em local seguro.
                      </AlertDescription>
                    </Alert>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setNovaKeyModal(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateKey}>
                      Criar Chave
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {loadingKeys ? (
                <div className="space-y-2">
                  {[1, 2].map(i => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Chave</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="w-24">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiKeys?.filter(k => k.ativa).map((key) => (
                      <TableRow key={key.id}>
                        <TableCell className="font-medium">{key.nome}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 font-mono text-sm">
                            {showKey[key.id] ? key.key_hash : maskKey(key.key_hash)}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleToggleShowKey(key.id)}
                            >
                              {showKey[key.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleCopyKey(key.key_hash)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={key.ativa ? 'default' : 'secondary'}>
                            {key.ativa ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteKey(key.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!apiKeys || apiKeys.filter(k => k.ativa).length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          Nenhuma chave de API cadastrada
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Documentação da API */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Documentação da API
              </CardTitle>
              <CardDescription>
                Use a API para integrar leads de fontes externas (Google Ads, Facebook, Site, etc)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="endpoint">
                  <AccordionTrigger>Endpoint</AccordionTrigger>
                  <AccordionContent>
                    <div className="bg-muted p-4 rounded-lg font-mono text-sm">
                      <code>POST https://[PROJECT_ID].supabase.co/functions/v1/leads-webhook</code>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="headers">
                  <AccordionTrigger>Headers</AccordionTrigger>
                  <AccordionContent>
                    <div className="bg-muted p-4 rounded-lg font-mono text-sm space-y-1">
                      <p><span className="text-primary">x-api-key:</span> [SUA_API_KEY]</p>
                      <p><span className="text-primary">Content-Type:</span> application/json</p>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="body">
                  <AccordionTrigger>Body (JSON)</AccordionTrigger>
                  <AccordionContent>
                    <pre className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto">
{`{
  "nome": "João Silva",              // Obrigatório
  "telefone": "(11) 99999-1234",     // Obrigatório
  "email": "joao@email.com",         // Opcional
  "cpf": "123.456.789-00",           // Opcional
  "cidade": "São Paulo",             // Opcional
  "estado": "SP",                    // Opcional
  "veiculo_marca": "Volkswagen",     // Opcional
  "veiculo_modelo": "Gol",           // Opcional
  "veiculo_ano": 2020,               // Opcional
  "veiculo_placa": "ABC1234",        // Opcional
  "planos_interesse": ["basico", "completo"], // Opcional
  "origem_detalhe": "Campanha Google Ads"     // Opcional
}`}
                    </pre>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="responses">
                  <AccordionTrigger>Responses</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Badge className="bg-green-100 text-green-800">201</Badge>
                        <span>Lead criado com sucesso</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className="bg-yellow-100 text-yellow-800">400</Badge>
                        <span>Dados inválidos (nome ou telefone ausentes)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className="bg-red-100 text-red-800">401</Badge>
                        <span>API Key inválida ou ausente</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className="bg-orange-100 text-orange-800">409</Badge>
                        <span>Lead duplicado (mesmo telefone nas últimas 24h)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className="bg-purple-100 text-purple-800">429</Badge>
                        <span>Limite diário excedido</span>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA NOTIFICAÇÕES */}
        <TabsContent value="notificacoes">
          <Card>
            <CardHeader>
              <CardTitle>Configurar Notificações</CardTitle>
              <CardDescription>Escolha quais eventos geram notificações para os vendedores</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Novo lead recebido</Label>
                  <p className="text-sm text-muted-foreground">Notificar quando um lead for atribuído</p>
                </div>
                <Switch
                  checked={notifConfig.novoLead}
                  onCheckedChange={(checked) => setNotifConfig(c => ({ ...c, novoLead: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Contrato assinado</Label>
                  <p className="text-sm text-muted-foreground">Celebrar quando o cliente assinar</p>
                </div>
                <Switch
                  checked={notifConfig.contratoAssinado}
                  onCheckedChange={(checked) => setNotifConfig(c => ({ ...c, contratoAssinado: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Contrato recusado</Label>
                  <p className="text-sm text-muted-foreground">Alertar se o cliente recusar a assinatura</p>
                </div>
                <Switch
                  checked={notifConfig.contratoRecusado}
                  onCheckedChange={(checked) => setNotifConfig(c => ({ ...c, contratoRecusado: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Lembrete de follow-up</Label>
                  <p className="text-sm text-muted-foreground">Lembrar de leads sem contato recente</p>
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    className="w-20"
                    value={notifConfig.horasSemContato}
                    onChange={(e) => setNotifConfig(c => ({ ...c, horasSemContato: parseInt(e.target.value) || 24 }))}
                    min={1}
                  />
                  <span className="text-sm text-muted-foreground">horas</span>
                  <Switch
                    checked={notifConfig.lembreteFollowup}
                    onCheckedChange={(checked) => setNotifConfig(c => ({ ...c, lembreteFollowup: checked }))}
                  />
                </div>
              </div>

              <Button className="mt-4">
                <Check className="h-4 w-4 mr-2" />
                Salvar Configurações
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
