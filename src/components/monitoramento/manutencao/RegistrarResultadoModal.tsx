import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Loader2, 
  CheckCircle2, 
  RefreshCw, 
  AlertTriangle, 
  Car, 
  User,
  Search,
} from 'lucide-react';
import { 
  useRegistrarResultadoManutencao, 
  useRastreadoresParaSubstituicao 
} from '@/hooks/useVistoriaManutencao';
import { 
  type VistoriaManutencao,
  type ResultadoManutencao,
  RESULTADO_MANUTENCAO_LABELS,
} from '@/types/vistoriaManutencao';

interface RegistrarResultadoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vistoria: VistoriaManutencao | null;
}

export function RegistrarResultadoModal({ 
  open, 
  onOpenChange,
  vistoria,
}: RegistrarResultadoModalProps) {
  const [resultado, setResultado] = useState<ResultadoManutencao>('resolvido');
  const [descricao, setDescricao] = useState('');
  const [rastreadorNovoId, setRastreadorNovoId] = useState('');
  const [idPlataforma, setIdPlataforma] = useState('');
  const [buscaRastreador, setBuscaRastreador] = useState('');

  const { data: rastreadoresDisponiveis, isLoading: loadingRastreadores } = useRastreadoresParaSubstituicao();
  const registrarMutation = useRegistrarResultadoManutencao();

  // Limpar ao fechar
  useEffect(() => {
    if (!open) {
      setResultado('resolvido');
      setDescricao('');
      setRastreadorNovoId('');
      setIdPlataforma('');
      setBuscaRastreador('');
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!vistoria || !descricao) return;

    if (resultado === 'substituicao' && !rastreadorNovoId) {
      return;
    }

    await registrarMutation.mutateAsync({
      servicoId: vistoria.id,
      resultado,
      descricao,
      rastreadorNovoId: resultado === 'substituicao' ? rastreadorNovoId : undefined,
      idPlataforma: resultado === 'substituicao' ? idPlataforma : undefined,
    });

    onOpenChange(false);
  };

  const isValid = descricao && (resultado === 'resolvido' || (resultado === 'substituicao' && rastreadorNovoId));

  // Filtrar rastreadores pela busca
  const rastreadorFiltrados = rastreadoresDisponiveis?.filter((r: any) => {
    if (!buscaRastreador) return true;
    const termo = buscaRastreador.toLowerCase();
    return (
      r.codigo?.toLowerCase().includes(termo) ||
      r.imei?.toLowerCase().includes(termo) ||
      r.numero_serie?.toLowerCase().includes(termo)
    );
  }) || [];

  const rastreadorSelecionado = rastreadoresDisponiveis?.find((r: any) => r.id === rastreadorNovoId);

  if (!vistoria) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Resultado da Manutenção</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Info do serviço */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{vistoria.associado?.nome}</span>
            </div>
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4 text-muted-foreground" />
              <span>
                {vistoria.veiculo?.marca} {vistoria.veiculo?.modelo} • {vistoria.veiculo?.placa}
              </span>
            </div>
            <div className="text-sm">
              Rastreador atual: <span className="font-mono font-medium">{vistoria.rastreador?.codigo}</span>
            </div>
          </div>

          {/* Resultado */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Resultado *</Label>
            <RadioGroup
              value={resultado}
              onValueChange={(v) => setResultado(v as ResultadoManutencao)}
              className="space-y-3"
            >
              <div 
                className={`flex items-start space-x-3 p-3 rounded-lg border ${
                  resultado === 'resolvido' ? 'border-green-500 bg-green-50' : 'border-muted'
                }`}
              >
                <RadioGroupItem value="resolvido" id="resolvido" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="resolvido" className="font-medium cursor-pointer flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Problema Resolvido
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    O rastreador foi reparado/resetado e continua instalado no veículo.
                  </p>
                </div>
              </div>

              <div 
                className={`flex items-start space-x-3 p-3 rounded-lg border ${
                  resultado === 'substituicao' ? 'border-purple-500 bg-purple-50' : 'border-muted'
                }`}
              >
                <RadioGroupItem value="substituicao" id="substituicao" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="substituicao" className="font-medium cursor-pointer flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-purple-600" />
                    Substituição de Rastreador
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    O rastreador antigo será BAIXADO e um novo será instalado no veículo.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Campos de substituição */}
          {resultado === 'substituicao' && (
            <>
              {/* Alerta de baixa */}
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Rastreador será BAIXADO</AlertTitle>
                <AlertDescription>
                  O rastreador <strong>{vistoria.rastreador?.codigo}</strong> será marcado como BAIXADO 
                  e NÃO poderá mais ser utilizado em nenhum veículo.
                </AlertDescription>
              </Alert>

              {/* Seleção de novo rastreador */}
              <div className="space-y-2">
                <Label>Novo Rastreador *</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar rastreador disponível..."
                    value={buscaRastreador}
                    onChange={(e) => setBuscaRastreador(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Rastreador selecionado */}
                {rastreadorSelecionado && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <span className="font-mono font-medium">{rastreadorSelecionado.codigo}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        IMEI: {rastreadorSelecionado.imei}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRastreadorNovoId('')}
                    >
                      Trocar
                    </Button>
                  </div>
                )}

                {/* Lista de rastreadores disponíveis */}
                {!rastreadorNovoId && (
                  <div className="border rounded-md max-h-40 overflow-auto">
                    {loadingRastreadores ? (
                      <div className="p-4 text-center">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                      </div>
                    ) : rastreadorFiltrados.length > 0 ? (
                      rastreadorFiltrados.slice(0, 10).map((r: any) => (
                        <button
                          key={r.id}
                          onClick={() => setRastreadorNovoId(r.id)}
                          className="w-full px-3 py-2 text-left hover:bg-muted flex items-center justify-between border-b last:border-0"
                        >
                          <div>
                            <span className="font-mono font-medium">{r.codigo}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {r.plataforma}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {r.imei}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-center text-muted-foreground text-sm">
                        Nenhum rastreador disponível em estoque
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ID na Plataforma */}
              {rastreadorNovoId && (
                <div className="space-y-2">
                  <Label>ID na Plataforma (ativação)</Label>
                  <Input
                    placeholder="Código de ativação na plataforma..."
                    value={idPlataforma}
                    onChange={(e) => setIdPlataforma(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Código de ativação na Rede Veículos ou Softruck (opcional)
                  </p>
                </div>
              )}
            </>
          )}

          {/* Descrição */}
          <div className="space-y-2">
            <Label>Descrição do que foi feito *</Label>
            <Textarea
              placeholder="Descreva o procedimento realizado..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!isValid || registrarMutation.isPending}
            className={resultado === 'substituicao' ? 'bg-purple-600 hover:bg-purple-700' : ''}
          >
            {registrarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {resultado === 'substituicao' ? 'Confirmar Substituição' : 'Confirmar Resultado'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
