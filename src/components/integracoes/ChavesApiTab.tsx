import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Key,
  Plus,
  Trash2,
  Ban,
  Loader2,
  Copy,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Lightbulb,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useApiKeys, useCreateApiKey, useRevokeApiKey, useDeleteApiKey } from '@/hooks/useApiKeys';
import { cn } from '@/lib/utils';

function ApiKeyCard({ apiKey, onRevoke, onDelete, isRevoking, isDeleting }: {
  apiKey: {
    id: string;
    nome: string;
    key_prefix: string;
    ativa: boolean | null;
    last_used_at?: string | null;
    created_at: string;
  };
  onRevoke: (id: string) => void;
  onDelete: (id: string) => void;
  isRevoking: boolean;
  isDeleting: boolean;
}) {
  const [showActions, setShowActions] = useState(false);

  const formatLastUsed = () => {
    if (!apiKey.last_used_at) return 'Nunca usado';
    try {
      return `Último uso: ${formatDistanceToNow(new Date(apiKey.last_used_at), { addSuffix: true, locale: ptBR })}`;
    } catch {
      return 'Nunca usado';
    }
  };

  // Determine status based on activity
  const getStatusInfo = () => {
    if (!apiKey.ativa) {
      return { color: 'text-red-500', bg: 'bg-red-500', label: 'Revogada' };
    }
    
    // Check if unused for more than 7 days
    if (apiKey.last_used_at) {
      const lastUsed = new Date(apiKey.last_used_at);
      const daysSinceUse = (Date.now() - lastUsed.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUse > 7) {
        return { color: 'text-yellow-500', bg: 'bg-yellow-500', label: 'Pouco usada' };
      }
    }
    
    return { color: 'text-green-500', bg: 'bg-green-500 animate-pulse', label: 'Ativa' };
  };

  const status = getStatusInfo();

  return (
    <Card className={cn(
      "border-border/50 transition-all duration-200 hover:shadow-md",
      !apiKey.ativa && "opacity-60"
    )}>
      <CardContent className="p-5">
        {/* Header with status */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className={cn("h-2.5 w-2.5 rounded-full", status.bg)} />
            <h3 className="font-medium">{apiKey.nome}</h3>
            <Badge 
              variant="outline"
              className={cn(
                "text-xs",
                apiKey.ativa 
                  ? status.color === 'text-yellow-500' 
                    ? "border-yellow-500/30 text-yellow-500 bg-yellow-500/10"
                    : "border-green-500/30 text-green-500 bg-green-500/10"
                  : "border-red-500/30 text-red-500 bg-red-500/10"
              )}
            >
              {status.label}
            </Badge>
          </div>
        </div>

        {/* Key display */}
        <div className="mt-3">
          <code className="text-sm bg-muted px-3 py-1.5 rounded font-mono text-muted-foreground">
            {apiKey.key_prefix}...
          </code>
        </div>

        {/* Info */}
        <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
          <span>Criada em {format(new Date(apiKey.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
          <span>•</span>
          <span>{formatLastUsed()}</span>
        </div>

        {/* Actions */}
        <div className="mt-4 pt-4 border-t border-border/50 flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-2" onClick={() => {
            navigator.clipboard.writeText(apiKey.key_prefix);
            toast.success('Prefixo copiado!');
          }}>
            <Copy className="h-4 w-4" />
            Copiar
          </Button>
          
          {apiKey.ativa && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-orange-500 hover:text-orange-600 hover:bg-orange-500/10"
              onClick={() => onRevoke(apiKey.id)}
              disabled={isRevoking}
            >
              <Ban className="h-4 w-4" />
              Revogar
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => onDelete(apiKey.id)}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4" />
            Excluir
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Key className="h-5 w-5" />
            Chaves de API
          </h2>
          <p className="text-sm text-muted-foreground">
            Gerencie chaves de acesso para integrações externas
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Chave
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !apiKeys?.length ? (
        <Card className="border-border/50">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Key className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-lg text-foreground">Nenhuma chave cadastrada</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Crie sua primeira API Key para começar a integrar sistemas externos
              </p>
              <Button className="mt-6 gap-2" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Criar API Key
              </Button>
              
              {/* Tip */}
              <div className="mt-8 pt-6 border-t border-border/50 w-full max-w-md">
                <div className="flex items-start gap-2 text-left">
                  <Lightbulb className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Dica:</strong> Use chaves de teste para desenvolvimento e chaves de produção apenas em ambiente final.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* API Keys Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            {apiKeys.map((key) => (
              <ApiKeyCard
                key={key.id}
                apiKey={key}
                onRevoke={handleRevoke}
                onDelete={handleDelete}
                isRevoking={revokeApiKey.isPending}
                isDeleting={deleteApiKey.isPending}
              />
            ))}
          </div>

          {/* Tip at bottom */}
          <Card className="border-border/50 bg-muted/30">
            <CardContent className="py-4">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Dica:</strong> Use chaves de teste para desenvolvimento e chaves de produção apenas em ambiente final. Revogue chaves que não estão mais em uso.
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}

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
