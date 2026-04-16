import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getHojeBrasilia } from '@/lib/date-utils';
import { useBasesPratic } from '@/hooks/useBasesPratic';
import { toast } from 'sonner';
import { CalendarDays, Save, Loader2, MapPin, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  base_id: string | null;
  alocacao_id?: string;
}

interface EstadoLocal {
  tipo: 'rota' | 'base';
  base_id: string | null;
}

export function EscalaDiaPanel() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const hoje = getHojeBrasilia();
  const [dataSelecionada, setDataSelecionada] = useState<Date>(hoje);
  const [alocacoes, setAlocacoes] = useState<Record<string, EstadoLocal>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const { data: bases = [] } = useBasesPratic();

  const dataFormatada = format(dataSelecionada, 'yyyy-MM-dd');
  const dataLabel = format(dataSelecionada, "EEEE, dd 'de' MMMM", { locale: ptBR });

  const { data: profissionais = [], isLoading } = useQuery({
    queryKey: ['escala-dia', dataFormatada],
    queryFn: async (): Promise<ProfissionalAlocacao[]> => {
      const { data: configs } = await supabase
        .from('app_roles_config')
        .select('role')
        .eq('is_operational', true)
        .eq('is_active', true);
      const opRoles = (configs || [])
        .map((c: any) => c.role)
        .filter((r: string) => r.includes('instalador') || r.includes('vistoriador'));
      if (opRoles.length === 0) opRoles.push('instalador_vistoriador');

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', opRoles);

      if (rolesError) throw rolesError;
      if (!roles?.length) return [];

      const userIds = roles.map(r => r.user_id);

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, nome, ativo')
        .in('user_id', userIds)
        .eq('ativo', true)
        .order('nome');

      if (profilesError) throw profilesError;
      if (!profiles?.length) return [];

      const profileIds = profiles.map(p => p.id);
      const { data: alocacoesData } = await supabase
        .from('alocacoes_diarias')
        .select('*')
        .eq('data', dataFormatada)
        .in('profissional_id', profileIds);

      const alocacaoMap: Record<string, { tipo: 'rota' | 'base'; id: string; base_id: string | null }> = {};
      alocacoesData?.forEach((a: any) => {
        alocacaoMap[a.profissional_id] = { tipo: a.tipo_alocacao, id: a.id, base_id: a.base_id };
      });

      return profiles.map(p => ({
        id: p.id,
        nome: p.nome || 'Sem nome',
        alocacao: alocacaoMap[p.id]?.tipo || null,
        base_id: alocacaoMap[p.id]?.base_id || null,
        alocacao_id: alocacaoMap[p.id]?.id,
      }));
    },
  });

  useEffect(() => {
    const initial: Record<string, EstadoLocal> = {};
    profissionais.forEach(p => {
      if (p.alocacao) {
        initial[p.id] = { tipo: p.alocacao, base_id: p.base_id };
      }
    });
    setAlocacoes(initial);
    setHasChanges(false);
  }, [profissionais]);

  const toggleAlocacao = (profissionalId: string) => {
    setAlocacoes(prev => {
      const current = prev[profissionalId]?.tipo || 'rota';
      const novoTipo = current === 'rota' ? 'base' : 'rota';
      return {
        ...prev,
        [profissionalId]: {
          tipo: novoTipo,
          base_id: novoTipo === 'base' ? (prev[profissionalId]?.base_id || null) : null,
        },
      };
    });
    setHasChanges(true);
  };

  const setBaseProfissional = (profissionalId: string, baseId: string) => {
    setAlocacoes(prev => ({
      ...prev,
      [profissionalId]: { tipo: 'base', base_id: baseId },
    }));
    setHasChanges(true);
  };

  const salvarMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error('Usuário não autenticado');

      const entries = Object.entries(alocacoes);
      const incompletos = entries.filter(([, v]) => v.tipo === 'base' && !v.base_id);
      if (incompletos.length > 0) {
        throw new Error('Selecione a base para todos os profissionais marcados como Base.');
      }

      const upserts = entries.map(([profissionalId, v]) => ({
        profissional_id: profissionalId,
        data: dataFormatada,
        tipo_alocacao: v.tipo,
        base_id: v.tipo === 'base' ? v.base_id : null,
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
      queryClient.invalidateQueries({ queryKey: ['alocacoes-dia'] });
    },
    onError: (error) => {
      toast.error('Erro ao salvar escala: ' + (error as Error).message);
    },
  });

  const definirTodos = (tipo: 'rota' | 'base') => {
    const newAlocacoes: Record<string, EstadoLocal> = {};
    profissionais.forEach(p => {
      newAlocacoes[p.id] = {
        tipo,
        base_id: tipo === 'base' ? (alocacoes[p.id]?.base_id || null) : null,
      };
    });
    setAlocacoes(newAlocacoes);
    setHasChanges(true);
  };

  const countRota = Object.values(alocacoes).filter(v => v.tipo === 'rota').length;
  const countBase = Object.values(alocacoes).filter(v => v.tipo === 'base').length;
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
              const estado = alocacoes[prof.id];
              const tipo = estado?.tipo || null;
              const isBase = tipo === 'base';

              return (
                <div
                  key={prof.id}
                  className="rounded-lg border p-3 hover:bg-accent/50 transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between">
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
                  {isBase && (
                    <div className="pl-11">
                      <Select
                        value={estado?.base_id || ''}
                        onValueChange={(v) => setBaseProfissional(prof.id, v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Selecione a base..." />
                        </SelectTrigger>
                        <SelectContent>
                          {bases.length === 0 && (
                            <div className="p-2 text-xs text-muted-foreground">
                              Nenhuma base Pratic cadastrada
                            </div>
                          )}
                          {bases.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.nome_fantasia || b.razao_social}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

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
