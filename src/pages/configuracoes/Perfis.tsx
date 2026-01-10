import { useState } from 'react';
import { Check, X, Info, Plus, Clock, Shield, Code, Crown, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';
import { GerenciarRolesTab } from '@/components/configuracoes/GerenciarRolesTab';
import { SolicitacoesTab } from '@/components/configuracoes/SolicitacoesTab';

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

// 14 perfis do sistema (12 existentes + desenvolvedor + admin_master)
const perfis = [
  // DIRETORIA
  { id: 'desenvolvedor', label: 'Desenvolvedor', sigla: 'Dev', color: 'bg-violet-500', area: 'Diretoria' },
  { id: 'diretor', label: 'Diretor', sigla: 'Dir', color: 'bg-purple-500', area: 'Diretoria' },
  { id: 'admin_master', label: 'Admin Master', sigla: 'Adm', color: 'bg-purple-400', area: 'Diretoria' },
  // COMERCIAL
  { id: 'gerente_comercial', label: 'Gerente Comercial', sigla: 'GerC', color: 'bg-blue-500', area: 'Comercial' },
  { id: 'supervisor_vendas', label: 'Supervisor Vendas', sigla: 'SupV', color: 'bg-cyan-500', area: 'Comercial' },
  { id: 'vendedor_clt', label: 'Vendedor CLT', sigla: 'VdC', color: 'bg-green-500', area: 'Comercial' },
  { id: 'vendedor_externo', label: 'Vendedor Externo', sigla: 'VdE', color: 'bg-green-400', area: 'Comercial' },
  // OPERACIONAL
  { id: 'analista_cadastro', label: 'Analista Cadastro', sigla: 'AnCad', color: 'bg-orange-500', area: 'Cadastro' },
  { id: 'coordenador_monitoramento', label: 'Coord. Monitoramento', sigla: 'CrdM', color: 'bg-teal-500', area: 'Monitoramento' },
  { id: 'analista_plataforma', label: 'Analista Plataforma', sigla: 'AnPlt', color: 'bg-teal-400', area: 'Monitoramento' },
  { id: 'instalador_vistoriador', label: 'Instalador/Vistoriador', sigla: 'Inst', color: 'bg-pink-500', area: 'Monitoramento' },
  // OUTROS
  { id: 'analista_marketing', label: 'Analista Marketing', sigla: 'AnMkt', color: 'bg-rose-500', area: 'Marketing' },
  { id: 'analista_juridico', label: 'Analista Jurídico', sigla: 'AnJur', color: 'bg-gray-500', area: 'Jurídico' },
  // APP
  { id: 'associado', label: 'Associado', sigla: 'Assoc', color: 'bg-slate-500', area: 'App' },
];

type PermValue = boolean | 'read' | 'own';

// Matriz de permissões atualizada com todos os 14 perfis
const matriz: Record<string, Record<string, PermValue>> = {
  // DIRETORIA - Acesso total
  desenvolvedor: { dashboard: true, vendas: true, cadastro: true, monitoramento: true, eventos: true, financeiro: true, cobranca: true, assistencia: true, relatorios: true, configuracoes: true },
  diretor: { dashboard: true, vendas: true, cadastro: true, monitoramento: true, eventos: true, financeiro: true, cobranca: true, assistencia: true, relatorios: true, configuracoes: true },
  admin_master: { dashboard: true, vendas: true, cadastro: true, monitoramento: true, eventos: true, financeiro: true, cobranca: true, assistencia: true, relatorios: true, configuracoes: true },
  // COMERCIAL
  gerente_comercial: { dashboard: true, vendas: true, cadastro: 'read', monitoramento: 'read', eventos: false, financeiro: 'read', cobranca: false, assistencia: false, relatorios: true, configuracoes: 'read' },
  supervisor_vendas: { dashboard: true, vendas: true, cadastro: 'read', monitoramento: 'read', eventos: false, financeiro: false, cobranca: false, assistencia: false, relatorios: 'read', configuracoes: false },
  vendedor_clt: { dashboard: 'own', vendas: 'own', cadastro: false, monitoramento: false, eventos: false, financeiro: false, cobranca: false, assistencia: false, relatorios: false, configuracoes: false },
  vendedor_externo: { dashboard: 'own', vendas: 'own', cadastro: false, monitoramento: false, eventos: false, financeiro: false, cobranca: false, assistencia: false, relatorios: false, configuracoes: false },
  // OPERACIONAL
  analista_cadastro: { dashboard: 'read', vendas: 'read', cadastro: true, monitoramento: 'read', eventos: false, financeiro: false, cobranca: false, assistencia: false, relatorios: false, configuracoes: false },
  coordenador_monitoramento: { dashboard: true, vendas: 'read', cadastro: 'read', monitoramento: true, eventos: false, financeiro: false, cobranca: false, assistencia: false, relatorios: 'read', configuracoes: false },
  analista_plataforma: { dashboard: 'read', vendas: false, cadastro: false, monitoramento: true, eventos: false, financeiro: false, cobranca: false, assistencia: false, relatorios: false, configuracoes: false },
  instalador_vistoriador: { dashboard: false, vendas: false, cadastro: false, monitoramento: 'own', eventos: false, financeiro: false, cobranca: false, assistencia: false, relatorios: false, configuracoes: false },
  // OUTROS
  analista_marketing: { dashboard: 'read', vendas: 'read', cadastro: false, monitoramento: false, eventos: false, financeiro: false, cobranca: false, assistencia: false, relatorios: 'read', configuracoes: false },
  analista_juridico: { dashboard: 'read', vendas: false, cadastro: 'read', monitoramento: false, eventos: 'read', financeiro: false, cobranca: false, assistencia: false, relatorios: 'read', configuracoes: false },
  // APP
  associado: { dashboard: false, vendas: false, cadastro: false, monitoramento: false, eventos: false, financeiro: false, cobranca: false, assistencia: false, relatorios: false, configuracoes: false },
};

const Cell = ({ value }: { value: PermValue }) => {
  if (value === true) return <Check className="w-4 h-4 text-green-500" />;
  if (value === 'read') return <span className="text-xs font-medium text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">R</span>;
  if (value === 'own') return <span className="text-xs font-medium text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">P</span>;
  return <X className="w-4 h-4 text-muted-foreground/30" />;
};

// Componente de área (agrupamento visual)
const AreaBadge = ({ area }: { area: string }) => {
  const colors: Record<string, string> = {
    'Diretoria': 'bg-purple-500/20 text-purple-400',
    'Comercial': 'bg-blue-500/20 text-blue-400',
    'Cadastro': 'bg-orange-500/20 text-orange-400',
    'Monitoramento': 'bg-teal-500/20 text-teal-400',
    'Marketing': 'bg-rose-500/20 text-rose-400',
    'Jurídico': 'bg-gray-500/20 text-gray-400',
    'App': 'bg-slate-500/20 text-slate-400',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${colors[area] || 'bg-muted text-muted-foreground'}`}>
      {area}
    </span>
  );
};

export default function Perfis() {
  const { canManagePermissions, canApprovePermissionChanges } = usePermissions();
  const [activeTab, setActiveTab] = useState('matriz');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Perfis e Permissões</h1>
        <p className="text-sm text-muted-foreground">Gerencie perfis, permissões e solicitações de acesso</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="matriz" className="gap-2">
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">Matriz</span>
          </TabsTrigger>
          {canManagePermissions && (
            <TabsTrigger value="roles" className="gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Gerenciar Roles</span>
            </TabsTrigger>
          )}
          {canApprovePermissionChanges && (
            <TabsTrigger value="solicitacoes" className="gap-2">
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">Solicitações</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* ABA 1: MATRIZ DE PERMISSÕES */}
        <TabsContent value="matriz" className="space-y-6">
          {/* Legenda */}
          <Card className="border-border/50">
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">Acesso total</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">R</span>
                  <span className="text-sm text-muted-foreground">Somente leitura</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">P</span>
                  <span className="text-sm text-muted-foreground">Apenas próprios registros</span>
                </div>
                <div className="flex items-center gap-2">
                  <X className="w-4 h-4 text-muted-foreground/30" />
                  <span className="text-sm text-muted-foreground">Sem acesso</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Matriz */}
          <Card className="border-border/50">
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
                                <TooltipTrigger>
                                  <div className="flex flex-col items-center gap-1">
                                    <div className={`w-3 h-3 rounded-full ${p.color}`} />
                                    <span className="text-[10px] font-medium text-foreground">
                                      {p.sigla}
                                    </span>
                                  </div>
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
                          className={`border-b border-border/50 ${idx % 2 === 0 ? 'bg-muted/20' : ''}`}
                        >
                          <td className="p-4 font-medium text-foreground sticky left-0 bg-inherit z-10">
                            {m.label}
                          </td>
                          {perfis.map((p) => (
                            <td key={p.id} className="p-3 text-center">
                              <div className="flex justify-center">
                                <Cell value={matriz[p.id]?.[m.id] ?? false} />
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="border-border/50 bg-blue-500/5 border-blue-500/20">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-foreground">Sobre os perfis</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Esta matriz mostra as permissões padrão de cada perfil. 
                    <strong className="text-foreground"> Desenvolvedor</strong>, <strong className="text-foreground">Diretor</strong> e <strong className="text-foreground">Admin Master</strong> podem gerenciar permissões e roles na aba "Gerenciar Roles".
                    O <strong className="text-foreground">Admin Master</strong> precisa de aprovação de um Diretor para alterações sensíveis.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card de perfis por área */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Perfis por Área</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {['Diretoria', 'Comercial', 'Cadastro', 'Monitoramento', 'Marketing', 'Jurídico', 'App'].map(area => {
                  const areaPerfis = perfis.filter(p => p.area === area);
                  if (areaPerfis.length === 0) return null;
                  return (
                    <div key={area} className="space-y-2">
                      <AreaBadge area={area} />
                      <div className="flex flex-wrap gap-1">
                        {areaPerfis.map(p => (
                          <Badge key={p.id} variant="outline" className="text-xs gap-1">
                            <div className={`w-2 h-2 rounded-full ${p.color}`} />
                            {p.sigla}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 2: GERENCIAR ROLES */}
        {canManagePermissions && (
          <TabsContent value="roles">
            <GerenciarRolesTab perfis={perfis} />
          </TabsContent>
        )}

        {/* ABA 3: SOLICITAÇÕES PENDENTES */}
        {canApprovePermissionChanges && (
          <TabsContent value="solicitacoes">
            <SolicitacoesTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
