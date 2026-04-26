import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, CheckCircle, XCircle, ImageIcon, ExternalLink, Camera, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useVistoriaLinksAguardandoAprovacao,
  useAprovarFotosVistoria,
  useReprovarFotosVistoria,
  buildVistoriaLinkUrl,
} from '@/hooks/useVistoriaLinkPublica';

export default function AprovacaoFotosVistoriaTab() {
  const { data: itens, isLoading, refetch } = useVistoriaLinksAguardandoAprovacao();
  const [selecionado, setSelecionado] = useState<any | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!itens || itens.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center">
        <CheckCircle className="h-10 w-10 mx-auto text-success mb-3" />
        <h3 className="font-semibold">Nenhuma vistoria aguardando aprovação</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Quando um executor concluir a etapa de fotos, ela aparecerá aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {itens.length} vistoria(s) aguardando aprovação das fotos
        </p>
        <Button size="sm" variant="ghost" onClick={() => refetch()}>
          Atualizar
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {itens.map((item: any) => {
          const veiculo = item.instalacoes?.veiculos;
          const associado = item.instalacoes?.associados;
          return (
            <Card key={item.id} className="hover:border-primary/40 transition-all cursor-pointer" onClick={() => setSelecionado(item)}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-bold">
                    {veiculo?.placa || '—'}
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    Aguardando
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div>
                  <p className="font-medium">
                    {veiculo?.marca} {veiculo?.modelo}
                  </p>
                  <p className="text-muted-foreground">{associado?.nome || '—'}</p>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Camera className="h-3 w-3" />
                  <span>Por: {item.fotos_executor_nome || 'desconhecido'}</span>
                </div>
                {item.fotos_concluida_em && (
                  <p className="text-muted-foreground">
                    {formatDistanceToNow(new Date(item.fotos_concluida_em), { locale: ptBR, addSuffix: true })}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selecionado && (
        <RevisarFotosDialog
          item={selecionado}
          open={!!selecionado}
          onClose={() => setSelecionado(null)}
        />
      )}
    </div>
  );
}

function RevisarFotosDialog({ item, open, onClose }: { item: any; open: boolean; onClose: () => void }) {
  const [reprovaOpen, setReprovaOpen] = useState(false);
  const [motivo, setMotivo] = useState('');
  const aprovarMut = useAprovarFotosVistoria();
  const reprovarMut = useReprovarFotosVistoria();

  // Buscar fotos enviadas
  const { data: fotos, isLoading: loadingFotos } = useQuery({
    queryKey: ['vistoria-fotos', item.instalacao_id, item.id],
    queryFn: async () => {
      // Tenta buscar via tabela de vistorias_fotos vinculada à vistoria
      const { data: vistoriaInst } = await publicSupabase
        .from('vistorias' as any)
        .select('id')
        .eq('instalacao_id', item.instalacao_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!vistoriaInst) return [];
      const { data } = await publicSupabase
        .from('vistorias_fotos' as any)
        .select('id, tipo, arquivo_url, created_at')
        .eq('vistoria_id', (vistoriaInst as any).id)
        .order('created_at', { ascending: true });
      return (data as any[]) || [];
    },
  });

  const veiculo = item.instalacoes?.veiculos;
  const associado = item.instalacoes?.associados;

  return (
    <>
      <Dialog open={open && !reprovaOpen} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Revisar fotos — {veiculo?.placa || 'sem placa'}
            </DialogTitle>
            <DialogDescription>
              {veiculo?.marca} {veiculo?.modelo} • {associado?.nome || '—'} • Enviado por:{' '}
              <strong>{item.fotos_executor_nome || '—'}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 text-xs">
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(buildVistoriaLinkUrl(item.token), '_blank')}
            >
              <ExternalLink className="h-3 w-3 mr-1" /> Abrir link público
            </Button>
          </div>

          {loadingFotos ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : !fotos || fotos.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma foto encontrada para esta vistoria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {fotos.map((f: any) => (
                <a
                  key={f.id}
                  href={f.arquivo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-md overflow-hidden border hover:border-primary/40"
                >
                  <img
                    src={f.arquivo_url}
                    alt={f.tipo}
                    loading="lazy"
                    className="w-full aspect-square object-cover"
                  />
                  <div className="text-[10px] p-1 truncate text-center bg-muted">{f.tipo}</div>
                </a>
              ))}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="text-destructive"
              disabled={aprovarMut.isPending || reprovarMut.isPending}
              onClick={() => setReprovaOpen(true)}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reprovar
            </Button>
            <Button
              disabled={aprovarMut.isPending || reprovarMut.isPending}
              onClick={async () => {
                await aprovarMut.mutateAsync({ vistoriaLinkId: item.id });
                onClose();
              }}
            >
              {aprovarMut.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Aprovar fotos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reprovaOpen} onOpenChange={setReprovaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Reprovar fotos
            </DialogTitle>
            <DialogDescription>
              Informe o motivo. O link será reaberto para o executor refazer o envio.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: foto do chassi ilegível, faltam fotos das laterais..."
            rows={4}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReprovaOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={motivo.trim().length < 5 || reprovarMut.isPending}
              onClick={async () => {
                await reprovarMut.mutateAsync({ vistoriaLinkId: item.id, motivo: motivo.trim() });
                setReprovaOpen(false);
                onClose();
              }}
            >
              {reprovarMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar reprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
