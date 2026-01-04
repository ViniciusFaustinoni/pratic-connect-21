import { GitBranch, List, Download, Users, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';

interface FuncionarioNode {
  id: string;
  nome_completo: string;
  foto_url: string | null;
  gestor_id: string | null;
  cargo: { nome: string; nivel: number | null } | null;
  departamento: { id: string; nome: string } | null;
  subordinados: FuncionarioNode[];
}

const nivelConfig: Record<number, { label: string; className: string }> = {
  1: { label: 'Junior', className: 'bg-gray-100 text-gray-800' },
  2: { label: 'Pleno', className: 'bg-blue-100 text-blue-800' },
  3: { label: 'Senior', className: 'bg-green-100 text-green-800' },
  4: { label: 'Coordenador', className: 'bg-yellow-100 text-yellow-800' },
  5: { label: 'Gerente', className: 'bg-orange-100 text-orange-800' },
  6: { label: 'Diretor', className: 'bg-purple-100 text-purple-800' },
};

export default function Organograma() {
  const [viewMode, setViewMode] = useState<'arvore' | 'lista'>('arvore');
  const navigate = useNavigate();

  const { data: funcionarios, isLoading } = useQuery({
    queryKey: ['organograma'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funcionarios')
        .select(`
          id, nome_completo, foto_url, gestor_id,
          cargo:cargos(nome, nivel),
          departamento:departamentos(id, nome)
        `)
        .eq('status', 'ativo')
        .order('nome_completo');
      
      if (error) throw error;
      return data;
    }
  });

  const montarHierarquia = (
    funcionarios: any[], 
    gestorId: string | null = null
  ): FuncionarioNode[] => {
    return funcionarios
      ?.filter(f => f.gestor_id === gestorId)
      .map(func => ({
        ...func,
        subordinados: montarHierarquia(funcionarios, func.id)
      })) || [];
  };

  const hierarquia = useMemo(() => {
    if (!funcionarios) return [];
    return montarHierarquia(funcionarios);
  }, [funcionarios]);

  const funcionariosPorDepartamento = useMemo(() => {
    if (!funcionarios) return {};
    const agrupado: Record<string, any[]> = {};
    funcionarios.forEach(f => {
      const deptNome = f.departamento?.nome || 'Sem Departamento';
      if (!agrupado[deptNome]) agrupado[deptNome] = [];
      agrupado[deptNome].push(f);
    });
    // Ordenar por nível dentro de cada departamento
    Object.keys(agrupado).forEach(dept => {
      agrupado[dept].sort((a, b) => (b.cargo?.nivel || 0) - (a.cargo?.nivel || 0));
    });
    return agrupado;
  }, [funcionarios]);

  const getInitials = (name: string) => 
    name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  const OrgNode = ({ funcionario, isFirst = false }: { funcionario: FuncionarioNode; isFirst?: boolean }) => (
    <div className="flex flex-col items-center">
      {!isFirst && <div className="w-px h-6 bg-border" />}
      <Card 
        className="w-48 cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary/50"
        onClick={() => navigate(`/rh/funcionarios/${funcionario.id}`)}
      >
        <CardContent className="p-4 text-center">
          <Avatar className="h-16 w-16 mx-auto mb-2">
            <AvatarImage src={funcionario.foto_url || ''} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {getInitials(funcionario.nome_completo)}
            </AvatarFallback>
          </Avatar>
          <p className="font-medium text-sm truncate">{funcionario.nome_completo}</p>
          <p className="text-xs text-muted-foreground truncate">{funcionario.cargo?.nome || 'Sem cargo'}</p>
          {funcionario.departamento && (
            <Badge variant="outline" className="mt-2 text-xs">
              {funcionario.departamento.nome}
            </Badge>
          )}
        </CardContent>
      </Card>
      
      {funcionario.subordinados.length > 0 && (
        <>
          <div className="w-px h-6 bg-border" />
          <div className="relative flex gap-8">
            {funcionario.subordinados.length > 1 && (
              <div 
                className="absolute top-0 left-1/2 -translate-x-1/2 h-px bg-border"
                style={{ 
                  width: `calc(100% - 12rem)`,
                  left: '50%'
                }}
              />
            )}
            {funcionario.subordinados.map((sub, index) => (
              <div key={sub.id} className="flex flex-col items-center relative">
                {funcionario.subordinados.length > 1 && (
                  <div className="w-px h-6 bg-border" />
                )}
                <OrgNode funcionario={sub} isFirst={funcionario.subordinados.length === 1} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  const DepartamentoCollapsible = ({ nome, funcionarios }: { nome: string; funcionarios: any[] }) => {
    const [open, setOpen] = useState(true);

    return (
      <Collapsible open={open} onOpenChange={setOpen} className="border rounded-lg">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-4 h-auto">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <span className="font-semibold">{nome}</span>
              <Badge variant="secondary">{funcionarios.length}</Badge>
            </div>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-2">
            {funcionarios.map(func => (
              <div 
                key={func.id}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => navigate(`/rh/funcionarios/${func.id}`)}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={func.foto_url || ''} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {getInitials(func.nome_completo)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{func.nome_completo}</p>
                  <p className="text-sm text-muted-foreground truncate">{func.cargo?.nome || 'Sem cargo'}</p>
                </div>
                {func.cargo?.nivel && nivelConfig[func.cargo.nivel] && (
                  <Badge className={nivelConfig[func.cargo.nivel].className}>
                    {nivelConfig[func.cargo.nivel].label}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="flex justify-center">
          <Skeleton className="h-96 w-full max-w-4xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <GitBranch className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Organograma</h1>
          <Badge variant="secondary">{funcionarios?.length || 0} funcionários</Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <ToggleGroup 
            type="single" 
            value={viewMode} 
            onValueChange={(v) => v && setViewMode(v as 'arvore' | 'lista')}
          >
            <ToggleGroupItem value="arvore" aria-label="Visualização em árvore">
              <GitBranch className="h-4 w-4 mr-2" />
              Árvore
            </ToggleGroupItem>
            <ToggleGroupItem value="lista" aria-label="Visualização em lista">
              <List className="h-4 w-4 mr-2" />
              Lista
            </ToggleGroupItem>
          </ToggleGroup>
          
          <Button variant="outline" disabled>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Conteúdo */}
      {viewMode === 'arvore' ? (
        <ScrollArea className="w-full">
          <div className="min-w-max p-8 flex justify-center">
            {hierarquia.length > 0 ? (
              <div className="flex gap-12">
                {hierarquia.map(func => (
                  <OrgNode key={func.id} funcionario={func} isFirst />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum funcionário cadastrado ou sem hierarquia definida</p>
              </div>
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      ) : (
        <div className="space-y-4">
          {Object.keys(funcionariosPorDepartamento).length > 0 ? (
            Object.entries(funcionariosPorDepartamento)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([dept, funcs]) => (
                <DepartamentoCollapsible key={dept} nome={dept} funcionarios={funcs} />
              ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum funcionário cadastrado</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
