import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CpfInput, TelefoneInput } from '@/components/inputs/MaskedInputs';
import { Loader2, Users, Info, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCriarSolicitacaoTroca } from '@/hooks/useSolicitacoesTroca';
import { useBuscaSGA } from '@/hooks/useBuscaSGA';
import { useQuery } from '@tanstack/react-query';

interface TrocaTitularidadeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  associadoId: string;
  associadoNome: string;
  associadoCpf?: string | null;
}

interface VeiculoOpcao {
  id: string;            // UUID local (necessário para o backend)
  descricao: string;
  placa: string;
}

export function TrocaTitularidadeDialog({
  open, onOpenChange, associadoId, associadoNome, associadoCpf,
}: TrocaTitularidadeDialogProps) {
  const navigate = useNavigate();
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [veiculoId, setVeiculoId] = useState<string | null>(null);
  const criar = useCriarSolicitacaoTroca();

  // 1) Busca o CPF do associado antigo na base local (apenas para localizar no SGA)
  const { data: associadoLocal } = useQuery({
    queryKey: ['troca-tit-associado-cpf', associadoId],
    queryFn: async () => {
      const { data } = await supabase
        .from('associados')
        .select('cpf')
        .eq('id', associadoId)
        .maybeSingle();
      return data?.cpf || null;
    },
    enabled: open && !!associadoId && !associadoCpf,
  });

  const cpfAntigo = (associadoCpf || associadoLocal || '').replace(/\D/g, '');

  // 2) Lista veículos do associado antigo NO SGA
  const sga = useBuscaSGA({ cpf: cpfAntigo, enabled: open && cpfAntigo.length === 11 });

  // 3) Para cada veículo SGA, mapeia para o UUID local pela placa.
  //    Se não houver espelho local, dispara import automático do SGA (cria associado + veículos).
  const placas = (sga.data?.veiculos || []).map((v) => v.placa).filter(Boolean);

  const { data: veiculosLocais, refetch: refetchLocais } = useQuery({
    queryKey: ['troca-tit-veiculos-local-by-placa', placas.join(',')],
    queryFn: async () => {
      if (placas.length === 0) return [] as Array<{ id: string; placa: string; marca: string; modelo: string; ano_modelo: number | null; associado_id: string }>;
      const { data } = await supabase
        .from('veiculos')
        .select('id, placa, marca, modelo, ano_modelo, associado_id')
        .in('placa', placas);
      return data || [];
    },
    enabled: open && placas.length > 0,
  });

  // Monta opções: para cada veículo SGA, busca o par local pela placa
  const veiculos: VeiculoOpcao[] = (sga.data?.veiculos || [])
    .map((v) => {
      const local = (veiculosLocais || []).find(
        (l) => (l.placa || '').toUpperCase() === (v.placa || '').toUpperCase(),
      );
      if (!local) return null;
      return {
        id: local.id,
        placa: v.placa,
        descricao: `${v.marca || local.marca || ''} ${v.modelo || local.modelo || ''} ${v.ano || local.ano_modelo || ''} - ${v.placa}`.trim(),
      };
    })
    .filter((x): x is VeiculoOpcao => !!x);

  // Auto-import: quando SGA tem veículos mas nenhum espelho local existe ainda
  const [importando, setImportando] = useState(false);
  const [importErro, setImportErro] = useState<string | null>(null);
  useEffect(() => {
    const semEspelho =
      open &&
      !sga.isLoading &&
      (sga.data?.veiculos || []).length > 0 &&
      veiculos.length === 0 &&
      !importando &&
      cpfAntigo.length === 11;
    if (!semEspelho) return;
    (async () => {
      try {
        setImportando(true);
        setImportErro(null);
        const { data, error } = await supabase.functions.invoke('importar-associado-sga', {
          body: { cpf: cpfAntigo },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        await refetchLocais();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Falha ao importar do SGA';
        setImportErro(msg);
      } finally {
        setImportando(false);
      }
    })();
  }, [open, sga.isLoading, sga.data, veiculos.length, importando, cpfAntigo, refetchLocais]);

  // Auto-seleciona se só houver 1
  useEffect(() => {
    if (open && veiculos.length === 1 && !veiculoId) {
      setVeiculoId(veiculos[0].id);
    }
  }, [open, veiculos, veiculoId]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setVeiculoId(null);
      setNome(''); setCpf(''); setEmail(''); setTelefone('');
    }
  }, [open]);

  const carregando = sga.isLoading || importando;
  const semVeiculosSGA = !sga.isLoading && (!sga.data?.encontrado || (sga.data?.veiculos || []).length === 0);
  const semEspelhoLocal =
    !carregando && (sga.data?.veiculos || []).length > 0 && veiculos.length === 0;

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
            Veículos buscados em tempo real na base SGA. Será criada uma cotação para o novo titular — após preenchida, gere o link público; a solicitação passará por aprovação do Cadastro e do Monitoramento antes da assinatura.
          </AlertDescription>
        </Alert>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Veículo a transferir *</Label>
            {carregando ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {importando ? 'Importando dados do SGA…' : 'Buscando veículos no SGA…'}
              </div>
            ) : semVeiculosSGA ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Nenhum veículo encontrado no SGA para este CPF.
                </AlertDescription>
              </Alert>
            ) : semEspelhoLocal ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {importErro
                    ? `Falha ao importar do SGA: ${importErro}`
                    : `O SGA tem ${sga.data?.veiculos.length} veículo(s) para este associado, mas o import automático ainda não concluiu. Tente novamente em instantes.`}
                </AlertDescription>
              </Alert>
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
          <Button onClick={handleSubmit} disabled={criar.isPending || !veiculoId}>
            {criar.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Users className="h-4 w-4 mr-2" />}
            Criar Solicitação
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
