import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CpfInput, TelefoneInput } from '@/components/inputs/MaskedInputs';
import { Loader2, Users, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCriarSolicitacaoTroca } from '@/hooks/useSolicitacoesTroca';

interface TrocaTitularidadeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  associadoId: string;
  associadoNome: string;
}

export function TrocaTitularidadeDialog({
  open, onOpenChange, associadoId, associadoNome,
}: TrocaTitularidadeDialogProps) {
  const navigate = useNavigate();
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [veiculoId, setVeiculoId] = useState<string | null>(null);
  const [veiculos, setVeiculos] = useState<Array<{ id: string; descricao: string }>>([]);
  const [loadingVeiculos, setLoadingVeiculos] = useState(false);
  const criar = useCriarSolicitacaoTroca();

  // Carregar veículos do associado quando abre
  if (open && veiculos.length === 0 && !loadingVeiculos) {
    setLoadingVeiculos(true);
    supabase
      .from('veiculos')
      .select('id, marca, modelo, ano, placa')
      .eq('associado_id', associadoId)
      .then(({ data }) => {
        const list = (data || []).map(v => ({
          id: v.id,
          descricao: `${v.marca} ${v.modelo} ${v.ano} - ${v.placa}`,
        }));
        setVeiculos(list);
        if (list.length === 1) setVeiculoId(list[0].id);
        setLoadingVeiculos(false);
      });
  }

  const handleSubmit = async () => {
    if (!nome.trim() || !cpf.trim() || !veiculoId) {
      toast.error('Preencha nome, CPF e selecione o veículo');
      return;
    }
    try {
      const result = await criar.mutateAsync({
        associado_antigo_id: associadoId,
        veiculo_id: veiculoId,
        novo_titular: { nome: nome.trim(), cpf: cpf.trim(), email: email.trim() || undefined, telefone: telefone.trim() || undefined },
      });
      toast.success('Solicitação criada! Continue preenchendo a cotação.');
      onOpenChange(false);
      // Redirecionar para edição da cotação criada
      if (result?.cotacao_id) {
        navigate(`/vendas/cotacoes/${result.cotacao_id}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar solicitação');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Troca de Titularidade
          </DialogTitle>
          <DialogDescription>
            Transferir o veículo de <strong>{associadoNome}</strong> para um novo titular.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Será criada uma cotação para o novo titular. Após preenchida, gere o link público — o novo titular escolhe o plano e envia documentos. A solicitação passará por aprovação do Cadastro e do Monitoramento antes da assinatura.
          </AlertDescription>
        </Alert>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Veículo a transferir *</Label>
            {loadingVeiculos ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
            ) : veiculos.length === 0 ? (
              <p className="text-sm text-destructive">Nenhum veículo encontrado</p>
            ) : (
              <select
                className="w-full border rounded h-10 px-3 bg-background"
                value={veiculoId || ''}
                onChange={(e) => setVeiculoId(e.target.value)}
              >
                <option value="">Selecione…</option>
                {veiculos.map(v => <option key={v.id} value={v.id}>{v.descricao}</option>)}
              </select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="novo-titular-nome">Nome completo do novo titular *</Label>
            <Input id="novo-titular-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="novo-titular-cpf">CPF do novo titular *</Label>
            <CpfInput value={cpf} onChange={setCpf} id="novo-titular-cpf" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="novo-titular-email">Email</Label>
            <Input id="novo-titular-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="novo-titular-telefone">Telefone / WhatsApp</Label>
            <TelefoneInput value={telefone} onChange={setTelefone} id="novo-titular-telefone" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={criar.isPending}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={criar.isPending}>
            {criar.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Users className="h-4 w-4 mr-2" />}
            Criar Solicitação
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
