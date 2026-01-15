import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Users, TrendingDown, Calculator, FileText, Download, Eye, CheckCircle, Loader2, Printer, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// Tipos
interface Funcionario {
  id: string;
  nome_completo: string;
  cargo?: { nome: string } | null;
  salario_atual: number | null;
  data_admissao: string | null;
}

interface FolhaPagamentoRecord {
  id: string;
  funcionario_id: string;
  mes: number;
  ano: number;
  salario_base: number;
  horas_extras_qtd: number;
  horas_extras_valor: number;
  adicional_noturno: number;
  comissoes: number;
  bonus: number;
  outros_proventos: number;
  total_proventos: number;
  inss: number;
  irrf: number;
  vale_transporte: number;
  vale_refeicao: number;
  plano_saude: number;
  emprestimo_consignado: number;
  adiantamento: number;
  outros_descontos: number;
  total_descontos: number;
  salario_liquido: number;
  status: string;
  funcionario?: {
    id: string;
    nome_completo: string;
    cargo?: { nome: string } | null;
    salario_atual: number | null;
  };
}

const MESES = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  rascunho: { label: 'Rascunho', variant: 'secondary' },
  calculado: { label: 'Calculado', variant: 'default' },
  aprovado: { label: 'Aprovado', variant: 'outline' },
  pago: { label: 'Pago', variant: 'default' },
  cancelado: { label: 'Cancelado', variant: 'destructive' },
};

// Cálculo INSS 2024 (Progressivo)
const calcularINSS = (salarioBruto: number): number => {
  if (salarioBruto <= 1412.00) return salarioBruto * 0.075;
  if (salarioBruto <= 2666.68) return (salarioBruto * 0.09) - 21.18;
  if (salarioBruto <= 4000.03) return (salarioBruto * 0.12) - 101.18;
  if (salarioBruto <= 7786.02) return (salarioBruto * 0.14) - 181.18;
  return 908.85; // Teto INSS 2024
};

// Cálculo IRRF 2024
const calcularIRRF = (baseCalculo: number, dependentes: number = 0): number => {
  const DEDUCAO_DEPENDENTE = 189.59;
  const baseComDeducoes = baseCalculo - (dependentes * DEDUCAO_DEPENDENTE);
  
  if (baseComDeducoes <= 2259.20) return 0;
  if (baseComDeducoes <= 2826.65) return (baseComDeducoes * 0.075) - 169.44;
  if (baseComDeducoes <= 3751.05) return (baseComDeducoes * 0.15) - 381.44;
  if (baseComDeducoes <= 4664.68) return (baseComDeducoes * 0.225) - 662.77;
  return (baseComDeducoes * 0.275) - 896.00;
};

const formatCurrency = (value: number | null | undefined): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value || 0);
};

const FolhaPagamento = () => {
  const queryClient = useQueryClient();
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [modalHolerite, setModalHolerite] = useState<FolhaPagamentoRecord | null>(null);

  // Buscar funcionários ativos
  const { data: funcionarios = [] } = useQuery<Funcionario[]>({
    queryKey: ['funcionarios-ativos'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('funcionarios')
        .select('id, nome_completo, salario_atual, data_admissao')
        .eq('ativo', true)
        .order('nome_completo');
      
      if (error) throw error;
      return (data || []).map((f: any) => ({
        id: f.id,
        nome_completo: f.nome_completo,
        cargo: null,
        salario_atual: f.salario_atual,
        data_admissao: f.data_admissao,
      }));
    },
  });

  // Buscar folhas do período
  const { data: folhas = [], isLoading } = useQuery<FolhaPagamentoRecord[]>({
    queryKey: ['folha-pagamento', mes, ano],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('folha_pagamento')
        .select('*')
        .eq('mes', mes)
        .eq('ano', ano)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const folhasData = data || [];
      const funcIds = [...new Set(folhasData.map((f: any) => f.funcionario_id))];
      
      if (funcIds.length === 0) return [];
      
      const { data: funcsData } = await (supabase as any)
        .from('funcionarios')
        .select('id, nome_completo')
        .in('id', funcIds);
      
      const funcsMap = new Map<string, { id: string; nome_completo: string }>(
        (funcsData || []).map((f: any) => [f.id, { id: f.id, nome_completo: f.nome_completo }])
      );
      
      return folhasData.map((f: any) => {
        const func = funcsMap.get(f.funcionario_id);
        return {
          ...f,
          funcionario: func ? {
            id: func.id,
            nome_completo: func.nome_completo,
            cargo: null,
            salario_atual: null,
          } : undefined,
        };
      });
    },
  });

  // Mutation para calcular folha
  const calcularFolhaMutation = useMutation({
    mutationFn: async () => {
      const results = [];
      
      for (const func of funcionarios) {
        const salarioBase = func.salario_atual || 0;
        
        // Calcular proventos
        const horasExtrasQtd = 0; // TODO: Buscar do controle de ponto
        const valorHoraExtra = (salarioBase / 220) * 1.5 * horasExtrasQtd;
        const totalProventos = salarioBase + valorHoraExtra;
        
        // Calcular descontos
        const inss = Math.max(0, calcularINSS(totalProventos));
        const baseIRRF = totalProventos - inss;
        const irrf = Math.max(0, calcularIRRF(baseIRRF, 0)); // TODO: Buscar dependentes
        const valeTransporte = salarioBase * 0.06; // 6% do salário base
        const totalDescontos = inss + irrf + valeTransporte;
        
        // Salário líquido
        const salarioLiquido = totalProventos - totalDescontos;

        const folhaData = {
          funcionario_id: func.id,
          mes,
          ano,
          salario_base: salarioBase,
          horas_extras_qtd: horasExtrasQtd,
          horas_extras_valor: valorHoraExtra,
          adicional_noturno: 0,
          comissoes: 0,
          bonus: 0,
          outros_proventos: 0,
          total_proventos: totalProventos,
          inss,
          irrf,
          vale_transporte: valeTransporte,
          vale_refeicao: 0,
          plano_saude: 0,
          emprestimo_consignado: 0,
          adiantamento: 0,
          outros_descontos: 0,
          total_descontos: totalDescontos,
          salario_liquido: salarioLiquido,
          status: 'calculado',
          calculado_em: new Date().toISOString(),
        };

        const { error } = await supabase
          .from('folha_pagamento')
          .upsert(folhaData, { onConflict: 'funcionario_id,mes,ano' });

        if (error) throw error;
        results.push(folhaData);
      }
      
      return results;
    },
    onSuccess: () => {
      toast.success(
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span>Folha de {MESES[mes - 1]?.label}/{ano} calculada com sucesso!</span>
        </div>
      );
      queryClient.invalidateQueries({ queryKey: ['folha-pagamento', mes, ano] });
    },
    onError: (error) => {
      console.error('Erro ao calcular folha:', error);
      toast.error('Erro ao calcular folha de pagamento');
    },
  });

  // Totalizadores
  const totalBruto = folhas.reduce((acc, f) => acc + (f.total_proventos || 0), 0);
  const totalDescontos = folhas.reduce((acc, f) => acc + (f.total_descontos || 0), 0);
  const totalLiquido = folhas.reduce((acc, f) => acc + (f.salario_liquido || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Folha de Pagamento</h1>
          <p className="text-muted-foreground">Gerencie a folha de pagamento dos funcionários</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Select value={mes.toString()} onValueChange={(v) => setMes(parseInt(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((m) => (
                <SelectItem key={m.value} value={m.value.toString()}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={ano.toString()} onValueChange={(v) => setAno(parseInt(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map((a) => (
                <SelectItem key={a} value={a.toString()}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button
            onClick={() => calcularFolhaMutation.mutate()}
            disabled={calcularFolhaMutation.isPending || funcionarios.length === 0}
          >
            {calcularFolhaMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Calculator className="h-4 w-4 mr-2" />
            )}
            {calcularFolhaMutation.isPending ? 'Calculando...' : 'Calcular Folha'}
          </Button>
          
          <Button variant="outline" disabled={folhas.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Cards Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Users className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Funcionários</p>
                <p className="text-2xl font-bold">{folhas.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <DollarSign className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Bruto</p>
                <p className="text-2xl font-bold">{formatCurrency(totalBruto)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-red-500/10">
                <TrendingDown className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Descontos</p>
                <p className="text-2xl font-bold">{formatCurrency(totalDescontos)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Líquido</p>
                <p className="text-2xl font-bold">{formatCurrency(totalLiquido)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Funcionário</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead className="text-right">Sal. Base</TableHead>
                  <TableHead className="text-right">Proventos</TableHead>
                  <TableHead className="text-right">INSS</TableHead>
                  <TableHead className="text-right">IRRF</TableHead>
                  <TableHead className="text-right">Descontos</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {folhas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      Nenhuma folha calculada para este período. Clique em "Calcular Folha".
                    </TableCell>
                  </TableRow>
                ) : (
                  folhas.map((folha) => (
                    <TableRow key={folha.id}>
                      <TableCell className="font-medium">{folha.funcionario?.nome_completo}</TableCell>
                      <TableCell>{folha.funcionario?.cargo?.nome || '-'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(folha.salario_base)}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {formatCurrency(folha.total_proventos)}
                      </TableCell>
                      <TableCell className="text-right text-red-600">{formatCurrency(folha.inss)}</TableCell>
                      <TableCell className="text-right text-red-600">{formatCurrency(folha.irrf)}</TableCell>
                      <TableCell className="text-right font-medium text-red-600">
                        {formatCurrency(folha.total_descontos)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        {formatCurrency(folha.salario_liquido)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_CONFIG[folha.status]?.variant || 'secondary'}>
                          {STATUS_CONFIG[folha.status]?.label || folha.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setModalHolerite(folha)}
                          title="Ver Holerite"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal Holerite */}
      <Dialog open={!!modalHolerite} onOpenChange={() => setModalHolerite(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Holerite - {modalHolerite?.funcionario?.nome_completo}
            </DialogTitle>
          </DialogHeader>
          
          {modalHolerite && (
            <div className="space-y-6">
              {/* Cabeçalho */}
              <div className="text-center border-b pb-4">
                <h3 className="text-xl font-bold text-primary">SGA PRATIC</h3>
                <p className="text-sm text-muted-foreground">
                  Competência: {MESES[mes - 1]?.label}/{ano}
                </p>
              </div>

              {/* Dados do Funcionário */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Funcionário</span>
                  <p className="font-medium">{modalHolerite.funcionario?.nome_completo}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Cargo</span>
                  <p className="font-medium">{modalHolerite.funcionario?.cargo?.nome || '-'}</p>
                </div>
              </div>

              {/* Proventos */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 border-b pb-1">
                  <span className="font-semibold text-green-600">PROVENTOS</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Salário Base</span>
                    <span className="font-medium">{formatCurrency(modalHolerite.salario_base)}</span>
                  </div>
                  {modalHolerite.horas_extras_valor > 0 && (
                    <div className="flex justify-between">
                      <span>Horas Extras ({modalHolerite.horas_extras_qtd}h)</span>
                      <span className="font-medium">{formatCurrency(modalHolerite.horas_extras_valor)}</span>
                    </div>
                  )}
                  {modalHolerite.adicional_noturno > 0 && (
                    <div className="flex justify-between">
                      <span>Adicional Noturno</span>
                      <span className="font-medium">{formatCurrency(modalHolerite.adicional_noturno)}</span>
                    </div>
                  )}
                  {modalHolerite.comissoes > 0 && (
                    <div className="flex justify-between">
                      <span>Comissões</span>
                      <span className="font-medium">{formatCurrency(modalHolerite.comissoes)}</span>
                    </div>
                  )}
                  {modalHolerite.bonus > 0 && (
                    <div className="flex justify-between">
                      <span>Bônus</span>
                      <span className="font-medium">{formatCurrency(modalHolerite.bonus)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold pt-1 border-t">
                    <span>Total Proventos</span>
                    <span className="text-green-600">{formatCurrency(modalHolerite.total_proventos)}</span>
                  </div>
                </div>
              </div>

              {/* Descontos */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 border-b pb-1">
                  <span className="font-semibold text-red-600">DESCONTOS</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>INSS</span>
                    <span className="font-medium">{formatCurrency(modalHolerite.inss)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>IRRF</span>
                    <span className="font-medium">{formatCurrency(modalHolerite.irrf)}</span>
                  </div>
                  {modalHolerite.vale_transporte > 0 && (
                    <div className="flex justify-between">
                      <span>Vale Transporte (6%)</span>
                      <span className="font-medium">{formatCurrency(modalHolerite.vale_transporte)}</span>
                    </div>
                  )}
                  {modalHolerite.vale_refeicao > 0 && (
                    <div className="flex justify-between">
                      <span>Vale Refeição</span>
                      <span className="font-medium">{formatCurrency(modalHolerite.vale_refeicao)}</span>
                    </div>
                  )}
                  {modalHolerite.plano_saude > 0 && (
                    <div className="flex justify-between">
                      <span>Plano de Saúde</span>
                      <span className="font-medium">{formatCurrency(modalHolerite.plano_saude)}</span>
                    </div>
                  )}
                  {modalHolerite.emprestimo_consignado > 0 && (
                    <div className="flex justify-between">
                      <span>Empréstimo Consignado</span>
                      <span className="font-medium">{formatCurrency(modalHolerite.emprestimo_consignado)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold pt-1 border-t">
                    <span>Total Descontos</span>
                    <span className="text-red-600">{formatCurrency(modalHolerite.total_descontos)}</span>
                  </div>
                </div>
              </div>

              {/* Líquido */}
              <div className="bg-primary/5 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold">SALÁRIO LÍQUIDO</span>
                  <span className="text-2xl font-bold text-primary">
                    {formatCurrency(modalHolerite.salario_liquido)}
                  </span>
                </div>
              </div>

              {/* Ações */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" size="sm">
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir
                </Button>
                <Button size="sm">
                  <Mail className="h-4 w-4 mr-2" />
                  Enviar por Email
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FolhaPagamento;
