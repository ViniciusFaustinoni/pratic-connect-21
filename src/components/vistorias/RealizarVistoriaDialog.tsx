import { useState, useMemo } from 'react';
import { Search, Car, Bike, ArrowLeft, Save, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { VistoriaFotoGrid } from './VistoriaFotoGrid';
import {
  getFotosByTipoVeiculo,
  getCategoriasByTipoVeiculo,
  agruparFotosPorCategoria,
} from '@/data/vistoriaConfig';
import {
  useBuscarVeiculos,
  useCriarVistoria,
  useUploadVistoriaFoto,
  useVistoria,
  useFinalizarVistoria,
  useSalvarRascunhoVistoria,
} from '@/hooks/useVistorias';
import { toast } from 'sonner';

interface RealizarVistoriaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TipoVeiculo = 'automovel' | 'moto';

interface VeiculoSelecionado {
  id: string;
  placa: string;
  marca: string | null;
  modelo: string | null;
  associado: {
    id: string;
    nome: string;
    telefone: string;
  } | null;
}

export function RealizarVistoriaDialog({ open, onOpenChange }: RealizarVistoriaDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoVeiculo, setTipoVeiculo] = useState<TipoVeiculo>('automovel');
  const [veiculoSelecionado, setVeiculoSelecionado] = useState<VeiculoSelecionado | null>(null);
  const [vistoriaId, setVistoriaId] = useState<string | null>(null);
  const [uploadingFoto, setUploadingFoto] = useState<string | null>(null);
  const [observacoes, setObservacoes] = useState('');
  const [kmAtual, setKmAtual] = useState('');

  const { data: veiculos = [], isLoading: buscandoVeiculos } = useBuscarVeiculos(searchTerm);
  const { data: vistoria } = useVistoria(vistoriaId);
  const criarVistoria = useCriarVistoria();
  const uploadFoto = useUploadVistoriaFoto();
  const finalizarVistoria = useFinalizarVistoria();
  const salvarRascunho = useSalvarRascunhoVistoria();

  const fotos = getFotosByTipoVeiculo(tipoVeiculo);
  const categorias = getCategoriasByTipoVeiculo(tipoVeiculo);
  const categoriasComFotos = agruparFotosPorCategoria(fotos, categorias);

  const fotosEnviadas = vistoria?.fotos || [];
  const totalFotos = fotos.length;
  const fotosCompletas = fotosEnviadas.length;
  const progresso = (fotosCompletas / totalFotos) * 100;
  const podesFinalizar = fotosCompletas === totalFotos;

  const handleSelecionarVeiculo = (veiculo: VeiculoSelecionado) => {
    setVeiculoSelecionado(veiculo);
    // Default to automóvel
    setTipoVeiculo('automovel');
  };

  const handleContinuar = async () => {
    if (!veiculoSelecionado) {
      toast.error('Selecione um veículo para continuar');
      return;
    }

    if (!veiculoSelecionado.associado?.id) {
      toast.error('Veículo sem associado vinculado');
      return;
    }

    try {
      const result = await criarVistoria.mutateAsync({
        veiculo_id: veiculoSelecionado.id,
        associado_id: veiculoSelecionado.associado.id,
        tipo_veiculo: tipoVeiculo,
      });

      setVistoriaId(result.id);
      setStep(2);
      toast.success('Vistoria iniciada!');
    } catch (error) {
      console.error('Erro ao criar vistoria:', error);
    }
  };

  const handleUploadFoto = async (fotoId: string, file: File) => {
    if (!vistoriaId) return;

    setUploadingFoto(fotoId);
    try {
      await uploadFoto.mutateAsync({
        vistoria_id: vistoriaId,
        tipo: fotoId,
        file,
      });
      toast.success('Foto enviada!');
    } catch (error) {
      console.error('Erro no upload:', error);
    } finally {
      setUploadingFoto(null);
    }
  };

  const handleSalvarRascunho = async () => {
    if (!vistoriaId) return;

    await salvarRascunho.mutateAsync({
      id: vistoriaId,
      observacoes,
      km_atual: kmAtual ? parseInt(kmAtual) : undefined,
    });
  };

  const handleFinalizar = async () => {
    if (!vistoriaId) return;

    await finalizarVistoria.mutateAsync({
      id: vistoriaId,
      observacoes,
      km_atual: kmAtual ? parseInt(kmAtual) : undefined,
    });

    onOpenChange(false);
    resetState();
  };

  const resetState = () => {
    setStep(1);
    setSearchTerm('');
    setVeiculoSelecionado(null);
    setVistoriaId(null);
    setObservacoes('');
    setKmAtual('');
  };

  const handleClose = () => {
    onOpenChange(false);
    resetState();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 2 && (
              <Button variant="ghost" size="icon" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {step === 1 ? 'Realizar Vistoria' : `Vistoria: ${veiculoSelecionado?.placa}`}
          </DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-6">
            {/* Busca de veículo */}
            <div className="space-y-2">
              <Label>Buscar veículo por placa ou nome do cliente</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Digite a placa ou nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Resultados da busca */}
            {searchTerm.length >= 2 && (
              <div className="space-y-2">
                <Label>Resultados</Label>
                <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                  {buscandoVeiculos ? (
                    <div className="p-4 text-center text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    </div>
                  ) : veiculos.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      Nenhum veículo encontrado
                    </div>
                  ) : (
                    veiculos.map((veiculo: any) => (
                      <div
                        key={veiculo.id}
                        className={cn(
                          "flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors",
                          veiculoSelecionado?.id === veiculo.id && "bg-primary/10"
                        )}
                        onClick={() => handleSelecionarVeiculo(veiculo)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="font-mono font-semibold">{veiculo.placa}</div>
                          <div className="text-sm text-muted-foreground">
                            {veiculo.marca} {veiculo.modelo}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {veiculo.associado?.nome}
                        </div>
                        {veiculoSelecionado?.id === veiculo.id && (
                          <CheckCircle className="h-5 w-5 text-primary" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Tipo de veículo */}
            <div className="space-y-2">
              <Label>Tipo de veículo</Label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  className={cn(
                    "flex flex-col items-center gap-2 p-6 rounded-xl border-2 transition-all",
                    tipoVeiculo === 'automovel'
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/50"
                  )}
                  onClick={() => setTipoVeiculo('automovel')}
                >
                  <Car className={cn("h-10 w-10", tipoVeiculo === 'automovel' ? "text-primary" : "text-muted-foreground")} />
                  <span className="font-medium">Automóvel</span>
                  <span className="text-xs text-muted-foreground">30 fotos</span>
                </button>

                <button
                  type="button"
                  className={cn(
                    "flex flex-col items-center gap-2 p-6 rounded-xl border-2 transition-all",
                    tipoVeiculo === 'moto'
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/50"
                  )}
                  onClick={() => setTipoVeiculo('moto')}
                >
                  <Bike className={cn("h-10 w-10", tipoVeiculo === 'moto' ? "text-primary" : "text-muted-foreground")} />
                  <span className="font-medium">Moto</span>
                  <span className="text-xs text-muted-foreground">14 fotos</span>
                </button>
              </div>
            </div>

            {/* Botão continuar */}
            <div className="flex justify-end">
              <Button
                onClick={handleContinuar}
                disabled={!veiculoSelecionado || criarVistoria.isPending}
              >
                {criarVistoria.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Continuar'
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Barra de progresso */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Progresso da Vistoria</span>
                <span className="text-muted-foreground">
                  {fotosCompletas}/{totalFotos} fotos ({Math.round(progresso)}%)
                </span>
              </div>
              <Progress value={progresso} className="h-3" />
            </div>

            {/* Grid de fotos */}
            <VistoriaFotoGrid
              categorias={categoriasComFotos}
              fotosEnviadas={fotosEnviadas}
              uploadingFoto={uploadingFoto}
              onUpload={handleUploadFoto}
            />

            {/* Campos adicionais */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="km">Quilometragem atual</Label>
                <Input
                  id="km"
                  type="number"
                  placeholder="Ex: 45000"
                  value={kmAtual}
                  onChange={(e) => setKmAtual(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="obs">Observações</Label>
              <Textarea
                id="obs"
                placeholder="Anotações sobre a vistoria..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
              />
            </div>

            {/* Botões de ação */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleSalvarRascunho}
                disabled={salvarRascunho.isPending}
              >
                {salvarRascunho.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar Rascunho
              </Button>

              <Button
                onClick={handleFinalizar}
                disabled={!podesFinalizar || finalizarVistoria.isPending}
                className={cn(
                  podesFinalizar && "animate-pulse bg-emerald-600 hover:bg-emerald-700"
                )}
              >
                {finalizarVistoria.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Finalizando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Finalizar Vistoria
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
