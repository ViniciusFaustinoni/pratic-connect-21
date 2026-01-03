import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { Target, Edit, Plus, ChevronLeft, ChevronRight, RefreshCw, Trash2 } from 'lucide-react';
import { useMetas, Meta, MetaInput } from '@/hooks/useMetas';
import { useVendedores } from '@/hooks/useVendedores';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function Metas() {
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [modalAberto, setModalAberto] = useState(false);
  const [metaSelecionada, setMetaSelecionada] = useState<Meta | null>(null);
  const [formData, setFormData] = useState<Partial<MetaInput>>({});

  const { metas, isLoading, salvarMeta, deletarMeta, atualizarRealizados } = useMetas(mes, ano);
  const { data: vendedores } = useVendedores();
  const { isGerencia } = usePermissions();

  // Atualizar realizados ao carregar
  useEffect(() => {
    if (metas && metas.length > 0) {
      atualizarRealizados();
    }
  }, [mes, ano]);

  const navegarMes = (direcao: number) => {
    let novoMes = mes + direcao;
    let novoAno = ano;

    if (novoMes > 12) {
      novoMes = 1;
      novoAno++;
    } else if (novoMes < 1) {
      novoMes = 12;
      novoAno--;
    }

    setMes(novoMes);
    setAno(novoAno);
  };

  const abrirModal = (meta?: Meta) => {
    if (meta) {
      setMetaSelecionada(meta);
      setFormData({
        id: meta.id,
        vendedor_id: meta.vendedor_id,
        meta_leads: meta.meta_leads,
        meta_cotacoes: meta.meta_cotacoes,
        meta_contratos: meta.meta_contratos,
        meta_valor: meta.meta_valor,
      });
    } else {
      setMetaSelecionada(null);
      setFormData({});
    }
    setModalAberto(true);
  };

  const handleSalvar = () => {
    if (!formData.vendedor_id) {
      return;
    }

    salvarMeta.mutate({
      id: formData.id,
      vendedor_id: formData.vendedor_id,
      mes,
      ano,
      meta_leads: formData.meta_leads || 0,
      meta_cotacoes: formData.meta_cotacoes || 0,
      meta_contratos: formData.meta_contratos || 0,
      meta_valor: formData.meta_valor || 0,
    });

    setModalAberto(false);
  };

  const handleDeletar = (id: string) => {
    if (confirm('Tem certeza que deseja remover esta meta?')) {
      deletarMeta.mutate(id);
    }
  };

  const getProgressColor = (percentual: number) => {
    if (percentual >= 100) return 'bg-green-500';
    if (percentual >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const calcularPercentual = (realizado: number, meta: number) => {
    if (meta <= 0) return 0;
    return Math.min((realizado / meta) * 100, 100);
  };

  // Vendedores que ainda não têm meta no período
  const vendedoresSemMeta = vendedores?.filter(
    v => !metas?.some(m => m.vendedor_id === v.id)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Metas de Vendas
          </h1>
          <p className="text-muted-foreground">
            Acompanhamento de metas por vendedor
          </p>
        </div>

        {isGerencia && (
          <Button onClick={() => abrirModal()}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Meta
          </Button>
        )}
      </div>

      {/* Navegação de Período */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navegarMes(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-2">
              <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map((a) => (
                    <SelectItem key={a} value={String(a)}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" size="icon" onClick={() => navegarMes(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>

            <Button variant="ghost" size="icon" onClick={atualizarRealizados} title="Atualizar realizados">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Grid de Metas */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : metas && metas.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metas.map((meta) => {
            const percLeads = calcularPercentual(meta.realizado_leads, meta.meta_leads);
            const percCotacoes = calcularPercentual(meta.realizado_cotacoes, meta.meta_cotacoes);
            const percContratos = calcularPercentual(meta.realizado_contratos, meta.meta_contratos);
            const percValor = calcularPercentual(meta.realizado_valor, meta.meta_valor);

            return (
              <Card key={meta.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={meta.vendedor?.avatar_url || undefined} />
                        <AvatarFallback>
                          {meta.vendedor?.nome?.slice(0, 2).toUpperCase() || 'VD'}
                        </AvatarFallback>
                      </Avatar>
                      <CardTitle className="text-lg">{meta.vendedor?.nome || 'Vendedor'}</CardTitle>
                    </div>
                    {isGerencia && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => abrirModal(meta)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeletar(meta.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Leads */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Leads</span>
                      <span className="font-medium">
                        {meta.realizado_leads}/{meta.meta_leads}
                      </span>
                    </div>
                    <Progress
                      value={percLeads}
                      className={cn("h-2", getProgressColor(percLeads))}
                    />
                  </div>

                  {/* Cotações */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Cotações</span>
                      <span className="font-medium">
                        {meta.realizado_cotacoes}/{meta.meta_cotacoes}
                      </span>
                    </div>
                    <Progress
                      value={percCotacoes}
                      className={cn("h-2", getProgressColor(percCotacoes))}
                    />
                  </div>

                  {/* Contratos */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Contratos</span>
                      <span className="font-medium">
                        {meta.realizado_contratos}/{meta.meta_contratos}
                      </span>
                    </div>
                    <Progress
                      value={percContratos}
                      className={cn("h-2", getProgressColor(percContratos))}
                    />
                  </div>

                  {/* Valor */}
                  <div className="pt-2 border-t">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs text-muted-foreground">Meta Valor</p>
                        <p className="font-semibold">
                          R$ {meta.meta_valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Realizado</p>
                        <p className={cn(
                          "font-semibold",
                          percValor >= 100 ? "text-green-600" : percValor >= 70 ? "text-yellow-600" : "text-red-600"
                        )}>
                          R$ {meta.realizado_valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Nenhuma meta definida</h3>
            <p className="text-muted-foreground mb-4">
              Não há metas cadastradas para {MESES[mes - 1]} de {ano}.
            </p>
            {isGerencia && (
              <Button onClick={() => abrirModal()}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Meta
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal de Edição */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {metaSelecionada ? 'Editar Meta' : 'Nova Meta'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Vendedor</Label>
              <Select
                value={formData.vendedor_id}
                onValueChange={(v) => setFormData({ ...formData, vendedor_id: v })}
                disabled={!!metaSelecionada}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o vendedor" />
                </SelectTrigger>
                <SelectContent>
                  {(metaSelecionada ? vendedores : vendedoresSemMeta)?.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Meta Leads</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.meta_leads || ''}
                  onChange={(e) => setFormData({ ...formData, meta_leads: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label>Meta Cotações</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.meta_cotacoes || ''}
                  onChange={(e) => setFormData({ ...formData, meta_cotacoes: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label>Meta Contratos</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.meta_contratos || ''}
                  onChange={(e) => setFormData({ ...formData, meta_contratos: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label>Meta Valor (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.meta_valor || ''}
                  onChange={(e) => setFormData({ ...formData, meta_valor: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvar} disabled={salvarMeta.isPending}>
              {salvarMeta.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
