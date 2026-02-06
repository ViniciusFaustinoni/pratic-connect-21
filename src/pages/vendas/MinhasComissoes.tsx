import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wallet, DollarSign, Percent, Target, Trophy, TrendingUp, History, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMinhasComissoesExtended } from '@/hooks/useMinhasComissoesExtended';
import { MinhasComissoesKPIs } from '@/components/comissoes/vendedor/MinhasComissoesKPIs';
import { TabAdesao } from '@/components/comissoes/vendedor/TabAdesao';
import { TabRecorrente } from '@/components/comissoes/vendedor/TabRecorrente';
import { TabProducao } from '@/components/comissoes/vendedor/TabProducao';
import { TabRanking } from '@/components/comissoes/vendedor/TabRanking';
import { TabCrescimento } from '@/components/comissoes/vendedor/TabCrescimento';
import { TabHistorico } from '@/components/comissoes/vendedor/TabHistorico';
import { TabDeducoes } from '@/components/comissoes/vendedor/TabDeducoes';

export default function MinhasComissoes() {
  const currentDate = new Date();
  const [mes, setMes] = useState(currentDate.getMonth() + 1);
  const [ano, setAno] = useState(currentDate.getFullYear());

  const {
    meuResumoMensal,
    meuRanking,
    rankingPublico,
    meuRecorrente,
    minhasDeducoes,
    meuCrescimento,
    meuHistorico,
    minhasAdesoes,
    tipoConsultor,
    placasAtivas,
    isLoading,
    isLoadingAdesoes,
    isLoadingRecorrente,
    isLoadingRanking,
    isLoadingRankingPublico,
    isLoadingCrescimento,
    isLoadingHistorico,
    isLoadingDeducoes,
    contestarComissao,
    totalMes,
    vendasConfirmadas,
    totalDeducoes,
  } = useMinhasComissoesExtended(mes, ano);

  const isInterno = tipoConsultor === 'interno';
  const isExterno = tipoConsultor === 'externo';

  const meses = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: format(new Date(2024, i), 'MMMM', { locale: ptBR }),
  }));

  const anos = Array.from({ length: 3 }, (_, i) => currentDate.getFullYear() - i);

  const resumoAdesao = meuResumoMensal?.find(r => r.tipo === 'adesao');
  const resumoProducao = meuResumoMensal?.find(r => r.tipo === 'producao');

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <nav className="text-sm text-muted-foreground mb-1">
            Vendas / Minhas Comissões
          </nav>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6" />
            Minhas Comissões
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant={isInterno ? 'default' : 'secondary'}>
            {isInterno ? 'Consultor Interno' : 'Consultor Externo'}
          </Badge>

          <div className="flex gap-2">
            <Select value={mes.toString()} onValueChange={(v) => setMes(parseInt(v))}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {meses.map((m) => (
                  <SelectItem key={m.value} value={m.value.toString()}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={ano.toString()} onValueChange={(v) => setAno(parseInt(v))}>
              <SelectTrigger className="w-[90px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {anos.map((a) => (
                  <SelectItem key={a} value={a.toString()}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <MinhasComissoesKPIs
        totalMes={totalMes}
        vendasConfirmadas={vendasConfirmadas}
        placasAtivas={placasAtivas || 0}
        posicaoRanking={meuRanking?.posicao_ranking || null}
        isLoading={isLoading}
      />

      {/* Tabs de detalhamento */}
      <Tabs defaultValue="adesao" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1">
          {isInterno && (
            <TabsTrigger value="adesao" className="gap-1">
              <DollarSign className="h-4 w-4 hidden sm:block" />
              Adesão
            </TabsTrigger>
          )}
          <TabsTrigger value="recorrente" className="gap-1">
            <Percent className="h-4 w-4 hidden sm:block" />
            Recorrente
          </TabsTrigger>
          {isExterno && (
            <TabsTrigger value="producao" className="gap-1">
              <Target className="h-4 w-4 hidden sm:block" />
              Produção
            </TabsTrigger>
          )}
          <TabsTrigger value="ranking" className="gap-1">
            <Trophy className="h-4 w-4 hidden sm:block" />
            Ranking
          </TabsTrigger>
          <TabsTrigger value="crescimento" className="gap-1">
            <TrendingUp className="h-4 w-4 hidden sm:block" />
            Crescimento
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-1">
            <History className="h-4 w-4 hidden sm:block" />
            Histórico
          </TabsTrigger>
          <TabsTrigger value="deducoes" className="gap-1">
            <AlertTriangle className="h-4 w-4 hidden sm:block" />
            Deduções
          </TabsTrigger>
        </TabsList>

        {isInterno && (
          <TabsContent value="adesao" className="mt-6">
            <TabAdesao
              resumoAdesao={resumoAdesao}
              adesoes={minhasAdesoes || []}
              deducoes={minhasDeducoes || []}
              totalDeducoes={totalDeducoes}
              isLoading={isLoadingAdesoes}
              onContestar={(id, motivo) => contestarComissao.mutate({ id, motivo })}
              isContestando={contestarComissao.isPending}
            />
          </TabsContent>
        )}

        <TabsContent value="recorrente" className="mt-6">
          <TabRecorrente
            recorrente={meuRecorrente}
            crescimento={meuCrescimento || []}
            placasAtivas={placasAtivas || 0}
            tipoConsultor={tipoConsultor || 'interno'}
            isLoading={isLoadingRecorrente}
          />
        </TabsContent>

        {isExterno && (
          <TabsContent value="producao" className="mt-6">
            <TabProducao
              resumoProducao={resumoProducao}
              vendasConfirmadas={vendasConfirmadas}
              isLoading={isLoading}
            />
          </TabsContent>
        )}

        <TabsContent value="ranking" className="mt-6">
          <TabRanking
            meuRanking={meuRanking}
            rankingPublico={rankingPublico || []}
            isLoading={isLoadingRanking || isLoadingRankingPublico}
          />
        </TabsContent>

        <TabsContent value="crescimento" className="mt-6">
          <TabCrescimento
            crescimento={meuCrescimento || []}
            placasAtivas={placasAtivas || 0}
            isLoading={isLoadingCrescimento}
          />
        </TabsContent>

        <TabsContent value="historico" className="mt-6">
          <TabHistorico
            historico={meuHistorico || []}
            isLoading={isLoadingHistorico}
          />
        </TabsContent>

        <TabsContent value="deducoes" className="mt-6">
          <TabDeducoes
            deducoes={minhasDeducoes || []}
            totalDeducoes={totalDeducoes}
            isLoading={isLoadingDeducoes}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
