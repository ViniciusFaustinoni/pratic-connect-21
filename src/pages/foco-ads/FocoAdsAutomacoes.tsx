import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, ShieldAlert, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAutomacoes, useAtualizarAutomacao, type Automacao } from '@/hooks/useFocoAds';

const GATILHO_LABEL: Record<Automacao['gatilho'], string> = {
  custo_conversa: 'Custo por conversa estourado',
  custo_lead: 'Custo por lead estourado',
  with_issues: 'Anúncio com problema (WITH_ISSUES)',
};

export default function FocoAdsAutomacoes() {
  const navigate = useNavigate();
  const { data: automacoes, isLoading } = useAutomacoes();
  const atualizar = useAtualizarAutomacao();

  const setModo = (a: Automacao, modo: Automacao['modo']) => {
    toast.promise(atualizar.mutateAsync({ id: a.id, patch: { modo } }), {
      loading: 'Salvando…',
      success: modo === 'executar'
        ? 'Modo alterado para EXECUTAR (a automação poderá agir sozinha).'
        : 'Modo alterado para apenas sinalizar.',
      error: (e) => `Falha: ${e?.message ?? e}`,
    });
  };

  const setAtivo = (a: Automacao, ativo: boolean) => {
    toast.promise(atualizar.mutateAsync({ id: a.id, patch: { ativo } }), {
      loading: 'Salvando…',
      success: ativo ? 'Automação ligada.' : 'Automação desligada.',
      error: (e) => `Falha: ${e?.message ?? e}`,
    });
  };

  const setNotificar = (a: Automacao, notificar: boolean) => {
    toast.promise(atualizar.mutateAsync({ id: a.id, patch: { notificar } }), {
      loading: 'Salvando…', success: 'Atualizado.', error: (e) => `Falha: ${e?.message ?? e}`,
    });
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/foco-ads')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Automações de guarda-corpo</h1>
          <p className="text-muted-foreground">
            Regras que podem agir sozinhas. Vêm <strong>desligadas</strong> por padrão e sempre notificam.
          </p>
        </div>
      </div>

      <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="flex items-start gap-3 py-4 text-sm">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p>
            <strong>Modo Executar</strong> faz a automação <strong>agir sozinha</strong> sobre campanhas reais
            (pode pausar anúncios). Use com critério. <strong>Sinalizar</strong> apenas notifica, sem executar.
          </p>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
      ) : !automacoes?.length ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhuma automação configurada.</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {automacoes.map((a) => (
            <Card key={a.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{a.nome}</CardTitle>
                    <CardDescription>
                      Gatilho: {GATILHO_LABEL[a.gatilho]} · plataforma: {a.plataforma} · ação: {a.acao_tipo}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={a.ativo ? 'default' : 'outline'}>{a.ativo ? 'Ligada' : 'Desligada'}</Badge>
                    {a.ativo && a.modo === 'executar' && <Badge variant="destructive">Age sozinha</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-6">
                {/* Liga/desliga — confirmacao extra ao ligar em modo executar */}
                <div className="flex items-center gap-2">
                  {!a.ativo && a.modo === 'executar' ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Switch checked={false} />
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <ShieldAlert className="h-5 w-5 text-destructive" /> Ligar automação que age sozinha?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            "{a.nome}" está em modo <strong>Executar</strong>. Ligada, ela poderá pausar/alterar
                            campanhas reais automaticamente (gasta/altera entrega), sempre notificando. Confirma?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => setAtivo(a, true)}>Ligar mesmo assim</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <Switch checked={a.ativo} onCheckedChange={(v) => setAtivo(a, v)} />
                  )}
                  <span className="text-sm">Ativa</span>
                </div>

                {/* Modo */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Modo:</span>
                  <Select value={a.modo} onValueChange={(v) => setModo(a, v as Automacao['modo'])}>
                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sinalizar">Apenas sinalizar</SelectItem>
                      <SelectItem value="executar">Executar (age sozinha)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Notificar */}
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <Switch checked={a.notificar} onCheckedChange={(v) => setNotificar(a, v)} />
                  <span className="text-sm">Notificar</span>
                </div>

                {a.ultima_execucao_em && (
                  <span className="text-xs text-muted-foreground">
                    Última execução: {new Date(a.ultima_execucao_em).toLocaleString('pt-BR')}
                  </span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
