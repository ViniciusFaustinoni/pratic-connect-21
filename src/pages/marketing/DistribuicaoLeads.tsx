import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Users, Settings, Edit, AlertTriangle, 
  ArrowRight, Shuffle, MapPin, BarChart3 
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

interface DistribuicaoVendedor {
  id: string;
  vendedor_id: string;
  vendedor?: { id: string; nome: string; email: string } | null;
  max_leads_dia?: number;
  max_leads_mes?: number;
  leads_recebidos_hoje?: number;
  leads_recebidos_mes?: number;
  taxa_conversao?: number;
  recebendo_leads: boolean;
  regioes?: string[];
  canais?: string[];
}

export default function DistribuicaoLeads() {
  const queryClient = useQueryClient();
  const [editingVendedor, setEditingVendedor] = useState<DistribuicaoVendedor | null>(null);
  const [maxDia, setMaxDia] = useState('');
  const [maxMes, setMaxMes] = useState('');
  const [regioes, setRegioes] = useState('');
  const [canais, setCanais] = useState('');

  // Query: Configuração de distribuição
  const { data: config, isLoading: loadingConfig } = useQuery({
    queryKey: ['distribuicao-config'],
    queryFn: async () => {
      const { data } = await supabase
        .from('distribuicao_leads_config')
        .select('*')
        .maybeSingle();
      return data;
    }
  });

  // Query: Vendedores com limites
  const { data: vendedores, isLoading: loadingVendedores } = useQuery({
    queryKey: ['distribuicao-vendedores'],
    queryFn: async () => {
      const { data } = await supabase
        .from('distribuicao_leads_vendedores')
        .select('*, vendedor:profiles!vendedor_id(id, nome, email)')
        .order('created_at');
      return data as DistribuicaoVendedor[];
    }
  });

  // Query: Estatísticas do dia
  const { data: stats } = useQuery({
    queryKey: ['distribuicao-stats'],
    queryFn: async () => {
      const hoje = new Date().toISOString().split('T')[0];
      const [distribuidos, semVendedor] = await Promise.all([
        supabase.from('leads').select('*', { count: 'exact', head: true })
          .not('vendedor_id', 'is', null)
          .gte('created_at', `${hoje}T00:00:00`),
        supabase.from('leads').select('*', { count: 'exact', head: true })
          .is('vendedor_id', null)
      ]);
      return {
        distribuidosHoje: distribuidos.count || 0,
        semVendedor: semVendedor.count || 0
      };
    }
  });

  // Mutation: Atualizar tipo de distribuição
  const updateConfig = useMutation({
    mutationFn: async (tipo: string) => {
      if (config?.id) {
        await supabase
          .from('distribuicao_leads_config')
          .update({ tipo, updated_at: new Date().toISOString() })
          .eq('id', config.id);
      } else {
        await supabase
          .from('distribuicao_leads_config')
          .insert({ tipo });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distribuicao-config'] });
      toast.success('Configuração atualizada!');
    }
  });

  // Mutation: Toggle recebendo leads
  const toggleRecebendo = useMutation({
    mutationFn: async ({ id, recebendo }: { id: string; recebendo: boolean }) => {
      await supabase
        .from('distribuicao_leads_vendedores')
        .update({ recebendo_leads: recebendo, updated_at: new Date().toISOString() })
        .eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distribuicao-vendedores'] });
      toast.success('Status atualizado!');
    }
  });

  // Mutation: Atualizar limites
  const updateLimites = useMutation({
    mutationFn: async (data: { id: string; max_leads_dia?: number; max_leads_mes?: number; regioes?: string[]; canais?: string[] }) => {
      await supabase
        .from('distribuicao_leads_vendedores')
        .update({ 
          ...data, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', data.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distribuicao-vendedores'] });
      toast.success('Limites atualizados!');
      setEditingVendedor(null);
    }
  });

  const handleEditVendedor = (vendedor: DistribuicaoVendedor) => {
    setEditingVendedor(vendedor);
    setMaxDia(vendedor.max_leads_dia?.toString() || '');
    setMaxMes(vendedor.max_leads_mes?.toString() || '');
    setRegioes(vendedor.regioes?.join(', ') || '');
    setCanais(vendedor.canais?.join(', ') || '');
  };

  const handleSalvarLimites = () => {
    if (!editingVendedor) return;
    
    updateLimites.mutate({
      id: editingVendedor.id,
      max_leads_dia: maxDia ? parseInt(maxDia) : undefined,
      max_leads_mes: maxMes ? parseInt(maxMes) : undefined,
      regioes: regioes ? regioes.split(',').map(r => r.trim()) : undefined,
      canais: canais ? canais.split(',').map(c => c.trim()) : undefined,
    });
  };

  const tipoDistribuicaoLabels: Record<string, { label: string; icon: any; desc: string }> = {
    round_robin: { label: 'Round Robin (Rotativo)', icon: Shuffle, desc: 'Distribui leads alternadamente entre os vendedores' },
    por_regiao: { label: 'Por Região', icon: MapPin, desc: 'Distribui leads baseado na região do cliente' },
    por_canal: { label: 'Por Canal', icon: Settings, desc: 'Distribui leads baseado no canal de origem' },
    por_performance: { label: 'Por Performance', icon: BarChart3, desc: 'Prioriza vendedores com melhor taxa de conversão' },
    manual: { label: 'Manual', icon: Users, desc: 'Leads precisam ser atribuídos manualmente' },
  };

  const proximoVendedor = vendedores?.filter(v => v.recebendo_leads)?.[config?.proximo_vendedor || 0];

  const isLoading = loadingConfig || loadingVendedores;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Distribuição de Leads</h1>
          <p className="text-muted-foreground">
            Configure como os leads são distribuídos entre os vendedores
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-64" />
        </div>
      ) : (
        <>
          {/* Card Configuração */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Tipo de Distribuição
              </CardTitle>
              <CardDescription>
                Escolha como os leads serão distribuídos automaticamente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select 
                value={config?.tipo || 'round_robin'} 
                onValueChange={(tipo) => updateConfig.mutate(tipo)}
              >
                <SelectTrigger className="w-80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(tipoDistribuicaoLabels).map(([value, { label, desc }]) => (
                    <SelectItem key={value} value={value}>
                      <div>
                        <p className="font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Cards Estatísticas */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Leads Distribuídos Hoje</p>
                    <p className="text-2xl font-bold">{stats?.distribuidosHoje || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className={stats?.semVendedor && stats.semVendedor > 0 ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stats?.semVendedor && stats.semVendedor > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-muted text-muted-foreground'}`}>
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Leads Sem Vendedor</p>
                    <p className="text-2xl font-bold">{stats?.semVendedor || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-700">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Próximo Vendedor</p>
                    <p className="text-lg font-medium truncate">
                      {proximoVendedor?.vendedor?.nome || 'Não definido'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Alerta se houver leads sem vendedor */}
          {stats?.semVendedor && stats.semVendedor > 0 && (
            <Alert variant="destructive" className="border-yellow-300 bg-yellow-50 text-yellow-800 dark:bg-yellow-950/20 dark:text-yellow-200">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Existem {stats.semVendedor} leads sem vendedor atribuído. Verifique se há vendedores disponíveis para receber leads.
              </AlertDescription>
            </Alert>
          )}

          {/* Tabela de Vendedores */}
          <Card>
            <CardHeader>
              <CardTitle>Vendedores</CardTitle>
              <CardDescription>
                Gerencie os limites e configurações de cada vendedor
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {vendedores && vendedores.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-center">Max/Dia</TableHead>
                      <TableHead className="text-center">Recebidos Hoje</TableHead>
                      <TableHead className="text-center">Max/Mês</TableHead>
                      <TableHead className="text-center">Recebidos Mês</TableHead>
                      <TableHead className="text-center">Taxa Conv.</TableHead>
                      <TableHead className="text-center">Recebendo?</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendedores.map(v => {
                      const progressDia = v.max_leads_dia 
                        ? ((v.leads_recebidos_hoje || 0) / v.max_leads_dia) * 100 
                        : 0;
                      const progressMes = v.max_leads_mes 
                        ? ((v.leads_recebidos_mes || 0) / v.max_leads_mes) * 100 
                        : 0;
                      
                      return (
                        <TableRow key={v.id}>
                          <TableCell>
                            <p className="font-medium">{v.vendedor?.nome || 'Sem nome'}</p>
                            <p className="text-xs text-muted-foreground">{v.vendedor?.email}</p>
                          </TableCell>
                          <TableCell className="text-center">
                            {v.max_leads_dia || '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span>{v.leads_recebidos_hoje || 0}</span>
                              {v.max_leads_dia && (
                                <Progress 
                                  value={progressDia} 
                                  className="w-16 h-2"
                                />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {v.max_leads_mes || '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span>{v.leads_recebidos_mes || 0}</span>
                              {v.max_leads_mes && (
                                <Progress 
                                  value={progressMes} 
                                  className="w-16 h-2"
                                />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">
                              {(v.taxa_conversao || 0).toFixed(1)}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={v.recebendo_leads}
                              onCheckedChange={(checked) => toggleRecebendo.mutate({ id: v.id, recebendo: checked })}
                            />
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleEditVendedor(v)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-12 text-center">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-lg font-medium">Nenhum vendedor configurado</p>
                  <p className="text-muted-foreground">
                    Configure vendedores para distribuição de leads
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Modal Editar Limites */}
      <Dialog open={!!editingVendedor} onOpenChange={() => setEditingVendedor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar {editingVendedor?.vendedor?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Máximo Leads/Dia</Label>
                <Input 
                  type="number" 
                  value={maxDia} 
                  onChange={(e) => setMaxDia(e.target.value)}
                  placeholder="Sem limite"
                />
              </div>
              <div className="space-y-2">
                <Label>Máximo Leads/Mês</Label>
                <Input 
                  type="number" 
                  value={maxMes} 
                  onChange={(e) => setMaxMes(e.target.value)}
                  placeholder="Sem limite"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Regiões (opcional)</Label>
              <Input 
                value={regioes} 
                onChange={(e) => setRegioes(e.target.value)}
                placeholder="SP, RJ, MG..."
              />
              <p className="text-xs text-muted-foreground">
                Separe as regiões por vírgula
              </p>
            </div>
            <div className="space-y-2">
              <Label>Canais (opcional)</Label>
              <Input 
                value={canais} 
                onChange={(e) => setCanais(e.target.value)}
                placeholder="google, facebook..."
              />
              <p className="text-xs text-muted-foreground">
                Separe os canais por vírgula
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingVendedor(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvarLimites} disabled={updateLimites.isPending}>
              {updateLimites.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}