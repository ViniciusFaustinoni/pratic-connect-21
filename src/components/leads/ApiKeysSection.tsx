import { useState } from 'react';
import { Key, Plus, Copy, Trash2, Ban, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useApiKeys, useCreateApiKey, useRevokeApiKey, useDeleteApiKey } from '@/hooks/useApiKeys';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function ApiKeysSection() {
  const { data: apiKeys, isLoading } = useApiKeys();
  const createApiKey = useCreateApiKey();
  const revokeApiKey = useRevokeApiKey();
  const deleteApiKey = useDeleteApiKey();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      toast.error('Informe um nome para a chave');
      return;
    }

    try {
      const result = await createApiKey.mutateAsync(newKeyName);
      setCreatedKey(result.fullKey);
      setNewKeyName('');
      toast.success('Chave de API criada com sucesso');
    } catch (error) {
      toast.error('Erro ao criar chave de API');
    }
  };

  const handleCopyKey = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      setCopied(true);
      toast.success('Chave copiada para a área de transferência');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCloseCreate = () => {
    setIsCreateOpen(false);
    setCreatedKey(null);
    setNewKeyName('');
  };

  const handleRevoke = async (id: string) => {
    try {
      await revokeApiKey.mutateAsync(id);
      toast.success('Chave revogada com sucesso');
    } catch (error) {
      toast.error('Erro ao revogar chave');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteApiKey.mutateAsync(id);
      toast.success('Chave excluída com sucesso');
    } catch (error) {
      toast.error('Erro ao excluir chave');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Chaves de API
            </CardTitle>
            <CardDescription>
              Gerencie as chaves de acesso para integrações externas
            </CardDescription>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Chave
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {createdKey ? 'Chave Criada' : 'Nova Chave de API'}
                </DialogTitle>
                <DialogDescription>
                  {createdKey
                    ? 'Salve esta chave agora. Ela não será exibida novamente.'
                    : 'Dê um nome descritivo para identificar esta chave.'}
                </DialogDescription>
              </DialogHeader>

              {createdKey ? (
                <div className="space-y-4">
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Copie e salve esta chave em um local seguro. Ela não será exibida novamente!
                    </AlertDescription>
                  </Alert>
                  <div className="flex gap-2">
                    <Input
                      value={createdKey}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button variant="outline" onClick={handleCopyKey}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Input
                    placeholder="Ex: Integração Facebook Ads"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                  />
                </div>
              )}

              <DialogFooter>
                {createdKey ? (
                  <Button onClick={handleCloseCreate}>Fechar</Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleCreate} disabled={createApiKey.isPending}>
                      {createApiKey.isPending ? 'Criando...' : 'Criar Chave'}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">Carregando...</div>
        ) : apiKeys?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma chave de API criada ainda
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Chave</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Último Uso</TableHead>
                <TableHead>Criada em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiKeys?.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.nome}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {key.key_prefix}
                  </TableCell>
                  <TableCell>
                    <Badge variant={key.ativa ? 'default' : 'secondary'}>
                      {key.ativa ? 'Ativa' : 'Revogada'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {key.last_used_at
                      ? format(new Date(key.last_used_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                      : 'Nunca usada'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(key.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {key.ativa && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRevoke(key.id)}
                          title="Revogar chave"
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(key.id)}
                        title="Excluir chave"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}