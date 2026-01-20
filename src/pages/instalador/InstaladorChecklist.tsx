import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  ArrowRight, 
  User, 
  Car, 
  MapPin, 
  ClipboardCheck,
  Camera,
  PenTool,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Phone,
  Gauge,
  XCircle,
  ShieldCheck,
  ShieldX,
  Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  useInstalacaoDetalhes, 
  useConcluirInstalacao, 
  useSalvarChecklistInstalacao,
  useAprovarVeiculo,
  useRecusarVeiculo
} from '@/hooks/useInstaladorInstalacoes';
import { useInstalacaoFotos, useUploadInstalacaoFoto, FOTOS_INSTALACAO } from '@/hooks/useInstalacaoFotos';
import { useSaveAssinatura } from '@/hooks/useAssinatura';
import { ChecklistItem, type ChecklistStatus } from '@/components/instalador/ChecklistItem';
import { FotoCapture } from '@/components/instalador/FotoCapture';
import { SignaturePad } from '@/components/instalador/SignaturePad';
import { ModalRecusaVeiculo } from '@/components/instalador/ModalRecusaVeiculo';
import { toast } from 'sonner';

const CHECKLIST_ITEMS = [
  { id: 'veiculo_confere', label: 'Veículo corresponde aos dados cadastrados' },
  { id: 'placa_confere', label: 'Placa confere com o documento' },
  { id: 'condicoes_veiculo', label: 'Condições do veículo adequadas' },
  { id: 'local_seguro', label: 'Local de instalação seguro' },
  { id: 'bateria_ok', label: 'Bateria do veículo em boas condições' },
  { id: 'eletrica_ok', label: 'Acessórios elétricos funcionando' },
  { id: 'cliente_ciente', label: 'Associado ciente do procedimento' },
];

const ETAPAS = [
  { id: 1, label: 'Dados', icon: User },
  { id: 2, label: 'Checklist', icon: ClipboardCheck },
  { id: 3, label: 'Fotos', icon: Camera },
  { id: 4, label: 'Assinatura', icon: PenTool },
  { id: 5, label: 'Decisão', icon: ShieldCheck },
];

type ChecklistState = Record<string, { status: ChecklistStatus; observacao?: string }>;

export default function InstaladorChecklist() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [etapaAtual, setEtapaAtual] = useState(1);
  const [checklist, setChecklist] = useState<ChecklistState>(() => 
    CHECKLIST_ITEMS.reduce((acc, item) => ({ ...acc, [item.id]: { status: 'pendente' as ChecklistStatus } }), {})
  );
  const [quilometragem, setQuilometragem] = useState<string>('');
  const [uploadingFoto, setUploadingFoto] = useState<string | null>(null);
  const [assinaturaUrl, setAssinaturaUrl] = useState<string | null>(null);
  const [showModalRecusa, setShowModalRecusa] = useState(false);

  const { data: instalacao, isLoading, error } = useInstalacaoDetalhes(id);
  const { data: fotos = [] } = useInstalacaoFotos(id);
  const uploadFotoMutation = useUploadInstalacaoFoto();
  const saveAssinaturaMutation = useSaveAssinatura();
  const concluirMutation = useConcluirInstalacao();
  const salvarChecklistMutation = useSalvarChecklistInstalacao();
  const aprovarVeiculoMutation = useAprovarVeiculo();
  const recusarVeiculoMutation = useRecusarVeiculo();

  const progresso = (etapaAtual / ETAPAS.length) * 100;

  // Carregar checklist e quilometragem salvos
  useEffect(() => {
    if (instalacao) {
      // Restaurar checklist do banco se existir
      const savedChecklist = (instalacao as any).checklist_data;
      if (savedChecklist && typeof savedChecklist === 'object' && Object.keys(savedChecklist).length > 0) {
        setChecklist(savedChecklist);
      }
      // Restaurar quilometragem
      const savedKm = (instalacao as any).quilometragem;
      if (savedKm) {
        setQuilometragem(String(savedKm));
      }
    }
  }, [instalacao]);

  const checklistCompleto = useMemo(() => 
    CHECKLIST_ITEMS.every(item => checklist[item.id]?.status === 'ok'),
    [checklist]
  );

  const fotosObrigatoriasCompletas = useMemo(() => {
    const obrigatorias = FOTOS_INSTALACAO.filter(f => f.obrigatoria);
    return obrigatorias.every(f => fotos.some(foto => foto.tipo === f.tipo));
  }, [fotos]);

  const handleChecklistChange = (itemId: string, status: ChecklistStatus) => {
    setChecklist(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], status },
    }));
  };

  const handleObservacaoChange = (itemId: string, observacao: string) => {
    setChecklist(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], observacao },
    }));
  };

  const handleFotoCapture = async (tipo: string, file: File) => {
    if (!id) return;
    setUploadingFoto(tipo);
    try {
      await uploadFotoMutation.mutateAsync({ instalacaoId: id, tipo, file });
      toast.success('Foto enviada com sucesso!');
    } catch (err) {
      toast.error('Erro ao enviar foto');
    } finally {
      setUploadingFoto(null);
    }
  };

  const handleAssinaturaSave = async (signatureBlob: Blob) => {
    if (!id) return;
    try {
      const url = await saveAssinaturaMutation.mutateAsync({ instalacaoId: id, signatureBlob });
      setAssinaturaUrl(url);
      toast.success('Assinatura salva com sucesso!');
    } catch (err) {
      toast.error('Erro ao salvar assinatura');
    }
  };

  const handleAprovarVeiculo = async () => {
    if (!id || !instalacao?.veiculos?.id || !instalacao?.associados?.id) return;
    try {
      await aprovarVeiculoMutation.mutateAsync({
        instalacaoId: id,
        veiculoId: instalacao.veiculos.id,
        associadoId: instalacao.associados.id,
      });
      toast.success('Veículo aprovado! Cobertura total ativada.');
      navigate('/instalador');
    } catch (err) {
      toast.error('Erro ao aprovar veículo');
    }
  };

  const handleRecusarVeiculo = async (motivoCodigo: string, motivoCompleto: string) => {
    if (!id || !instalacao?.veiculos?.id || !instalacao?.associados?.id) return;
    try {
      await recusarVeiculoMutation.mutateAsync({
        instalacaoId: id,
        veiculoId: instalacao.veiculos.id,
        associadoId: instalacao.associados.id,
        motivo: motivoCompleto,
      });
      toast.success('Veículo recusado. Associado será notificado.');
      setShowModalRecusa(false);
      navigate('/instalador');
    } catch (err) {
      toast.error('Erro ao recusar veículo');
    }
  };

  const podeAvancar = () => {
    switch (etapaAtual) {
      case 1: return true;
      case 2: return checklistCompleto;
      case 3: return fotosObrigatoriasCompletas;
      case 4: return !!assinaturaUrl || !!instalacao?.assinatura_cliente_url;
      default: return true;
    }
  };

  const avancar = async () => {
    if (etapaAtual < ETAPAS.length && podeAvancar()) {
      // Salvar checklist e quilometragem ao sair da etapa 2
      if (etapaAtual === 2 && id) {
        try {
          await salvarChecklistMutation.mutateAsync({
            id,
            checklist_data: checklist,
            quilometragem: quilometragem ? parseInt(quilometragem) : undefined,
          });
        } catch (err) {
          toast.error('Erro ao salvar checklist');
          return;
        }
      }
      setEtapaAtual(etapaAtual + 1);
    }
  };

  const voltar = () => {
    if (etapaAtual > 1) {
      setEtapaAtual(etapaAtual - 1);
    } else {
      navigate('/instalador');
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !instalacao) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 p-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <p className="mt-4 text-white">Instalação não encontrada</p>
        <Button onClick={() => navigate('/instalador')} className="mt-4">
          Voltar
        </Button>
      </div>
    );
  }

  // Verificar se a instalação já foi finalizada (bloqueio de edição)
  const instalacaoFinalizada = ['concluida', 'cancelada'].includes(instalacao?.status || '');
  
  if (instalacaoFinalizada) {
    const foiConcluida = instalacao.status === 'concluida';
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-900 p-6">
        <div className={`rounded-full p-6 ${foiConcluida ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
          {foiConcluida ? (
            <ShieldCheck className="h-16 w-16 text-green-500" />
          ) : (
            <ShieldX className="h-16 w-16 text-red-500" />
          )}
        </div>
        
        <div className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${
          foiConcluida ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>
          <Lock className="h-3 w-3" />
          Instalação {foiConcluida ? 'Concluída' : 'Cancelada'}
        </div>
        
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-white">
            Instalação Finalizada
          </h2>
          <p className="text-slate-400 max-w-sm">
            Esta instalação já foi {foiConcluida ? 'concluída' : 'cancelada'} e não pode mais ser editada.
          </p>
        </div>

        <Card className="border-slate-700 bg-slate-800 w-full max-w-sm">
          <CardContent className="py-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Veículo:</span>
              <span className="text-white font-medium">{instalacao.veiculos?.placa}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Associado:</span>
              <span className="text-white">{instalacao.associados?.nome}</span>
            </div>
            {instalacao.updated_at && (
              <div className="flex justify-between">
                <span className="text-slate-400">Concluída em:</span>
                <span className="text-white">
                  {new Date(instalacao.updated_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Button 
          onClick={() => navigate('/instalador')} 
          className="mt-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Fila
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-900">
      {/* Progress Bar */}
      <div className="sticky top-14 z-40 border-b border-slate-700 bg-slate-800 px-4 py-3">
        <div className="mb-2 flex justify-between">
          {ETAPAS.map((etapa) => {
            const Icon = etapa.icon;
            const isActive = etapa.id === etapaAtual;
            const isCompleted = etapa.id < etapaAtual;
            return (
              <div
                key={etapa.id}
                className={`flex flex-col items-center ${
                  isActive ? 'text-blue-400' : isCompleted ? 'text-green-400' : 'text-slate-500'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="mt-1 text-[10px]">{etapa.label}</span>
              </div>
            );
          })}
        </div>
        <Progress value={progresso} className="h-1" />
      </div>

      {/* Content */}
      <div className="flex-1 p-4">
        {/* Etapa 1: Dados */}
        {etapaAtual === 1 && (
          <div className="space-y-4">
            <Card className="border-slate-700 bg-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <User className="h-4 w-4" />
                  Associado
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-medium text-white">{instalacao.associados?.nome}</p>
                <div className="flex items-center gap-2 text-slate-400">
                  <Phone className="h-4 w-4" />
                  <span>{instalacao.associados?.telefone}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-700 bg-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <Car className="h-4 w-4" />
                  Veículo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p className="font-medium text-white">
                  {instalacao.veiculos?.marca} {instalacao.veiculos?.modelo}
                </p>
                <p className="text-slate-400">Placa: {instalacao.veiculos?.placa}</p>
                <p className="text-slate-400">Ano: {instalacao.veiculos?.ano_modelo}</p>
                {instalacao.veiculos?.cor && (
                  <p className="text-slate-400">Cor: {instalacao.veiculos.cor}</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-700 bg-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <MapPin className="h-4 w-4" />
                  Endereço
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-400">
                <p>
                  {[instalacao.logradouro, instalacao.numero].filter(Boolean).join(', ')}
                </p>
                <p>
                  {[instalacao.bairro, instalacao.cidade, instalacao.uf].filter(Boolean).join(' - ')}
                </p>
                {instalacao.cep && <p>CEP: {instalacao.cep}</p>}
              </CardContent>
            </Card>

            {instalacao.rastreadores && (
              <Card className="border-slate-700 bg-slate-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-white">Rastreador</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-400">
                  <p>Código: {instalacao.rastreadores.codigo}</p>
                  {instalacao.rastreadores.numero_serie && (
                    <p>Série: {instalacao.rastreadores.numero_serie}</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Etapa 2: Checklist */}
        {etapaAtual === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Verifique todos os itens antes de iniciar a instalação:
            </p>
            
            {/* Campo de Quilometragem */}
            <Card className="border-slate-700 bg-slate-800">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/20">
                    <Gauge className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="quilometragem" className="text-white text-sm">
                      Quilometragem do Veículo
                    </Label>
                    <Input
                      id="quilometragem"
                      type="number"
                      placeholder="Ex: 45000"
                      value={quilometragem}
                      onChange={(e) => setQuilometragem(e.target.value)}
                      className="mt-1 bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Itens do Checklist */}
            {CHECKLIST_ITEMS.map((item) => (
              <ChecklistItem
                key={item.id}
                label={item.label}
                status={checklist[item.id]?.status || 'pendente'}
                observacao={checklist[item.id]?.observacao}
                onStatusChange={(status) => handleChecklistChange(item.id, status)}
                onObservacaoChange={(obs) => handleObservacaoChange(item.id, obs)}
              />
            ))}
          </div>
        )}

        {/* Etapa 3: Fotos */}
        {etapaAtual === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Capture as fotos obrigatórias da instalação:
            </p>
            <div className="grid grid-cols-3 gap-3">
              {FOTOS_INSTALACAO.map((fotoConfig) => {
                const fotoExistente = fotos.find(f => f.tipo === fotoConfig.tipo);
                return (
                  <FotoCapture
                    key={fotoConfig.tipo}
                    tipo={fotoConfig.tipo}
                    label={fotoConfig.label}
                    obrigatoria={fotoConfig.obrigatoria}
                    fotoUrl={fotoExistente?.arquivo_url}
                    uploading={uploadingFoto === fotoConfig.tipo}
                    onCapture={(file) => handleFotoCapture(fotoConfig.tipo, file)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Etapa 4: Assinatura */}
        {etapaAtual === 4 && (
          <div className="space-y-4">
            <Card className="border-slate-700 bg-slate-800">
              <CardHeader>
                <CardTitle className="text-base text-white">
                  Assinatura do Associado
                </CardTitle>
                <p className="text-sm text-slate-400">
                  {instalacao.associados?.nome}
                </p>
              </CardHeader>
              <CardContent>
                {assinaturaUrl || instalacao.assinatura_cliente_url ? (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
                      <div className="flex items-center gap-2 text-green-400">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="font-medium">Assinatura coletada</span>
                      </div>
                      <img
                        src={assinaturaUrl || instalacao.assinatura_cliente_url || ''}
                        alt="Assinatura"
                        className="mt-3 rounded-lg bg-white"
                      />
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setAssinaturaUrl(null)}
                      className="w-full border-slate-600 text-slate-300"
                    >
                      Coletar nova assinatura
                    </Button>
                  </div>
                ) : (
                  <SignaturePad
                    onSave={handleAssinaturaSave}
                    disabled={saveAssinaturaMutation.isPending}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Etapa 5: Confirmação */}
        {etapaAtual === 5 && (
          <div className="space-y-4">
            <Card className="border-green-500/50 bg-green-500/10">
              <CardContent className="flex items-center gap-3 p-4">
                <CheckCircle2 className="h-8 w-8 text-green-400" />
                <div>
                  <p className="font-semibold text-white">Tudo pronto!</p>
                  <p className="text-sm text-slate-400">
                    Revise os dados e conclua a instalação
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between rounded-lg bg-slate-800 p-3">
                <span className="text-slate-400">Associado</span>
                <span className="text-white">{instalacao.associados?.nome}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-slate-800 p-3">
                <span className="text-slate-400">Veículo</span>
                <span className="text-white">{instalacao.veiculos?.placa}</span>
              </div>
              {quilometragem && (
                <div className="flex justify-between rounded-lg bg-slate-800 p-3">
                  <span className="text-slate-400">Quilometragem</span>
                  <span className="text-white">{parseInt(quilometragem).toLocaleString('pt-BR')} km</span>
                </div>
              )}
              <div className="flex justify-between rounded-lg bg-slate-800 p-3">
                <span className="text-slate-400">Fotos capturadas</span>
                <span className="text-white">{fotos.length}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-slate-800 p-3">
                <span className="text-slate-400">Assinatura</span>
                <span className="text-green-400">Coletada ✓</span>
              </div>
            </div>

            {/* Botões de Decisão */}
            <div className="space-y-3 mt-6">
              <Button
                onClick={handleAprovarVeiculo}
                disabled={aprovarVeiculoMutation.isPending || recusarVeiculoMutation.isPending}
                className="w-full bg-emerald-600 py-6 text-lg font-semibold hover:bg-emerald-700"
              >
                {aprovarVeiculoMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Aprovando...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-5 w-5" />
                    Aprovar Veículo - Ativar Cobertura Total
                  </>
                )}
              </Button>

              <Button
                variant="destructive"
                onClick={() => setShowModalRecusa(true)}
                disabled={aprovarVeiculoMutation.isPending || recusarVeiculoMutation.isPending}
                className="w-full py-6 text-lg font-semibold"
              >
                <XCircle className="mr-2 h-5 w-5" />
                Recusar Veículo
              </Button>
            </div>

            {/* Modal de Recusa */}
            <ModalRecusaVeiculo
              open={showModalRecusa}
              onClose={() => setShowModalRecusa(false)}
              onConfirm={handleRecusarVeiculo}
              isPending={recusarVeiculoMutation.isPending}
              veiculoInfo={{
                placa: instalacao.veiculos?.placa,
                modelo: instalacao.veiculos?.modelo,
              }}
            />
          </div>
        )}
      </div>

      {/* Footer com navegação */}
      <div className="sticky bottom-0 border-t border-slate-700 bg-slate-800 p-4">
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={voltar}
            className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {etapaAtual === 1 ? 'Cancelar' : 'Voltar'}
          </Button>
          {etapaAtual < ETAPAS.length && (
            <Button
              onClick={avancar}
              disabled={!podeAvancar()}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              Próximo
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
