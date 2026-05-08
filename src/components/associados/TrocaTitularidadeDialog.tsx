import { useState, useEffect, useRef } from 'react';
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
import { useBuscaSGA, extractTransientPayload } from '@/hooks/useBuscaSGA';
import { useQuery } from '@tanstack/react-query';
import { SgaTransientAlert } from '@/components/cotacao/SgaTransientAlert';

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

  // Quando o RQ esgota retries, o erro carrega o payload "soft" com erro_transitorio.
  const transientPayload = sga.error ? extractTransientPayload(sga.error) : null;
  const sgaPayload = sga.data ?? transientPayload;
  const sgaTransitorio = !!sgaPayload?.erro_transitorio || !!transientPayload;
  const sgaMotivo = sgaPayload?.motivo ?? transientPayload?.motivo ?? null;

  // 3) Para cada veículo SGA, mapeia para o UUID local pela placa.
  //    Normaliza placa (remove tudo que não é alfanumérico, uppercase) para evitar
  //    falso-negativo por hífen/maiúscula entre SGA e base local.
  const normPlaca = (p?: string | null) => (p || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const placas = (sgaPayload?.veiculos || []).map((v) => normPlaca(v.placa)).filter(Boolean);

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

  // Monta opções: para cada veículo SGA, busca o par local pela placa (normalizada)
  const veiculos: VeiculoOpcao[] = (sgaPayload?.veiculos || [])
    .map((v) => {
      const placaNorm = normPlaca(v.placa);
      const local = (veiculosLocais || []).find((l) => normPlaca(l.placa) === placaNorm);
      if (!local) return null;
      return {
        id: local.id,
        placa: v.placa,
        descricao: `${v.marca || local.marca || ''} ${v.modelo || local.modelo || ''} ${v.ano || local.ano_modelo || ''} - ${v.placa}`.trim(),
      };
    })
    .filter((x): x is VeiculoOpcao => !!x);

  // Auto-import: quando SGA tem veículos mas nenhum espelho local existe ainda.
  // Guarda por CPF para garantir EXATAMENTE 1 tentativa por abertura do diálogo,
  // evitando loop quando o import não consegue criar espelho com placa que case.
  const [importando, setImportando] = useState(false);
  const [importErro, setImportErro] = useState<string | null>(null);
  const tentativasImport = useRef<Set<string>>(new Set());

  useEffect(() => {
    const podeTentar =
      open &&
      !sga.isLoading &&
      !sgaTransitorio &&
      (sgaPayload?.veiculos || []).length > 0 &&
      veiculos.length === 0 &&
      cpfAntigo.length === 11 &&
      !tentativasImport.current.has(cpfAntigo);
    if (!podeTentar) return;
    tentativasImport.current.add(cpfAntigo);
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
    // Dependências mínimas — `tentativasImport` (ref) é o único gate de re-execução.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sga.isLoading, sgaTransitorio, sgaPayload?.veiculos?.length, cpfAntigo]);

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
      setImportErro(null);
      tentativasImport.current.clear();
    }
  }, [open]);

  const carregando = sga.isLoading || sga.isFetching || importando;
  // Distingue 3 estados: transitório (retry), realmente vazio, espelho local pendente.
  const sgaTransitorioVisivel = !sga.isLoading && sgaTransitorio;
  const semVeiculosSGA =
    !sga.isLoading &&
    !sgaTransitorio &&
    (!sgaPayload?.encontrado || (sgaPayload?.veiculos || []).length === 0);
  const semEspelhoLocal =
    !carregando &&
    !sgaTransitorio &&
    (sgaPayload?.veiculos || []).length > 0 &&
    veiculos.length === 0;

  const handleRetrySga = async () => {
    tentativasImport.current.clear();
    setImportErro(null);
    await sga.refetch();
    await refetchLocais();
  };

  const handleSubmit = async () => {
    if (!nome.trim() || !cpf.trim() || !veiculoId) {
      toast.error('Preencha nome, CPF e selecione o veículo');
      return;
    }
    try {
      // Garante que o UUID local está fresco (evita 'Veículo não encontrado' por cache stale após import SGA)
      const fresh = await refetchLocais();
      const veiculoSelecionado = veiculos.find(v => v.id === veiculoId);
      const placaFallback = veiculoSelecionado?.placa
        || (fresh.data || []).find(l => l.id === veiculoId)?.placa
        || null;
      const result = await criar.mutateAsync({
        associado_antigo_id: associadoId,
        veiculo_id: veiculoId,
        veiculo_placa: placaFallback || undefined,
        novo_titular: { nome: nome.trim(), cpf: cpf.trim(), email: email.trim() || undefined, telefone: telefone.trim() || undefined },
      });
      if ((result as any)?.termo_enviado_automaticamente === false) {
        toast.warning('Solicitação criada, mas o envio automático do termo de cancelamento falhou. Reenvie pelo modal de detalhes da solicitação.');
      } else {
        toast.success('Solicitação criada! Termo de cancelamento enviado ao titular antigo.');
      }
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
            ) : sgaTransitorioVisivel ? (
              <SgaTransientAlert
                motivo={sgaMotivo}
                onRetry={handleRetrySga}
                loading={sga.isFetching}
                titulo="Não foi possível consultar o SGA agora"
                descricao="A API do Hinova respondeu com erro temporário. Não significa que o CPF não tenha veículos — tente novamente em instantes."
              />
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
                <AlertDescription className="text-sm space-y-2">
                  <div>
                    {importErro
                      ? `Falha ao importar do SGA: ${importErro}`
                      : `O SGA tem ${sgaPayload?.veiculos.length} veículo(s) para este associado, mas o espelho local ainda não foi criado.`}
                  </div>
                  <Button size="sm" variant="outline" onClick={handleRetrySga} disabled={carregando}>
                    {carregando && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
                    Tentar novamente
                  </Button>
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
          <Button onClick={handleSubmit} disabled={criar.isPending || !veiculoId || sgaTransitorioVisivel}>
            {criar.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Users className="h-4 w-4 mr-2" />}
            Criar Solicitação
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
