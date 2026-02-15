import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, Search, Radio, Globe, DollarSign, 
  Users, Mail, Share2, Building, Target, TrendingUp
} from 'lucide-react';
import { useCanais, useUpdateCanal, usePerformanceCanais } from '@/hooks/useMarketing';
import { Skeleton } from '@/components/ui/skeleton';
import { CanalFormDialog } from '@/components/marketing/CanalFormDialog';
import { useNavigate } from 'react-router-dom';

const tipoIcons: Record<string, any> = {
  organico: Globe,
  pago: DollarSign,
  referral: Users,
  direto: Target,
  social: Share2,
  email: Mail,
  offline: Building,
};

const tipoLabels: Record<string, string> = {
  organico: 'Orgânico',
  pago: 'Pago',
  referral: 'Indicação',
  direto: 'Direto',
  social: 'Social',
  email: 'E-mail',
  offline: 'Offline',
};

const tipoCores: Record<string, string> = {
  organico: 'text-green-600 bg-green-100',
  pago: 'text-blue-600 bg-blue-100',
  referral: 'text-purple-600 bg-purple-100',
  direto: 'text-amber-600 bg-amber-100',
  social: 'text-pink-600 bg-pink-100',
  email: 'text-orange-600 bg-orange-100',
  offline: 'text-gray-600 bg-gray-100',
};

export default function Canais() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCanal, setEditingCanal] = useState<any>(null);

  const { data: canais, isLoading } = useCanais();
  const { data: performance } = usePerformanceCanais();
  const updateCanal = useUpdateCanal();

  // Mesclar performance com canais
  const canaisComPerformance = canais?.map(canal => {
    const perf = performance?.find(p => p.id === canal.id);
    return {
      ...canal,
      total_leads: perf?.total_leads || 0,
      conversoes: perf?.conversoes || 0,
      taxa_conversao: perf?.taxa_conversao || 0,
      cpl_medio: perf?.cpl_medio || 0,
      investimento_total: perf?.investimento_total || 0,
    };
  });

  const filteredCanais = canaisComPerformance?.filter(c =>
    c.nome.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggleAtivo = (canal: any) => {
    updateCanal.mutate({ id: canal.id, ativo: !canal.ativo });
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Canais de Marketing</h1>
          <p className="text-muted-foreground">
            Gerencie as origens de leads e campanhas
          </p>
        </div>
        <Button onClick={() => { setEditingCanal(null); setShowForm(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Canal
        </Button>
      </div>

      {/* Busca */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar canal..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Lista de Canais */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : filteredCanais?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Radio className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium">Nenhum canal encontrado</p>
            <p className="text-muted-foreground">
              Crie seu primeiro canal de marketing
            </p>
            <Button className="mt-4" onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Canal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCanais?.map(canal => {
            const Icon = tipoIcons[canal.tipo] || Radio;
            const cores = tipoCores[canal.tipo] || 'text-gray-600 bg-gray-100';
            return (
              <Card 
                key={canal.id} 
                className={`transition-all hover:shadow-md cursor-pointer ${!canal.ativo && 'opacity-60'}`}
                onClick={() => navigate(`/marketing/canais/${canal.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${cores}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{canal.nome}</CardTitle>
                        <Badge variant="outline" className="mt-1">
                          {tipoLabels[canal.tipo] || canal.tipo}
                        </Badge>
                      </div>
                    </div>
                    <Switch
                      checked={canal.ativo}
                      onCheckedChange={() => handleToggleAtivo(canal)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {canal.descricao && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {canal.descricao}
                    </p>
                  )}
                  
                  {/* Métricas de Performance */}
                  <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t">
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Leads: </span>
                      <span className="font-medium">{canal.total_leads}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-green-600" />
                      <span className="text-muted-foreground">Conv.: </span>
                      <span className="font-medium text-green-600">{canal.conversoes}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Taxa: </span>
                      <span className="font-medium">{canal.taxa_conversao?.toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">CPL: </span>
                      <span className="font-medium">R$ {canal.cpl_medio?.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Meta */}
                  {canal.meta_leads_mes && (
                    <div className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1">
                      <span className="text-muted-foreground">Meta:</span>
                      <span className="font-medium">{canal.total_leads}/{canal.meta_leads_mes}</span>
                    </div>
                  )}

                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => { setEditingCanal(canal); setShowForm(true); }}
                  >
                    Editar
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CanalFormDialog
        open={showForm}
        onClose={() => { setShowForm(false); setEditingCanal(null); }}
        canal={editingCanal}
      />
    </div>
  );
}