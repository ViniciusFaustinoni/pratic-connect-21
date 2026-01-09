import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  XCircle, 
  Clock, 
  RefreshCw,
  Building2,
  TrendingUp,
  TrendingDown,
  Eye,
  Loader2,
  Scale,
  AlertTriangle,
  Check
} from 'lucide-react';
import { useContasBancarias, useExtratosBancarios, useUploadExtrato, StatusExtrato } from '@/hooks/useExtratoBancario';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const STATUS_CONFIG: Record<StatusExtrato, { label: string; color: string; icon: React.ElementType }> = {
  pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  processando: { label: 'Processando', color: 'bg-blue-100 text-blue-800', icon: RefreshCw },
  processado: { label: 'Processado', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  conciliado: { label: 'Conciliado', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle },
  erro: { label: 'Erro', color: 'bg-red-100 text-red-800', icon: XCircle },
};

export default function ExtratosBancarios() {
  const navigate = useNavigate();
  const [contaSelecionada, setContaSelecionada] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [mesConciliacao, setMesConciliacao] = useState(new Date().getMonth() + 1);
  const [anoConciliacao, setAnoConciliacao] = useState(new Date().getFullYear());
  
  const { data: contas, isLoading: loadingContas } = useContasBancarias();
  const { data: extratos, isLoading: loadingExtratos } = useExtratosBancarios(contaSelecionada || undefined);
  const uploadMutation = useUploadExtrato();

  // Query para conciliação - compara pagamentos ASAAS
  const { data: dadosConciliacao, isLoading: loadingConciliacao } = useQuery({
    queryKey: ['conciliacao', mesConciliacao, anoConciliacao],
    queryFn: async () => {
      const inicioMes = `${anoConciliacao}-${String(mesConciliacao).padStart(2, '0')}-01`;
      const fimMes = new Date(anoConciliacao, mesConciliacao, 0).toISOString().split('T')[0];

      // Buscar pagamentos confirmados no ASAAS
      const { data: pagamentosAsaas } = await supabase
        .from('asaas_pagamentos')
        .select('id, valor, data_pagamento, forma_pagamento, asaas_id, associado_id')
        .gte('data_pagamento', inicioMes)
        .lte('data_pagamento', fimMes)
        .eq('status', 'CONFIRMED');

      const totalAsaas = (pagamentosAsaas || []).reduce((acc, p) => acc + (p.valor || 0), 0);

      return {
        pagamentosAsaas: pagamentosAsaas || [],
        totalAsaas,
        totalExtrato: 0, // Placeholder - extrato_lancamentos não existe no schema
        diferenca: totalAsaas,
        naoConciliados: [],
        conciliadosCount: pagamentosAsaas?.length || 0,
      };
    },
  });
  
  const handleUpload = async () => {
    if (!contaSelecionada || !arquivo) return;
    
    await uploadMutation.mutateAsync({
      contaId: contaSelecionada,
      arquivo
    });
    
    setArquivo(null);
  };
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const meses = [
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
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Extratos Bancários</h1>
          <p className="text-muted-foreground">
            Importe e gerencie extratos para conciliação
          </p>
        </div>
      </div>
      
      {/* Cards de Resumo por Conta */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loadingContas ? (
          <Card className="animate-pulse">
            <CardContent className="h-24" />
          </Card>
        ) : (
          contas?.map(conta => (
            <Card 
              key={conta.id} 
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                contaSelecionada === conta.id && "ring-2 ring-primary"
              )}
              onClick={() => setContaSelecionada(conta.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{conta.banco_nome}</p>
                      <p className="text-sm text-muted-foreground">
                        Ag: {conta.agencia} | Cc: {conta.conta}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-xl font-bold">{formatCurrency(conta.saldo_atual)}</p>
                  {conta.data_saldo && (
                    <p className="text-xs text-muted-foreground">
                      Saldo em {format(new Date(conta.data_saldo), 'dd/MM/yyyy')}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      
      <Tabs defaultValue="upload" className="space-y-4">
        <TabsList>
          <TabsTrigger value="upload" className="gap-2">
            <Upload className="h-4 w-4" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Histórico
          </TabsTrigger>
          <TabsTrigger value="conciliacao" className="gap-2">
            <Scale className="h-4 w-4" />
            Conciliação
          </TabsTrigger>
        </TabsList>
        
        {/* Tab Upload */}
        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle>Importar Extrato</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Conta Bancária</Label>
                  <Select value={contaSelecionada} onValueChange={setContaSelecionada}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a conta" />
                    </SelectTrigger>
                    <SelectContent>
                      {contas?.map(conta => (
                        <SelectItem key={conta.id} value={conta.id}>
                          {conta.banco_nome} - Ag: {conta.agencia} Cc: {conta.conta}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Arquivo XLS</Label>
                  <Input
                    type="file"
                    accept=".xls,.xlsx"
                    onChange={(e) => setArquivo(e.target.files?.[0] || null)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Formato suportado: Bradesco Net Empresa (.xls)
                  </p>
                </div>
              </div>
              
              <Button
                onClick={handleUpload}
                disabled={!contaSelecionada || !arquivo || uploadMutation.isPending}
                className="gap-2"
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Importar Extrato
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Tab Histórico */}
        <TabsContent value="historico">
          <Card>
            <CardHeader>
              <CardTitle>Extratos Importados</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Conta</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Créditos</TableHead>
                    <TableHead className="text-right">Débitos</TableHead>
                    <TableHead className="text-center">Lançamentos</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingExtratos ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : extratos?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Nenhum extrato importado
                      </TableCell>
                    </TableRow>
                  ) : (
                    extratos?.map(extrato => {
                      const statusConfig = STATUS_CONFIG[extrato.status];
                      const StatusIcon = statusConfig.icon;
                      return (
                        <TableRow key={extrato.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{extrato.arquivo_nome}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {extrato.conta_bancaria?.banco_nome}
                          </TableCell>
                          <TableCell>
                            {extrato.data_inicio && extrato.data_fim && (
                              <>
                                {format(new Date(extrato.data_inicio), 'dd/MM/yy')} - {format(new Date(extrato.data_fim), 'dd/MM/yy')}
                              </>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="flex items-center justify-end gap-1 text-green-600">
                              <TrendingUp className="h-3 w-3" />
                              {formatCurrency(extrato.total_creditos)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="flex items-center justify-end gap-1 text-red-600">
                              <TrendingDown className="h-3 w-3" />
                              {formatCurrency(extrato.total_debitos)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">
                              {extrato.qtd_conciliados}/{extrato.qtd_lancamentos}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("gap-1", statusConfig.color)}>
                              <StatusIcon className="h-3 w-3" />
                              {statusConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/financeiro/extratos/${extrato.id}`)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Conciliação */}
        <TabsContent value="conciliacao">
          <div className="space-y-4">
            {/* Filtros */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-5 w-5" />
                  Conciliação ASAAS x Banco
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 items-end">
                  <div className="space-y-2">
                    <Label>Mês</Label>
                    <Select 
                      value={mesConciliacao.toString()} 
                      onValueChange={(v) => setMesConciliacao(parseInt(v))}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {meses.map(m => (
                          <SelectItem key={m.value} value={m.value.toString()}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Ano</Label>
                    <Select 
                      value={anoConciliacao.toString()} 
                      onValueChange={(v) => setAnoConciliacao(parseInt(v))}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[2024, 2025, 2026].map(a => (
                          <SelectItem key={a} value={a.toString()}>
                            {a}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Resumo da Conciliação */}
            {loadingConciliacao ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Total ASAAS</p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(dadosConciliacao?.totalAsaas || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {dadosConciliacao?.pagamentosAsaas.length || 0} pagamentos
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Total Extrato</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {formatCurrency(dadosConciliacao?.totalExtrato || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {dadosConciliacao?.pagamentosAsaas.length || 0} lançamentos
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Diferença</p>
                      <p className={cn(
                        "text-2xl font-bold",
                        (dadosConciliacao?.diferenca || 0) === 0 
                          ? "text-green-600" 
                          : "text-amber-600"
                      )}>
                        {formatCurrency(dadosConciliacao?.diferenca || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(dadosConciliacao?.diferenca || 0) === 0 ? 'Conciliado' : 'Pendente'}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Conciliados</p>
                      <p className="text-2xl font-bold">
                        {dadosConciliacao?.conciliadosCount || 0}/{dadosConciliacao?.pagamentosAsaas.length || 0}
                      </p>
                      <div className="flex items-center gap-1 text-xs">
                        {(dadosConciliacao?.naoConciliados.length || 0) > 0 ? (
                          <Badge variant="outline" className="gap-1 text-amber-600">
                            <AlertTriangle className="h-3 w-3" />
                            {dadosConciliacao?.naoConciliados.length} pendentes
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-green-600">
                            <Check className="h-3 w-3" />
                            Todos conciliados
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Lista de não conciliados */}
                {(dadosConciliacao?.naoConciliados.length || 0) > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        Pagamentos ASAAS não encontrados no extrato
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ID ASAAS</TableHead>
                            <TableHead>Associado</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Forma</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dadosConciliacao?.naoConciliados.map((p: any) => (
                            <TableRow key={p.id}>
                              <TableCell className="font-mono text-xs">{p.asaas_id}</TableCell>
                              <TableCell>{(p.associados as any)?.nome || '-'}</TableCell>
                              <TableCell>
                                {p.data_pagamento ? format(new Date(p.data_pagamento), 'dd/MM/yyyy') : '-'}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{p.forma_pagamento}</Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(p.valor)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
