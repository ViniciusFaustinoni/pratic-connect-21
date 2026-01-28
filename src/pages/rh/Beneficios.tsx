import { useState } from 'react';
import { 
  Gift, Plus, Edit, Bus, Utensils, ShoppingCart, Heart, Smile, Shield, Dumbbell, 
  Users, Eye, Check, X, DollarSign, Building, LucideIcon 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';
import { BeneficioFormModal } from '@/components/rh/BeneficioFormModal';

interface Beneficio {
  id: string;
  nome: string;
  tipo: string;
  fornecedor: string | null;
  valor_empresa: number | null;
  valor_funcionario: number | null;
  ativo: boolean;
}

const tipoConfig: Record<string, { icon: LucideIcon; cor: string; bgCor: string; label: string }> = {
  vale_transporte: { icon: Bus, cor: 'text-blue-600', bgCor: 'bg-blue-100', label: 'Vale Transporte' },
  vale_refeicao: { icon: Utensils, cor: 'text-orange-600', bgCor: 'bg-orange-100', label: 'Vale Refeição' },
  vale_alimentacao: { icon: ShoppingCart, cor: 'text-green-600', bgCor: 'bg-green-100', label: 'Vale Alimentação' },
  plano_saude: { icon: Heart, cor: 'text-red-600', bgCor: 'bg-red-100', label: 'Plano de Saúde' },
  plano_odontologico: { icon: Smile, cor: 'text-cyan-600', bgCor: 'bg-cyan-100', label: 'Plano Odontológico' },
  seguro_vida: { icon: Shield, cor: 'text-purple-600', bgCor: 'bg-purple-100', label: 'Seguro de Vida' },
  gympass: { icon: Dumbbell, cor: 'text-yellow-600', bgCor: 'bg-yellow-100', label: 'Gympass' },
};

const getTipoConfig = (tipo: string) => 
  tipoConfig[tipo] || { icon: Gift, cor: 'text-gray-600', bgCor: 'bg-gray-100', label: tipo };

const formatCurrency = (value: number | null) => {
  if (!value && value !== 0) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export default function Beneficios() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedBeneficio, setSelectedBeneficio] = useState<Beneficio | null>(null);

  const { data: beneficios, isLoading } = useQuery({
    queryKey: ['beneficios'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('beneficios')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data as Beneficio[];
    }
  });

  const { data: utilizacao } = useQuery({
    queryKey: ['beneficios-utilizacao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funcionarios_beneficios')
        .select('beneficio_id')
        .eq('ativo', true);
      
      if (error) {
        console.warn('Tabela funcionarios_beneficios não encontrada');
        return {};
      }
      
      const contagem: Record<string, number> = {};
      data?.forEach(b => {
        contagem[b.beneficio_id] = (contagem[b.beneficio_id] || 0) + 1;
      });
      return contagem;
    }
  });

  const stats = useMemo(() => {
    if (!beneficios) return { total: 0, ativos: 0, custoTotal: 0, funcionariosCobertos: 0 };
    
    const ativos = beneficios.filter(b => b.ativo);
    const custoTotal = ativos.reduce((acc, b) => acc + (b.valor_empresa || 0), 0);
    const funcionariosCobertos = Object.values(utilizacao || {}).reduce((a, b) => a + b, 0);
    
    return {
      total: beneficios.length,
      ativos: ativos.length,
      custoTotal,
      funcionariosCobertos
    };
  }, [beneficios, utilizacao]);

  const handleNew = () => {
    setSelectedBeneficio(null);
    setModalMode('create');
    setModalOpen(true);
  };

  const handleEdit = (beneficio: Beneficio) => {
    setSelectedBeneficio(beneficio);
    setModalMode('edit');
    setModalOpen(true);
  };

  const handleView = (beneficio: Beneficio) => {
    setSelectedBeneficio(beneficio);
    setModalMode('view');
    setModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Gift className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Benefícios</h1>
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Benefício
        </Button>
      </div>

      {/* Cards KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Gift className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Benefícios</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Benefícios Ativos</p>
                <p className="text-2xl font-bold">{stats.ativos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Funcionários Cobertos</p>
                <p className="text-2xl font-bold">{stats.funcionariosCobertos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100">
                <DollarSign className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Custo Total Empresa</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.custoTotal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid de Benefícios */}
      {beneficios && beneficios.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {beneficios.map(beneficio => {
            const config = getTipoConfig(beneficio.tipo);
            const Icon = config.icon;
            const qtdFuncionarios = utilizacao?.[beneficio.id] || 0;
            
            return (
              <Card key={beneficio.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg ${config.bgCor}`}>
                        <Icon className={`h-6 w-6 ${config.cor}`} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{beneficio.nome}</CardTitle>
                        <p className="text-sm text-muted-foreground">{config.label}</p>
                      </div>
                    </div>
                    <Badge variant={beneficio.ativo ? 'default' : 'secondary'}>
                      {beneficio.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {beneficio.fornecedor && (
                    <div className="flex items-center gap-2 text-sm">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Fornecedor:</span>
                      <span>{beneficio.fornecedor}</span>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Valor Empresa</p>
                      <p className="font-semibold text-green-600">
                        {formatCurrency(beneficio.valor_empresa)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Valor Funcionário</p>
                      <p className="font-semibold">
                        {formatCurrency(beneficio.valor_funcionario)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t">
                    <Badge variant="outline" className="gap-1">
                      <Users className="h-3 w-3" />
                      {qtdFuncionarios} funcionários
                    </Badge>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(beneficio)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleView(beneficio)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Gift className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum benefício cadastrado</p>
        </div>
      )}

      {/* Modal */}
      <BeneficioFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        beneficio={selectedBeneficio}
        mode={modalMode}
      />
    </div>
  );
}
