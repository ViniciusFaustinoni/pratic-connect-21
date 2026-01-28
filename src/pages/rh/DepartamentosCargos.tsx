import { useState } from 'react';
import { Building, Briefcase, Plus, Edit, Trash2, Users, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DepartamentoFormModal } from '@/components/rh/DepartamentoFormModal';
import { CargoFormModal } from '@/components/rh/CargoFormModal';

interface Departamento {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
}

interface Cargo {
  id: string;
  nome: string;
  departamento_id: string | null;
  nivel: number | null;
  cbo: string | null;
  salario_base: number | null;
  ativo: boolean;
  departamento?: { nome: string } | null;
}

const nivelConfig: Record<number, { label: string; className: string }> = {
  1: { label: 'Junior', className: 'bg-gray-100 text-gray-800' },
  2: { label: 'Pleno', className: 'bg-blue-100 text-blue-800' },
  3: { label: 'Senior', className: 'bg-green-100 text-green-800' },
  4: { label: 'Coordenador', className: 'bg-yellow-100 text-yellow-800' },
  5: { label: 'Gerente', className: 'bg-orange-100 text-orange-800' },
  6: { label: 'Diretor', className: 'bg-purple-100 text-purple-800' },
};

const formatCurrency = (value: number | null) => {
  if (!value) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export default function DepartamentosCargos() {
  const [tabAtual, setTabAtual] = useState('departamentos');
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [cargoModalOpen, setCargoModalOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState<Departamento | null>(null);
  const [selectedCargo, setSelectedCargo] = useState<Cargo | null>(null);

  const { data: departamentos, isLoading: loadingDepts } = useQuery({
    queryKey: ['departamentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departamentos')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data as Departamento[];
    }
  });

  const { data: funcionariosPorDept } = useQuery({
    queryKey: ['funcionarios-por-departamento'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funcionarios')
        .select('departamento_id')
        .eq('status', 'ativo');
      
      if (error) throw error;
      
      const contagem: Record<string, number> = {};
      data?.forEach(f => {
        if (f.departamento_id) {
          contagem[f.departamento_id] = (contagem[f.departamento_id] || 0) + 1;
        }
      });
      return contagem;
    }
  });

  const { data: cargos, isLoading: loadingCargos } = useQuery({
    queryKey: ['cargos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cargos')
        .select(`
          *,
          departamento:departamentos(nome)
        `)
        .order('nome');
      if (error) throw error;
      return data as Cargo[];
    }
  });

  const totalDepartamentos = departamentos?.length || 0;
  const totalCargos = cargos?.length || 0;

  const handleNewDept = () => {
    setSelectedDept(null);
    setDeptModalOpen(true);
  };

  const handleEditDept = (dept: Departamento) => {
    setSelectedDept(dept);
    setDeptModalOpen(true);
  };

  const handleNewCargo = () => {
    setSelectedCargo(null);
    setCargoModalOpen(true);
  };

  const handleEditCargo = (cargo: Cargo) => {
    setSelectedCargo(cargo);
    setCargoModalOpen(true);
  };

  const isLoading = loadingDepts || loadingCargos;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-40" />
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
          <Building className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Departamentos e Cargos</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Building className="h-3 w-3" />
            {totalDepartamentos} departamentos
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Briefcase className="h-3 w-3" />
            {totalCargos} cargos
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tabAtual} onValueChange={setTabAtual}>
        <TabsList>
          <TabsTrigger value="departamentos" className="gap-2">
            <Building className="h-4 w-4" />
            Departamentos
          </TabsTrigger>
          <TabsTrigger value="cargos" className="gap-2">
            <Briefcase className="h-4 w-4" />
            Cargos
          </TabsTrigger>
        </TabsList>

        {/* Tab Departamentos */}
        <TabsContent value="departamentos" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={handleNewDept}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Departamento
            </Button>
          </div>

          {departamentos && departamentos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {departamentos.map(dept => (
                <Card key={dept.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Building className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{dept.nome}</CardTitle>
                        </div>
                      </div>
                      <Badge variant={dept.ativo ? 'default' : 'secondary'}>
                        {dept.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {dept.descricao && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {dept.descricao}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{funcionariosPorDept?.[dept.id] || 0} funcionários</span>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEditDept(dept)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Building className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum departamento cadastrado</p>
            </div>
          )}
        </TabsContent>

        {/* Tab Cargos */}
        <TabsContent value="cargos" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={handleNewCargo}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Cargo
            </Button>
          </div>

          {cargos && cargos.length > 0 ? (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Nível</TableHead>
                    <TableHead>CBO</TableHead>
                    <TableHead className="text-right">Salário Base</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cargos.map(cargo => (
                    <TableRow key={cargo.id}>
                      <TableCell className="font-medium">{cargo.nome}</TableCell>
                      <TableCell>{cargo.departamento?.nome || '-'}</TableCell>
                      <TableCell>
                        {cargo.nivel && nivelConfig[cargo.nivel] ? (
                          <Badge className={nivelConfig[cargo.nivel].className}>
                            {nivelConfig[cargo.nivel].label}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{cargo.cbo || '-'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(cargo.salario_base)}</TableCell>
                      <TableCell>
                        {cargo.ativo ? (
                          <Badge variant="outline" className="gap-1 text-green-600 border-green-200 bg-green-50">
                            <Check className="h-3 w-3" />
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-red-600 border-red-200 bg-red-50">
                            <X className="h-3 w-3" />
                            Inativo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEditCargo(cargo)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum cargo cadastrado</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modais */}
      <DepartamentoFormModal
        open={deptModalOpen}
        onClose={() => setDeptModalOpen(false)}
        departamento={selectedDept}
      />
      <CargoFormModal
        open={cargoModalOpen}
        onClose={() => setCargoModalOpen(false)}
        cargo={selectedCargo}
      />
    </div>
  );
}
