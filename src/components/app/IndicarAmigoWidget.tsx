import { useState } from 'react';
import { Gift, UserPlus, Check, Clock, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusLabels: Record<string, string> = {
  pendente: 'Aguardando',
  contatado: 'Em contato',
  convertido: 'Convertido',
  recompensado: 'Pago!',
  expirado: 'Expirado',
};

const statusConfig: Record<string, { className: string }> = {
  pendente: { className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
  contatado: { className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
  convertido: { className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  recompensado: { className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' },
  expirado: { className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
};

export function IndicarAmigoWidget() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');

  // Programa ativo
  const { data: programa } = useQuery({
    queryKey: ['programa-ativo'],
    queryFn: async () => {
      const { data } = await supabase
        .from('programa_indicacao')
        .select('*')
        .eq('ativo', true)
        .maybeSingle();
      return data;
    }
  });

  // Minhas indicações
  const { data: minhasIndicacoes } = useQuery({
    queryKey: ['minhas-indicacoes'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Buscar associado_id do usuário
      const { data: assoc } = await supabase
        .from('associados')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!assoc) return [];

      const { data } = await supabase
        .from('indicacoes')
        .select('*')
        .eq('indicador_id', assoc.id)
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    }
  });

  // Mutation para criar indicação
  const indicarMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      // Buscar dados do associado
      const { data: assoc } = await supabase
        .from('associados')
        .select('id, nome, telefone')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!assoc) throw new Error('Associado não encontrado');

      const { error } = await supabase
        .from('indicacoes')
        .insert({
          indicador_id: assoc.id,
          indicador_nome: assoc.nome,
          indicador_telefone: assoc.telefone,
          indicado_nome: nome,
          indicado_telefone: telefone,
          indicado_email: email || null,
          programa_id: programa?.id,
          valor_recompensa: programa?.valor_indicador,
          status: 'pendente',
          data_indicacao: new Date().toISOString().split('T')[0],
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Indicação enviada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['minhas-indicacoes'] });
      setShowModal(false);
      setNome('');
      setTelefone('');
      setEmail('');
    },
    onError: (error) => {
      toast.error('Erro ao enviar indicação');
      console.error(error);
    }
  });

  const handleIndicar = () => {
    if (!nome || !telefone) {
      toast.error('Preencha nome e telefone');
      return;
    }
    indicarMutation.mutate();
  };

  if (!programa) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Card Destaque */}
      <Card className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0">
        <CardContent className="p-6 text-center">
          <Gift className="h-12 w-12 mx-auto mb-3 opacity-90" />
          <h3 className="text-xl font-bold">Indique e Ganhe!</h3>
          <p className="mt-2 opacity-90">
            Indique um amigo e ganhe{' '}
            <span className="font-bold">R$ {programa.valor_indicador?.toFixed(2)}</span>{' '}
            quando ele se associar
          </p>
          <Button
            className="mt-4 bg-white text-purple-600 hover:bg-white/90"
            onClick={() => setShowModal(true)}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Indicar Agora
          </Button>
        </CardContent>
      </Card>

      {/* Minhas Indicações */}
      {minhasIndicacoes && minhasIndicacoes.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Minhas Indicações</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {minhasIndicacoes.map((ind: any) => (
                <div key={ind.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{ind.indicado_nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {ind.data_indicacao && format(new Date(ind.data_indicacao), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge className={statusConfig[ind.status]?.className || ''} variant="secondary">
                      {statusLabels[ind.status] || ind.status}
                    </Badge>
                    {ind.status === 'recompensado' && ind.valor_recompensa && (
                      <p className="text-xs text-green-600 mt-1 flex items-center justify-end gap-1">
                        <DollarSign className="h-3 w-3" />
                        R$ {ind.valor_recompensa?.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de Indicação */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Indicar um Amigo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do amigo *</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome completo"
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone do amigo *</Label>
              <Input
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label>Email (opcional)</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleIndicar} 
              disabled={!nome || !telefone || indicarMutation.isPending}
            >
              {indicarMutation.isPending ? 'Enviando...' : 'Enviar Indicação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
