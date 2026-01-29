import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Phone, 
  MessageSquare, 
  Copy, 
  Check, 
  SkipForward, 
  X, 
  User,
  Calendar,
  DollarSign,
  Clock,
  Handshake
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface FilaItem {
  id: string;
  associado_id: string;
  prioridade: number;
  motivo: string;
  associado?: {
    id: string;
    nome: string;
    telefone: string;
    whatsapp?: string;
    cpf?: string;
  };
  cobranca?: {
    valor_final: number;
    data_vencimento: string;
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
  fila: FilaItem[];
  currentIndex: number;
  onNext: () => void;
  onSkip: () => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatTelefone = (tel: string) => {
  const clean = tel?.replace(/\D/g, '') || '';
  if (clean.length === 11) return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  if (clean.length === 10) return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  return tel;
};

const ROTEIRO_LIGACAO = `Olá, bom dia/tarde! 

Aqui é [SEU_NOME] da Pratic Car. Estou entrando em contato pois identificamos uma pendência financeira em seu cadastro.

Gostaríamos de oferecer condições especiais para regularização:
- Desconto para pagamento à vista
- Parcelamento em até 12x
- Escolha do vencimento

Podemos conversar sobre as opções?`;

type ResultadoLigacao = 
  | 'atendeu_vai_pagar' 
  | 'atendeu_quer_acordo' 
  | 'nao_atendeu' 
  | 'caixa_postal'
  | 'numero_errado'
  | 'pediu_retorno';

export function ModoTrabalhoModal({ open, onClose, fila, currentIndex, onNext, onSkip }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [resultado, setResultado] = useState<ResultadoLigacao | ''>('');
  const [observacao, setObservacao] = useState('');
  const [dataRetorno, setDataRetorno] = useState('');
  const [copied, setCopied] = useState(false);

  const item = fila[currentIndex];
  const total = fila.length;

  const diasAtraso = item?.cobranca?.data_vencimento 
    ? differenceInDays(new Date(), new Date(item.cobranca.data_vencimento))
    : 0;

  const copyTelefone = () => {
    if (item?.associado?.telefone) {
      navigator.clipboard.writeText(item.associado.telefone.replace(/\D/g, ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Telefone copiado!');
    }
  };

  const openWhatsApp = () => {
    const numero = item?.associado?.whatsapp || item?.associado?.telefone || '';
    const limpo = numero.replace(/\D/g, '');
    window.open(`https://wa.me/55${limpo}`, '_blank');
  };

  const openDiscador = () => {
    const numero = item?.associado?.telefone || '';
    window.open(`tel:${numero.replace(/\D/g, '')}`, '_blank');
  };

  // Registrar contato
  const registrarContato = useMutation({
    mutationFn: async () => {
      const user = await supabase.auth.getUser();
      
      // Registrar o contato
      await supabase.from('cobranca_contatos').insert({
        associado_id: item.associado_id,
        tipo: 'ligacao',
        resultado: resultado,
        observacao: observacao,
        realizado_por: user.data.user?.id
      });

      // Atualizar status da fila
      await supabase.from('cobranca_fila').update({
        status: resultado === 'pediu_retorno' ? 'pendente' : 'concluido',
        data_agendamento: resultado === 'pediu_retorno' && dataRetorno 
          ? new Date(dataRetorno).toISOString() 
          : null,
        concluido_em: resultado !== 'pediu_retorno' ? new Date().toISOString() : null
      }).eq('id', item.id);

      return { resultado };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fila-cobranca'] });
      queryClient.invalidateQueries({ queryKey: ['fila-cobranca-stats'] });
      
      // Reset form
      setResultado('');
      setObservacao('');
      setDataRetorno('');

      if (data.resultado === 'atendeu_quer_acordo') {
        toast.success('Redirecionando para criar acordo...');
        onClose();
        navigate(`/cobranca/acordos/novo?associado=${item.associado_id}`);
      } else {
        toast.success('Contato registrado!');
        onNext();
      }
    },
    onError: () => {
      toast.error('Erro ao registrar contato');
    }
  });

  const handleProximo = () => {
    if (!resultado) {
      toast.error('Selecione o resultado da ligação');
      return;
    }
    if (resultado === 'pediu_retorno' && !dataRetorno) {
      toast.error('Informe a data de retorno');
      return;
    }
    registrarContato.mutate();
  };

  const handleProporAcordo = () => {
    onClose();
    navigate(`/cobranca/acordos/novo?associado=${item?.associado_id}`);
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Ação de Cobrança
            </DialogTitle>
            <Badge variant="outline" className="text-sm">
              #{currentIndex + 1} de {total}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Dados do Associado */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">{item.associado?.nome || 'Associado'}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{formatTelefone(item.associado?.telefone || '')}</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={copyTelefone}>
                {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={openDiscador}>
                <Phone className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={openWhatsApp}>
                <MessageSquare className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Dados da Dívida */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3 text-center">
              <DollarSign className="h-4 w-4 mx-auto text-red-600 mb-1" />
              <p className="text-xs text-muted-foreground">Valor</p>
              <p className="font-bold text-red-700 dark:text-red-400">
                {formatCurrency(item.cobranca?.valor_final || 0)}
              </p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-950/30 rounded-lg p-3 text-center">
              <Clock className="h-4 w-4 mx-auto text-orange-600 mb-1" />
              <p className="text-xs text-muted-foreground">Atraso</p>
              <p className="font-bold text-orange-700 dark:text-orange-400">
                {diasAtraso} dias
              </p>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-950/30 rounded-lg p-3 text-center">
              <Calendar className="h-4 w-4 mx-auto text-yellow-600 mb-1" />
              <p className="text-xs text-muted-foreground">Vencimento</p>
              <p className="font-bold text-yellow-700 dark:text-yellow-400 text-sm">
                {item.cobranca?.data_vencimento 
                  ? format(new Date(item.cobranca.data_vencimento), 'dd/MM', { locale: ptBR })
                  : '-'
                }
              </p>
            </div>
          </div>

          <Separator />

          {/* Roteiro */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Roteiro de Ligação</Label>
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-sm text-muted-foreground whitespace-pre-line max-h-[120px] overflow-y-auto">
              {ROTEIRO_LIGACAO}
            </div>
          </div>

          <Separator />

          {/* Resultado da Ligação */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Resultado da Ligação</Label>
            <RadioGroup value={resultado} onValueChange={(v) => setResultado(v as ResultadoLigacao)}>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center space-x-2 p-2 rounded-lg border hover:bg-muted/50">
                  <RadioGroupItem value="atendeu_vai_pagar" id="r1" />
                  <Label htmlFor="r1" className="text-sm cursor-pointer">✅ Atendeu - Vai pagar</Label>
                </div>
                <div className="flex items-center space-x-2 p-2 rounded-lg border hover:bg-muted/50">
                  <RadioGroupItem value="atendeu_quer_acordo" id="r2" />
                  <Label htmlFor="r2" className="text-sm cursor-pointer">🤝 Atendeu - Quer acordo</Label>
                </div>
                <div className="flex items-center space-x-2 p-2 rounded-lg border hover:bg-muted/50">
                  <RadioGroupItem value="nao_atendeu" id="r3" />
                  <Label htmlFor="r3" className="text-sm cursor-pointer">📵 Não atendeu</Label>
                </div>
                <div className="flex items-center space-x-2 p-2 rounded-lg border hover:bg-muted/50">
                  <RadioGroupItem value="caixa_postal" id="r4" />
                  <Label htmlFor="r4" className="text-sm cursor-pointer">📭 Caixa postal</Label>
                </div>
                <div className="flex items-center space-x-2 p-2 rounded-lg border hover:bg-muted/50">
                  <RadioGroupItem value="numero_errado" id="r5" />
                  <Label htmlFor="r5" className="text-sm cursor-pointer">❌ Número errado</Label>
                </div>
                <div className="flex items-center space-x-2 p-2 rounded-lg border hover:bg-muted/50">
                  <RadioGroupItem value="pediu_retorno" id="r6" />
                  <Label htmlFor="r6" className="text-sm cursor-pointer">📅 Pediu retorno</Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Data de Retorno (condicional) */}
          {resultado === 'pediu_retorno' && (
            <div>
              <Label className="text-sm font-medium mb-2 block">Data/Hora do Retorno</Label>
              <Input
                type="datetime-local"
                value={dataRetorno}
                onChange={(e) => setDataRetorno(e.target.value)}
              />
            </div>
          )}

          {/* Observações */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Observações</Label>
            <Textarea
              placeholder="Anotações sobre a ligação..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onSkip}>
              <SkipForward className="h-4 w-4 mr-1" />
              Pular
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4 mr-1" />
              Fechar
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleProporAcordo}>
              <Handshake className="h-4 w-4 mr-1" />
              Propor Acordo
            </Button>
            <Button 
              onClick={handleProximo}
              disabled={registrarContato.isPending}
            >
              {registrarContato.isPending ? 'Salvando...' : 'Próximo'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
