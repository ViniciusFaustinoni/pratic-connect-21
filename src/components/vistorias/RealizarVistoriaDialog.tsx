import { useState } from 'react';
import { Car, Bike, ArrowLeft, Save, CheckCircle, XCircle, Loader2, Camera } from 'lucide-react';
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
import { VincularContratoModal } from './VincularContratoModal';
import {
  getFotosByTipoVeiculo,
  getCategoriasByTipoVeiculo,
  agruparFotosPorCategoria,
} from '@/data/vistoriaConfig';
import {
  useCriarVistoriaAvulsa,
  useUploadVistoriaFoto,
  useVistoria,
  useSalvarRascunhoVistoria,
  useFinalizarVistoriaComDecisao,
} from '@/hooks/useVistorias';
import { toast } from 'sonner';

interface RealizarVistoriaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TipoVeiculo = 'automovel' | 'moto';

export function RealizarVistoriaDialog({ open, onOpenChange }: RealizarVistoriaDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [tipoVeiculo, setTipoVeiculo] = useState<TipoVeiculo>('automovel');
  const [vistoriaId, setVistoriaId] = useState<string | null>(null);
  const [uploadingFoto, setUploadingFoto] = useState<string | null>(null);
  const [observacoes, setObservacoes] = useState('');
  const [kmAtual, setKmAtual] = useState('');
  const [showVincularModal, setShowVincularModal] = useState(false);

  const { data: vistoria } = useVistoria(vistoriaId);
  const criarVistoriaAvulsa = useCriarVistoriaAvulsa();
  const uploadFoto = useUploadVistoriaFoto();
  const finalizarComDecisao = useFinalizarVistoriaComDecisao();
  const salvarRascunho = useSalvarRascunhoVistoria();

  const fotos = getFotosByTipoVeiculo(tipoVeiculo);
  const categorias = getCategoriasByTipoVeiculo(tipoVeiculo);
  const categoriasComFotos = agruparFotosPorCategoria(fotos, categorias);

  const fotosEnviadas = vistoria?.fotos || [];
  const totalFotos = fotos.length;
  const fotosCompletas = fotosEnviadas.length;
  const progresso = (fotosCompletas / totalFotos) * 100;
  const todasFotosEnviadas = fotosCompletas === totalFotos;

  const handleIniciarVistoria = async () => {
    try {
      const result = await criarVistoriaAvulsa.mutateAsync({
        tipo_veiculo: tipoVeiculo,
      });

      setVistoriaId(result.id);
      setStep(2);
      toast.success('Vistoria iniciada! Tire as fotos do veículo.');
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

  const handleVeiculoAceito = () => {
    setShowVincularModal(true);
  };

  const handleVeiculoNaoAceito = async () => {
    if (!vistoriaId) return;

    await finalizarComDecisao.mutateAsync({
      id: vistoriaId,
      aceito: false,
      observacoes,
      km_atual: kmAtual ? parseInt(kmAtual) : undefined,
    });

    onOpenChange(false);
    resetState();
  };

  const handleConfirmarVinculo = async (contratoId: string | null) => {
    if (!vistoriaId) return;

    await finalizarComDecisao.mutateAsync({
      id: vistoriaId,
      aceito: true,
      contrato_id: contratoId,
      observacoes,
      km_atual: kmAtual ? parseInt(kmAtual) : undefined,
    });

    setShowVincularModal(false);
    onOpenChange(false);
    resetState();
  };

  const resetState = () => {
    setStep(1);
    setTipoVeiculo('automovel');
    setVistoriaId(null);
    setObservacoes('');
    setKmAtual('');
    setShowVincularModal(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    resetState();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {step === 2 && (
                <Button variant="ghost" size="icon" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              {step === 1 ? 'Realizar Vistoria' : 'Vistoria em Andamento'}
            </DialogTitle>
          </DialogHeader>

          {step === 1 ? (
            <div className="space-y-6">
              {/* Título e descrição */}
              <div className="text-center py-4">
                <Camera className="h-12 w-12 mx-auto text-primary mb-3" />
                <h3 className="text-lg font-semibold">Selecione o tipo de veículo para iniciar</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  As fotos serão organizadas de acordo com o tipo selecionado
                </p>
              </div>

              {/* Tipo de veículo */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  className={cn(
                    "flex flex-col items-center gap-3 p-8 rounded-xl border-2 transition-all",
                    tipoVeiculo === 'automovel'
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border hover:border-muted-foreground/50"
                  )}
                  onClick={() => setTipoVeiculo('automovel')}
                >
                  <div className="relative">
                    <Car className={cn("h-12 w-12", tipoVeiculo === 'automovel' ? "text-primary" : "text-muted-foreground")} />
                    <Camera className={cn(
                      "h-5 w-5 absolute -bottom-1 -right-1 bg-background rounded-full p-0.5",
                      tipoVeiculo === 'automovel' ? "text-primary" : "text-muted-foreground"
                    )} />
                  </div>
                  <span className="font-semibold text-lg">Automóvel</span>
                  <span className={cn(
                    "text-sm px-3 py-1 rounded-full",
                    tipoVeiculo === 'automovel' 
                      ? "bg-primary/10 text-primary" 
                      : "bg-muted text-muted-foreground"
                  )}>
                    30 fotos
                  </span>
                </button>

                <button
                  type="button"
                  className={cn(
                    "flex flex-col items-center gap-3 p-8 rounded-xl border-2 transition-all",
                    tipoVeiculo === 'moto'
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border hover:border-muted-foreground/50"
                  )}
                  onClick={() => setTipoVeiculo('moto')}
                >
                  <div className="relative">
                    <Bike className={cn("h-12 w-12", tipoVeiculo === 'moto' ? "text-primary" : "text-muted-foreground")} />
                    <Camera className={cn(
                      "h-5 w-5 absolute -bottom-1 -right-1 bg-background rounded-full p-0.5",
                      tipoVeiculo === 'moto' ? "text-primary" : "text-muted-foreground"
                    )} />
                  </div>
                  <span className="font-semibold text-lg">Moto</span>
                  <span className={cn(
                    "text-sm px-3 py-1 rounded-full",
                    tipoVeiculo === 'moto' 
                      ? "bg-primary/10 text-primary" 
                      : "bg-muted text-muted-foreground"
                  )}>
                    14 fotos
                  </span>
                </button>
              </div>

              {/* Botão iniciar */}
              <div className="flex justify-center pt-4">
                <Button
                  size="lg"
                  onClick={handleIniciarVistoria}
                  disabled={criarVistoriaAvulsa.isPending}
                  className="px-8"
                >
                  {criarVistoriaAvulsa.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4 mr-2" />
                      Iniciar Vistoria
                    </>
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

              {/* Área de decisão - aparece quando todas as fotos forem enviadas */}
              {todasFotosEnviadas && (
                <div className="p-6 border-2 border-dashed border-primary/30 rounded-xl bg-primary/5 space-y-4">
                  <div className="text-center">
                    <CheckCircle className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
                    <h3 className="font-semibold text-lg">Todas as fotos foram enviadas!</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Selecione a decisão final da vistoria
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={handleVeiculoNaoAceito}
                      disabled={finalizarComDecisao.isPending}
                      className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground h-16"
                    >
                      {finalizarComDecisao.isPending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <XCircle className="h-5 w-5 mr-2" />
                          Veículo Não Aceito
                        </>
                      )}
                    </Button>

                    <Button
                      size="lg"
                      onClick={handleVeiculoAceito}
                      disabled={finalizarComDecisao.isPending}
                      className="bg-emerald-600 hover:bg-emerald-700 h-16 animate-pulse"
                    >
                      <CheckCircle className="h-5 w-5 mr-2" />
                      Veículo Aceito
                    </Button>
                  </div>
                </div>
              )}

              {/* Botões de ação - antes de completar as fotos */}
              {!todasFotosEnviadas && (
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

                  <span className="text-sm text-muted-foreground">
                    Complete todas as fotos para finalizar
                  </span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de vincular contrato */}
      <VincularContratoModal
        open={showVincularModal}
        onOpenChange={setShowVincularModal}
        onConfirmar={handleConfirmarVinculo}
        isPending={finalizarComDecisao.isPending}
      />
    </>
  );
}
