import { useState } from 'react';
import { Plus, Edit2, Building2, CreditCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useContasBancarias, useCreateContaBancaria, useUpdateContaBancaria, ContaBancaria, TipoContaBancaria } from '@/hooks/useExtratoBancario';

const BANCOS = [
  { codigo: '001', nome: 'Banco do Brasil' },
  { codigo: '033', nome: 'Santander' },
  { codigo: '104', nome: 'Caixa Econômica' },
  { codigo: '237', nome: 'Bradesco' },
  { codigo: '341', nome: 'Itaú' },
  { codigo: '422', nome: 'Safra' },
  { codigo: '756', nome: 'Sicoob' },
  { codigo: '748', nome: 'Sicredi' },
  { codigo: '077', nome: 'Inter' },
  { codigo: '260', nome: 'Nubank' },
  { codigo: '336', nome: 'C6 Bank' },
];

interface ContaForm {
  banco_codigo: string;
  banco_nome: string;
  agencia: string;
  conta: string;
  digito: string;
  tipo: TipoContaBancaria;
  descricao: string;
  ativo: boolean;
}

const initialForm: ContaForm = {
  banco_codigo: '',
  banco_nome: '',
  agencia: '',
  conta: '',
  digito: '',
  tipo: 'corrente',
  descricao: '',
  ativo: true,
};

export default function ContasBancarias() {
  const { toast } = useToast();
  const { data: contas, isLoading } = useContasBancarias();
  const createConta = useCreateContaBancaria();
  const updateConta = useUpdateContaBancaria();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConta, setEditingConta] = useState<ContaBancaria | null>(null);
  const [form, setForm] = useState<ContaForm>(initialForm);

  const handleOpenNew = () => {
    setEditingConta(null);
    setForm(initialForm);
    setDialogOpen(true);
  };

  const handleEdit = (conta: ContaBancaria) => {
    setEditingConta(conta);
    setForm({
      banco_codigo: conta.banco_codigo,
      banco_nome: conta.banco_nome,
      agencia: conta.agencia,
      conta: conta.conta,
      digito: conta.digito || '',
      tipo: conta.tipo,
      descricao: conta.descricao || '',
      ativo: conta.ativo,
    });
    setDialogOpen(true);
  };

  const handleBancoChange = (codigo: string) => {
    const banco = BANCOS.find(b => b.codigo === codigo);
    setForm(prev => ({
      ...prev,
      banco_codigo: codigo,
      banco_nome: banco?.nome || '',
    }));
  };

  const handleSubmit = async () => {
    if (!form.banco_codigo || !form.agencia || !form.conta) {
      toast({ title: 'Preencha os campos obrigatórios', variant: 'destructive' });
      return;
    }

    try {
      if (editingConta) {
        await updateConta.mutateAsync({
          id: editingConta.id,
          ...form,
        });
        toast({ title: 'Conta atualizada com sucesso' });
      } else {
        await createConta.mutateAsync({
          ...form,
          saldo_atual: 0,
        });
        toast({ title: 'Conta cadastrada com sucesso' });
      }
      setDialogOpen(false);
    } catch (error) {
      toast({ title: 'Erro ao salvar conta', variant: 'destructive' });
    }
  };

  const formatConta = (conta: ContaBancaria) => {
    return `${conta.agencia} / ${conta.conta}${conta.digito ? `-${conta.digito}` : ''}`;
  };

  const getTipoBadge = (tipo: TipoContaBancaria) => {
    const config = {
      corrente: { label: 'Corrente', variant: 'default' as const },
      poupanca: { label: 'Poupança', variant: 'secondary' as const },
      investimento: { label: 'Investimento', variant: 'outline' as const },
    };
    return config[tipo] || config.corrente;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contas Bancárias</h1>
          <p className="text-muted-foreground">Gerencie as contas bancárias para conciliação</p>
        </div>
        <Button onClick={handleOpenNew}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Conta
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-20 bg-muted" />
              <CardContent className="h-16" />
            </Card>
          ))}
        </div>
      ) : contas && contas.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {contas.map(conta => (
            <Card key={conta.id} className={!conta.ativo ? 'opacity-60' : ''}>
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{conta.banco_nome}</CardTitle>
                    <p className="text-sm text-muted-foreground">{conta.banco_codigo}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleEdit(conta)}>
                  <Edit2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{formatConta(conta)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={getTipoBadge(conta.tipo).variant}>
                    {getTipoBadge(conta.tipo).label}
                  </Badge>
                  {!conta.ativo && <Badge variant="destructive">Inativa</Badge>}
                </div>
                {conta.descricao && (
                  <p className="text-sm text-muted-foreground">{conta.descricao}</p>
                )}
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">Saldo atual</p>
                  <p className="text-lg font-semibold">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(conta.saldo_atual)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">Nenhuma conta cadastrada</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Cadastre uma conta bancária para começar a importar extratos
          </p>
          <Button className="mt-4" onClick={handleOpenNew}>
            <Plus className="mr-2 h-4 w-4" />
            Cadastrar Conta
          </Button>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingConta ? 'Editar Conta' : 'Nova Conta Bancária'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Banco *</Label>
              <Select value={form.banco_codigo} onValueChange={handleBancoChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o banco" />
                </SelectTrigger>
                <SelectContent>
                  {BANCOS.map(banco => (
                    <SelectItem key={banco.codigo} value={banco.codigo}>
                      {banco.codigo} - {banco.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Agência *</Label>
                <Input 
                  value={form.agencia}
                  onChange={e => setForm(prev => ({ ...prev, agencia: e.target.value }))}
                  placeholder="0001"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select 
                  value={form.tipo} 
                  onValueChange={(v: TipoContaBancaria) => setForm(prev => ({ ...prev, tipo: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrente">Corrente</SelectItem>
                    <SelectItem value="poupanca">Poupança</SelectItem>
                    <SelectItem value="investimento">Investimento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Conta *</Label>
                <Input 
                  value={form.conta}
                  onChange={e => setForm(prev => ({ ...prev, conta: e.target.value }))}
                  placeholder="123456"
                />
              </div>
              <div className="space-y-2">
                <Label>Dígito</Label>
                <Input 
                  value={form.digito}
                  onChange={e => setForm(prev => ({ ...prev, digito: e.target.value }))}
                  placeholder="0"
                  maxLength={2}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input 
                value={form.descricao}
                onChange={e => setForm(prev => ({ ...prev, descricao: e.target.value }))}
                placeholder="Ex: Conta principal"
              />
            </div>

            {editingConta && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">Conta ativa</p>
                  <p className="text-sm text-muted-foreground">
                    Desative para ocultar da listagem
                  </p>
                </div>
                <Switch 
                  checked={form.ativo}
                  onCheckedChange={checked => setForm(prev => ({ ...prev, ativo: checked }))}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createConta.isPending || updateConta.isPending}
            >
              {editingConta ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
