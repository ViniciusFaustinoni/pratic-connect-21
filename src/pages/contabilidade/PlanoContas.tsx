import { useState } from 'react';
import { Plus, Search, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlanoContasTree, ContaFormDialog } from '@/components/contabilidade';
import { usePlanoContasTree, PlanoContas as PlanoContasType } from '@/hooks/useContabilidade';

export default function PlanoContas() {
  const { data: tree, contas, isLoading } = usePlanoContasTree();
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState<string>('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [contaSelecionada, setContaSelecionada] = useState<PlanoContasType | null>(null);
  const [contaPai, setContaPai] = useState<PlanoContasType | null>(null);

  const handleEdit = (conta: PlanoContasType) => {
    setContaSelecionada(conta);
    setContaPai(null);
    setDialogOpen(true);
  };

  const handleAddChild = (contaPai: PlanoContasType) => {
    setContaSelecionada(null);
    setContaPai(contaPai);
    setDialogOpen(true);
  };

  const handleNovaConta = () => {
    setContaSelecionada(null);
    setContaPai(null);
    setDialogOpen(true);
  };

  // Filtrar contas
  const filteredTree = tree.filter(conta => {
    if (tipoFilter !== 'todos' && conta.tipo !== tipoFilter) {
      return false;
    }
    if (search) {
      const searchLower = search.toLowerCase();
      const matchesSearch = (c: PlanoContasType): boolean => {
        if (c.codigo.toLowerCase().includes(searchLower) ||
            c.descricao.toLowerCase().includes(searchLower)) {
          return true;
        }
        return c.children?.some(matchesSearch) || false;
      };
      return matchesSearch(conta);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plano de Contas</h1>
          <p className="text-muted-foreground">
            Gerencie a estrutura do plano de contas contábil
          </p>
        </div>
        <Button onClick={handleNovaConta}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Conta
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código ou descrição..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="passivo">Passivo</SelectItem>
                <SelectItem value="patrimonio_liquido">Patrimônio Líquido</SelectItem>
                <SelectItem value="receita">Receita</SelectItem>
                <SelectItem value="despesa">Despesa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tree View */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Estrutura de Contas</span>
            <span className="text-sm font-normal text-muted-foreground">
              {contas?.length || 0} contas cadastradas
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando plano de contas...
            </div>
          ) : (
            <PlanoContasTree
              contas={filteredTree}
              onEdit={handleEdit}
              onAddChild={handleAddChild}
            />
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <ContaFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        conta={contaSelecionada}
        contaPai={contaPai}
      />
    </div>
  );
}
