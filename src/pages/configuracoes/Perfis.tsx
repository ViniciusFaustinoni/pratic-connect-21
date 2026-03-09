import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Check, X, Info, Search, ChevronDown, ChevronUp, Grid3X3, Settings2,
  Crown, Briefcase, FileText, Radio, Megaphone, Scale, Smartphone,
  Shield, Users, Clock, Eye, Pencil, Save, ChevronRight
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
import { useAppRoles } from '@/hooks/useAppRoles';
import { MODULES, MODULE_ITEMS } from '@/config/modules';
import { GerenciarRolesTab } from '@/components/configuracoes/GerenciarRolesTab';
import { SolicitacoesTab } from '@/components/configuracoes/SolicitacoesTab';
import { AreaSection } from '@/components/configuracoes/AreaSection';
import { PerfilSheet } from '@/components/configuracoes/PerfilSheet';
import { Perfil } from '@/components/configuracoes/PerfilCard';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// Mapa de ícones Lucide por nome (para áreas — derivados do banco)
const ICON_REGISTRY: Record<string, typeof Crown> = {
  Crown, Briefcase, FileCheck: FileText, Radio, Megaphone, Scale, Smartphone,
  Shield, Code: Settings2, ShieldCheck: Shield, Users, MapPin: Shield,
  Monitor: Shield, Wrench: Shield, ClipboardCheck: Shield,
  AlertTriangle: Shield, Search, Gavel: Scale, User: Shield,
  UserCheck: Shield, UserPlus: Shield, Building2: Shield,
};

// Cor → gradiente de área (derivado dinamicamente)
function getAreaGradient(color: string): { gradient: string; borderColor: string } {
  const map: Record<string, { gradient: string; borderColor: string }> = {
    purple: { gradient: 'from-purple-500/10 via-purple-500/5 to-transparent', borderColor: 'border-l-purple-500' },
    violet: { gradient: 'from-violet-500/10 via-violet-500/5 to-transparent', borderColor: 'border-l-violet-500' },
    blue: { gradient: 'from-blue-500/10 via-blue-500/5 to-transparent', borderColor: 'border-l-blue-500' },
    cyan: { gradient: 'from-cyan-500/10 via-cyan-500/5 to-transparent', borderColor: 'border-l-cyan-500' },
    green: { gradient: 'from-green-500/10 via-green-500/5 to-transparent', borderColor: 'border-l-green-500' },
    orange: { gradient: 'from-orange-500/10 via-orange-500/5 to-transparent', borderColor: 'border-l-orange-500' },
    teal: { gradient: 'from-teal-500/10 via-teal-500/5 to-transparent', borderColor: 'border-l-teal-500' },
    pink: { gradient: 'from-pink-500/10 via-pink-500/5 to-transparent', borderColor: 'border-l-pink-500' },
    red: { gradient: 'from-red-500/10 via-red-500/5 to-transparent', borderColor: 'border-l-red-500' },
    rose: { gradient: 'from-rose-500/10 via-rose-500/5 to-transparent', borderColor: 'border-l-rose-500' },
    indigo: { gradient: 'from-indigo-500/10 via-indigo-500/5 to-transparent', borderColor: 'border-l-indigo-500' },
    slate: { gradient: 'from-slate-500/10 via-slate-500/5 to-transparent', borderColor: 'border-l-slate-500' },
    fuchsia: { gradient: 'from-fuchsia-500/10 via-fuchsia-500/5 to-transparent', borderColor: 'border-l-fuchsia-500' },
    gray: { gradient: 'from-gray-500/10 via-gray-500/5 to-transparent', borderColor: 'border-l-gray-500' },
  };
  return map[color] || map.gray;
}

const DEFAULT_AREA_STYLE = { gradient: 'from-gray-500/10 via-gray-500/5 to-transparent', borderColor: 'border-l-gray-500' };

// Célula da matriz - toggle de visibilidade
const VisibilityCell = ({ 
  visible, editable, isEdited, onChange 
}: { visible: boolean; editable: boolean; isEdited: boolean; onChange: (v: boolean) => void }) => {
  if (editable) {
    return (
      <div className={cn(
        "flex justify-center rounded-md p-1 transition-all",
        isEdited && "bg-amber-500/10 ring-1 ring-amber-500/30"
      )}>
        <Switch checked={visible} onCheckedChange={onChange} className="scale-75" />
      </div>
    );
  }
  return (
    <div className="flex justify-center">
      {visible ? <Check className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-muted-foreground/30" />}
    </div>
  );
};

interface MatrixUser {
  id: string;
  nome: string;
  email: string;
}

export default function Perfis() {
  const { canManagePermissions, canApprovePermissionChanges } = usePermissions();
  const { contagemPorPerfil, useUsuariosPorPerfil } = usePerfilUsuarios();
  const { roles: appRoles, getAreas, getAreaStyles, isLoading: isLoadingRoles } = useAppRoles();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState('perfis');
  const [searchTerm, setSearchTerm] = useState('');
  const [matrixUserSearch, setMatrixUserSearch] = useState('');

  // Gerar perfis dinâmicos a partir do hook
  const perfis: Perfil[] = useMemo(() => {
    return appRoles.map(r => ({
      id: r.role,
      label: r.label,
      sigla: r.sigla,
      color: `bg-${r.color}-500`,
      area: r.area,
      descricao: r.description,
    }));
  }, [appRoles]);

  // Áreas dinâmicas
  const areas = useMemo(() => getAreas(), [getAreas, appRoles]);

  const [expandedAreas, setExpandedAreas] = useState<Record<string, boolean>>({});
  const [selectedPerfil, setSelectedPerfil] = useState<Perfil | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showMatriz, setShowMatriz] = useState(false);
  
  const [editedVisibility, setEditedVisibility] = useState<Record<string, Record<string, boolean>>>({});
  const [editedCanEdit, setEditedCanEdit] = useState<Record<string, Record<string, boolean>>>({});
  const [editedItemVisibility, setEditedItemVisibility] = useState<Record<string, Record<string, Record<string, boolean>>>>({});
  const [expandedModules, setExpandedModules] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { data: matrixUsers = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['matrix-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome, email')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return (data || []) as MatrixUser[];
    },
  });

  const filteredMatrixUsers = useMemo(() => {
    if (!matrixUserSearch) return matrixUsers;
    const term = matrixUserSearch.toLowerCase();
    return matrixUsers.filter(u => 
      u.nome?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term)
    );
  }, [matrixUsers, matrixUserSearch]);

  const { data: visibilityData, isLoading: isLoadingVisibility } = useQuery({
    queryKey: ['user-module-visibility-all'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('user_module_visibility')
        .select('user_id, module_id, visible, can_edit');
      if (error) throw error;
      return data as { user_id: string; module_id: string; visible: boolean; can_edit: boolean }[];
    },
  });

  const { data: itemVisibilityData, isLoading: isLoadingItemVisibility } = useQuery({
    queryKey: ['user-module-item-visibility-all'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('user_module_item_visibility')
        .select('user_id, module_id, item_id, visible');
      if (error) throw error;
      return data as { user_id: string; module_id: string; item_id: string; visible: boolean }[];
    },
  });

  const matrizFromDB = useMemo(() => {
    const matriz: Record<string, Record<string, boolean>> = {};
    if (visibilityData) {
      visibilityData.forEach(row => {
        if (!matriz[row.user_id]) matriz[row.user_id] = {};
        matriz[row.user_id][row.module_id] = row.visible;
      });
    }
    return matriz;
  }, [visibilityData]);

  const canEditFromDB = useMemo(() => {
    const map: Record<string, Record<string, boolean>> = {};
    if (visibilityData) {
      visibilityData.forEach(row => {
        if (!map[row.user_id]) map[row.user_id] = {};
        map[row.user_id][row.module_id] = row.can_edit ?? true;
      });
    }
    return map;
  }, [visibilityData]);

  const itemVisFromDB = useMemo(() => {
    const map: Record<string, Record<string, Record<string, boolean>>> = {};
    if (itemVisibilityData) {
      itemVisibilityData.forEach(row => {
        if (!map[row.user_id]) map[row.user_id] = {};
        if (!map[row.user_id][row.module_id]) map[row.user_id][row.module_id] = {};
        map[row.user_id][row.module_id][row.item_id] = row.visible;
      });
    }
    return map;
  }, [itemVisibilityData]);

  const { data: usuariosDoPerfil = [] } = useUsuariosPorPerfil(selectedPerfil?.id || '');

  const perfisFiltrados = useMemo(() => {
    if (!searchTerm) return perfis;
    const term = searchTerm.toLowerCase();
    return perfis.filter(p => 
      p.label.toLowerCase().includes(term) || 
      p.descricao.toLowerCase().includes(term) ||
      p.area.toLowerCase().includes(term)
    );
  }, [searchTerm, perfis]);

  const perfisPorArea = useMemo(() => {
    const grouped: Record<string, Perfil[]> = {};
    areas.forEach(area => { grouped[area] = perfisFiltrados.filter(p => p.area === area); });
    return grouped;
  }, [perfisFiltrados, areas]);

  const toggleArea = (area: string) => {
    setExpandedAreas(prev => ({ ...prev, [area]: !prev[area] }));
  };

  const toggleAll = () => {
    const allExpanded = areas.every(a => expandedAreas[a]);
    const newState: Record<string, boolean> = {};
    areas.forEach(a => { newState[a] = !allExpanded; });
    setExpandedAreas(newState);
  };

  const allExpanded = areas.every(a => expandedAreas[a]);

  const handlePerfilClick = (perfil: Perfil) => {
    setSelectedPerfil(perfil);
    setSheetOpen(true);
  };

  const handleVisibilityChange = useCallback((userId: string, moduloId: string, newValue: boolean) => {
    if (!canManagePermissions) return;
    setEditedVisibility(prev => ({
      ...prev,
      [userId]: { ...prev[userId], [moduloId]: newValue }
    }));
    setHasChanges(true);
  }, [canManagePermissions]);

  const handleCanEditChange = useCallback((userId: string, moduloId: string, newValue: boolean) => {
    if (!canManagePermissions) return;
    setEditedCanEdit(prev => ({
      ...prev,
      [userId]: { ...prev[userId], [moduloId]: newValue }
    }));
    setHasChanges(true);
  }, [canManagePermissions]);

  const handleItemVisibilityChange = useCallback((userId: string, moduloId: string, itemId: string, newValue: boolean) => {
    if (!canManagePermissions) return;
    setEditedItemVisibility(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [moduloId]: { ...prev[userId]?.[moduloId], [itemId]: newValue }
      }
    }));
    setHasChanges(true);
  }, [canManagePermissions]);

  const toggleModuleExpand = useCallback((moduleId: string) => {
    setExpandedModules(prev => 
      prev.includes(moduleId) ? prev.filter(id => id !== moduleId) : [...prev, moduleId]
    );
  }, []);

  const handleSaveChanges = useCallback(async () => {
    try {
      setIsSaving(true);
      
      const upsertData: any[] = [];
      const allEditedUserIds = new Set([
        ...Object.keys(editedVisibility),
        ...Object.keys(editedCanEdit),
      ]);
      
      allEditedUserIds.forEach(userId => {
        const editedMods = new Set([
          ...Object.keys(editedVisibility[userId] || {}),
          ...Object.keys(editedCanEdit[userId] || {}),
        ]);
        editedMods.forEach(moduloId => {
          upsertData.push({
            user_id: userId,
            module_id: moduloId,
            visible: editedVisibility[userId]?.[moduloId] ?? getVisibility(userId, moduloId),
            can_edit: editedCanEdit[userId]?.[moduloId] ?? getCanEdit(userId, moduloId),
            updated_at: new Date().toISOString(),
          });
        });
      });

      if (upsertData.length > 0) {
        const { error } = await (supabase as any)
          .from('user_module_visibility')
          .upsert(upsertData, { onConflict: 'user_id,module_id' });
        if (error) throw error;
      }

      const itemUpsertData: any[] = [];
      Object.entries(editedItemVisibility).forEach(([userId, modules]) => {
        Object.entries(modules).forEach(([moduleId, items]) => {
          Object.entries(items).forEach(([itemId, visible]) => {
            itemUpsertData.push({
              user_id: userId,
              module_id: moduleId,
              item_id: itemId,
              visible,
              updated_at: new Date().toISOString(),
            });
          });
        });
      });

      if (itemUpsertData.length > 0) {
        const { error } = await (supabase as any)
          .from('user_module_item_visibility')
          .upsert(itemUpsertData, { onConflict: 'user_id,module_id,item_id' });
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ['user-module-visibility-all'] });
      queryClient.invalidateQueries({ queryKey: ['user-module-item-visibility-all'] });
      queryClient.invalidateQueries({ queryKey: ['module-visibility'] });
      queryClient.invalidateQueries({ queryKey: ['module-item-visibility'] });
      
      setEditedVisibility({});
      setEditedCanEdit({});
      setEditedItemVisibility({});
      setHasChanges(false);
      toast.success('Visibilidade atualizada com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar alterações de visibilidade');
    } finally {
      setIsSaving(false);
    }
  }, [editedVisibility, editedCanEdit, editedItemVisibility, queryClient]);

  const handleDiscardChanges = useCallback(() => {
    setEditedVisibility({});
    setEditedCanEdit({});
    setEditedItemVisibility({});
    setHasChanges(false);
    toast.info('Alterações descartadas');
  }, []);

  const getVisibility = useCallback((userId: string, moduloId: string): boolean => {
    return editedVisibility[userId]?.[moduloId] ?? matrizFromDB[userId]?.[moduloId] ?? false;
  }, [editedVisibility, matrizFromDB]);

  const getCanEdit = useCallback((userId: string, moduloId: string): boolean => {
    return editedCanEdit[userId]?.[moduloId] ?? canEditFromDB[userId]?.[moduloId] ?? true;
  }, [editedCanEdit, canEditFromDB]);

  const getItemVisibility = useCallback((userId: string, moduloId: string, itemId: string): boolean => {
    return editedItemVisibility[userId]?.[moduloId]?.[itemId] ?? itemVisFromDB[userId]?.[moduloId]?.[itemId] ?? true;
  }, [editedItemVisibility, itemVisFromDB]);

  const isCellEdited = useCallback((userId: string, moduloId: string): boolean => {
    return editedVisibility[userId]?.[moduloId] !== undefined || editedCanEdit[userId]?.[moduloId] !== undefined;
  }, [editedVisibility, editedCanEdit]);

  const matrizForSheet = useMemo(() => {
    const result: Record<string, Record<string, boolean | 'read' | 'own'>> = {};
    perfis.forEach(p => {
      result[p.id] = {};
      MODULES.forEach(m => { result[p.id][m.id] = false; });
    });
    return result;
  }, [perfis]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Perfis e Permissões</h1>
          <p className="text-sm text-muted-foreground">Gerencie perfis de acesso e visibilidade de módulos por usuário</p>
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
              <Button variant="outline" size="sm" onClick={toggleAll} className="gap-2">
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
                if (!areaPerfis || areaPerfis.length === 0) return null;
                const icon = AREA_ICON_MAP[area] || Shield;
                const style = AREA_STYLE_MAP[area] || DEFAULT_AREA_STYLE;
                return (
                  <AreaSection
                    key={area}
                    area={area}
                    icon={icon}
                    gradient={style.gradient}
                    borderColor={style.borderColor}
                    perfis={areaPerfis}
                    isExpanded={expandedAreas[area] ?? false}
                    onToggle={() => toggleArea(area)}
                    onPerfilClick={handlePerfilClick}
                    usuariosPorPerfil={contagemPorPerfil}
                  />
                );
              })}

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

          {/* Matriz de Visibilidade por USUÁRIO */}
          {showMatriz && (
            <Card className="border-border/50">
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">Visibilidade de Módulos por Usuário</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Define quais módulos/abas cada <strong>usuário</strong> pode visualizar no sistema
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
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
                <div className="mt-3">
                  <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar usuário por nome ou email..."
                      value={matrixUserSearch}
                      onChange={(e) => setMatrixUserSearch(e.target.value)}
                      className="pl-9 h-9 text-sm"
                    />
                  </div>
                </div>
                {canManagePermissions && (
                  <p className="text-xs text-muted-foreground mt-2">
                    <Eye className="w-3 h-3 inline mr-1" />
                    Alterne os switches para definir quais módulos cada usuário pode ver.
                  </p>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {(isLoadingVisibility || isLoadingItemVisibility || isLoadingUsers) ? (
                  <div className="p-8 text-center text-muted-foreground">Carregando visibilidade...</div>
                ) : filteredMatrixUsers.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">Nenhum usuário encontrado</div>
                ) : (
                  <ScrollArea className="w-full">
                    <div className="min-w-[800px]">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border/50">
                            <th className="text-left p-4 font-medium text-muted-foreground sticky left-0 bg-card z-10 min-w-[180px]">
                              Módulo
                            </th>
                            {filteredMatrixUsers.map((u) => (
                              <th key={u.id} className="p-3 text-center min-w-[80px]">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex flex-col items-center gap-1">
                                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                          {(u.nome || u.email || '?').charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-[9px] font-medium text-foreground truncate max-w-[70px]">
                                          {(u.nome || u.email || '').split(' ')[0]}
                                        </span>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <div className="text-center">
                                        <p className="font-medium">{u.nome}</p>
                                        <p className="text-xs text-muted-foreground">{u.email}</p>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {MODULES.map((m, idx) => {
                            const moduleItems = MODULE_ITEMS[m.id];
                            const hasSubItems = moduleItems && moduleItems.length > 0;
                            const isExpanded = expandedModules.includes(m.id);

                            return (
                              <tbody key={m.id}>
                                <tr className={cn(
                                  "border-b border-border/50 transition-colors",
                                  idx % 2 === 0 ? 'bg-muted/20' : ''
                                )}>
                                  <td className="p-4 font-medium text-foreground sticky left-0 bg-inherit z-10">
                                    <div className="flex items-center gap-2">
                                      {hasSubItems && canManagePermissions && (
                                        <button 
                                          onClick={() => toggleModuleExpand(m.id)}
                                          className="p-0.5 rounded hover:bg-muted/50 transition-colors"
                                        >
                                          <ChevronRight className={cn(
                                            "w-3.5 h-3.5 text-muted-foreground transition-transform",
                                            isExpanded && "rotate-90"
                                          )} />
                                        </button>
                                      )}
                                      {!hasSubItems && <span className="w-4" />}
                                      {m.label}
                                    </div>
                                  </td>
                                  {filteredMatrixUsers.map((u) => {
                                    const currentValue = getVisibility(u.id, m.id);
                                    const isEdited = isCellEdited(u.id, m.id);
                                    return (
                                      <td key={u.id} className="p-2 text-center">
                                        <VisibilityCell
                                          visible={currentValue}
                                          editable={canManagePermissions}
                                          isEdited={isEdited}
                                          onChange={(v) => handleVisibilityChange(u.id, m.id, v)}
                                        />
                                      </td>
                                    );
                                  })}
                                </tr>

                                {/* Sub-itens */}
                                {isExpanded && hasSubItems && moduleItems.map((item) => (
                                  <tr 
                                    key={`${m.id}-${item.id}`}
                                    className="border-b border-border/30 bg-muted/10"
                                  >
                                    <td className="pl-10 pr-4 py-2 text-sm text-muted-foreground sticky left-0 bg-inherit z-10">
                                      <span className="text-muted-foreground/50 mr-1">›</span>
                                      {item.label}
                                    </td>
                                    {filteredMatrixUsers.map((u) => {
                                      const moduleVisible = getVisibility(u.id, m.id);
                                      if (!moduleVisible) {
                                        return (
                                          <td key={u.id} className="p-2 text-center">
                                            <span className="text-muted-foreground/20">—</span>
                                          </td>
                                        );
                                      }
                                      const itemVisible = getItemVisibility(u.id, m.id, item.id);
                                      return (
                                        <td key={u.id} className="p-2 text-center">
                                          <VisibilityCell
                                            visible={itemVisible}
                                            editable={canManagePermissions}
                                            isEdited={editedItemVisibility[u.id]?.[m.id]?.[item.id] !== undefined}
                                            onChange={(v) => handleItemVisibilityChange(u.id, m.id, item.id, v)}
                                          />
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            );
                          })}
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
                  <p className="font-medium text-foreground">Visibilidade por Usuário</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    A visibilidade é configurada <strong className="text-foreground">individualmente por usuário</strong>.
                    Defina quais módulos e sub-itens cada pessoa pode ver e editar diretamente na matriz ou na edição do usuário.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA GERENCIAR */}
        {canManagePermissions && (
          <TabsContent value="roles">
            <GerenciarRolesTab />
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
        modulos={MODULES}
        matriz={matrizForSheet}
        usuarios={usuariosDoPerfil.map(u => ({ id: u.id, nome: u.nome || '', email: u.email || '' }))}
        onPermissionChange={() => {}}
      />
    </div>
  );
}
