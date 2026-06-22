import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MessageSquare, FileText, DollarSign, RefreshCw, Sparkles, AlertTriangle, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  useFocoAdsResumo, useFocoAdsAnuncios, useSincronizarMeta, useSincronizarGoogle, useGerarAnalise,
} from '@/hooks/useFocoAds';

const brl = (v: number | null | undefined) =>
  v == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const PERIODOS = [7, 14, 30];

export default function FocoAdsDashboard() {
  const navigate = useNavigate();
  const [dias, setDias] = useState(7);
  const { data: resumo, isLoading: loadingResumo } = useFocoAdsResumo(dias);
  const { data: anuncios, isLoading: loadingAnuncios } = useFocoAdsAnuncios(dias);
  const sync = useSincronizarMeta();
  const syncGoogle = useSincronizarGoogle();
  const analise = useGerarAnalise();

  const onSync = () => {
    toast.promise(sync.mutateAsync(dias), {
      loading: 'Sincronizando dados da Meta…',
      success: (r: any) => `Meta sincronizada: ${r?.insights ?? 0} linhas de insight.`,
      error: (e) => `Falha na sincronização: ${e?.message ?? e}`,
    });
  };

  const onSyncGoogle = () => {
    toast.promise(syncGoogle.mutateAsync(dias), {
      loading: 'Sincronizando dados do Google…',
      success: (r: any) => `Google sincronizado: ${r?.insights ?? 0} linhas de insight.`,
      error: (e) => `Falha na sincronização: ${e?.message ?? e}`,
    });
  };

  const onAnalise = () => {
    toast.promise(analise.mutateAsync(dias), {
      loading: 'Gerando análise de IA…',
      success: (r: any) => `Análise concluída: ${r?.achados ?? 0} achados.`,
      error: (e) => `Falha na análise: ${e?.message ?? e}`,
    });
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Cabecalho */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Foco Ads</h1>
          <p className="text-muted-foreground">
            Gestão de tráfego pago com IA — leitura e análise (execução requer aprovação).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border">
            {PERIODOS.map((p) => (
              <Button
                key={p}
                size="sm"
                variant={dias === p ? 'default' : 'ghost'}
                className="rounded-none first:rounded-l-md last:rounded-r-md"
                onClick={() => setDias(p)}
              >
                {p}d
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={onSync} disabled={sync.isPending}>
            <RefreshCw className={`mr-2 h-4 w-4 ${sync.isPending ? 'animate-spin' : ''}`} />
            Sincronizar Meta
          </Button>
          <Button variant="outline" size="sm" onClick={onSyncGoogle} disabled={syncGoogle.isPending}>
            <RefreshCw className={`mr-2 h-4 w-4 ${syncGoogle.isPending ? 'animate-spin' : ''}`} />
            Sincronizar Google
          </Button>
          <Button size="sm" onClick={onAnalise} disabled={analise.isPending}>
            <Sparkles className="mr-2 h-4 w-4" />
            Analisar com IA
          </Button>
          <Button variant="secondary" size="sm" onClick={() => navigate('/foco-ads/achados')}>
            Ver achados <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => navigate('/foco-ads/acoes')}>
            Ações propostas <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => navigate('/foco-ads/automacoes')}>
            Automações <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPIs — messaging vs lead SEMPRE separados */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gasto total ({dias}d)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingResumo ? <Skeleton className="h-8 w-32" /> : (
              <div className="text-2xl font-bold">{brl(resumo?.gastoTotal)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">WhatsApp (conversas)</CardTitle>
            <MessageSquare className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            {loadingResumo ? <Skeleton className="h-8 w-32" /> : (
              <>
                <div className="text-2xl font-bold">{resumo?.messaging.conversas ?? 0}</div>
                <CardDescription>
                  Custo/conversa: <strong>{brl(resumo?.messaging.custoPorConversa)}</strong> · gasto {brl(resumo?.messaging.gasto)}
                </CardDescription>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Formulário (leads)</CardTitle>
            <FileText className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {loadingResumo ? <Skeleton className="h-8 w-32" /> : (
              <>
                <div className="text-2xl font-bold">{resumo?.lead.leads ?? 0}</div>
                <CardDescription>
                  Custo/lead: <strong>{brl(resumo?.lead.custoPorLead)}</strong> · gasto {brl(resumo?.lead.gasto)}
                </CardDescription>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela por anuncio */}
      <Card>
        <CardHeader>
          <CardTitle>Anúncios no período</CardTitle>
          <CardDescription>Ordenado por gasto. Objetivos messaging e lead não são somados entre si.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingAnuncios ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !anuncios?.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sem dados ainda. Cadastre a credencial Meta e clique em <strong>Sincronizar</strong>.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Anúncio</TableHead>
                  <TableHead>Objetivo</TableHead>
                  <TableHead className="text-right">Gasto</TableHead>
                  <TableHead className="text-right">Resultado</TableHead>
                  <TableHead className="text-right">Custo unit.</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {anuncios.map((a) => (
                  <TableRow key={a.entidade_id}>
                    <TableCell className="font-medium">{a.nome}</TableCell>
                    <TableCell>
                      <Badge variant={a.objetivo === 'messaging' ? 'default' : a.objetivo === 'lead' ? 'secondary' : 'outline'}>
                        {a.objetivo === 'messaging' ? 'WhatsApp' : a.objetivo === 'lead' ? 'Lead' : 'Outro'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{brl(a.gasto)}</TableCell>
                    <TableCell className="text-right">
                      {a.objetivo === 'messaging' ? `${a.conversas} conv.` : a.objetivo === 'lead' ? `${a.leads} leads` : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {a.objetivo === 'messaging' ? brl(a.custoPorConversa) : a.objetivo === 'lead' ? brl(a.custoPorLead) : '—'}
                    </TableCell>
                    <TableCell>
                      {String(a.effective_status).toUpperCase() === 'WITH_ISSUES' ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" /> Problema
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">{a.effective_status ?? '—'}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
