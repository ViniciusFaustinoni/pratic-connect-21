import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { User, ArrowRight, Phone, UserPlus, X } from 'lucide-react';
import { useVendedores } from '@/hooks/useVendedores';
import { useState } from 'react';
import { useAssociadoSearch, type AssociadoSearchResult } from '@/hooks/useAssociadoSearch';
import { useVerificarVeiculoAtivoCpf } from '@/hooks/useVerificarVeiculoAtivoCpf';
import { DialogTipoOperacao } from '@/components/cotacao/DialogTipoOperacao';

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
  const [buscaIndicador, setBuscaIndicador] = useState('');
  const { data: resultadosBusca = [], isLoading: isSearching } = useAssociadoSearch(buscaIndicador);

  // CPF para verificação de veículo ativo
  const [cpfBusca, setCpfBusca] = useState('');
  const { data: veiculoAtivoCpf, isLoading: verificandoCpf } = useVerificarVeiculoAtivoCpf(cpfBusca);
  const [showDialogTipo, setShowDialogTipo] = useState(false);
  
  // Pode avançar se Nome, Telefone e Consultor estão preenchidos
  const telefoneValido = telefone1.replace(/\D/g, '').length >= 10;
  const canProceed = nome.trim() !== '' && telefoneValido && consultorId !== '' && (!isIndicacao || indicadorId !== '');

  const handleSelectIndicador = (associado: AssociadoSearchResult) => {
    setIndicadorId(associado.id);
    setIndicadorNome(associado.nome);
    setBuscaIndicador('');
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

        <Separator />

        {/* Consultor Responsável */}
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
  );
}
