import { useState, useMemo } from 'react';
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
  Phone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useInstalacaoDetalhes, useConcluirInstalacao } from '@/hooks/useInstaladorInstalacoes';
import { useInstalacaoFotos, useUploadInstalacaoFoto, FOTOS_INSTALACAO } from '@/hooks/useInstalacaoFotos';
import { useSaveAssinatura } from '@/hooks/useAssinatura';
import { ChecklistItem, type ChecklistStatus } from '@/components/instalador/ChecklistItem';
import { FotoCapture } from '@/components/instalador/FotoCapture';
import { SignaturePad } from '@/components/instalador/SignaturePad';
import { toast } from 'sonner';

const CHECKLIST_ITEMS = [
  { id: 'veiculo_confere', label: 'Veículo corresponde aos dados cadastrados' },
  { id: 'placa_confere', label: 'Placa confere com o documento' },
  { id: 'condicoes_veiculo', label: 'Condições do veículo adequadas' },
  { id: 'local_seguro', label: 'Local de instalação seguro' },
  { id: 'bateria_ok', label: 'Bateria do veículo em boas condições' },
  { id: 'eletrica_ok', label: 'Acessórios elétricos funcionando' },
  { id: 'cliente_ciente', label: 'Cliente ciente do procedimento' },
];

const ETAPAS = [
  { id: 1, label: 'Dados', icon: User },
  { id: 2, label: 'Checklist', icon: ClipboardCheck },
  { id: 3, label: 'Fotos', icon: Camera },
  { id: 4, label: 'Assinatura', icon: PenTool },
  { id: 5, label: 'Confirmar', icon: CheckCircle2 },
];

type ChecklistState = Record<string, { status: ChecklistStatus; observacao?: string }>;

export default function InstaladorChecklist() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [etapaAtual, setEtapaAtual] = useState(1);
  const [checklist, setChecklist] = useState<ChecklistState>(() => 
    CHECKLIST_ITEMS.reduce((acc, item) => ({ ...acc, [item.id]: { status: 'pendente' as ChecklistStatus } }), {})
  );
  const [uploadingFoto, setUploadingFoto] = useState<string | null>(null);
  const [assinaturaUrl, setAssinaturaUrl] = useState<string | null>(null);

  const { data: instalacao, isLoading, error } = useInstalacaoDetalhes(id);
  const { data: fotos = [] } = useInstalacaoFotos(id);
  const uploadFotoMutation = useUploadInstalacaoFoto();
  const saveAssinaturaMutation = useSaveAssinatura();
  const concluirMutation = useConcluirInstalacao();

  const progresso = (etapaAtual / ETAPAS.length) * 100;

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

  const handleConcluir = async () => {
    if (!id) return;
    try {
      await concluirMutation.mutateAsync(id);
      toast.success('Instalação concluída com sucesso!');
      navigate('/instalador');
    } catch (err) {
      toast.error('Erro ao concluir instalação');
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

  const avancar = () => {
    if (etapaAtual < ETAPAS.length && podeAvancar()) {
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
          <div className="space-y-3">
            <p className="text-sm text-slate-400">
              Verifique todos os itens antes de iniciar a instalação:
            </p>
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
                  Assinatura do Cliente
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
              <div className="flex justify-between rounded-lg bg-slate-800 p-3">
                <span className="text-slate-400">Fotos capturadas</span>
                <span className="text-white">{fotos.length}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-slate-800 p-3">
                <span className="text-slate-400">Assinatura</span>
                <span className="text-green-400">Coletada ✓</span>
              </div>
            </div>

            <Button
              onClick={handleConcluir}
              disabled={concluirMutation.isPending}
              className="w-full bg-green-600 py-6 text-lg font-semibold hover:bg-green-700"
            >
              {concluirMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Finalizando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  Concluir Instalação
                </>
              )}
            </Button>
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
