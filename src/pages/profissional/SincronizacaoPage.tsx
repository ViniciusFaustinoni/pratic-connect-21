import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Trash2, AlertCircle, CloudUpload, Image as ImageIcon, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { offlineDB, removerMidia } from '@/lib/offline/db';
import { useSyncQueue } from '@/hooks/useSyncQueue';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { toast } from 'sonner';

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelative(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'agora';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min atrás`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h atrás`;
  return `${Math.floor(diff / 86_400_000)} d atrás`;
}

export default function SincronizacaoPage() {
  const online = useOnlineStatus();
  const { forcarSync, sincronizando } = useSyncQueue();
  const itens = useLiveQuery(
    () => offlineDB.midias_pendentes.orderBy('criado_em').toArray(),
    [],
    []
  );

  const handleRemover = async (id: string) => {
    if (!confirm('Remover esta mídia da fila? Ela não será enviada.')) return;
    await removerMidia(id);
    toast.success('Mídia removida');
  };

  const total = itens?.length ?? 0;

  return (
    <div className="p-4 space-y-4 pb-24">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/instalador"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Sincronização</h1>
          <p className="text-xs text-muted-foreground">
            {total === 0 ? 'Nenhum item pendente' : `${total} ${total === 1 ? 'item' : 'itens'} na fila`}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => forcarSync()}
          disabled={!online || sincronizando}
        >
          <RefreshCw className={sincronizando ? 'h-4 w-4 mr-1 animate-spin' : 'h-4 w-4 mr-1'} />
          Tentar agora
        </Button>
      </div>

      {!online && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-6 text-sm text-destructive">
            Sem conexão. Os itens serão enviados automaticamente quando a internet voltar.
          </CardContent>
        </Card>
      )}

      {total === 0 && online && (
        <Card>
          <CardContent className="pt-6 text-center text-sm text-muted-foreground">
            <CloudUpload className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />
            Tudo sincronizado. Nada aguardando envio.
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {itens?.map((m) => {
          const Icone = m.tipo === 'video' ? Video : ImageIcon;
          const erroPermanente = m.tentativas >= 5;
          return (
            <Card key={m.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="rounded-md bg-muted p-2">
                  <Icone className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {m.tipo === 'video' ? 'Vídeo' : `Foto ${m.slot}`}
                    </span>
                    {m.status === 'enviando' && (
                      <Badge variant="secondary" className="text-[10px]">enviando</Badge>
                    )}
                    {erroPermanente && (
                      <Badge variant="destructive" className="text-[10px]">erro</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(m.tamanho)} • {formatRelative(m.criado_em)}
                    {m.tentativas > 0 && ` • ${m.tentativas} ${m.tentativas === 1 ? 'tentativa' : 'tentativas'}`}
                  </p>
                  {m.ultimo_erro && erroPermanente && (
                    <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {m.ultimo_erro.slice(0, 80)}
                    </p>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleRemover(m.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
