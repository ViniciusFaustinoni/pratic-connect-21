import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save } from 'lucide-react';

interface DadosBancarios {
  banco: string;
  agencia_bancaria: string;
  conta_bancaria: string;
  tipo_conta: string;
  pix_tipo: string;
  pix_chave: string;
}

export default function DadosPagamento() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dados, setDados] = useState<DadosBancarios>({
    banco: '',
    agencia_bancaria: '',
    conta_bancaria: '',
    tipo_conta: '',
    pix_tipo: '',
    pix_chave: '',
  });

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('banco, agencia_bancaria, conta_bancaria, tipo_conta, pix_tipo, pix_chave' as '*')
        .eq('id', user.id)
        .single();

      if (!error && data) {
        const d = data as any;
        setDados({
          banco: d.banco || '',
          agencia_bancaria: d.agencia_bancaria || '',
          conta_bancaria: d.conta_bancaria || '',
          tipo_conta: d.tipo_conta || '',
          pix_tipo: d.pix_tipo || '',
          pix_chave: d.pix_chave || '',
        });
      }
      setLoading(false);
    })();
  }, [user?.id]);

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        banco: dados.banco || null,
        agencia_bancaria: dados.agencia_bancaria || null,
        conta_bancaria: dados.conta_bancaria || null,
        tipo_conta: dados.tipo_conta || null,
        pix_tipo: dados.pix_tipo || null,
        pix_chave: dados.pix_chave || null,
      })
      .eq('id', user.id);

    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar dados bancários');
    } else {
      toast.success('Dados bancários atualizados com sucesso');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dados de Pagamento</h1>
        <p className="text-muted-foreground">Gerencie seus dados bancários para recebimento de comissões.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conta Bancária</CardTitle>
          <CardDescription>Informe os dados da conta onde deseja receber seus pagamentos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="banco">Banco</Label>
              <Input
                id="banco"
                placeholder="Ex: Banco do Brasil"
                value={dados.banco}
                onChange={(e) => setDados({ ...dados, banco: e.target.value })}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo_conta">Tipo de Conta</Label>
              <Select
                value={dados.tipo_conta}
                onValueChange={(v) => setDados({ ...dados, tipo_conta: v })}
              >
                <SelectTrigger id="tipo_conta">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="corrente">Conta Corrente</SelectItem>
                  <SelectItem value="poupanca">Conta Poupança</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="agencia">Agência</Label>
              <Input
                id="agencia"
                placeholder="0000"
                value={dados.agencia_bancaria}
                onChange={(e) => setDados({ ...dados, agencia_bancaria: e.target.value })}
                maxLength={20}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conta">Conta</Label>
              <Input
                id="conta"
                placeholder="00000-0"
                value={dados.conta_bancaria}
                onChange={(e) => setDados({ ...dados, conta_bancaria: e.target.value })}
                maxLength={20}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chave Pix</CardTitle>
          <CardDescription>Informe sua chave Pix para recebimentos rápidos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pix_tipo">Tipo de Chave</Label>
              <Select
                value={dados.pix_tipo}
                onValueChange={(v) => setDados({ ...dados, pix_tipo: v })}
              >
                <SelectTrigger id="pix_tipo">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf_cnpj">CPF / CNPJ</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="telefone">Telefone</SelectItem>
                  <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pix_chave">Chave Pix</Label>
              <Input
                id="pix_chave"
                placeholder="Informe sua chave"
                value={dados.pix_chave}
                onChange={(e) => setDados({ ...dados, pix_chave: e.target.value })}
                maxLength={100}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Dados
        </Button>
      </div>
    </div>
  );
}
