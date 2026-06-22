import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Sparkles, ShieldCheck, AlertTriangle, PlusCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useFocoAdsAchados, useGerarAnalise, useCriarAcaoProposta, type Achado } from '@/hooks/useFocoAds';

const SEVERIDADE: Record<Achado['severidade'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  critica: { label: 'Crítica', variant: 'destructive' },
  alta: { label: 'Alta', variant: 'destructive' },
  media: { label: 'Média', variant: 'secondary' },
  baixa: { label: 'Baixa', variant: 'outline' },
};

export default function FocoAdsAchados() {
  const navigate = useNavigate();
  const { data: achados, isLoading } = useFocoAdsAchados();
  const analise = useGerarAnalise();
  const criarAcao = useCriarAcaoProposta();

  const onAnalise = () => {
    toast.promise(analise.mutateAsync(7), {
      loading: 'Gerando análise de IA…',
      success: (r: any) => `Análise concluída: ${r?.achados ?? 0} achados.`,
      error: (e) => `Falha na análise: ${e?.message ?? e}`,
    });
  };

  const onCriarAcao = (achado: Achado) => {
    toast.promise(criarAcao.mutateAsync(achado), {
      loading: 'Criando ação proposta…',
      success: 'Ação proposta criada (aguardando aprovação). Nada foi executado na Meta.',
      error: (e) => `Falha: ${e?.message ?? e}`,
    });
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/foco-ads')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Achados da IA</h1>
            <p className="text-muted-foreground">
              Críticas e sugestões. Criar uma ação proposta <strong>não executa nada</strong> — só registra para aprovação.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={onAnalise} disabled={analise.isPending}>
          <Sparkles className="mr-2 h-4 w-4" />
          Gerar nova análise
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : !achados?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum achado ainda. Clique em <strong>Gerar nova análise</strong> para a IA avaliar os dados.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {achados.map((a) => {
            const sev = SEVERIDADE[a.severidade] ?? SEVERIDADE.media;
            const ehGuardrail = ['custo_conversa', 'custo_lead', 'with_issues'].includes(a.tipo);
            return (
              <Card key={a.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={sev.variant}>{sev.label}</Badge>
                    <Badge variant="outline" className="gap-1">
                      {ehGuardrail
                        ? <><ShieldCheck className="h-3 w-3" /> Guardrail</>
                        : <><Sparkles className="h-3 w-3" /> IA</>}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{a.tipo}</span>
                  </div>
                  <CardTitle className="text-base">{a.titulo}</CardTitle>
                  {a.descricao && <CardDescription>{a.descricao}</CardDescription>}
                </CardHeader>
                <CardContent className="space-y-3">
                  {a.evidencia && Object.keys(a.evidencia).length > 0 && (
                    <div className="rounded-md bg-muted/50 p-3 text-sm">
                      <p className="mb-1 font-medium text-muted-foreground">Evidência (métricas reais)</p>
                      <div className="flex flex-wrap gap-x-6 gap-y-1">
                        {Object.entries(a.evidencia).map(([k, v]) => (
                          <span key={k}><span className="text-muted-foreground">{k}:</span> <strong>{String(v)}</strong></span>
                        ))}
                      </div>
                    </div>
                  )}
                  {a.sugestao && (
                    <p className="text-sm"><span className="font-medium">Sugestão: </span>{a.sugestao}</p>
                  )}
                  {a.acao_sugerida && (
                    <div className="flex items-center gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => onCriarAcao(a)} disabled={criarAcao.isPending}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Criar ação proposta
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Não executa — apenas registra para aprovação (Onda 3).
                      </span>
                    </div>
                  )}
                  {a.tipo === 'with_issues' && (
                    <p className="flex items-center gap-1 text-xs text-destructive">
                      <AlertTriangle className="h-3 w-3" /> Verifique a reprovação/limitação diretamente na Meta.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
