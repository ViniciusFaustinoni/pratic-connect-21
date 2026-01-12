import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Key,
  Plus,
  Trash2,
  Ban,
  Loader2,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useApiKeys, useCreateApiKey, useRevokeApiKey, useDeleteApiKey } from '@/hooks/useApiKeys';

export function ChavesApiTab() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copiedNewKey, setCopiedNewKey] = useState(false);

  const { data: apiKeys, isLoading } = useApiKeys();
  const createApiKey = useCreateApiKey();
  const revokeApiKey = useRevokeApiKey();
  const deleteApiKey = useDeleteApiKey();

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      toast.error('Informe um nome para a chave');
      return;
    }

    try {
      const result = await createApiKey.mutateAsync(newKeyName);
      setCreatedKey(result.fullKey);
      toast.success('API Key criada com sucesso!');
    } catch {
      toast.error('Erro ao criar API Key');
    }
  };

  const handleCopyKey = async () => {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(createdKey);
      setCopiedNewKey(true);
      setTimeout(() => setCopiedNewKey(false), 2000);
      toast.success('Chave copiada!');
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const handleCloseCreate = () => {
    setCreateDialogOpen(false);
    setNewKeyName('');
    setCreatedKey(null);
    setCopiedNewKey(false);
  };

  const handleRevoke = async (id: string) => {
    try {
      await revokeApiKey.mutateAsync(id);
      toast.success('Chave revogada');
    } catch {
      toast.error('Erro ao revogar chave');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteApiKey.mutateAsync(id);
      toast.success('Chave excluída');
    } catch {
      toast.error('Erro ao excluir chave');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Key className="h-5 w-5" />
                Chaves de API
              </CardTitle>
              <CardDescription>
                Gerencie as chaves de acesso para integrações externas
              </CardDescription>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Chave
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !apiKeys?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Key className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-foreground">Nenhuma chave cadastrada</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Crie sua primeira API Key para começar a integrar
              </p>
              <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar API Key
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Chave</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Último Uso</TableHead>
                    <TableHead>Criação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium">{key.nome}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {key.key_prefix}...
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={key.ativa ? 'default' : 'secondary'}
                          className={key.ativa ? 'bg-green-500/20 text-green-500' : ''}
                        >
                          {key.ativa ? 'Ativa' : 'Revogada'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {key.last_used_at 
                          ? format(new Date(key.last_used_at), "dd/MM/yy HH:mm", { locale: ptBR })
                          : 'Nunca'
                        }
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(key.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {key.ativa && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRevoke(key.id)}
                              disabled={revokeApiKey.isPending}
                              title="Revogar"
                            >
                              <Ban className="h-4 w-4 text-orange-500" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(key.id)}
                            disabled={deleteApiKey.isPending}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={handleCloseCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {createdKey ? 'API Key Criada!' : 'Nova API Key'}
            </DialogTitle>
            <DialogDescription>
              {createdKey 
                ? 'Copie sua chave agora. Por segurança, ela não será exibida novamente.'
                : 'Crie uma nova chave para integração com sistemas externos.'
              }
            </DialogDescription>
          </DialogHeader>

          {createdKey ? (
            <div className="space-y-4">
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-700 dark:text-yellow-400">
                      Copie sua chave agora!
                    </p>
                    <p className="text-sm text-yellow-600 dark:text-yellow-500">
                      Esta é a única vez que você verá a chave completa.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Input
                  value={createdKey}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button variant="outline" size="icon" onClick={handleCopyKey}>
                  {copiedNewKey ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="keyName">Nome da Chave</Label>
                <Input
                  id="keyName"
                  placeholder="Ex: Integração N8N, API Leads, etc."
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            {createdKey ? (
              <Button onClick={handleCloseCreate}>Fechar</Button>
            ) : (
              <>
                <Button variant="outline" onClick={handleCloseCreate}>
                  Cancelar
                </Button>
                <Button onClick={handleCreate} disabled={createApiKey.isPending}>
                  {createApiKey.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Criar Chave
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
