import { useState, useMemo, useCallback } from 'react';
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
import { usePermissions } from '@/hooks/usePermissions';
import { usePerfilUsuarios } from '@/hooks/usePerfilUsuarios';
import { GerenciarRolesTab } from '@/components/configuracoes/GerenciarRolesTab';
import { SolicitacoesTab } from '@/components/configuracoes/SolicitacoesTab';
import { AreaSection } from '@/components/configuracoes/AreaSection';
import { PerfilSheet } from '@/components/configuracoes/PerfilSheet';
import { PermissionSelect } from '@/components/configuracoes/PermissionSelect';
import { Perfil } from '@/components/configuracoes/PerfilCard';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// 10 módulos do sistema
const modulos = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'vendas', label: 'Vendas' },
  { id: 'cadastro', label: 'Cadastro' },
  { id: 'monitoramento', label: 'Monitoramento' },
  { id: 'eventos', label: 'Eventos/Sinistros' },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'cobranca', label: 'Cobrança' },
  { id: 'assistencia', label: 'Assistência 24h' },
  { id: 'relatorios', label: 'Relatórios' },
  { id: 'configuracoes', label: 'Configurações' },
];

// 14 perfis do sistema com descrições
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
  // OPERACIONAL
  { id: 'analista_cadastro', label: 'Analista Cadastro', sigla: 'AnCad', color: 'bg-orange-500', area: 'Cadastro', descricao: 'Gerencia cadastros de associados e veículos' },
  { id: 'coordenador_monitoramento', label: 'Coord. Monitoramento', sigla: 'CrdM', color: 'bg-teal-500', area: 'Monitoramento', descricao: 'Coordena equipe de monitoramento e instalações' },
  { id: 'analista_plataforma', label: 'Analista Plataforma', sigla: 'AnPlt', color: 'bg-teal-400', area: 'Monitoramento', descricao: 'Monitora rastreadores e alertas em tempo real' },
  { id: 'instalador_vistoriador', label: 'Instalador/Vistoriador', sigla: 'Inst', color: 'bg-pink-500', area: 'Monitoramento', descricao: 'Realiza instalações e vistorias em campo' },
  // OUTROS
  { id: 'analista_marketing', label: 'Analista Marketing', sigla: 'AnMkt', color: 'bg-rose-500', area: 'Marketing', descricao: 'Gerencia campanhas e leads de marketing' },
  { id: 'analista_juridico', label: 'Analista Jurídico', sigla: 'AnJur', color: 'bg-gray-500', area: 'Jurídico', descricao: 'Acompanha processos e consultas jurídicas' },
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

const areas = ['Diretoria', 'Comercial', 'Cadastro', 'Monitoramento', 'Marketing', 'Jurídico', 'App'];

type PermValue = boolean | 'read' | 'own';

// Matriz de permissões
const matrizInicial: Record<string, Record<string, PermValue>> = {
  desenvolvedor: { dashboard: true, vendas: true, cadastro: true, monitoramento: true, eventos: true, financeiro: true, cobranca: true, assistencia: true, relatorios: true, configuracoes: true },
  diretor: { dashboard: true, vendas: true, cadastro: true, monitoramento: true, eventos: true, financeiro: true, cobranca: true, assistencia: true, relatorios: true, configuracoes: true },
  admin_master: { dashboard: true, vendas: true, cadastro: true, monitoramento: true, eventos: true, financeiro: true, cobranca: true, assistencia: true, relatorios: true, configuracoes: true },
  gerente_comercial: { dashboard: true, vendas: true, cadastro: 'read', monitoramento: 'read', eventos: false, financeiro: 'read', cobranca: false, assistencia: false, relatorios: true, configuracoes: 'read' },
  supervisor_vendas: { dashboard: true, vendas: true, cadastro: 'read', monitoramento: 'read', eventos: false, financeiro: false, cobranca: false, assistencia: false, relatorios: 'read', configuracoes: false },
  vendedor_clt: { dashboard: 'own', vendas: 'own', cadastro: false, monitoramento: false, eventos: false, financeiro: false, cobranca: false, assistencia: false, relatorios: false, configuracoes: false },
  vendedor_externo: { dashboard: 'own', vendas: 'own', cadastro: false, monitoramento: false, eventos: false, financeiro: false, cobranca: false, assistencia: false, relatorios: false, configuracoes: false },
  analista_cadastro: { dashboard: 'read', vendas: 'read', cadastro: true, monitoramento: 'read', eventos: false, financeiro: false, cobranca: false, assistencia: false, relatorios: false, configuracoes: false },
  coordenador_monitoramento: { dashboard: true, vendas: 'read', cadastro: 'read', monitoramento: true, eventos: false, financeiro: false, cobranca: false, assistencia: false, relatorios: 'read', configuracoes: false },
  analista_plataforma: { dashboard: 'read', vendas: false, cadastro: false, monitoramento: true, eventos: false, financeiro: false, cobranca: false, assistencia: false, relatorios: false, configuracoes: false },
  instalador_vistoriador: { dashboard: false, vendas: false, cadastro: false, monitoramento: 'own', eventos: false, financeiro: false, cobranca: false, assistencia: false, relatorios: false, configuracoes: false },
  analista_marketing: { dashboard: 'read', vendas: 'read', cadastro: false, monitoramento: false, eventos: false, financeiro: false, cobranca: false, assistencia: false, relatorios: 'read', configuracoes: false },
  analista_juridico: { dashboard: 'read', vendas: false, cadastro: 'read', monitoramento: false, eventos: 'read', financeiro: false, cobranca: false, assistencia: false, relatorios: 'read', configuracoes: false },
  associado: { dashboard: false, vendas: false, cadastro: false, monitoramento: false, eventos: false, financeiro: false, cobranca: false, assistencia: false, relatorios: false, configuracoes: false },
};

const Cell = ({ value }: { value: PermValue }) => {
  if (value === true) return <Check className="w-4 h-4 text-green-500" />;
  if (value === 'read') return <span className="text-xs font-medium text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">R</span>;
  if (value === 'own') return <span className="text-xs font-medium text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">P</span>;
  return <X className="w-4 h-4 text-muted-foreground/30" />;
};

export default function Perfis() {
  const { canManagePermissions, canApprovePermissionChanges, isDesenvolvedor, isDiretor } = usePermissions();
  const { contagemPorPerfil, useUsuariosPorPerfil } = usePerfilUsuarios();
  
  const [activeTab, setActiveTab] = useState('perfis');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedAreas, setExpandedAreas] = useState<Record<string, boolean>>({
    'Diretoria': true,
    'Comercial': true,
    'Cadastro': false,
    'Monitoramento': false,
    'Marketing': false,
    'Jurídico': false,
    'App': false,
  });
  const [selectedPerfil, setSelectedPerfil] = useState<Perfil | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showMatriz, setShowMatriz] = useState(false);
  
  // Estado para edição de permissões
  const [matriz, setMatriz] = useState(matrizInicial);
  const [editedPermissions, setEditedPermissions] = useState<Record<string, Record<string, PermValue>>>({});
  const [hasChanges, setHasChanges] = useState(false);

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

  // Handler para alterar permissão na matriz
  const handlePermissionChange = useCallback((perfilId: string, moduloId: string, newValue: PermValue) => {
    if (!canManagePermissions) return;
    
    setEditedPermissions(prev => ({
      ...prev,
      [perfilId]: {
        ...prev[perfilId],
        [moduloId]: newValue
      }
    }));
    setHasChanges(true);
  }, [canManagePermissions]);

  // Handler para salvar alterações
  const handleSaveChanges = useCallback(() => {
    // Aplicar alterações na matriz
    setMatriz(prev => {
      const updated = { ...prev };
      Object.entries(editedPermissions).forEach(([perfilId, modulos]) => {
        if (!updated[perfilId]) updated[perfilId] = {};
        Object.entries(modulos).forEach(([moduloId, value]) => {
          updated[perfilId][moduloId] = value;
        });
      });
      return updated;
    });

    // Limpar estado de edição
    setEditedPermissions({});
    setHasChanges(false);

    // Feedback
    if (isDesenvolvedor || isDiretor) {
      toast.success('Permissões atualizadas com sucesso!');
    } else {
      toast.success('Solicitação de alteração enviada para aprovação!');
    }
  }, [editedPermissions, isDesenvolvedor, isDiretor]);

  // Handler para descartar alterações
  const handleDiscardChanges = useCallback(() => {
    setEditedPermissions({});
    setHasChanges(false);
    toast.info('Alterações descartadas');
  }, []);

  // Obter valor atual (editado ou original)
  const getPermValue = useCallback((perfilId: string, moduloId: string): PermValue => {
    return editedPermissions[perfilId]?.[moduloId] ?? matriz[perfilId]?.[moduloId] ?? false;
  }, [editedPermissions, matriz]);

  // Verificar se célula foi editada
  const isCellEdited = useCallback((perfilId: string, moduloId: string): boolean => {
    return editedPermissions[perfilId]?.[moduloId] !== undefined;
  }, [editedPermissions]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Perfis e Permissões</h1>
          <p className="text-sm text-muted-foreground">Gerencie perfis de acesso e suas permissões</p>
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

        {/* ABA PERFIS - NOVO DESIGN */}
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
                <span className="hidden sm:inline">Matriz</span>
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

          {/* Matriz de Permissões (toggle) */}
          {showMatriz && (
            <Card className="border-border/50">
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <CardTitle className="text-base">Matriz de Permissões</CardTitle>
                  <div className="flex flex-wrap items-center gap-4">
                    {/* Legenda */}
                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-green-500" />
                        <span className="text-muted-foreground">Total</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-blue-400 bg-blue-500/10 px-1 rounded text-[10px] font-medium">R</span>
                        <span className="text-muted-foreground">Leitura</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-amber-400 bg-amber-500/10 px-1 rounded text-[10px] font-medium">P</span>
                        <span className="text-muted-foreground">Próprios</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <X className="w-3.5 h-3.5 text-muted-foreground/30" />
                        <span className="text-muted-foreground">Sem acesso</span>
                      </div>
                    </div>
                    {/* Botões de salvar/descartar */}
                    {canManagePermissions && hasChanges && (
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={handleDiscardChanges}>
                          Descartar
                        </Button>
                        <Button size="sm" onClick={handleSaveChanges} className="gap-1.5">
                          <Save className="w-3.5 h-3.5" />
                          Salvar
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                {canManagePermissions && (
                  <p className="text-xs text-muted-foreground mt-2">
                    <Pencil className="w-3 h-3 inline mr-1" />
                    Clique em qualquer célula para alterar a permissão
                  </p>
                )}
              </CardHeader>
              <CardContent className="p-0">
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
                              const currentValue = getPermValue(p.id, m.id);
                              const isEdited = isCellEdited(p.id, m.id);
                              
                              return (
                                <td key={p.id} className="p-2 text-center">
                                  {canManagePermissions ? (
                                    <div className={cn(
                                      "flex justify-center rounded-md p-1 transition-all",
                                      isEdited && "bg-amber-500/10 ring-1 ring-amber-500/30"
                                    )}>
                                      <PermissionSelect
                                        value={currentValue}
                                        onChange={(newValue) => handlePermissionChange(p.id, m.id, newValue)}
                                      />
                                    </div>
                                  ) : (
                                    <div className="flex justify-center">
                                      <Cell value={currentValue} />
                                    </div>
                                  )}
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
              </CardContent>
            </Card>
          )}

          {/* Info Card */}
          <Card className="border-border/50 bg-primary/5 border-primary/20">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-foreground">Como funciona</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Clique em qualquer perfil para ver detalhes e usuários. 
                    <strong className="text-foreground"> Desenvolvedor</strong>, <strong className="text-foreground">Diretor</strong> e <strong className="text-foreground">Admin Master</strong> podem gerenciar permissões.
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
        matriz={matriz}
        usuarios={usuariosDoPerfil.map(u => ({ id: u.id, nome: u.nome || '', email: u.email || '' }))}
        onPermissionChange={handlePermissionChange}
      />
    </div>
  );
}
