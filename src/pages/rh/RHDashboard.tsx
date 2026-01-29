import { 
  Users, 
  Palmtree, 
  UserMinus, 
  UserPlus, 
  Cake, 
  Calendar, 
  Clock, 
  Building, 
  ChevronRight, 
  Plus,
  FileWarning,
  ClipboardList,
  GraduationCap,
  UserCheck,
  Wallet,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  History
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { format, differenceInDays, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function RHDashboard() {
  const navigate = useNavigate();

  // Estatísticas gerais
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['rh-stats'],
    queryFn: async () => {
      const primeiroDiaMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      
      const [funcionarios, emFerias, afastados, admissoesMes] = await Promise.all([
        supabase.from('funcionarios').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
        supabase.from('funcionarios').select('*', { count: 'exact', head: true }).eq('status', 'ferias'),
        supabase.from('funcionarios').select('*', { count: 'exact', head: true }).eq('status', 'afastado'),
        supabase.from('funcionarios').select('*', { count: 'exact', head: true })
          .eq('status', 'ativo')
          .gte('data_admissao', primeiroDiaMes)
      ]);
      
      return {
        totalAtivos: funcionarios.count || 0,
        emFerias: emFerias.count || 0,
        afastados: afastados.count || 0,
        admissoesMes: admissoesMes.count || 0
      };
    }
  });

  // Folha do mês atual
  const { data: folhaMes, isLoading: loadingFolha } = useQuery({
    queryKey: ['folha-mes-atual'],
    queryFn: async () => {
      const mesAtual = new Date().getMonth() + 1;
      const anoAtual = new Date().getFullYear();
      
      const { data } = await supabase
        .from('folha_pagamento')
        .select('total_proventos, total_descontos, salario_liquido, status')
        .eq('mes', mesAtual)
        .eq('ano', anoAtual);
      
      const totais = (data || []).reduce((acc, item) => ({
        proventos: acc.proventos + (item.total_proventos || 0),
        descontos: acc.descontos + (item.total_descontos || 0),
        liquido: acc.liquido + (item.salario_liquido || 0),
        funcionarios: acc.funcionarios + 1
      }), { proventos: 0, descontos: 0, liquido: 0, funcionarios: 0 });
      
      const statusGeral = (data || []).every(f => f.status === 'pago') ? 'Pago' :
                          (data || []).some(f => f.status === 'aprovado') ? 'Aprovado' :
                          (data || []).some(f => f.status === 'calculado') ? 'Calculado' : 'Pendente';
      
      return { ...totais, statusGeral };
    }
  });

  // Últimas movimentações
  const { data: ultimasMovimentacoes, isLoading: loadingMovimentacoes } = useQuery({
    queryKey: ['rh-movimentacoes-recentes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('funcionarios_historico')
        .select(`
          id, tipo, motivo, data_vigencia, created_at,
          funcionario:funcionarios(nome_completo, foto_url)
        `)
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    }
  });

  // Aniversariantes do mês
  const { data: aniversariantes, isLoading: loadingAniversariantes } = useQuery({
    queryKey: ['aniversariantes'],
    queryFn: async () => {
      const mesAtual = new Date().getMonth() + 1;
      const { data } = await supabase
        .from('funcionarios')
        .select('id, nome_completo, data_nascimento, foto_url, cargo:cargos(nome)')
        .eq('status', 'ativo')
        .not('data_nascimento', 'is', null);
      
      return data?.filter(f => {
        if (!f.data_nascimento) return false;
        const mes = new Date(f.data_nascimento).getMonth() + 1;
        return mes === mesAtual;
      }).sort((a, b) => {
        const diaA = new Date(a.data_nascimento!).getDate();
        const diaB = new Date(b.data_nascimento!).getDate();
        return diaA - diaB;
      }) || [];
    }
  });

  // Férias próximas
  const { data: feriasProximas, isLoading: loadingFerias } = useQuery({
    queryKey: ['ferias-proximas'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ferias')
        .select(`
          *,
          funcionario:funcionarios(nome_completo, foto_url)
        `)
        .eq('status', 'aprovada')
        .gte('data_inicio', new Date().toISOString().split('T')[0])
        .order('data_inicio')
        .limit(5);
      return data || [];
    }
  });

  // Distribuição por departamento
  const { data: porDepartamento, isLoading: loadingDepartamento } = useQuery({
    queryKey: ['funcionarios-departamento'],
    queryFn: async () => {
      const { data } = await supabase
        .from('funcionarios')
        .select('departamento:departamentos(nome)')
        .eq('status', 'ativo');
      
      const contagem = new Map<string, number>();
      data?.forEach(f => {
        const dep = (f.departamento as { nome: string } | null)?.nome || 'Sem departamento';
        contagem.set(dep, (contagem.get(dep) || 0) + 1);
      });
      
      const total = data?.length || 1;
      return Array.from(contagem.entries())
        .map(([nome, quantidade]) => ({ 
          nome, 
          quantidade,
          percentual: Math.round((quantidade / total) * 100)
        }))
        .sort((a, b) => b.quantidade - a.quantidade);
    }
  });

  // Ações pendentes
  const { data: acoesPendentes, isLoading: loadingAcoes } = useQuery({
    queryKey: ['rh-acoes-pendentes'],
    queryFn: async () => {
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() + 30);
      
      const [feriasParaAprovar, documentosVencendo] = await Promise.all([
        supabase.from('ferias').select('*', { count: 'exact', head: true }).eq('status', 'solicitada'),
        supabase.from('funcionarios_documentos').select('*', { count: 'exact', head: true })
          .lte('data_validade', dataLimite.toISOString().split('T')[0])
          .gte('data_validade', new Date().toISOString().split('T')[0])
      ]);
      
      return {
        feriasParaAprovar: feriasParaAprovar.count || 0,
        pontosRevisar: 0, // Tabela registros_ponto ainda não implementada
        documentosVencendo: documentosVencendo.count || 0
      };
    }
  });

  // Admissões recentes
  const { data: admissoesRecentes, isLoading: loadingAdmissoes } = useQuery({
    queryKey: ['admissoes-recentes'],
    queryFn: async () => {
      const primeiroDiaMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      
      const { data } = await supabase
        .from('funcionarios')
        .select('id, nome_completo, foto_url, data_admissao, cargo:cargos(nome)')
        .eq('status', 'ativo')
        .gte('data_admissao', primeiroDiaMes)
        .order('data_admissao', { ascending: false })
        .limit(3);
      
      return data || [];
    }
  });

  const getInitials = (nome: string) => {
    return nome?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?';
  };

  const isAniversarioHoje = (dataNascimento: string) => {
    const hoje = new Date();
    const nascimento = parseISO(dataNascimento);
    return hoje.getDate() === nascimento.getDate() && hoje.getMonth() === nascimento.getMonth();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recursos Humanos</h1>
          <p className="text-muted-foreground">Gestão de colaboradores e departamentos</p>
        </div>
        <Button onClick={() => navigate('/rh/funcionarios/novo')}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Funcionário
        </Button>
      </div>

      {/* Cards KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Funcionários Ativos</p>
                {loadingStats ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{stats?.totalAtivos}</p>
                )}
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">Em Férias</p>
                {loadingStats ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-3xl font-bold text-green-700 dark:text-green-300">{stats?.emFerias}</p>
                )}
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <Palmtree className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Afastados</p>
                {loadingStats ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-3xl font-bold text-yellow-700 dark:text-yellow-300">{stats?.afastados}</p>
                )}
              </div>
              <div className="h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                <UserMinus className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Admissões (mês)</p>
                {loadingStats ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">{stats?.admissoesMes}</p>
                )}
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                <UserPlus className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card Folha do Mês */}
        <Card 
          className="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 cursor-pointer hover:border-emerald-400 transition-colors"
          onClick={() => navigate('/rh/folha-pagamento')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Folha do Mês</p>
                {loadingFolha ? (
                  <Skeleton className="h-8 w-24 mt-1" />
                ) : (
                  <>
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(folhaMes?.liquido || 0)}
                    </p>
                    <Badge variant="outline" className="mt-1 text-xs border-emerald-300 text-emerald-600">
                      {folhaMes?.statusGeral || 'Pendente'}
                    </Badge>
                  </>
                )}
              </div>
              <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                <Wallet className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1-2 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ações Pendentes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Ações Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingAcoes ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : (
                <div className="space-y-3">
                  <div 
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => navigate('/rh/ferias')}
                  >
                    <div className="flex items-center gap-3">
                      <Palmtree className="h-5 w-5 text-muted-foreground" />
                      <span>Férias para aprovar</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={acoesPendentes?.feriasParaAprovar ? 'destructive' : 'secondary'}>
                        {acoesPendentes?.feriasParaAprovar || 0}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>

                  <div 
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => navigate('/rh/ponto')}
                  >
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <span>Pontos para revisar</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={acoesPendentes?.pontosRevisar ? 'destructive' : 'secondary'}>
                        {acoesPendentes?.pontosRevisar || 0}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>

                  <div 
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => navigate('/rh/funcionarios')}
                  >
                    <div className="flex items-center gap-3">
                      <FileWarning className="h-5 w-5 text-muted-foreground" />
                      <span>Documentos vencendo (30 dias)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={acoesPendentes?.documentosVencendo ? 'default' : 'secondary'}>
                        {acoesPendentes?.documentosVencendo || 0}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Distribuição por Departamento */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Distribuição por Departamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingDepartamento ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-8 w-full" />)}
                </div>
              ) : porDepartamento?.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Nenhum departamento cadastrado</p>
              ) : (
                <div className="space-y-4">
                  {porDepartamento?.map((dep) => (
                    <div key={dep.nome} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{dep.nome}</span>
                        <span className="text-muted-foreground">{dep.quantidade} ({dep.percentual}%)</span>
                      </div>
                      <Progress value={dep.percentual} className="h-2" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Próximas Férias */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Próximas Férias
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingFerias ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : feriasProximas?.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Nenhuma férias agendada</p>
              ) : (
                <div className="space-y-3">
                  {feriasProximas?.map((ferias) => {
                    const diasParaInicio = differenceInDays(parseISO(ferias.data_inicio), new Date());
                    return (
                      <div key={ferias.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={ferias.funcionario?.foto_url || ''} />
                          <AvatarFallback>{getInitials(ferias.funcionario?.nome_completo || '')}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{ferias.funcionario?.nome_completo}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(parseISO(ferias.data_inicio), "dd/MM", { locale: ptBR })} - {format(parseISO(ferias.data_fim), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                        </div>
                        <Badge variant={diasParaInicio <= 7 ? 'destructive' : 'secondary'}>
                          {diasParaInicio === 0 ? 'Hoje' : `${diasParaInicio} dias`}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna 3 */}
        <div className="space-y-6">
          {/* Aniversariantes do Mês */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cake className="h-5 w-5" />
                Aniversariantes do Mês 🎂
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingAniversariantes ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : aniversariantes?.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Nenhum aniversariante este mês</p>
              ) : (
                <div className="space-y-3">
                  {aniversariantes?.map((func) => {
                    const ehHoje = isAniversarioHoje(func.data_nascimento!);
                    return (
                      <div 
                        key={func.id} 
                        className={`flex items-center gap-3 p-2 rounded-lg ${ehHoje ? 'bg-primary/10 ring-1 ring-primary' : ''}`}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={func.foto_url || ''} />
                          <AvatarFallback>{getInitials(func.nome_completo)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{func.nome_completo}</p>
                          <p className="text-xs text-muted-foreground">
                            {(func.cargo as { nome: string } | null)?.nome || 'Sem cargo'}
                          </p>
                        </div>
                        <div className="text-right">
                          {ehHoje ? (
                            <Badge className="bg-primary">Hoje! 🎉</Badge>
                          ) : (
                            <span className="text-sm font-medium">
                              {format(parseISO(func.data_nascimento!), "dd/MM", { locale: ptBR })}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ações Rápidas */}
          <Card>
            <CardHeader>
              <CardTitle>Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start" 
                onClick={() => navigate('/rh/funcionarios/novo')}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Novo Funcionário
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate('/rh/ponto')}
              >
                <Clock className="mr-2 h-4 w-4" />
                Registrar Ponto
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate('/rh/ferias')}
              >
                <Palmtree className="mr-2 h-4 w-4" />
                Solicitar Férias
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate('/rh/departamentos')}
              >
                <Building className="mr-2 h-4 w-4" />
                Ver Organograma
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate('/rh/treinamentos')}
              >
                <GraduationCap className="mr-2 h-4 w-4" />
                Treinamentos
              </Button>
            </CardContent>
          </Card>

          {/* Últimas Movimentações */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Últimas Movimentações
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingMovimentacoes ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : ultimasMovimentacoes?.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Nenhuma movimentação recente</p>
              ) : (
                <div className="space-y-3">
                  {ultimasMovimentacoes?.map((mov) => {
                    const tipoLabel = {
                      admissao: { label: 'Admissão', icon: UserPlus, color: 'text-green-600' },
                      demissao: { label: 'Desligamento', icon: UserMinus, color: 'text-red-600' },
                      promocao: { label: 'Promoção', icon: TrendingUp, color: 'text-blue-600' },
                      transferencia: { label: 'Transferência', icon: ArrowUpRight, color: 'text-purple-600' },
                      reajuste: { label: 'Reajuste', icon: Wallet, color: 'text-emerald-600' },
                    }[mov.tipo] || { label: mov.tipo, icon: ArrowDownRight, color: 'text-muted-foreground' };
                    const IconComponent = tipoLabel.icon;
                    
                    return (
                      <div key={mov.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                        <div className={`h-8 w-8 rounded-full bg-muted flex items-center justify-center ${tipoLabel.color}`}>
                          <IconComponent className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {(mov.funcionario as { nome_completo: string } | null)?.nome_completo || 'Funcionário'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {tipoLabel.label} {mov.motivo && `- ${mov.motivo}`}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {mov.created_at && format(parseISO(mov.created_at), "dd/MM", { locale: ptBR })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Admissões Recentes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Admissões Recentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingAdmissoes ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : admissoesRecentes?.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Nenhuma admissão este mês</p>
              ) : (
                <div className="space-y-3">
                  {admissoesRecentes?.map((func) => (
                    <div key={func.id} className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={func.foto_url || ''} />
                        <AvatarFallback>{getInitials(func.nome_completo)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{func.nome_completo}</p>
                        <p className="text-xs text-muted-foreground">
                          {(func.cargo as { nome: string } | null)?.nome || 'Sem cargo'}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {func.data_admissao && format(parseISO(func.data_admissao), "dd/MM", { locale: ptBR })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
