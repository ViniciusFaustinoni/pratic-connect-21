import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { User, ArrowRight, Phone, UserPlus, X } from 'lucide-react';
import { useVendedores } from '@/hooks/useVendedores';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useAssociadoSearch, type AssociadoSearchResult } from '@/hooks/useAssociadoSearch';
import { resolverAssociadoLocalId } from '@/hooks/useResolverAssociadoLocal';
import { toast } from 'sonner';
import { useVerificarVeiculoAtivoCpf } from '@/hooks/useVerificarVeiculoAtivoCpf';
import { useVerificarDebitosAssociado } from '@/hooks/useVerificarDebitosAssociado';
import { DialogTipoOperacao } from '@/components/cotacao/DialogTipoOperacao';
import { DebitosCard } from '@/components/cotacao/DebitosCard';
import { SgaTransientAlert } from '@/components/cotacao/SgaTransientAlert';
import { IgnorarAvisoSGADialog } from '@/components/cotacao/IgnorarAvisoSGADialog';

interface EtapaDadosAssociadoProps {
  // Dados do associado/solicitante
  nome: string;
  setNome: (nome: string) => void;
  email: string;
  setEmail: (email: string) => void;
  telefone1: string;
  setTelefone1: (tel: string) => void;
  telefone2: string;
  setTelefone2: (tel: string) => void;
  
  // Consultor responsável
  consultorId: string;
  setConsultorId: (id: string) => void;

  // Indicação
  isIndicacao: boolean;
  setIsIndicacao: (v: boolean) => void;
  indicadorId: string;
  setIndicadorId: (id: string) => void;
  indicadorNome: string;
  setIndicadorNome: (nome: string) => void;
  
  // Navegação
  onNext: () => void;
  onSubstituicao?: (associadoId: string) => void;
}

const formatPhone = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 7) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
  if (cleaned.length <= 11) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
};

function formatCPF(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function EtapaDadosAssociado({
  nome,
  setNome,
  email,
  setEmail,
  telefone1,
  setTelefone1,
  telefone2,
  setTelefone2,
  consultorId,
  setConsultorId,
  isIndicacao,
  setIsIndicacao,
  indicadorId,
  setIndicadorId,
  indicadorNome,
  setIndicadorNome,
  onNext,
  onSubstituicao,
}: EtapaDadosAssociadoProps) {
  const { data: vendedores = [], isLoading: isLoadingVendedores } = useVendedores();
  const { user } = useAuth();
  const { isDiretor, isGerente, isSupervisor } = usePermissions();
  const podeAtribuirVendedor = isDiretor || isGerente || isSupervisor;

  const [buscaIndicador, setBuscaIndicador] = useState('');
  const { data: resultadosBusca = [], isLoading: isSearching } = useAssociadoSearch(buscaIndicador);

  // CPF para verificação de veículo ativo + débitos no SGA
  const [cpfBusca, setCpfBusca] = useState('');
  const cpfDigits = cpfBusca.replace(/\D/g, '');
  const { data: veiculoAtivoCpf, isLoading: verificandoCpf, isFetching: refazendoCpf, refetch: refetchVeiculoCpf, erroTransitorio: cpfErroTransitorio, motivoTransitorio: cpfMotivoTransitorio } = useVerificarVeiculoAtivoCpf(cpfBusca);
  const { data: debitosSGA } = useVerificarDebitosAssociado(cpfDigits.length === 11 ? cpfDigits : undefined);
  const [showDialogTipo, setShowDialogTipo] = useState(false);
  const [bypassDebitoSGA, setBypassDebitoSGA] = useState(false);
  const [showBypassDebitoDialog, setShowBypassDebitoDialog] = useState(false);

  // Auto-atribui o vendedor logado se ele não for liderança (ou pré-seleciona p/ liderança)
  useEffect(() => {
    if (!consultorId && user?.id) {
      setConsultorId(user.id);
    }
  }, [user?.id, consultorId, setConsultorId]);

  // Pode avançar se Nome, Telefone e Consultor estão preenchidos.
  // Bloqueia se houver débito SGA — ex-cliente precisa quitar antes.
  const telefoneValido = telefone1.replace(/\D/g, '').length >= 10;
  const temDebitoSGA = debitosSGA?.temDebito === true;
  const canProceed =
    nome.trim() !== '' &&
    telefoneValido &&
    consultorId !== '' &&
    (!isIndicacao || indicadorId !== '') &&
    !temDebitoSGA;

  const [isImportandoIndicador, setIsImportandoIndicador] = useState(false);

  const handleSelectIndicador = async (associado: AssociadoSearchResult) => {
    try {
      setIsImportandoIndicador(true);
      if (associado.origem_sga) {
        toast.info('Importando indicador do SGA...');
      }
      const localId = await resolverAssociadoLocalId(associado);
      setIndicadorId(localId);
      setIndicadorNome(associado.nome);
      setBuscaIndicador('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível selecionar este indicador');
    } finally {
      setIsImportandoIndicador(false);
    }
  };

  const handleClearIndicador = () => {
    setIndicadorId('');
    setIndicadorNome('');
    setBuscaIndicador('');
  };

  const handleToggleIndicacao = (checked: boolean) => {
    setIsIndicacao(checked);
    if (!checked) {
      handleClearIndicador();
    }
  };

  return (
    <>
    {veiculoAtivoCpf && (
      <DialogTipoOperacao
        open={showDialogTipo}
        onOpenChange={setShowDialogTipo}
        veiculoAtivo={veiculoAtivoCpf}
        onSubstituicao={(associadoId) => onSubstituicao?.(associadoId)}
        onInclusao={() => {
          // Continue normal flow
          setShowDialogTipo(false);
        }}
      />
    )}
    <Card className="border-border bg-card">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Dados do Solicitante</CardTitle>
            <CardDescription>
              Informe os dados de contato para a cotação
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Formulário de Dados */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Nome */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="nome">
              Nome <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome completo do solicitante"
            />
          </div>

          {/* CPF (opcional - para verificar veículo ativo) */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="cpf">
              CPF do cliente (opcional)
            </Label>
            <Input
              id="cpf"
              value={cpfBusca}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '');
                if (digits.length <= 11) {
                  setCpfBusca(formatCPF(digits));
                }
              }}
              placeholder="000.000.000-00"
              maxLength={14}
            />
            {verificandoCpf && (
              <p className="text-xs text-muted-foreground">Verificando CPF...</p>
            )}
            {!verificandoCpf && cpfErroTransitorio && cpfDigits.length === 11 && (
              <SgaTransientAlert
                motivo={cpfMotivoTransitorio}
                onRetry={() => refetchVeiculoCpf()}
                loading={refazendoCpf}
                compact
                titulo="SGA instável — não confirmamos se este CPF já é associado"
              />
            )}
            {veiculoAtivoCpf && !showDialogTipo && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                <User className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="flex-1">
                  <strong>{veiculoAtivoCpf.associado_nome}</strong> já possui veículo ativo ({veiculoAtivoCpf.veiculo_marca} {veiculoAtivoCpf.veiculo_modelo} - {veiculoAtivoCpf.veiculo_placa})
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDialogTipo(true)}
                >
                  Escolher operação
                </Button>
              </div>
            )}
          </div>

          {/* Aviso de débito SGA — ex-cliente com saldo devedor */}
          {temDebitoSGA && debitosSGA && (
            <div className="md:col-span-2">
              <DebitosCard
                debitos={debitosSGA.debitosPorVeiculo}
                saldoTotal={debitosSGA.saldoTotal}
                bloqueante
                cpf={cpfDigits}
                titulo="Este CPF já foi cliente Pratic e está com saldo devedor"
                descricao="É necessário quitar os boletos abaixo no SGA antes de iniciar uma nova cotação."
              />
            </div>
          )}

          {/* E-mail */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="email">E-mail (opcional)</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
            />
          </div>

          {/* Telefone/WhatsApp */}
          <div className="space-y-2">
            <Label htmlFor="telefone1" className="flex items-center gap-2">
              <Phone className="h-3 w-3" />
              Telefone/WhatsApp <span className="text-destructive">*</span>
            </Label>
            <Input
              id="telefone1"
              value={telefone1}
              onChange={(e) => setTelefone1(formatPhone(e.target.value))}
              placeholder="(00) 00000-0000"
              maxLength={15}
            />
          </div>

          {/* Telefone 2 */}
          <div className="space-y-2">
            <Label htmlFor="telefone2" className="flex items-center gap-2">
              <Phone className="h-3 w-3" />
              Telefone 2 (opcional)
            </Label>
            <Input
              id="telefone2"
              value={telefone2}
              onChange={(e) => setTelefone2(formatPhone(e.target.value))}
              placeholder="(00) 00000-0000"
              maxLength={15}
            />
          </div>
        </div>

        {podeAtribuirVendedor && (
          <>
            <Separator />

            {/* Consultor Responsável (apenas para liderança) */}
            <div className="space-y-2">
              <Label htmlFor="consultor">
                Consultor Responsável <span className="text-destructive">*</span>
              </Label>
              <Select value={consultorId} onValueChange={setConsultorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o consultor" />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingVendedores ? (
                    <SelectItem value="loading" disabled>
                      Carregando...
                    </SelectItem>
                  ) : (
                    vendedores.map((vendedor) => (
                      <SelectItem key={vendedor.user_id} value={vendedor.user_id}>
                        {vendedor.nome}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        <Separator />

        {/* Indicação */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="indicacao-switch" className="cursor-pointer">
                Este cliente foi indicado por um associado?
              </Label>
            </div>
            <Switch
              id="indicacao-switch"
              checked={isIndicacao}
              onCheckedChange={handleToggleIndicacao}
            />
          </div>

          {isIndicacao && (
            <div className="space-y-2 pl-6 border-l-2 border-primary/20">
              <Label>
                Associado indicador <span className="text-destructive">*</span>
              </Label>

              {indicadorId ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <User className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-medium text-sm flex-1">{indicadorNome}</span>
                  <button
                    type="button"
                    onClick={handleClearIndicador}
                    className="p-1 rounded hover:bg-muted transition-colors"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    value={buscaIndicador}
                    onChange={(e) => setBuscaIndicador(e.target.value)}
                    placeholder="Buscar por nome, telefone ou CPF..."
                  />
                  {buscaIndicador.length >= 2 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-auto">
                      {isSearching ? (
                        <div className="p-3 text-sm text-muted-foreground text-center">
                          Buscando...
                        </div>
                      ) : resultadosBusca.length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground text-center">
                          Nenhum associado encontrado
                        </div>
                      ) : (
                        resultadosBusca.map((assoc) => (
                          <button
                            key={assoc.id}
                            type="button"
                            onClick={() => handleSelectIndicador(assoc)}
                            className="w-full text-left px-3 py-2 hover:bg-accent transition-colors flex items-center gap-3"
                          >
                            <User className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-medium truncate">{assoc.nome}</span>
                              <span className="text-xs text-muted-foreground">
                                CPF: {formatCPF(assoc.cpf)}
                                {assoc.telefone && ` • Tel: ${assoc.telefone}`}
                              </span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Botão Avançar */}
        <div className="flex justify-end pt-4 border-t border-border">
          <Button
            onClick={onNext}
            disabled={!canProceed}
            size="lg"
            className="min-w-[140px]"
          >
            Avançar
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
    </>
  );
}
