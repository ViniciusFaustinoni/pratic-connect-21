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

// Sub-itens de cada módulo
const MODULE_ITEMS: Record<string, { id: string; label: string }[]> = {
  vendas: [
    { id: 'leads', label: 'Leads' },
    { id: 'cotacoes', label: 'Cotação' },
    { id: 'propostas', label: 'Propostas' },
    { id: 'ativacoes', label: 'Ativações' },
    { id: 'consultores', label: 'Consultores' },
    { id: 'planos', label: 'Planos e Benefícios' },
  ],
  cadastro: [
    { id: 'propostas_pendentes', label: 'Propostas Pendentes' },
    { id: 'associados', label: 'Associados' },
    { id: 'veiculos', label: 'Veículos' },
    { id: 'substituicoes', label: 'Substituições' },
  ],
  monitoramento: [
    { id: 'equipe', label: 'Equipe' },
    { id: 'instalacoes', label: 'Instalações' },
    { id: 'vistorias', label: 'Vistorias' },
    { id: 'retiradas', label: 'Retiradas' },
    { id: 'calendario', label: 'Calendário' },
    { id: 'estoque', label: 'Estoque' },
    { id: 'rastreadores', label: 'Rastreadores' },
    { id: 'mapa', label: 'Mapa' },
    { id: 'alertas', label: 'Alertas' },
  ],
  eventos: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'sinistros', label: 'Sinistros' },
    { id: 'pre_analise', label: 'Pré-Análise' },
    { id: 'sla', label: 'SLA' },
    { id: 'sindicancias', label: 'Sindicâncias' },
    { id: 'sindicantes', label: 'Sindicantes' },
    { id: 'solicitacoes_ia', label: 'Solicitações IA' },
  ],
  assistencia: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'chamados', label: 'Fila de Chamados' },
    { id: 'prestadores', label: 'Prestadores' },
  ],
  oficinas: [
    { id: 'oficinas', label: 'Oficinas' },
    { id: 'auto_centers', label: 'Auto Centers' },
    { id: 'ordens_servico', label: 'Ordens de Serviço' },
    { id: 'relatorios', label: 'Relatórios' },
  ],
  financeiro: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'cobrancas', label: 'Cobranças' },
    { id: 'contas_pagar', label: 'Contas a Pagar' },
    { id: 'faturamento', label: 'Faturamento' },
    { id: 'extrato', label: 'Extrato' },
    { id: 'extratos_bancarios', label: 'Extratos Bancários' },
    { id: 'contas_bancarias', label: 'Contas Bancárias' },
  ],
  cobranca: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'inadimplentes', label: 'Inadimplentes' },
    { id: 'fila', label: 'Fila de Trabalho' },
    { id: 'acordos', label: 'Acordos' },
    { id: 'negativacao', label: 'Negativação' },
    { id: 'regua', label: 'Régua' },
  ],
  contabilidade: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'plano_contas', label: 'Plano de Contas' },
    { id: 'lancamentos', label: 'Lançamentos' },
    { id: 'balancete', label: 'Balancete' },
    { id: 'balanco_patrimonial', label: 'Balanço Patrimonial' },
    { id: 'dre', label: 'DRE' },
    { id: 'fechamento', label: 'Fechamento' },
  ],
  juridico: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'casos', label: 'Casos' },
    { id: 'processos', label: 'Processos' },
    { id: 'advogados', label: 'Advogados' },
    { id: 'prazos', label: 'Prazos' },
    { id: 'audiencias', label: 'Audiências' },
    { id: 'consultas', label: 'Consultas 360' },
    { id: 'pareceres', label: 'Pareceres' },
  ],
  rh: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'funcionarios', label: 'Funcionários' },
    { id: 'jornadas', label: 'Jornadas' },
    { id: 'folha_pagamento', label: 'Folha de Pagamento' },
    { id: 'ponto', label: 'Ponto' },
    { id: 'ferias', label: 'Férias' },
    { id: 'organograma', label: 'Organograma' },
    { id: 'departamentos', label: 'Departamentos' },
    { id: 'beneficios', label: 'Benefícios' },
  ],
  marketing: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'campanhas', label: 'Campanhas' },
    { id: 'canais', label: 'Canais' },
    { id: 'indicacoes', label: 'Indicações' },
    { id: 'utms', label: 'UTMs' },
    { id: 'distribuicao', label: 'Distribuição' },
    { id: 'relatorios', label: 'Relatórios' },
  ],
  ouvidoria: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'fila', label: 'Fila' },
  ],
  diretoria: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'produtos', label: 'Produtos' },
    { id: 'planos_beneficios', label: 'Planos/Benefícios' },
    { id: 'precos', label: 'Tabela de Preços' },
    { id: 'rateio', label: 'Rateio' },
    { id: 'atuarial', label: 'Atuarial' },
    { id: 'blacklist', label: 'Blacklist' },
    { id: 'configuracoes', label: 'Configurações' },
    { id: 'perfis', label: 'Perfis' },
    { id: 'logs', label: 'Logs' },
    { id: 'relatorios', label: 'Relatórios' },
  ],
  documentos: [
    { id: 'gerar', label: 'Gerar Documento' },
    { id: 'historico', label: 'Histórico' },
    { id: 'templates', label: 'Templates' },
    { id: 'aditivos', label: 'Aditivos' },
  ],
};

// Perfis do sistema com descrições
const perfis: Perfil[] = [
  { id: 'desenvolvedor', label: 'Desenvolvedor', sigla: 'Dev', color: 'bg-violet-500', area: 'Diretoria', descricao: 'Acesso total ao sistema, incluindo configurações técnicas e debug' },
  { id: 'diretor', label: 'Diretor', sigla: 'Dir', color: 'bg-purple-500', area: 'Diretoria', descricao: 'Acesso total ao sistema, aprova alterações de permissão' },
  { id: 'admin_master', label: 'Admin Master', sigla: 'Adm', color: 'bg-purple-400', area: 'Diretoria', descricao: 'Gerencia permissões e usuários (alterações requerem aprovação)' },
  { id: 'gerente_comercial', label: 'Gerente Comercial', sigla: 'GerC', color: 'bg-blue-500', area: 'Comercial', descricao: 'Gestão completa da equipe comercial e metas' },
  { id: 'supervisor_vendas', label: 'Supervisor Vendas', sigla: 'SupV', color: 'bg-cyan-500', area: 'Comercial', descricao: 'Supervisiona vendedores e acompanha desempenho' },
  { id: 'vendedor_clt', label: 'Vendedor CLT', sigla: 'VdC', color: 'bg-green-500', area: 'Comercial', descricao: 'Vendas internas com acesso aos próprios registros' },
  { id: 'vendedor_externo', label: 'Vendedor Externo', sigla: 'VdE', color: 'bg-green-400', area: 'Comercial', descricao: 'Vendas externas com acesso aos próprios registros' },
  { id: 'agencia', label: 'Agência', sigla: 'Ag', color: 'bg-green-300', area: 'Comercial', descricao: 'Agência parceira com acesso a vendas' },
  { id: 'analista_cadastro', label: 'Analista Cadastro', sigla: 'AnCad', color: 'bg-orange-500', area: 'Cadastro', descricao: 'Gerencia cadastros de associados e veículos' },
  { id: 'coordenador_monitoramento', label: 'Coord. Monitoramento', sigla: 'CrdM', color: 'bg-teal-500', area: 'Monitoramento', descricao: 'Coordena equipe de monitoramento e instalações' },
  { id: 'analista_plataforma', label: 'Analista Plataforma', sigla: 'AnPlt', color: 'bg-teal-400', area: 'Monitoramento', descricao: 'Monitora rastreadores e alertas em tempo real' },
  { id: 'instalador_vistoriador', label: 'Instalador/Vistoriador', sigla: 'Inst', color: 'bg-pink-500', area: 'Monitoramento', descricao: 'Realiza instalações e vistorias em campo' },
  { id: 'vistoriador_base', label: 'Vistoriador Base', sigla: 'VBase', color: 'bg-pink-400', area: 'Monitoramento', descricao: 'Realiza vistorias na base' },
  { id: 'analista_eventos', label: 'Analista Eventos', sigla: 'AnEv', color: 'bg-red-500', area: 'Eventos', descricao: 'Gerencia eventos e sinistros' },
  { id: 'regulador', label: 'Regulador', sigla: 'Reg', color: 'bg-red-400', area: 'Eventos', descricao: 'Regulação de sinistros em campo' },
  { id: 'sindicante', label: 'Sindicante', sigla: 'Sind', color: 'bg-red-300', area: 'Eventos', descricao: 'Realiza sindicâncias em campo' },
  { id: 'analista_marketing', label: 'Analista Marketing', sigla: 'AnMkt', color: 'bg-rose-500', area: 'Marketing', descricao: 'Gerencia campanhas e leads de marketing' },
  { id: 'analista_juridico', label: 'Analista Jurídico', sigla: 'AnJur', color: 'bg-gray-500', area: 'Jurídico', descricao: 'Acompanha processos e consultas jurídicas' },
  { id: 'advogado', label: 'Advogado', sigla: 'Adv', color: 'bg-blue-800', area: 'Jurídico', descricao: 'Advogado com acesso ao módulo jurídico' },
  { id: 'associado', label: 'Associado', sigla: 'Assoc', color: 'bg-slate-500', area: 'App', descricao: 'Acesso ao aplicativo do associado' },
];

const areaConfig: Record<string, { icon: typeof Crown; gradient: string; borderColor: string }> = {
  'Diretoria': { icon: Crown, gradient: 'from-purple-500/10 via-purple-500/5 to-transparent', borderColor: 'border-l-purple-500' },
  'Comercial': { icon: Briefcase, gradient: 'from-blue-500/10 via-blue-500/5 to-transparent', borderColor: 'border-l-blue-500' },
  'Cadastro': { icon: FileText, gradient: 'from-orange-500/10 via-orange-500/5 to-transparent', borderColor: 'border-l-orange-500' },
  'Monitoramento': { icon: Radio, gradient: 'from-teal-500/10 via-teal-500/5 to-transparent', borderColor: 'border-l-teal-500' },
  'Eventos': { icon: Shield, gradient: 'from-red-500/10 via-red-500/5 to-transparent', borderColor: 'border-l-red-500' },
  'Marketing': { icon: Megaphone, gradient: 'from-rose-500/10 via-rose-500/5 to-transparent', borderColor: 'border-l-rose-500' },
  'Jurídico': { icon: Scale, gradient: 'from-gray-500/10 via-gray-500/5 to-transparent', borderColor: 'border-l-gray-500' },
  'App': { icon: Smartphone, gradient: 'from-slate-500/10 via-slate-500/5 to-transparent', borderColor: 'border-l-slate-500' },
};

const areas = ['Diretoria', 'Comercial', 'Cadastro', 'Monitoramento', 'Eventos', 'Marketing', 'Jurídico', 'App'];

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

// Tipo de usuário para a matriz
interface MatrixUser {
  id: string; // profile id (= user_id for our tables)
  nome: string;
  email: string;
}

export default function Perfis() {
  const { canManagePermissions, canApprovePermissionChanges } = usePermissions();
  const { contagemPorPerfil, useUsuariosPorPerfil } = usePerfilUsuarios();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState('perfis');
  const [searchTerm, setSearchTerm] = useState('');
  const [matrixUserSearch, setMatrixUserSearch] = useState('');
  const [expandedAreas, setExpandedAreas] = useState<Record<string, boolean>>({
    'Diretoria': true, 'Comercial': true, 'Cadastro': false,
    'Monitoramento': false, 'Eventos': false, 'Marketing': false,
    'Jurídico': false, 'App': false,
  });
  const [selectedPerfil, setSelectedPerfil] = useState<Perfil | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showMatriz, setShowMatriz] = useState(false);
  
  // Estado para edição de visibilidade por usuário
  const [editedVisibility, setEditedVisibility] = useState<Record<string, Record<string, boolean>>>({});
  const [editedCanEdit, setEditedCanEdit] = useState<Record<string, Record<string, boolean>>>({});
  const [editedItemVisibility, setEditedItemVisibility] = useState<Record<string, Record<string, Record<string, boolean>>>>({});
  const [expandedModules, setExpandedModules] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Buscar lista de usuários para a matriz
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

  // Filtrar usuários por busca
  const filteredMatrixUsers = useMemo(() => {
    if (!matrixUserSearch) return matrixUsers;
    const term = matrixUserSearch.toLowerCase();
    return matrixUsers.filter(u => 
      u.nome?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term)
    );
  }, [matrixUsers, matrixUserSearch]);

  // Busca dados de visibilidade por usuário do banco
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

  // Busca dados de visibilidade de itens por usuário
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

  // Converter dados do banco para mapas indexados por user_id
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

  const perfisPorArea = useMemo(() => {
    const grouped: Record<string, Perfil[]> = {};
    areas.forEach(area => { grouped[area] = perfisFiltrados.filter(p => p.area === area); });
    return grouped;
  }, [perfisFiltrados]);

  const toggleArea = (area: string) => {
    setExpandedAreas(prev => ({ ...prev, [area]: !prev[area] }));
  };

  const toggleAll = () => {
    const allExpanded = Object.values(expandedAreas).every(v => v);
    setExpandedAreas(Object.keys(expandedAreas).reduce((acc, key) => ({ ...acc, [key]: !allExpanded }), {}));
  };

  const allExpanded = Object.values(expandedAreas).every(v => v);

  const handlePerfilClick = (perfil: Perfil) => {
    setSelectedPerfil(perfil);
    setSheetOpen(true);
  };

  // Handlers para edição de visibilidade (agora indexados por userId)
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

  // Salvar alterações no banco (agora para user_module_visibility)
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

      // Upsert item visibility
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

  // Obter valor atual (editado ou do banco) — agora por userId
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

  // Criar uma matriz simplificada para o PerfilSheet (compatibilidade)
  const matrizForSheet = useMemo(() => {
    const result: Record<string, Record<string, boolean | 'read' | 'own'>> = {};
    perfis.forEach(p => {
      result[p.id] = {};
      modulos.forEach(m => { result[p.id][m.id] = false; });
    });
    return result;
  }, []);

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
                {/* Busca de usuários na matriz */}
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
                          {modulos.map((m, idx) => {
                            const hasSubItems = MODULE_ITEMS[m.id] && MODULE_ITEMS[m.id].length > 0;
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
                                {isExpanded && hasSubItems && MODULE_ITEMS[m.id].map((item) => (
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
        onPermissionChange={() => {}}
      />
    </div>
  );
}
