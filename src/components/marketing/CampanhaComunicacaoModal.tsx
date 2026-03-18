import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Mail, MessageCircle, Smartphone } from 'lucide-react';

interface CampanhaComunicacaoModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const segmentos = [
  { value: 'associados_ativos', label: 'Associados Ativos' },
  { value: 'associados_inativos', label: 'Associados Inativos' },
  { value: 'associados_inadimplentes', label: 'Associados Inadimplentes' },
  { value: 'leads_novos', label: 'Leads Novos (últimos 30 dias)' },
  { value: 'leads_qualificados', label: 'Leads Qualificados' },
  { value: 'leads_perdidos', label: 'Leads Perdidos' },
  { value: 'aniversariantes_mes', label: 'Aniversariantes do Mês' },
  { value: 'todos_leads', label: 'Todos os Leads' },
];

export function CampanhaComunicacaoModal({ open, onClose, onSuccess }: CampanhaComunicacaoModalProps) {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<'email' | 'whatsapp' | 'sms'>('email');
  const [assunto, setAssunto] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [segmento, setSegmento] = useState('');
  const [dataAgendamento, setDataAgendamento] = useState('');

  const queryClient = useQueryClient();

  const resetForm = () => {
    setNome('');
    setTipo('email');
    setAssunto('');
    setConteudo('');
    setSegmento('');
    setDataAgendamento('');
  };

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from('campanhas_comunicacao')
        .insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campanhas-comunicacao'] });
      toast.success('Campanha criada com sucesso!');
      resetForm();
      onSuccess?.();
      onClose();
    },
    onError: (error: any) => {
      toast.error('Erro: ' + error.message);
    },
  });

  const handleSubmit = () => {
    if (!nome || !tipo || !segmento) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    const data = {
      nome,
      tipo,
      assunto: tipo === 'email' ? assunto : null,
      conteudo: conteudo || null,
      segmento,
      data_agendamento: dataAgendamento || null,
      status: dataAgendamento ? 'agendada' : 'rascunho',
    };

    mutation.mutate(data);
  };

  const tipoIcons = {
    email: Mail,
    whatsapp: MessageCircle,
    sms: Smartphone,
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Campanha de Comunicação</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome da Campanha *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Lembrete de Pagamento - Janeiro"
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo de Disparo *</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(['email', 'whatsapp', 'sms'] as const).map((t) => {
                const Icon = tipoIcons[t];
                return (
                  <Button
                    key={t}
                    type="button"
                    variant={tipo === t ? 'default' : 'outline'}
                    className="flex items-center gap-2"
                    onClick={() => setTipo(t)}
                  >
                    <Icon className="h-4 w-4" />
                    {t === 'email' ? 'E-mail' : t === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                  </Button>
                );
              })}
            </div>
          </div>

          {tipo === 'email' && (
            <div className="space-y-2">
              <Label htmlFor="assunto">Assunto do E-mail</Label>
              <Input
                id="assunto"
                value={assunto}
                onChange={(e) => setAssunto(e.target.value)}
                placeholder="Ex: Sua fatura vence em 3 dias"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="segmento">Segmento *</Label>
            <Select value={segmento} onValueChange={setSegmento}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o público-alvo" />
              </SelectTrigger>
              <SelectContent>
                {segmentos.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="conteudo">Conteúdo da Mensagem</Label>
            <Textarea
              id="conteudo"
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              placeholder="Digite o conteúdo da mensagem..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Use variáveis: {'{{nome}}'}, {'{{telefone}}'}, {'{{valor}}'}, {'{{vencimento}}'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dataAgendamento">Agendar para</Label>
            <Input
              id="dataAgendamento"
              type="datetime-local"
              value={dataAgendamento}
              onChange={(e) => setDataAgendamento(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Deixe em branco para salvar como rascunho
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {dataAgendamento ? 'Agendar Campanha' : 'Salvar Rascunho'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
