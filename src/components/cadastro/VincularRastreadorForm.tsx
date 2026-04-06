import { useState, useEffect } from 'react';
import { Search, Wifi, Loader2, Link2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useRastreadoresEmEstoqueBusca, useUpdateRastreadorStatus } from '@/hooks/useRastreadores';
import { useQueryClient } from '@tanstack/react-query';

interface VincularRastreadorFormProps {
  veiculoId: string;
  veiculoPlaca?: string;
}

export function VincularRastreadorForm({ veiculoId, veiculoPlaca }: VincularRastreadorFormProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selected, setSelected] = useState<{ id: string; codigo: string; imei: string | null; plataforma: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const queryClient = useQueryClient();
  const { data: resultados, isLoading } = useRastreadoresEmEstoqueBusca(debouncedSearch);
  const updateStatus = useUpdateRastreadorStatus();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const handleVincular = () => {
    if (!selected) return;
    updateStatus.mutate(
      { id: selected.id, status: 'instalado', veiculo_id: veiculoId },
      {
        onSuccess: () => {
          setSelected(null);
          setSearch('');
          setConfirmOpen(false);
          queryClient.invalidateQueries({ queryKey: ['veiculo-completo', veiculoId] });
        },
        onSettled: () => setConfirmOpen(false),
      }
    );
  };

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2 mb-6">
        <Wifi className="h-10 w-10 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">Nenhum rastreador instalado neste veículo</p>
        <p className="text-xs text-muted-foreground">Busque um rastreador em estoque para vincular</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por código, IMEI ou nº série..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading && debouncedSearch.length >= 2 && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {resultados && resultados.length > 0 && (
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {resultados.map((r) => (
            <button
              key={r.id}
              onClick={() => { setSelected(r); setConfirmOpen(true); }}
              className="w-full flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-left"
            >
              <div>
                <p className="font-medium text-sm font-mono">{r.codigo}</p>
                <p className="text-xs text-muted-foreground">
                  IMEI: {r.imei || '—'} • Série: {r.numero_serie || '—'}
                </p>
              </div>
              <Badge variant="outline" className="text-xs">{r.plataforma}</Badge>
            </button>
          ))}
        </div>
      )}

      {resultados && resultados.length === 0 && debouncedSearch.length >= 2 && !isLoading && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum rastreador em estoque encontrado
        </p>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar vinculação</AlertDialogTitle>
            <AlertDialogDescription>
              Vincular o rastreador <strong className="font-mono">{selected?.codigo}</strong> (IMEI: {selected?.imei || '—'})
              ao veículo <strong className="font-mono">{veiculoPlaca || veiculoId.slice(0, 8)}</strong>?
              <br /><br />
              O status do rastreador será alterado para <strong>Instalado</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateStatus.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleVincular} disabled={updateStatus.isPending}>
              {updateStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
              Vincular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
