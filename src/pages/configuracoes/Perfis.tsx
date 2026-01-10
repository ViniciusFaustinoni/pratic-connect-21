import { Check, X, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

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

const perfis = [
  { id: 'diretor', label: 'Diretor', color: 'bg-purple-500' },
  { id: 'gerente_comercial', label: 'Ger. Comercial', color: 'bg-blue-500' },
  { id: 'supervisor_vendas', label: 'Supervisor', color: 'bg-cyan-500' },
  { id: 'vendedor_clt', label: 'Vendedor CLT', color: 'bg-green-500' },
  { id: 'analista_cadastro', label: 'Analista Cad.', color: 'bg-yellow-500' },
  { id: 'coordenador_monitoramento', label: 'Coord. Monit.', color: 'bg-orange-500' },
  { id: 'analista_plataforma', label: 'Analista Plat.', color: 'bg-pink-500' },
  { id: 'instalador_vistoriador', label: 'Instalador', color: 'bg-rose-500' },
];

type PermValue = boolean | 'read' | 'own';

const matriz: Record<string, Record<string, PermValue>> = {
  diretor: { dashboard: true, vendas: true, cadastro: true, monitoramento: true, eventos: true, financeiro: true, cobranca: true, assistencia: true, relatorios: true, configuracoes: true },
  gerente_comercial: { dashboard: true, vendas: true, cadastro: 'read', monitoramento: 'read', eventos: false, financeiro: 'read', cobranca: false, assistencia: false, relatorios: true, configuracoes: 'read' },
  supervisor_vendas: { dashboard: true, vendas: true, cadastro: 'read', monitoramento: 'read', eventos: false, financeiro: false, cobranca: false, assistencia: false, relatorios: 'read', configuracoes: false },
  vendedor_clt: { dashboard: 'own', vendas: 'own', cadastro: false, monitoramento: false, eventos: false, financeiro: false, cobranca: false, assistencia: false, relatorios: false, configuracoes: false },
  analista_cadastro: { dashboard: 'read', vendas: 'read', cadastro: true, monitoramento: 'read', eventos: false, financeiro: false, cobranca: false, assistencia: false, relatorios: false, configuracoes: false },
  coordenador_monitoramento: { dashboard: true, vendas: 'read', cadastro: 'read', monitoramento: true, eventos: false, financeiro: false, cobranca: false, assistencia: false, relatorios: 'read', configuracoes: false },
  analista_plataforma: { dashboard: 'read', vendas: false, cadastro: false, monitoramento: true, eventos: false, financeiro: false, cobranca: false, assistencia: false, relatorios: false, configuracoes: false },
  instalador_vistoriador: { dashboard: false, vendas: false, cadastro: false, monitoramento: 'own', eventos: false, financeiro: false, cobranca: false, assistencia: false, relatorios: false, configuracoes: false },
};

const Cell = ({ value }: { value: PermValue }) => {
  if (value === true) return <Check className="w-4 h-4 text-green-500" />;
  if (value === 'read') return <span className="text-xs font-medium text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">R</span>;
  if (value === 'own') return <span className="text-xs font-medium text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">P</span>;
  return <X className="w-4 h-4 text-muted-foreground/30" />;
};

export default function Perfis() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Perfis e Permissões</h1>
        <p className="text-sm text-muted-foreground">Matriz de permissões por perfil</p>
      </div>

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
            <div className="min-w-[800px]">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left p-4 font-medium text-muted-foreground sticky left-0 bg-card z-10">
                      Módulo
                    </th>
                    {perfis.map((p) => (
                      <th key={p.id} className="p-4 text-center min-w-[100px]">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <div className="flex flex-col items-center gap-1">
                                <div className={`w-3 h-3 rounded-full ${p.color}`} />
                                <span className="text-xs font-medium text-foreground">
                                  {p.label.split(' ')[0]}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{p.label}</p>
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
                        <td key={p.id} className="p-4 text-center">
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
            <Info className="w-5 h-5 text-blue-400 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Sobre os perfis</p>
              <p className="text-sm text-muted-foreground mt-1">
                Esta matriz é informativa. As permissões são gerenciadas automaticamente com base nos perfis atribuídos a cada usuário.
                Para alterar os perfis de um usuário, acesse a página de edição do usuário.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
