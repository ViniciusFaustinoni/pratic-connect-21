import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRightLeft, RotateCcw, RectangleEllipsis, Car, Eye, Clock, CheckCircle, XCircle, User, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ============================================
// TROCA DE TITULARIDADE TAB
// ============================================

function TrocaTitularidadeTab() {
  const navigate = useNavigate();

  const { data: solicitacoes, isLoading } = useQuery({
    queryKey: ['processos-troca-titularidade'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_solicitacoes_ia')
        .select(`
          *,
          associado:associados!chat_solicitacoes_ia_associado_id_fkey(id, nome, cpf, telefone)
        `)
        .eq('tipo', 'troca_titularidade')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const statusConfig: Record<string, { label: string; className: string }> = {
    pendente: { label: 'Pendente', className: 'bg-amber-100 text-amber-800 border-amber-200' },
    aprovado: { label: 'Aprovado', className: 'bg-green-100 text-green-800 border-green-200' },
    rejeitado: { label: 'Rejeitado', className: 'bg-red-100 text-red-800 border-red-200' },
    em_andamento: { label: 'Em Andamento', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando solicitações...</div>;
  }

  if (!solicitacoes?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <ArrowRightLeft className="h-12 w-12 mb-3 opacity-40" />
        <p className="text-lg font-medium">Nenhuma solicitação de troca de titularidade</p>
        <p className="text-sm">As solicitações aparecerão aqui quando forem realizadas pelo app ou WhatsApp.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {solicitacoes.map((sol: any) => {
        const dados = sol.dados as any;
        const novoTitular = sol.dados_novo_titular as any;
        const cfg = statusConfig[sol.status] || statusConfig.pendente;
        const associado = sol.associado as any;

        return (
          <Card key={sol.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{associado?.nome || 'Associado não encontrado'}</span>
                    <Badge className={cfg.className}>{cfg.label}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    {associado?.cpf && <p>CPF: {associado.cpf}</p>}
                    {novoTitular?.nome && (
                      <p className="text-foreground">
                        <span className="text-muted-foreground">Novo titular:</span> {novoTitular.nome}
                        {novoTitular.cpf && ` — CPF: ${novoTitular.cpf}`}
                      </p>
                    )}
                    {dados?.motivo && <p>Motivo: {dados.motivo}</p>}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(sol.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/cadastro/associados/${sol.associado_id}`)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Ver Ficha
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ============================================
// REATIVAÇÕES TAB
// ============================================

function ReativacoesTab() {
  const navigate = useNavigate();

  const { data: reativacoes, isLoading } = useQuery({
    queryKey: ['processos-reativacoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_solicitacoes_ia')
        .select(`
          *,
          associado:associados!chat_solicitacoes_ia_associado_id_fkey(id, nome, cpf, telefone, status)
        `)
        .eq('tipo', 'reativacao')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const statusConfig: Record<string, { label: string; className: string }> = {
    pendente: { label: 'Pendente', className: 'bg-amber-100 text-amber-800 border-amber-200' },
    aprovado: { label: 'Aprovado', className: 'bg-green-100 text-green-800 border-green-200' },
    rejeitado: { label: 'Rejeitado', className: 'bg-red-100 text-red-800 border-red-200' },
    em_andamento: { label: 'Em Andamento', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando reativações...</div>;
  }

  if (!reativacoes?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <RotateCcw className="h-12 w-12 mb-3 opacity-40" />
        <p className="text-lg font-medium">Nenhuma solicitação de reativação</p>
        <p className="text-sm">Solicitações de reativação de associados aparecerão aqui.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reativacoes.map((sol: any) => {
        const dados = sol.dados as any;
        const cfg = statusConfig[sol.status] || statusConfig.pendente;
        const associado = sol.associado as any;

        return (
          <Card key={sol.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{associado?.nome || 'Associado não encontrado'}</span>
                    <Badge className={cfg.className}>{cfg.label}</Badge>
                    {associado?.status && (
                      <Badge variant="outline" className="text-xs">{associado.status}</Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {associado?.cpf && <p>CPF: {associado.cpf}</p>}
                    {dados?.motivo && <p>Motivo: {dados.motivo}</p>}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(sol.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/cadastro/associados/${sol.associado_id}`)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Ver Ficha
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ============================================
// SUBSTITUIÇÃO DE PLACA TAB
// ============================================

function SubstituicaoPlacaTab() {
  const navigate = useNavigate();

  const { data: solicitacoes, isLoading } = useQuery({
    queryKey: ['processos-substituicao-placa'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_solicitacoes_ia')
        .select(`
          *,
          associado:associados!chat_solicitacoes_ia_associado_id_fkey(id, nome, cpf, telefone)
        `)
        .eq('tipo', 'substituicao_placa')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const statusConfig: Record<string, { label: string; className: string }> = {
    pendente: { label: 'Pendente', className: 'bg-amber-100 text-amber-800 border-amber-200' },
    aprovado: { label: 'Aprovado', className: 'bg-green-100 text-green-800 border-green-200' },
    rejeitado: { label: 'Rejeitado', className: 'bg-red-100 text-red-800 border-red-200' },
    em_andamento: { label: 'Em Andamento', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando solicitações...</div>;
  }

  if (!solicitacoes?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <RectangleEllipsis className="h-12 w-12 mb-3 opacity-40" />
        <p className="text-lg font-medium">Nenhuma solicitação de substituição de placa</p>
        <p className="text-sm">Solicitações de troca de placa aparecerão aqui.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {solicitacoes.map((sol: any) => {
        const dados = sol.dados as any;
        const cfg = statusConfig[sol.status] || statusConfig.pendente;
        const associado = sol.associado as any;

        return (
          <Card key={sol.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{associado?.nome || 'Associado não encontrado'}</span>
                    <Badge className={cfg.className}>{cfg.label}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    {associado?.cpf && <p>CPF: {associado.cpf}</p>}
                    {dados?.placa_atual && (
                      <p>
                        <span className="text-muted-foreground">Placa atual:</span>{' '}
                        <span className="font-mono font-semibold text-foreground">{dados.placa_atual}</span>
                        {dados?.placa_nova && (
                          <>
                            {' → '}
                            <span className="font-mono font-semibold text-foreground">{dados.placa_nova}</span>
                          </>
                        )}
                      </p>
                    )}
                    {dados?.motivo && <p>Motivo: {dados.motivo}</p>}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(sol.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/cadastro/associados/${sol.associado_id}`)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Ver Ficha
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ============================================
// SUBSTITUIÇÃO DE VEÍCULO TAB (redirect)
// ============================================

function SubstituicaoVeiculoTab() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Car className="h-12 w-12 mb-3 opacity-40" />
      <p className="text-lg font-medium">Substituições de Veículo</p>
      <p className="text-sm mb-4">As substituições de veículo possuem uma página dedicada com fluxo completo.</p>
      <Button onClick={() => navigate('/cadastro/substituicoes')}>
        <Eye className="h-4 w-4 mr-1" />
        Ir para Substituições
      </Button>
    </div>
  );
}

// ============================================
// CONTADORES
// ============================================

function useProcessosCounts() {
  return useQuery({
    queryKey: ['processos-counts'],
    queryFn: async () => {
      const [titularidade, reativacao, placa] = await Promise.all([
        supabase
          .from('chat_solicitacoes_ia')
          .select('id', { count: 'exact', head: true })
          .eq('tipo', 'troca_titularidade')
          .eq('status', 'pendente'),
        supabase
          .from('chat_solicitacoes_ia')
          .select('id', { count: 'exact', head: true })
          .eq('tipo', 'reativacao')
          .eq('status', 'pendente'),
        supabase
          .from('chat_solicitacoes_ia')
          .select('id', { count: 'exact', head: true })
          .eq('tipo', 'substituicao_placa')
          .eq('status', 'pendente'),
      ]);

      return {
        titularidade: titularidade.count || 0,
        reativacao: reativacao.count || 0,
        placa: placa.count || 0,
      };
    },
  });
}

// ============================================
// MAIN PAGE
// ============================================

export default function ProcessosOperacionais() {
  const { data: counts } = useProcessosCounts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Processos Operacionais</h1>
        <p className="text-muted-foreground">
          Central de gestão de trocas de titularidade, reativações, substituições de placa e veículo.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{counts?.titularidade ?? '—'}</p>
              <p className="text-xs text-muted-foreground">Trocas pendentes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 text-green-700">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{counts?.reativacao ?? '—'}</p>
              <p className="text-xs text-muted-foreground">Reativações pendentes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
              <RectangleEllipsis className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{counts?.placa ?? '—'}</p>
              <p className="text-xs text-muted-foreground">Placas pendentes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
              <Car className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">—</p>
              <p className="text-xs text-muted-foreground">Subst. Veículo</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="titularidade" className="w-full">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="titularidade" className="text-xs sm:text-sm">
            <ArrowRightLeft className="h-4 w-4 mr-1 hidden sm:inline" />
            Titularidade
            {(counts?.titularidade ?? 0) > 0 && (
              <Badge className="ml-1.5 bg-blue-600 text-white text-[10px] px-1.5 py-0">{counts?.titularidade}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="reativacao" className="text-xs sm:text-sm">
            <RotateCcw className="h-4 w-4 mr-1 hidden sm:inline" />
            Reativação
            {(counts?.reativacao ?? 0) > 0 && (
              <Badge className="ml-1.5 bg-green-600 text-white text-[10px] px-1.5 py-0">{counts?.reativacao}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="placa" className="text-xs sm:text-sm">
            <RectangleEllipsis className="h-4 w-4 mr-1 hidden sm:inline" />
            Placa
            {(counts?.placa ?? 0) > 0 && (
              <Badge className="ml-1.5 bg-purple-600 text-white text-[10px] px-1.5 py-0">{counts?.placa}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="veiculo" className="text-xs sm:text-sm">
            <Car className="h-4 w-4 mr-1 hidden sm:inline" />
            Veículo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="titularidade">
          <TrocaTitularidadeTab />
        </TabsContent>
        <TabsContent value="reativacao">
          <ReativacoesTab />
        </TabsContent>
        <TabsContent value="placa">
          <SubstituicaoPlacaTab />
        </TabsContent>
        <TabsContent value="veiculo">
          <SubstituicaoVeiculoTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
