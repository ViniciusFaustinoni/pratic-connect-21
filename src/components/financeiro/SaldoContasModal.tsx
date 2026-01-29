import { DollarSign, Building2, CreditCard, Wallet } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface SaldoContasModalProps {
  open: boolean;
  onClose: () => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const getBancoIcon = (banco: string) => {
  const bancoLower = banco?.toLowerCase() || '';
  if (bancoLower.includes('caixa')) return '🏦';
  if (bancoLower.includes('bradesco')) return '🔴';
  if (bancoLower.includes('itau') || bancoLower.includes('itaú')) return '🟠';
  if (bancoLower.includes('santander')) return '🔴';
  if (bancoLower.includes('banco do brasil') || bancoLower.includes('bb')) return '🟡';
  if (bancoLower.includes('nubank')) return '💜';
  if (bancoLower.includes('inter')) return '🟠';
  if (bancoLower.includes('sicoob') || bancoLower.includes('sicredi')) return '🟢';
  return '🏦';
};

export function SaldoContasModal({ open, onClose }: SaldoContasModalProps) {
  const { data: contas, isLoading } = useQuery({
    queryKey: ['contas-bancarias-saldo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contas_bancarias')
        .select('id, banco_nome, agencia, conta, saldo_atual, tipo')
        .eq('ativo', true)
        .order('banco_nome');
      
      if (error) throw error;
      return data || [];
    },
    enabled: open
  });

  const saldoTotal = contas?.reduce((acc, c) => acc + Number(c.saldo_atual || 0), 0) || 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Saldo por Conta Bancária
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Saldo Total */}
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground font-medium">Saldo Total</p>
                <p className={`text-3xl font-bold ${saldoTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {isLoading ? <Skeleton className="h-9 w-40 mx-auto" /> : formatCurrency(saldoTotal)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {contas?.length || 0} conta(s) ativa(s)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Contas */}
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-lg border">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32 mb-2" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-24" />
                </div>
              ))
            ) : contas && contas.length > 0 ? (
              contas.map((conta) => {
                const saldo = Number(conta.saldo_atual || 0);
                return (
                  <div
                    key={conta.id}
                    className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted text-xl">
                      {getBancoIcon(conta.banco_nome)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{conta.banco_nome}</p>
                      <p className="text-sm text-muted-foreground">
                        Ag: {conta.agencia} • CC: {conta.conta}
                        {conta.tipo && ` • ${conta.tipo}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(saldo)}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhuma conta bancária cadastrada</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
