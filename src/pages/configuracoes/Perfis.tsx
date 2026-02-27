import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Check, X, Info, Search, ChevronDown, ChevronUp, Grid3X3, Settings2,
  Crown, Briefcase, FileText, Radio, Megaphone, Scale, Smartphone,
  Shield, Users, Clock, Eye, Pencil, Save
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { usePermissions } from '@/hooks/usePermissions';
import { usePerfilUsuarios } from '@/hooks/usePerfilUsuarios';
import { GerenciarRolesTab } from '@/components/configuracoes/GerenciarRolesTab';
import { SolicitacoesTab } from '@/components/configuracoes/SolicitacoesTab';
import { AreaSection } from '@/components/configuracoes/AreaSection';
import { PerfilSheet } from '@/components/configuracoes/PerfilSheet';
import { Perfil } from '@/components/configuracoes/PerfilCard';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// 18 módulos do sistema (correspondem aos grupos do sidebar)
const modulos = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'vendas', label: 'Vendas' },
  { id: 'cadastro', label: 'Cadastro' },
  { id: 'monitoramento', label: 'Monitoramento' },
  { id: 'eventos', label: 'Eventos/Sinistros' },
  { id: 'assistencia', label: 'Assistência 24h' },
  { id: 'oficinas', label: 'Oficinas' },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'cobranca', label: 'Cobrança' },
  { id: 'contabilidade', label: 'Contabilidade' },
  { id: 'juridico', label: 'Jurídico' },
  { id: 'rh', label: 'Recursos Humanos' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'ouvidoria', label: 'Ouvidoria' },
  { id: 'diretoria', label: 'Diretoria' },
  { id: 'relatorios', label: 'Relatórios' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'configuracoes', label: 'Configurações' },
];

// Perfis do sistema com descrições
const perfis: Perfil[] = [
  // DIRETORIA
  { id: 'desenvolvedor', label: 'Desenvolvedor', sigla: 'Dev', color: 'bg-violet-500', area: 'Diretoria', descricao: 'Acesso total ao sistema, incluindo configurações técnicas e debug' },
  { id: 'diretor', label: 'Diretor', sigla: 'Dir', color: 'bg-purple-500', area: 'Diretoria', descricao: 'Acesso total ao sistema, aprova alterações de permissão' },
  { id: 'admin_master', label: 'Admin Master', sigla: 'Adm', color: 'bg-purple-400', area: 'Diretoria', descricao: 'Gerencia permissões e usuários (alterações requerem aprovação)' },
  // COMERCIAL
  { id: 'gerente_comercial', label: 'Gerente Comercial', sigla: 'GerC', color: 'bg-blue-500', area: 'Comercial', descricao: 'Gestão completa da equipe comercial e metas' },
  { id: 'supervisor_vendas', label: 'Supervisor Vendas', sigla: 'SupV', color: 'bg-cyan-500', area: 'Comercial', descricao: 'Supervisiona vendedores e acompanha desempenho' },
  { id: 'vendedor_clt', label: 'Vendedor CLT', sigla: 'VdC', color: 'bg-green-500', area: 'Comercial', descricao: 'Vendas internas com acesso aos próprios registros' },
  { id: 'vendedor_externo', label: 'Vendedor Externo', sigla: 'VdE', color: 'bg-green-400', area: 'Comercial', descricao: 'Vendas externas com acesso aos próprios registros' },
  { id: 'agencia', label: 'Agência', sigla: 'Ag', color: 'bg-green-300', area: 'Comercial', descricao: 'Agência parceira com acesso a vendas' },
  // OPERACIONAL
  { id: 'analista_cadastro', label: 'Analista Cadastro', sigla: 'AnCad', color: 'bg-orange-500', area: 'Cadastro', descricao: 'Gerencia cadastros de associados e veículos' },
  { id: 'coordenador_monitoramento', label: 'Coord. Monitoramento', sigla: 'CrdM', color: 'bg-teal-500', area: 'Monitoramento', descricao: 'Coordena equipe de monitoramento e instalações' },
  { id: 'analista_plataforma', label: 'Analista Plataforma', sigla: 'AnPlt', color: 'bg-teal-400', area: 'Monitoramento', descricao: 'Monitora rastreadores e alertas em tempo real' },
  { id: 'instalador_vistoriador', label: 'Instalador/Vistoriador', sigla: 'Inst', color: 'bg-pink-500', area: 'Monitoramento', descricao: 'Realiza instalações e vistorias em campo' },
  { id: 'vistoriador_base', label: 'Vistoriador Base', sigla: 'VBase', color: 'bg-pink-400', area: 'Monitoramento', descricao: 'Realiza vistorias na base' },
  // EVENTOS
  { id: 'analista_eventos', label: 'Analista Eventos', sigla: 'AnEv', color: 'bg-red-500', area: 'Eventos', descricao: 'Gerencia eventos e sinistros' },
  { id: 'regulador', label: 'Regulador', sigla: 'Reg', color: 'bg-red-400', area: 'Eventos', descricao: 'Regulação de sinistros em campo' },
  { id: 'sindicante', label: 'Sindicante', sigla: 'Sind', color: 'bg-red-300', area: 'Eventos', descricao: 'Realiza sindicâncias em campo' },
  // OUTROS
  { id: 'analista_marketing', label: 'Analista Marketing', sigla: 'AnMkt', color: 'bg-rose-500', area: 'Marketing', descricao: 'Gerencia campanhas e leads de marketing' },
  { id: 'analista_juridico', label: 'Analista Jurídico', sigla: 'AnJur', color: 'bg-gray-500', area: 'Jurídico', descricao: 'Acompanha processos e consultas jurídicas' },
  { id: 'advogado', label: 'Advogado', sigla: 'Adv', color: 'bg-blue-800', area: 'Jurídico', descricao: 'Advogado com acesso ao módulo jurídico' },
  // APP
  { id: 'associado', label: 'Associado', sigla: 'Assoc', color: 'bg-slate-500', area: 'App', descricao: 'Acesso ao aplicativo do associado' },
];

// Configuração visual por área
const areaConfig: Record<string, { icon: typeof Crown; gradient: string; borderColor: string }> = {
  'Diretoria': { 
    icon: Crown, 
    gradient: 'from-purple-500/10 via-purple-500/5 to-transparent',
    borderColor: 'border-l-purple-500'
  },
  'Comercial': { 
    icon: Briefcase, 
    gradient: 'from-blue-500/10 via-blue-500/5 to-transparent',
    borderColor: 'border-l-blue-500'
  },
  'Cadastro': { 
    icon: FileText, 
    gradient: 'from-orange-500/10 via-orange-500/5 to-transparent',
    borderColor: 'border-l-orange-500'
  },
  'Monitoramento': { 
    icon: Radio, 
    gradient: 'from-teal-500/10 via-teal-500/5 to-transparent',
    borderColor: 'border-l-teal-500'
  },
  'Eventos': { 
    icon: Shield, 
    gradient: 'from-red-500/10 via-red-500/5 to-transparent',
    borderColor: 'border-l-red-500'
  },
  'Marketing': { 
    icon: Megaphone, 
    gradient: 'from-rose-500/10 via-rose-500/5 to-transparent',
    borderColor: 'border-l-rose-500'
  },
  'Jurídico': { 
    icon: Scale, 
    gradient: 'from-gray-500/10 via-gray-500/5 to-transparent',
    borderColor: 'border-l-gray-500'
  },
  'App': { 
    icon: Smartphone, 
    gradient: 'from-slate-500/10 via-slate-500/5 to-transparent',
    borderColor: 'border-l-slate-500'
  },
};

const areas = ['Diretoria', 'Comercial', 'Cadastro', 'Monitoramento', 'Eventos', 'Marketing', 'Jurídico', 'App'];

// Célula da matriz - agora exibe visibilidade (toggle)
const VisibilityCell = ({ 
  visible, 
  editable, 
  isEdited,
  onChange 
}: { 
  visible: boolean; 
  editable: boolean;
  isEdited: boolean;
  onChange: (v: boolean) => void;
}) => {
  if (editable) {
    return (
      <div className={cn(
        "flex justify-center rounded-md p-1 transition-all",
        isEdited && "bg-amber-500/10 ring-1 ring-amber-500/30"
      )}>
        <Switch
          checked={visible}
          onCheckedChange={onChange}
          className="scale-75"
        />
      </div>
    );
  }
  
  return (
    <div className="flex justify-center">
      {visible ? (
        <Check className="w-4 h-4 text-green-500" />
      ) : (
        <X className="w-4 h-4 text-muted-foreground/30" />
      )}
    </div>
  );
};

export default function Perfis() {
  const { canManagePermissions, canApprovePermissionChanges, isDesenvolvedor, isDiretor } = usePermissions();
  const { contagemPorPerfil, useUsuariosPorPerfil } = usePerfilUsuarios();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState('perfis');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedAreas, setExpandedAreas] = useState<Record<string, boolean>>({
    'Diretoria': true,
    'Comercial': true,
    'Cadastro': false,
    'Monitoramento': false,
    'Eventos': false,
    'Marketing': false,
    'Jurídico': false,
    'App': false,
  });
  const [selectedPerfil, setSelectedPerfil] = useState<Perfil | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showMatriz, setShowMatriz] = useState(false);
  
  // Estado para edição de visibilidade
  const [editedVisibility, setEditedVisibility] = useState<Record<string, Record<string, boolean>>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Busca dados de visibilidade do banco
  const { data: visibilityData, isLoading: isLoadingVisibility } = useQuery({
    queryKey: ['role-module-visibility-all'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('role_module_visibility')
        .select('role, module_id, visible');
      if (error) throw error;
      return data as { role: string; module_id: string; visible: boolean }[];
    },
  });

  // Converte dados do banco para formato de matriz
  const matrizFromDB = useMemo(() => {
    const matriz: Record<string, Record<string, boolean>> = {};
    // Inicializar todos os perfis com todos os módulos como false
    perfis.forEach(p => {
      matriz[p.id] = {};
      modulos.forEach(m => {
        matriz[p.id][m.id] = false;
      });
    });
    // Preencher com dados do banco
    if (visibilityData) {
      visibilityData.forEach(row => {
        if (matriz[row.role]) {
          matriz[row.role][row.module_id] = row.visible;
        }
      });
    }
    return matriz;
  }, [visibilityData]);

  // Busca usuários do perfil selecionado
  const { data: usuariosDoPerfil = [] } = useUsuariosPorPerfil(selectedPerfil?.id || '');

  // Filtra perfis por busca
  const perfisFiltrados = useMemo(() => {
    if (!searchTerm) return perfis;
    const term = searchTerm.toLowerCase();
    return perfis.filter(p => 
      p.label.toLowerCase().includes(term) || 
      p.descricao.toLowerCase().includes(term) ||
      p.area.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  // Agrupa perfis filtrados por área
  const perfisPorArea = useMemo(() => {
    const grouped: Record<string, Perfil[]> = {};
    areas.forEach(area => {
      grouped[area] = perfisFiltrados.filter(p => p.area === area);
    });
    return grouped;
  }, [perfisFiltrados]);

  const toggleArea = (area: string) => {
    setExpandedAreas(prev => ({ ...prev, [area]: !prev[area] }));
  };

  const toggleAll = () => {
    const allExpanded = Object.values(expandedAreas).every(v => v);
    setExpandedAreas(
      Object.keys(expandedAreas).reduce((acc, key) => ({ ...acc, [key]: !allExpanded }), {})
    );
  };

  const allExpanded = Object.values(expandedAreas).every(v => v);

  const handlePerfilClick = (perfil: Perfil) => {
    setSelectedPerfil(perfil);
    setSheetOpen(true);
  };

  // Handler para alterar visibilidade na matriz
  const handleVisibilityChange = useCallback((perfilId: string, moduloId: string, newValue: boolean) => {
    if (!canManagePermissions) return;
    
    setEditedVisibility(prev => ({
      ...prev,
      [perfilId]: {
        ...prev[perfilId],
        [moduloId]: newValue
      }
    }));
    setHasChanges(true);
  }, [canManagePermissions]);

  // Handler para salvar alterações no banco
  const handleSaveChanges = useCallback(async () => {
    try {
      setIsSaving(true);
      
      const upsertData: any[] = [];
      Object.entries(editedVisibility).forEach(([perfilId, modulos]) => {
        Object.entries(modulos).forEach(([moduloId, visible]) => {
          upsertData.push({
            role: perfilId,
            module_id: moduloId,
            visible,
            updated_at: new Date().toISOString(),
          });
        });
      });

      if (upsertData.length > 0) {
        const { error } = await (supabase as any)
          .from('role_module_visibility')
          .upsert(upsertData, { onConflict: 'role,module_id' });
        
        if (error) throw error;
      }

      // Invalidar caches
      queryClient.invalidateQueries({ queryKey: ['role-module-visibility-all'] });
      queryClient.invalidateQueries({ queryKey: ['module-visibility'] });
      
      setEditedVisibility({});
      setHasChanges(false);
      toast.success('Visibilidade dos módulos atualizada com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar alterações de visibilidade');
    } finally {
      setIsSaving(false);
    }
  }, [editedVisibility, queryClient]);

  // Handler para descartar alterações
  const handleDiscardChanges = useCallback(() => {
    setEditedVisibility({});
    setHasChanges(false);
    toast.info('Alterações descartadas');
  }, []);

  // Obter valor atual (editado ou do banco)
  const getVisibility = useCallback((perfilId: string, moduloId: string): boolean => {
    return editedVisibility[perfilId]?.[moduloId] ?? matrizFromDB[perfilId]?.[moduloId] ?? false;
  }, [editedVisibility, matrizFromDB]);

  // Verificar se célula foi editada
  const isCellEdited = useCallback((perfilId: string, moduloId: string): boolean => {
    return editedVisibility[perfilId]?.[moduloId] !== undefined;
  }, [editedVisibility]);

  // Criar uma matriz simplificada para o PerfilSheet (compatibilidade)
  const matrizForSheet = useMemo(() => {
    const result: Record<string, Record<string, boolean | 'read' | 'own'>> = {};
    perfis.forEach(p => {
      result[p.id] = {};
      modulos.forEach(m => {
        result[p.id][m.id] = getVisibility(p.id, m.id);
      });
    });
    return result;
  }, [getVisibility]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Perfis e Permissões</h1>
          <p className="text-sm text-muted-foreground">Gerencie perfis de acesso e visibilidade de módulos</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1.5 py-1.5">
            <Users className="w-3.5 h-3.5" />
            {perfis.length} perfis
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="perfis" className="gap-2">
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">Perfis</span>
          </TabsTrigger>
          {canManagePermissions && (
            <TabsTrigger value="roles" className="gap-2">
              <Settings2 className="w-4 h-4" />
              <span className="hidden sm:inline">Gerenciar</span>
            </TabsTrigger>
          )}
          {canApprovePermissionChanges && (
            <TabsTrigger value="solicitacoes" className="gap-2">
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">Solicitações</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* ABA PERFIS */}
        <TabsContent value="perfis" className="space-y-6">
          {/* Barra de busca e ações */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar perfil por nome, descrição ou área..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={toggleAll}
                className="gap-2"
              >
                {allExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {allExpanded ? 'Colapsar' : 'Expandir'}
              </Button>
              <Button 
                variant={showMatriz ? "default" : "outline"}
                size="sm" 
                onClick={() => setShowMatriz(!showMatriz)}
                className="gap-2"
              >
                <Grid3X3 className="w-4 h-4" />
                <span className="hidden sm:inline">Visibilidade</span>
              </Button>
            </div>
          </div>

          {/* Seções por Área */}
          {!showMatriz && (
            <div className="space-y-4">
              {areas.map(area => {
                const areaPerfis = perfisPorArea[area];
                if (areaPerfis.length === 0) return null;
                
                const config = areaConfig[area];
                if (!config) return null;
                return (
                  <AreaSection
                    key={area}
                    area={area}
                    icon={config.icon}
                    gradient={config.gradient}
                    borderColor={config.borderColor}
                    perfis={areaPerfis}
                    isExpanded={expandedAreas[area]}
                    onToggle={() => toggleArea(area)}
                    onPerfilClick={handlePerfilClick}
                    usuariosPorPerfil={contagemPorPerfil}
                  />
                );
              })}

              {/* Resultados vazios */}
              {perfisFiltrados.length === 0 && (
                <Card className="border-border/50">
                  <CardContent className="py-12 text-center">
                    <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="text-muted-foreground">Nenhum perfil encontrado para "{searchTerm}"</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Matriz de Visibilidade de Módulos */}
          {showMatriz && (
            <Card className="border-border/50">
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">Visibilidade de Módulos por Perfil</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Define quais módulos/abas cada perfil pode <strong>visualizar</strong> no sistema
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    {/* Legenda */}
                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-green-500" />
                        <span className="text-muted-foreground">Visível</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <X className="w-3.5 h-3.5 text-muted-foreground/30" />
                        <span className="text-muted-foreground">Oculto</span>
                      </div>
                    </div>
                    {/* Botões de salvar/descartar */}
                    {canManagePermissions && hasChanges && (
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={handleDiscardChanges} disabled={isSaving}>
                          Descartar
                        </Button>
                        <Button size="sm" onClick={handleSaveChanges} disabled={isSaving} className="gap-1.5">
                          <Save className="w-3.5 h-3.5" />
                          {isSaving ? 'Salvando...' : 'Salvar'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                {canManagePermissions && (
                  <p className="text-xs text-muted-foreground mt-2">
                    <Eye className="w-3 h-3 inline mr-1" />
                    Alterne os switches para definir quais módulos cada perfil pode ver. Alterações são salvas no banco de dados.
                  </p>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {isLoadingVisibility ? (
                  <div className="p-8 text-center text-muted-foreground">Carregando visibilidade...</div>
                ) : (
                  <ScrollArea className="w-full">
                    <div className="min-w-[1200px]">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border/50">
                            <th className="text-left p-4 font-medium text-muted-foreground sticky left-0 bg-card z-10 min-w-[140px]">
                              Módulo
                            </th>
                            {perfis.map((p) => (
                              <th key={p.id} className="p-3 text-center min-w-[70px]">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button 
                                        onClick={() => handlePerfilClick(p)}
                                        className="flex flex-col items-center gap-1 hover:opacity-80 transition-opacity"
                                      >
                                        <div className={`w-3 h-3 rounded-full ${p.color}`} />
                                        <span className="text-[10px] font-medium text-foreground">
                                          {p.sigla}
                                        </span>
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <div className="text-center">
                                        <p className="font-medium">{p.label}</p>
                                        <p className="text-xs text-muted-foreground">{p.area}</p>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {modulos.map((m, idx) => (
                            <tr 
                              key={m.id} 
                              className={cn(
                                "border-b border-border/50 transition-colors",
                                idx % 2 === 0 ? 'bg-muted/20' : ''
                              )}
                            >
                              <td className="p-4 font-medium text-foreground sticky left-0 bg-inherit z-10">
                                {m.label}
                              </td>
                              {perfis.map((p) => {
                                const currentValue = getVisibility(p.id, m.id);
                                const isEdited = isCellEdited(p.id, m.id);
                                
                                return (
                                  <td key={p.id} className="p-2 text-center">
                                    <VisibilityCell
                                      visible={currentValue}
                                      editable={canManagePermissions}
                                      isEdited={isEdited}
                                      onChange={(v) => handleVisibilityChange(p.id, m.id, v)}
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          )}

          {/* Info Card */}
          <Card className="border-border/50 bg-primary/5 border-primary/20">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-foreground">Visibilidade vs Permissão</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    <strong className="text-foreground">Visibilidade</strong> define quais módulos/abas o perfil pode <em>ver</em> no sidebar.{' '}
                    <strong className="text-foreground">Permissão</strong> define o que o perfil pode <em>fazer</em> (gerenciado no código).
                    Usuários com múltiplos perfis veem a <strong className="text-foreground">união</strong> de todos os módulos visíveis.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA GERENCIAR */}
        {canManagePermissions && (
          <TabsContent value="roles">
            <GerenciarRolesTab perfis={perfis} />
          </TabsContent>
        )}

        {/* ABA SOLICITAÇÕES */}
        {canApprovePermissionChanges && (
          <TabsContent value="solicitacoes">
            <SolicitacoesTab />
          </TabsContent>
        )}
      </Tabs>

      {/* Sheet de detalhes do perfil */}
      <PerfilSheet
        perfil={selectedPerfil}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        modulos={modulos}
        matriz={matrizForSheet}
        usuarios={usuariosDoPerfil.map(u => ({ id: u.id, nome: u.nome || '', email: u.email || '' }))}
        onPermissionChange={(perfilId, moduloId, newValue) => {
          handleVisibilityChange(perfilId, moduloId, newValue !== false);
        }}
      />
    </div>
  );
}
