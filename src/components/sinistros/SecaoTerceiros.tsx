import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Car, Trash2, ExternalLink, Users, Loader2 } from 'lucide-react';
import { useTerceiros, useLimiteCobertura, useExcluirTerceiro } from '@/hooks/useTerceiros';
import { CadastrarTerceiroModal } from './CadastrarTerceiroModal';
import { CoberturaTerceirosInfo } from './CoberturaTerceirosInfo';
import {
  CULPA_LABELS, CULPA_COLORS, STATUS_TERCEIRO_LABELS, STATUS_TERCEIRO_COLORS,
} from '@/types/terceiros';
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

interface Props {
  sinistroId: string;
  associadoId: string;
  placaAssociado?: string;
}

export function SecaoTerceiros({ sinistroId, associadoId, placaAssociado }: Props) {
  const [modalCadastroOpen, setModalCadastroOpen] = useState(false);
  const [terceiroExcluir, setTerceiroExcluir] = useState<string | null>(null);

  const { data: terceiros = [], isLoading } = useTerceiros(sinistroId);
  const { data: limite, isLoading: limiteLoading } = useLimiteCobertura(associadoId, sinistroId);
  const excluirTerceiro = useExcluirTerceiro();

  const handleExcluir = async () => {
    if (!terceiroExcluir) return;
    await excluirTerceiro.mutateAsync({ terceiroId: terceiroExcluir, sinistroId });
    setTerceiroExcluir(null);
  };

  const portalUrl = (token: string) => {
    const base = window.location.origin;
    return `${base}/terceiro/${token}`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Terceiros Envolvidos ({terceiros.length})
        </CardTitle>
        <Button size="sm" onClick={() => setModalCadastroOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Adicionar Terceiro
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Card de limites */}
        {terceiros.length > 0 && (
          <CoberturaTerceirosInfo limite={limite} isLoading={limiteLoading} />
        )}

        {/* Lista de terceiros */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : terceiros.length === 0 ? (
          <div className="text-center py-6">
            <Car className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum terceiro cadastrado</p>
            <Button variant="link" size="sm" className="mt-2" onClick={() => setModalCadastroOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Cadastrar terceiro
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {terceiros.map((t) => (
              <div key={t.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">
                      Terceiro {t.numero_sequencial}
                    </Badge>
                    <span className="font-semibold">{t.nome}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={CULPA_COLORS[t.culpa]}>
                      {CULPA_LABELS[t.culpa]}
                    </Badge>
                    <Badge className={STATUS_TERCEIRO_COLORS[t.status]}>
                      {STATUS_TERCEIRO_LABELS[t.status]}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>🚗 {t.veiculo_marca} {t.veiculo_modelo} — {t.veiculo_placa}</span>
                  <span>📞 {t.telefone}</span>
                </div>

                {t.parentesco && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                    🔍 Familiar: {t.parentesco_descricao || 'Sim'}
                  </Badge>
                )}

                {t.tipo_dano === 'nao_veicular' && (
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                    ⚠️ Dano não veicular — NÃO coberto
                  </Badge>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(portalUrl(t.token));
                      import('sonner').then(({ toast }) => toast.success('Link copiado!'));
                    }}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Copiar Link Portal
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => setTerceiroExcluir(t.id)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Remover
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Modal Cadastro */}
      <CadastrarTerceiroModal
        open={modalCadastroOpen}
        onOpenChange={setModalCadastroOpen}
        sinistroId={sinistroId}
        placaAssociado={placaAssociado}
      />

      {/* Alert Dialog Excluir */}
      <AlertDialog open={!!terceiroExcluir} onOpenChange={(open) => !open && setTerceiroExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Terceiro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este terceiro? Todos os documentos e dados serão perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluir} className="bg-red-600 hover:bg-red-700">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
