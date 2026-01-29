import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Calculator, FileText, CheckCircle2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, differenceInMonths, differenceInDays, parseISO } from 'date-fns';

interface Funcionario {
  id: string;
  nome_completo: string;
  data_admissao: string;
  salario_atual: number;
  cargo?: { nome: string };
  departamento?: { nome: string };
}

interface DesligamentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funcionario: Funcionario | null;
}

interface RescisaoCalculo {
  saldoSalario: number;
  feriasVencidas: number;
  feriasProporcionais: number;
  decimoTerceiro: number;
  avisoPrevia: number;
  totalBruto: number;
  inss: number;
  irrf: number;
  totalLiquido: number;
  multaFgts: number;
}

const tiposDesligamento = [
  { value: 'pedido', label: 'Pedido de Demissão' },
  { value: 'sem_justa_causa', label: 'Demissão sem Justa Causa' },
  { value: 'justa_causa', label: 'Demissão por Justa Causa' },
  { value: 'acordo', label: 'Acordo (Art. 484-A CLT)' },
  { value: 'termino_contrato', label: 'Término de Contrato' },
];

const tiposAvisoPrevio = [
  { value: 'trabalhado', label: 'Trabalhado' },
  { value: 'indenizado', label: 'Indenizado' },
  { value: 'dispensado', label: 'Dispensado' },
];

const checklistItems = [
  { id: 'aso', label: 'ASO Demissional agendado' },
  { id: 'equipamentos', label: 'Devolução de equipamentos (crachá, notebook, celular)' },
  { id: 'acessos', label: 'Revogação de acessos (e-mail, sistemas)' },
  { id: 'trct', label: 'TRCT gerado' },
  { id: 'homologacao', label: 'Homologação agendada (se aplicável)' },
  { id: 'pagamento', label: 'Pagamento rescisório agendado' },
];

function calcularINSS(salario: number): number {
  // Tabela INSS 2024
  if (salario <= 1412.00) return salario * 0.075;
  if (salario <= 2666.68) return 105.90 + (salario - 1412.00) * 0.09;
  if (salario <= 4000.03) return 218.80 + (salario - 2666.68) * 0.12;
  if (salario <= 7786.02) return 378.80 + (salario - 4000.03) * 0.14;
  return 908.85; // Teto
}

function calcularIRRF(baseCalculo: number): number {
  // Tabela IRRF 2024
  if (baseCalculo <= 2259.20) return 0;
  if (baseCalculo <= 2826.65) return baseCalculo * 0.075 - 169.44;
  if (baseCalculo <= 3751.05) return baseCalculo * 0.15 - 381.44;
  if (baseCalculo <= 4664.68) return baseCalculo * 0.225 - 662.77;
  return baseCalculo * 0.275 - 896.00;
}

export function DesligamentoModal({ open, onOpenChange, funcionario }: DesligamentoModalProps) {
  const queryClient = useQueryClient();
  const [tipoDesligamento, setTipoDesligamento] = useState('');
  const [dataDesligamento, setDataDesligamento] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [avisoPrevia, setAvisoPrevia] = useState('indenizado');
  const [motivo, setMotivo] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [calculo, setCalculo] = useState<RescisaoCalculo | null>(null);
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (funcionario && tipoDesligamento && dataDesligamento) {
      const calc = calcularRescisao();
      setCalculo(calc);
    }
  }, [funcionario, tipoDesligamento, dataDesligamento, avisoPrevia]);

  const calcularRescisao = (): RescisaoCalculo => {
    if (!funcionario) {
      return {
        saldoSalario: 0, feriasVencidas: 0, feriasProporcionais: 0,
        decimoTerceiro: 0, avisoPrevia: 0, totalBruto: 0,
        inss: 0, irrf: 0, totalLiquido: 0, multaFgts: 0
      };
    }

    const salario = funcionario.salario_atual || 0;
    const admissao = parseISO(funcionario.data_admissao);
    const desligamento = parseISO(dataDesligamento);
    
    // Dias trabalhados no mês
    const diasMes = desligamento.getDate();
    const saldoSalario = (salario / 30) * diasMes;
    
    // Meses para férias proporcionais
    const mesesTrabalhados = differenceInMonths(desligamento, admissao);
    const mesesFerias = mesesTrabalhados % 12;
    
    // Férias proporcionais + 1/3
    const feriasProporcionais = ((salario / 12) * mesesFerias) * 1.333;
    
    // Férias vencidas (períodos completos)
    const periodosVencidos = Math.floor(mesesTrabalhados / 12);
    const feriasVencidas = periodosVencidos > 0 ? salario * 1.333 * (tipoDesligamento === 'justa_causa' ? 0 : 1) : 0;
    
    // 13º proporcional
    const mesAtual = desligamento.getMonth() + 1;
    const decimoTerceiro = tipoDesligamento === 'justa_causa' ? 0 : (salario / 12) * mesAtual;
    
    // Aviso prévio
    let avisoValor = 0;
    if (tipoDesligamento === 'sem_justa_causa' && avisoPrevia === 'indenizado') {
      // 30 dias + 3 dias por ano trabalhado
      const anosCompletos = Math.floor(mesesTrabalhados / 12);
      const diasAviso = Math.min(30 + (anosCompletos * 3), 90);
      avisoValor = (salario / 30) * diasAviso;
    } else if (tipoDesligamento === 'acordo' && avisoPrevia === 'indenizado') {
      avisoValor = salario * 0.5; // Metade do aviso
    }
    
    const totalBruto = saldoSalario + feriasVencidas + feriasProporcionais + decimoTerceiro + avisoValor;
    
    // Descontos
    const inss = calcularINSS(totalBruto);
    const irrf = calcularIRRF(totalBruto - inss);
    
    // Multa FGTS (simulado - 8% do salário por mês)
    const saldoFgts = salario * 0.08 * mesesTrabalhados;
    let multaFgts = 0;
    if (tipoDesligamento === 'sem_justa_causa') {
      multaFgts = saldoFgts * 0.40;
    } else if (tipoDesligamento === 'acordo') {
      multaFgts = saldoFgts * 0.20;
    }
    
    return {
      saldoSalario,
      feriasVencidas,
      feriasProporcionais,
      decimoTerceiro,
      avisoPrevia: avisoValor,
      totalBruto,
      inss,
      irrf,
      totalLiquido: totalBruto - inss - irrf,
      multaFgts
    };
  };

  const desligamentoMutation = useMutation({
    mutationFn: async () => {
      if (!funcionario) return;
      
      // Atualizar status do funcionário
      const { error: updateError } = await supabase
        .from('funcionarios')
        .update({
          status: 'desligado',
          data_desligamento: dataDesligamento,
          motivo_desligamento: motivo,
          tipo_desligamento: tipoDesligamento,
          updated_at: new Date().toISOString()
        })
        .eq('id', funcionario.id);
      
      if (updateError) throw updateError;
      
      // Registrar no histórico
      await supabase.from('funcionarios_historico').insert({
        funcionario_id: funcionario.id,
        tipo: 'desligamento',
        data_vigencia: dataDesligamento,
        motivo: `${tiposDesligamento.find(t => t.value === tipoDesligamento)?.label}: ${motivo}`,
        salario_anterior: funcionario.salario_atual
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funcionarios'] });
      queryClient.invalidateQueries({ queryKey: ['funcionario'] });
      queryClient.invalidateQueries({ queryKey: ['rh-stats'] });
      toast.success('Desligamento registrado com sucesso!');
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error('Erro ao registrar desligamento: ' + error.message);
    }
  });

  const resetForm = () => {
    setTipoDesligamento('');
    setDataDesligamento(format(new Date(), 'yyyy-MM-dd'));
    setAvisoPrevia('indenizado');
    setMotivo('');
    setObservacoes('');
    setChecklist({});
    setCalculo(null);
    setStep(1);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const checklistCompleto = checklistItems.every(item => checklist[item.id]);

  if (!funcionario) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Desligamento de Funcionário
          </DialogTitle>
          <DialogDescription>
            {funcionario.nome_completo} - {funcionario.cargo?.nome || 'Sem cargo'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {step === 1 && (
            <div className="space-y-6">
              {/* Dados do Desligamento */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Desligamento *</Label>
                  <Select value={tipoDesligamento} onValueChange={setTipoDesligamento}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposDesligamento.map(tipo => (
                        <SelectItem key={tipo.value} value={tipo.value}>{tipo.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Data do Desligamento *</Label>
                  <Input 
                    type="date" 
                    value={dataDesligamento} 
                    onChange={(e) => setDataDesligamento(e.target.value)} 
                  />
                </div>
              </div>

              {(tipoDesligamento === 'sem_justa_causa' || tipoDesligamento === 'acordo') && (
                <div className="space-y-2">
                  <Label>Aviso Prévio</Label>
                  <Select value={avisoPrevia} onValueChange={setAvisoPrevia}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposAvisoPrevio.map(tipo => (
                        <SelectItem key={tipo.value} value={tipo.value}>{tipo.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Motivo do Desligamento *</Label>
                <Textarea 
                  value={motivo} 
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Descreva o motivo do desligamento..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Observações Adicionais</Label>
                <Textarea 
                  value={observacoes} 
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Observações internas..."
                  rows={2}
                />
              </div>

              {/* Prévia do Cálculo */}
              {calculo && tipoDesligamento && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calculator className="h-4 w-4" />
                      Prévia do Cálculo Rescisório
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <span className="text-muted-foreground">Saldo de Salário:</span>
                      <span className="text-right">{formatCurrency(calculo.saldoSalario)}</span>
                      
                      <span className="text-muted-foreground">Férias Vencidas + 1/3:</span>
                      <span className="text-right">{formatCurrency(calculo.feriasVencidas)}</span>
                      
                      <span className="text-muted-foreground">Férias Proporcionais + 1/3:</span>
                      <span className="text-right">{formatCurrency(calculo.feriasProporcionais)}</span>
                      
                      <span className="text-muted-foreground">13º Proporcional:</span>
                      <span className="text-right">{formatCurrency(calculo.decimoTerceiro)}</span>
                      
                      {calculo.avisoPrevia > 0 && (
                        <>
                          <span className="text-muted-foreground">Aviso Prévio Indenizado:</span>
                          <span className="text-right">{formatCurrency(calculo.avisoPrevia)}</span>
                        </>
                      )}
                    </div>
                    
                    <Separator />
                    
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <span className="font-medium">Total Bruto:</span>
                      <span className="text-right font-medium">{formatCurrency(calculo.totalBruto)}</span>
                      
                      <span className="text-muted-foreground">(-) INSS:</span>
                      <span className="text-right text-destructive">-{formatCurrency(calculo.inss)}</span>
                      
                      <span className="text-muted-foreground">(-) IRRF:</span>
                      <span className="text-right text-destructive">-{formatCurrency(calculo.irrf)}</span>
                    </div>
                    
                    <Separator />
                    
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <span className="font-bold">Total Líquido:</span>
                      <span className="text-right font-bold text-lg text-primary">
                        {formatCurrency(calculo.totalLiquido)}
                      </span>
                      
                      {calculo.multaFgts > 0 && (
                        <>
                          <span className="text-muted-foreground text-sm">Multa FGTS (estimativa):</span>
                          <span className="text-right text-sm">{formatCurrency(calculo.multaFgts)}</span>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              {/* Checklist de Desligamento */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Checklist de Desligamento
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {checklistItems.map(item => (
                    <div key={item.id} className="flex items-center space-x-3">
                      <Checkbox 
                        id={item.id}
                        checked={checklist[item.id] || false}
                        onCheckedChange={(checked) => 
                          setChecklist(prev => ({ ...prev, [item.id]: !!checked }))
                        }
                      />
                      <Label htmlFor={item.id} className="cursor-pointer">
                        {item.label}
                      </Label>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Resumo Final */}
              <Card className="border-primary">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Resumo do Desligamento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Funcionário:</span>
                    <span className="font-medium">{funcionario.nome_completo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tipo:</span>
                    <Badge variant="outline">
                      {tiposDesligamento.find(t => t.value === tipoDesligamento)?.label}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data Desligamento:</span>
                    <span>{format(parseISO(dataDesligamento), 'dd/MM/yyyy')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor Líquido:</span>
                    <span className="font-bold text-primary">{formatCurrency(calculo?.totalLiquido || 0)}</span>
                  </div>
                </CardContent>
              </Card>

              {!checklistCompleto && (
                <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg text-yellow-700 dark:text-yellow-400 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Complete o checklist antes de confirmar o desligamento</span>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="gap-2">
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={() => setStep(2)}
                disabled={!tipoDesligamento || !dataDesligamento || !motivo}
              >
                Próximo: Checklist
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>
                Voltar
              </Button>
              <Button 
                variant="destructive"
                onClick={() => desligamentoMutation.mutate()}
                disabled={desligamentoMutation.isPending || !checklistCompleto}
              >
                {desligamentoMutation.isPending ? 'Processando...' : 'Confirmar Desligamento'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
