import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DollarSign, CheckCircle, Clock, Users, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useComissoes } from '@/hooks/useComissoes';
import { ComissaoCard } from '@/components/comissoes/ComissaoCard';
import { ComissaoResumoMensal } from '@/components/comissoes/ComissaoResumoMensal';
import type { StatusComissao } from '@/types/comissoes';

export default function Comissoes() {
  const currentDate = new Date();
  const [mes, setMes] = useState(currentDate.getMonth() + 1);
  const [ano, setAno] = useState(currentDate.getFullYear());
  const [statusFilter, setStatusFilter] = useState<StatusComissao | 'todas'>('todas');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { comissoes, resumo, isLoading, aprovarComissao, aprovarEmLote, marcarComoPaga, cancelarComissao } = useComissoes({
    mes,
    ano,
    status: statusFilter === 'todas' ? undefined : statusFilter,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const pendentes = comissoes?.filter(c => c.status === 'pendente') || [];

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(pendentes.map(c => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelect = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(i => i !== id));
    }
  };

  const handleAprovarSelecionados = () => {
    if (selectedIds.length > 0) {
      aprovarEmLote.mutate(selectedIds);
      setSelectedIds([]);
    }
  };

  const meses = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: format(new Date(2024, i), 'MMMM', { locale: ptBR }),
  }));

  const anos = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6" />
            Comissões
          </h1>
          <p className="text-muted-foreground">
            Gerencie as comissões dos vendedores
          </p>
        </div>

        <div className="flex gap-2">
          <Link to="/vendas/comissoes/config">
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Configurar Regras
            </Button>
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex gap-2 items-center">
              <span className="text-sm text-muted-foreground">Período:</span>
              <Select value={mes.toString()} onValueChange={(v) => setMes(parseInt(v))}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {meses.map((m) => (
                    <SelectItem key={m.value} value={m.value.toString()}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={ano.toString()} onValueChange={(v) => setAno(parseInt(v))}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {anos.map((a) => (
                    <SelectItem key={a} value={a.toString()}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 items-center">
              <span className="text-sm text-muted-foreground">Status:</span>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="pendente">Pendentes</SelectItem>
                  <SelectItem value="aprovada">Aprovadas</SelectItem>
                  <SelectItem value="paga">Pagas</SelectItem>
                  <SelectItem value="cancelada">Canceladas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Resumo */}
        <div className="lg:col-span-1">
          <ComissaoResumoMensal resumo={resumo} />
        </div>

        {/* Lista de Comissões */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Comissões ({comissoes?.length || 0})
                </CardTitle>
                
                {pendentes.length > 0 && statusFilter !== 'paga' && statusFilter !== 'cancelada' && (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedIds.length === pendentes.length && pendentes.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                      <span className="text-sm text-muted-foreground">
                        Selecionar pendentes
                      </span>
                    </div>
                    {selectedIds.length > 0 && (
                      <Button size="sm" onClick={handleAprovarSelecionados}>
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Aprovar {selectedIds.length}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Carregando...
                </div>
              ) : comissoes?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma comissão encontrada para o período</p>
                </div>
              ) : (
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-3">
                    {comissoes?.map((comissao) => (
                      <div key={comissao.id} className="flex items-start gap-2">
                        {comissao.status === 'pendente' && (
                          <Checkbox
                            checked={selectedIds.includes(comissao.id)}
                            onCheckedChange={(checked) => handleSelect(comissao.id, !!checked)}
                            className="mt-4"
                          />
                        )}
                        <div className="flex-1">
                          <ComissaoCard
                            comissao={comissao}
                            onAprovar={(id) => aprovarComissao.mutate(id)}
                            onCancelar={(id) => cancelarComissao.mutate({ id })}
                            onMarcarPaga={(id) => marcarComoPaga.mutate(id)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
