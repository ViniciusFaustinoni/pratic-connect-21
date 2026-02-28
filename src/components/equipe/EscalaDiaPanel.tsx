import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getHojeBrasilia } from '@/lib/date-utils';
import { toast } from 'sonner';
import { CalendarDays, Save, Loader2, MapPin, Building2, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface ProfissionalAlocacao {
  id: string;
  nome: string;
  alocacao: 'rota' | 'base' | null;
  alocacao_id?: string;
}

export function EscalaDiaPanel() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const hoje = getHojeBrasilia();
  const [dataSelecionada, setDataSelecionada] = useState<Date>(hoje);
  const [alocacoes, setAlocacoes] = useState<Record<string, 'rota' | 'base'>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [showHistorico, setShowHistorico] = useState(false);

  const dataFormatada = format(dataSelecionada, 'yyyy-MM-dd');
  const dataLabel = format(dataSelecionada, "EEEE, dd 'de' MMMM", { locale: ptBR });

  // Buscar profissionais com role instalador_vistoriador e suas alocações
  const { data: profissionais = [], isLoading } = useQuery({
    queryKey: ['escala-dia', dataFormatada],
    queryFn: async (): Promise<ProfissionalAlocacao[]> => {
      // 1. Buscar user_ids com role instalador_vistoriador
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'instalador_vistoriador');

      if (rolesError) throw rolesError;
      if (!roles?.length) return [];

      const userIds = roles.map(r => r.user_id);

      // 2. Buscar profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, nome, ativo')
        .in('user_id', userIds)
        .eq('ativo', true)
        .order('nome');

      if (profilesError) throw profilesError;
      if (!profiles?.length) return [];

      // 3. Buscar alocações do dia
      const profileIds = profiles.map(p => p.id);
      const { data: alocacoesData } = await supabase
        .from('alocacoes_diarias')
        .select('*')
        .eq('data', dataFormatada)
        .in('profissional_id', profileIds);

      const alocacaoMap: Record<string, { tipo: 'rota' | 'base'; id: string }> = {};
      alocacoesData?.forEach((a: any) => {
        alocacaoMap[a.profissional_id] = { tipo: a.tipo_alocacao, id: a.id };
      });

      return profiles.map(p => ({
        id: p.id,
        nome: p.nome || 'Sem nome',
        alocacao: alocacaoMap[p.id]?.tipo || null,
        alocacao_id: alocacaoMap[p.id]?.id,
      }));
    },
  });

  // Inicializar estado local quando dados carregam
  useEffect(() => {
    const initial: Record<string, 'rota' | 'base'> = {};
    profissionais.forEach(p => {
      if (p.alocacao) {
        initial[p.id] = p.alocacao;
      }
    });
    setAlocacoes(initial);
    setHasChanges(false);
  }, [profissionais]);

  const toggleAlocacao = (profissionalId: string) => {
    setAlocacoes(prev => {
      const current = prev[profissionalId] || 'rota';
      return { ...prev, [profissionalId]: current === 'rota' ? 'base' : 'rota' };
    });
    setHasChanges(true);
  };

  // Salvar alocações
  const salvarMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error('Usuário não autenticado');

      const upserts = Object.entries(alocacoes).map(([profissionalId, tipo]) => ({
        profissional_id: profissionalId,
        data: dataFormatada,
        tipo_alocacao: tipo,
        definido_por: profile.id,
        updated_at: new Date().toISOString(),
      }));

      if (upserts.length === 0) return;

      const { error } = await supabase
        .from('alocacoes_diarias')
        .upsert(upserts, { onConflict: 'profissional_id,data' });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Escala do dia salva com sucesso!');
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['escala-dia'] });
      queryClient.invalidateQueries({ queryKey: ['alocacao-diaria'] });
    },
    onError: (error) => {
      toast.error('Erro ao salvar escala: ' + (error as Error).message);
    },
  });

  // Definir todos como Rota ou Base
  const definirTodos = (tipo: 'rota' | 'base') => {
    const newAlocacoes: Record<string, 'rota' | 'base'> = {};
    profissionais.forEach(p => {
      newAlocacoes[p.id] = tipo;
    });
    setAlocacoes(newAlocacoes);
    setHasChanges(true);
  };

  const countRota = Object.values(alocacoes).filter(v => v === 'rota').length;
  const countBase = Object.values(alocacoes).filter(v => v === 'base').length;
  const countSemAlocacao = profissionais.length - Object.keys(alocacoes).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarDays className="h-5 w-5 text-primary" />
            Escala do Dia
          </CardTitle>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <CalendarDays className="h-4 w-4" />
                  {format(dataSelecionada, 'dd/MM/yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={dataSelecionada}
                  onSelect={(d) => d && setDataSelecionada(d)}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <p className="text-sm text-muted-foreground capitalize">{dataLabel}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumo + Ações em massa */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 text-sm">
            <Badge variant="outline" className="gap-1">
              <MapPin className="h-3 w-3" /> Rota: {countRota}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Building2 className="h-3 w-3" /> Base: {countBase}
            </Badge>
            {countSemAlocacao > 0 && (
              <Badge variant="secondary" className="gap-1">
                Sem definição: {countSemAlocacao}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => definirTodos('rota')}>
              Todos Rota
            </Button>
            <Button variant="outline" size="sm" onClick={() => definirTodos('base')}>
              Todos Base
            </Button>
          </div>
        </div>

        {/* Lista de profissionais */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : profissionais.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            Nenhum profissional com perfil instalador/vistoriador encontrado.
          </p>
        ) : (
          <div className="space-y-2">
            {profissionais.map((prof) => {
              const tipo = alocacoes[prof.id] || null;
              const isBase = tipo === 'base';

              return (
                <div
                  key={prof.id}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {prof.nome.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-sm">{prof.nome}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "text-xs font-medium",
                      isBase ? "text-amber-600 dark:text-amber-400" : "text-blue-600 dark:text-blue-400"
                    )}>
                      {isBase ? 'Base' : tipo === 'rota' ? 'Rota' : 'Não definido'}
                    </span>
                    <div className="flex items-center gap-2">
                      <MapPin className={cn("h-3.5 w-3.5", !isBase ? "text-blue-500" : "text-muted-foreground/40")} />
                      <Switch
                        checked={isBase}
                        onCheckedChange={() => toggleAlocacao(prof.id)}
                      />
                      <Building2 className={cn("h-3.5 w-3.5", isBase ? "text-amber-500" : "text-muted-foreground/40")} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Botão salvar */}
        {hasChanges && (
          <Button
            onClick={() => salvarMutation.mutate()}
            disabled={salvarMutation.isPending}
            className="w-full gap-2"
          >
            {salvarMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar Escala do Dia
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
