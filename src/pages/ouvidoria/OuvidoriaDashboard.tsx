import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEstatisticasOuvidoria, useManifestacoes } from "@/hooks/useOuvidoria";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  ThumbsUp,
  AlertCircle,
  Lightbulb,
  Shield,
  Trophy,
  Star,
  Plus
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { TIPO_MANIFESTACAO_LABELS, PRIORIDADE_LABELS, SETOR_ELOGIO_LABELS, type SetorElogio } from "@/types/ouvidoria";
import { ManifestacaoCard } from "@/components/ouvidoria/ManifestacaoCard";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { mockEstatisticas } from "@/mocks/ouvidoria";
import { NovaManifestacaoModal } from "@/components/ouvidoria/NovaManifestacaoModal";

const COLORS_TIPO = {
  reclamacao: "#f97316",
  reclamacao_urgente: "#ef4444",
  sugestao: "#eab308",
  elogio: "#22c55e",
  denuncia: "#a855f7",
};

const COLORS_PRIORIDADE = {
  baixa: "#94a3b8",
  normal: "#3b82f6",
  alta: "#f97316",
  urgente: "#ef4444",
};

export default function OuvidoriaDashboard() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const { data: estatisticas, isLoading: isLoadingStats } = useEstatisticasOuvidoria();
  const { data: manifestacoesRecentes, isLoading: isLoadingRecentes } = useManifestacoes();

  // Dados para gráfico de tipo (pizza)
  const dadosTipo = estatisticas
    ? Object.entries(estatisticas.por_tipo).map(([tipo, count]) => ({
        name: TIPO_MANIFESTACAO_LABELS[tipo as keyof typeof TIPO_MANIFESTACAO_LABELS],
        value: count,
        color: COLORS_TIPO[tipo as keyof typeof COLORS_TIPO],
      }))
    : [];

  // Dados para gráfico de prioridade (barras)
  const dadosPrioridade = estatisticas
    ? Object.entries(estatisticas.por_prioridade).map(([prioridade, count]) => ({
        name: PRIORIDADE_LABELS[prioridade as keyof typeof PRIORIDADE_LABELS],
        value: count,
        fill: COLORS_PRIORIDADE[prioridade as keyof typeof COLORS_PRIORIDADE],
      }))
    : [];

  // Últimas 5 manifestações
  const ultimasManifestacoes = (manifestacoesRecentes || []).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ouvidoria</h1>
          <p className="text-muted-foreground">
            Acompanhe manifestações de associados
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Manifestação
          </Button>
          <Button variant="outline" onClick={() => navigate("/ouvidoria/manifestacoes")}>
            Ver todas as manifestações
          </Button>
        </div>
      </div>

      {/* Modal de Cadastro Manual */}
      <NovaManifestacaoModal
        open={showModal}
        onOpenChange={setShowModal}
      />

      {/* Seção Registrar Manifestação */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Registrar Manifestação</h2>
          <p className="text-muted-foreground text-sm">Selecione o tipo para abrir uma nova manifestação</p>
        </div>
        
        <div className="grid grid-cols-5 gap-4">
          {/* Card Reclamação */}
          <Card 
            className="bg-orange-50 border-2 border-orange-300 hover:border-orange-500 cursor-pointer hover:shadow-lg transition-all"
            onClick={() => navigate('/ouvidoria/nova?tipo=reclamacao')}
          >
            <CardContent className="p-6 text-center space-y-3">
              <AlertCircle className="h-12 w-12 text-orange-600 mx-auto" />
              <p className="font-bold text-lg text-orange-800">Reclamação</p>
              <p className="text-sm text-orange-700">Insatisfação com serviço</p>
              <p className="text-xs text-orange-600">Resposta em 24h</p>
            </CardContent>
          </Card>

          {/* Card Reclamação Urgente */}
          <Card 
            className="bg-red-50 border-2 border-red-300 hover:border-red-500 cursor-pointer hover:shadow-lg transition-all relative"
            onClick={() => navigate('/ouvidoria/nova?tipo=reclamacao_urgente')}
          >
            <Badge className="absolute top-2 right-2 bg-red-600 text-white">URGENTE</Badge>
            <CardContent className="p-6 text-center space-y-3">
              <AlertTriangle className="h-12 w-12 text-red-600 mx-auto" />
              <p className="font-bold text-lg text-red-800">Reclamação Urgente</p>
              <p className="text-sm text-red-700">Problema crítico</p>
              <p className="text-sm font-semibold text-red-600">Resposta em 4h</p>
            </CardContent>
          </Card>

          {/* Card Denúncia */}
          <Card 
            className="bg-purple-50 border-2 border-purple-300 hover:border-purple-500 cursor-pointer hover:shadow-lg transition-all"
            onClick={() => navigate('/ouvidoria/nova?tipo=denuncia')}
          >
            <CardContent className="p-6 text-center space-y-3">
              <Shield className="h-12 w-12 text-purple-600 mx-auto" />
              <p className="font-bold text-lg text-purple-800">Denúncia</p>
              <p className="text-sm text-purple-700">Relatar irregularidade</p>
              <div className="flex justify-center">
                <Badge variant="outline" className="text-xs bg-purple-100 border-purple-300 text-purple-700">Sigiloso</Badge>
              </div>
              <p className="text-xs text-purple-600">Resposta em 24h</p>
            </CardContent>
          </Card>

          {/* Card Sugestão */}
          <Card 
            className="bg-yellow-50 border-2 border-yellow-300 hover:border-yellow-500 cursor-pointer hover:shadow-lg transition-all"
            onClick={() => navigate('/ouvidoria/nova?tipo=sugestao')}
          >
            <CardContent className="p-6 text-center space-y-3">
              <Lightbulb className="h-12 w-12 text-yellow-600 mx-auto" />
              <p className="font-bold text-lg text-yellow-800">Sugestão</p>
              <p className="text-sm text-yellow-700">Ideias de melhoria</p>
              <p className="text-xs text-yellow-600">Resposta em 24h</p>
            </CardContent>
          </Card>

          {/* Card Elogio */}
          <Card 
            className="bg-green-50 border-2 border-green-300 hover:border-green-500 cursor-pointer hover:shadow-lg transition-all"
            onClick={() => navigate('/ouvidoria/nova?tipo=elogio')}
          >
            <CardContent className="p-6 text-center space-y-3">
              <ThumbsUp className="h-12 w-12 text-green-600 mx-auto" />
              <p className="font-bold text-lg text-green-800">Elogio</p>
              <p className="text-sm text-green-700">Reconhecer bom atendimento</p>
              <p className="text-xs text-green-600">Resposta em 24h</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Cards de KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Abertas</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{estatisticas?.abertas || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              de {estatisticas?.total || 0} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SLA em Risco</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-orange-600">
                {estatisticas?.sla_em_risco || 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground">próximas 4h</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio Resposta</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">
                {estatisticas?.tempo_medio_resposta_horas.toFixed(1) || 0}h
              </div>
            )}
            <p className="text-xs text-muted-foreground">meta: &lt; 12h</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">NPS Ouvidoria</CardTitle>
            <ThumbsUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div
                className={`text-2xl font-bold ${
                  (estatisticas?.nps || 0) >= 70
                    ? "text-green-600"
                    : (estatisticas?.nps || 0) >= 50
                    ? "text-yellow-600"
                    : "text-red-600"
                }`}
              >
                {estatisticas?.nps || 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground">meta: &gt; 70</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Por Tipo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Por Tipo</CardTitle>
            <CardDescription>Distribuição das manifestações</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <div className="flex items-center justify-center h-[200px]">
                <Skeleton className="h-40 w-40 rounded-full" />
              </div>
            ) : (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dadosTipo}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {dadosTipo.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {dadosTipo.map((item) => (
                <div key={item.name} className="flex items-center gap-1 text-xs">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span>
                    {item.name}: {item.value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Por Prioridade */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Por Prioridade</CardTitle>
            <CardDescription>Nível de urgência</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dadosPrioridade} layout="vertical">
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={80} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Card Elogios do Mês */}
      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-green-600" />
              <CardTitle className="text-lg text-green-800">Elogios do Mês</CardTitle>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="border-green-300 text-green-700 hover:bg-green-100"
              onClick={() => navigate('/ouvidoria/manifestacoes?tipo=elogio')}
            >
              Ver todos
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {/* Total de elogios */}
            <div className="text-center">
              <div className="text-3xl font-bold text-green-700">
                {mockEstatisticas.elogios?.total_mes || 15}
              </div>
              <p className="text-sm text-green-600">Elogios recebidos</p>
            </div>
            
            {/* Setor mais elogiado */}
            <div className="text-center border-x border-green-200 px-4">
              <div className="flex items-center justify-center gap-1 text-lg font-semibold text-green-700">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                {SETOR_ELOGIO_LABELS[(mockEstatisticas.elogios?.setor_mais_elogiado as SetorElogio) || 'atendimento']}
              </div>
              <p className="text-sm text-green-600">
                Setor destaque ({mockEstatisticas.elogios?.setor_mais_elogiado_count || 8})
              </p>
            </div>
            
            {/* Colaborador destaque */}
            <div className="text-center">
              <div className="text-lg font-semibold text-green-700">
                {mockEstatisticas.elogios?.colaborador_destaque || 'Ana Paula'}
              </div>
              <p className="text-sm text-green-600">
                Mais mencionado ({mockEstatisticas.elogios?.colaborador_destaque_count || 4})
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <MessageSquare className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-blue-600 font-medium">Abertas</p>
                <p className="text-2xl font-bold text-blue-800">
                  {estatisticas?.abertas || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-yellow-600 font-medium">Em Análise</p>
                <p className="text-2xl font-bold text-yellow-800">
                  {estatisticas?.em_analise || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-green-600 font-medium">Respondidas</p>
                <p className="text-2xl font-bold text-green-800">
                  {estatisticas?.respondidas || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-50 border-gray-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Encerradas</p>
                <p className="text-2xl font-bold text-gray-800">
                  {estatisticas?.encerradas || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Últimas Manifestações */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Últimas Manifestações</CardTitle>
            <CardDescription>Mais recentes primeiro</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/ouvidoria/manifestacoes")}
          >
            Ver todas
          </Button>
        </CardHeader>
        <CardContent>
          {isLoadingRecentes ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : ultimasManifestacoes.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhuma manifestação registrada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {ultimasManifestacoes.map((manifestacao) => (
                <ManifestacaoCard key={manifestacao.id} manifestacao={manifestacao} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
