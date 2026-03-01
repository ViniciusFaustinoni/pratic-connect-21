import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Wrench, MapPin, Phone, Car, User, 
  Navigation, Play, CheckCircle2, Loader2, MessageCircle,
  RefreshCw, XCircle, RotateCcw, Trash2, Search, AlertTriangle, UserX, CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { useServico, useIniciarServicoMutation } from '@/hooks/useServicos';
import { 
  useRegistrarResultadoManutencao, 
  useMarcarNaoCompareceu 
} from '@/hooks/useVistoriaManutencao';
import { useRastreadoresDoPortador } from '@/hooks/useRastreadoresPortador';
import { 
  type ResultadoManutencao,
  type DestinoRastreadorSubstituido,
  type AcaoNaoResolvido,
} from '@/types/vistoriaManutencao';
import { ChecklistManutencao, type ChecklistManutencaoItem } from '@/components/instalador/ChecklistManutencao';
import { FotosManutencao, type FotoManutencao } from '@/components/instalador/FotosManutencao';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ImprevistoBotao } from '@/components/vistoriador/ImprevistoBotao';

export default function ExecutarManutencao() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // Modal de resultado
  const [showResultadoModal, setShowResultadoModal] = useState(false);
  const [resultado, setResultado] = useState<ResultadoManutencao>('resolvido');
  const [descricao, setDescricao] = useState('');

  // Para substituição
  const [rastreadorNovoId, setRastreadorNovoId] = useState('');
  const [idPlataforma, setIdPlataforma] = useState('');
  const [buscaRastreador, setBuscaRastreador] = useState('');
  const [destinoRastreadorAntigo, setDestinoRastreadorAntigo] = useState<DestinoRastreadorSubstituido>('retorno_base');

  // Para não resolvido
  const [acaoNaoResolvido, setAcaoNaoResolvido] = useState<AcaoNaoResolvido>('reagendar');

  // Checklist de manutenção (VM-01)
  const [checklistItems, setChecklistItems] = useState<ChecklistManutencaoItem[]>([]);
  const [checklistCompleto, setChecklistCompleto] = useState(false);

  // Fotos de manutenção (VM-02)
  const [fotosManutencao, setFotosManutencao] = useState<FotoManutencao[]>([]);

  const { data: servico, isLoading } = useServico(id);
  const { mutate: iniciarServico, isPending: isIniciando } = useIniciarServicoMutation();
  const { data: rastreadoresDisponiveis, isLoading: loadingRastreadores } = useRastreadoresDoPortador();
  const registrarResultado = useRegistrarResultadoManutencao();
  const marcarNaoCompareceu = useMarcarNaoCompareceu();

  // Callbacks para checklist
  const handleChecklistComplete = useCallback(() => {
    setChecklistCompleto(true);
  }, []);

  const handleChecklistChange = useCallback((items: ChecklistManutencaoItem[]) => {
    setChecklistItems(items);
    const allChecked = items.every(item => item.checked);
    setChecklistCompleto(allChecked);
  }, []);

  // Resetar estados ao fechar modal
  useEffect(() => {
    if (!showResultadoModal) {
      setResultado('resolvido');
      setDescricao('');
      setRastreadorNovoId('');
      setIdPlataforma('');
      setBuscaRastreador('');
      setDestinoRastreadorAntigo('retorno_base');
      setAcaoNaoResolvido('reagendar');
      setFotosManutencao([]);
    }
  }, [showResultadoModal]);

  const handleVoltar = () => {
    navigate('/instalador');
  };

  const handleNavegar = () => {
    if (servico?.latitude && servico?.longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${servico.latitude},${servico.longitude}`;
      window.open(url, '_blank');
    } else {
      toast.error('Endereço não disponível para navegação');
    }
  };

  const handleLigar = () => {
    if (servico?.associado?.telefone) {
      window.open(`tel:${servico.associado.telefone}`, '_self');
    }
  };

  const handleWhatsApp = () => {
    if (servico?.associado?.whatsapp || servico?.associado?.telefone) {
      const numero = (servico.associado.whatsapp || servico.associado.telefone)
        .replace(/\D/g, '');
      window.open(`https://wa.me/55${numero}`, '_blank');
    }
  };

  const handleCheguei = () => {
    if (id) {
      iniciarServico(id, {
        onSuccess: () => {
          toast.success('Chegada registrada! Agora você pode realizar a manutenção.');
        }
      });
    }
  };

  const handleConcluir = () => {
    setShowResultadoModal(true);
  };

  const handleConcluirComResultado = async () => {
    if (!id || !descricao.trim()) {
      toast.error('Preencha a descrição do que foi feito');
      return;
    }

    if (resultado === 'substituicao' && !rastreadorNovoId) {
      toast.error('Selecione o rastreador substituto');
      return;
    }

    // Validar fotos obrigatórias para resolvido e substituicao
    if ((resultado === 'resolvido' || resultado === 'substituicao') && fotosManutencao.length < 2) {
      toast.error('Adicione pelo menos 2 fotos do reparo');
      return;
    }

    // Preparar dados do checklist
    const checklistData = checklistItems.length > 0 ? {
      items: checklistItems.map(item => ({
        id: item.id,
        label: item.label,
        checked: item.checked,
        checked_at: item.checked_at,
      })),
    } : undefined;

    // Extrair apenas os Files para o hook
    const fotosFiles = fotosManutencao.map(f => f.file);
    const fotosCategorias = fotosManutencao.map(f => f.categoria);

    registrarResultado.mutate({
      servicoId: id,
      resultado,
      descricao,
      rastreadorNovoId: resultado === 'substituicao' ? rastreadorNovoId : undefined,
      idPlataforma: resultado === 'substituicao' ? idPlataforma : undefined,
      destinoRastreadorAntigo: resultado === 'substituicao' ? destinoRastreadorAntigo : undefined,
      acaoNaoResolvido: resultado === 'nao_resolvido' ? acaoNaoResolvido : undefined,
      checklistManutencao: checklistData,
      fotos: fotosFiles,
      fotosCategorias,
    }, {
      onSuccess: () => {
        setShowResultadoModal(false);
        navigate('/instalador');
      }
    });
  };

  const handleNaoCompareceu = async () => {
    if (!id) return;
    
    marcarNaoCompareceu.mutate({
      servicoId: id,
      observacao: 'Associado não estava presente no local',
    }, {
      onSuccess: () => {
        navigate('/instalador');
      }
    });
  };

  // Filtrar rastreadores disponíveis pela busca
  const rastreadorFiltrados = rastreadoresDisponiveis?.filter(r => {
    if (!buscaRastreador) return true;
    const termo = buscaRastreador.toLowerCase();
    return (
      r.codigo?.toLowerCase().includes(termo) ||
      r.imei?.toLowerCase().includes(termo) ||
      r.numero_serie?.toLowerCase().includes(termo)
    );
  }) || [];

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!servico) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground">Serviço não encontrado</p>
        <Button onClick={handleVoltar} className="mt-4">Voltar</Button>
      </div>
    );
  }

  const enderecoCompleto = [
    servico.logradouro,
    servico.numero,
    servico.bairro,
    servico.cidade,
    servico.uf
  ].filter(Boolean).join(', ') || 'Endereço não informado';

  const isEmRota = servico.status === 'em_rota';
  const isEmAndamento = servico.status === 'em_andamento';
  const isRota = servico.local_tipo_manutencao === 'rota';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleVoltar}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-amber-600" />
            <h1 className="text-lg font-semibold">Manutenção de Rastreador</h1>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Status */}
        <div className="flex items-center justify-between">
          <Badge 
            variant="outline" 
            className={
              isEmAndamento 
                ? "bg-yellow-100 text-yellow-800 border-yellow-300" 
                : "bg-blue-100 text-blue-800 border-blue-300"
            }
          >
            {isEmAndamento ? 'Em Andamento' : 'Em Rota'}
          </Badge>
          {servico.protocolo && (
            <span className="text-sm text-muted-foreground">
              #{servico.protocolo}
            </span>
          )}
        </div>

        {/* Informações do Rastreador */}
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="h-4 w-4 text-amber-600" />
              Rastreador
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {servico.imei_rastreador && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">IMEI:</span>
                <span className="font-mono">{servico.imei_rastreador}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cliente */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{servico.associado?.nome || 'Cliente'}</p>
                <p className="text-sm text-muted-foreground">{servico.associado?.telefone}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleLigar}
                  disabled={!servico.associado?.telefone}
                >
                  <Phone className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleWhatsApp}
                  disabled={!servico.associado?.telefone && !servico.associado?.whatsapp}
                >
                  <MessageCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Veículo */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Car className="h-4 w-4" />
              Veículo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">
              {servico.veiculo?.marca} {servico.veiculo?.modelo}
            </p>
            <p className="text-sm font-mono text-muted-foreground">
              {servico.veiculo?.placa}
            </p>
          </CardContent>
        </Card>

        {/* Endereço */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Endereço
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm">{enderecoCompleto}</p>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNavegar}
                disabled={!servico.latitude}
              >
                <Navigation className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Motivo */}
        {servico.observacoes && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Motivo da Manutenção</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{servico.observacoes}</p>
            </CardContent>
          </Card>
        )}

        {/* Comunicar Imprevisto */}
        <ImprevistoBotao
          tarefaId={id!}
          clienteNome={servico.associado?.nome || 'Cliente'}
          clienteTelefone={servico.associado?.telefone || ''}
          clienteWhatsapp={servico.associado?.whatsapp}
        />

        {/* Ações */}
        <div className="pt-4 space-y-3">
          {isEmRota ? (
            <>
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={handleNavegar}
                disabled={!servico.latitude}
              >
                <Navigation className="mr-2 h-4 w-4" />
                Navegar até o local
              </Button>
              <Button 
                className="w-full" 
                onClick={handleCheguei}
                disabled={isIniciando}
              >
                {isIniciando ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Cheguei no Local
                  </>
                )}
              </Button>
            </>
          ) : isEmAndamento ? (
            <>
              {/* Checklist de Manutenção (VM-01) */}
              <ChecklistManutencao
                onComplete={handleChecklistComplete}
                onChecklistChange={handleChecklistChange}
                disabled={false}
              />

              <Button 
                className="w-full bg-green-600 hover:bg-green-700" 
                onClick={handleConcluir}
                disabled={!checklistCompleto}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {checklistCompleto ? 'Concluir Manutenção' : 'Complete o checklist'}
              </Button>
              
              {/* Botão para associado ausente (apenas se for ROTA) */}
              {isRota && (
                <Button 
                  variant="outline"
                  className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
                  onClick={handleNaoCompareceu}
                  disabled={marcarNaoCompareceu.isPending}
                >
                  {marcarNaoCompareceu.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UserX className="mr-2 h-4 w-4" />
                  )}
                  Associado Ausente
                </Button>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* Modal de Resultado */}
      <Dialog open={showResultadoModal} onOpenChange={setShowResultadoModal}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2 flex-shrink-0">
            <DialogTitle>Resultado da Manutenção</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="space-y-4 pb-4">
              {/* Seleção de Resultado */}
              <div className="space-y-3">
                {/* Opção: Resolvido */}
                <div
                  onClick={() => setResultado('resolvido')}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                    resultado === 'resolvido' 
                      ? "border-green-500 bg-green-50 dark:bg-green-950/30" 
                      : "border-muted hover:border-muted-foreground/30"
                  )}
                >
                  <div className={cn(
                    "p-2 rounded-full",
                    resultado === 'resolvido' ? "bg-green-100 text-green-600" : "bg-muted text-muted-foreground"
                  )}>
                    <CheckCircle className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Problema Resolvido</p>
                    <p className="text-sm text-muted-foreground">
                      Consertou no local (fiação, reset, reposicionamento). Rastreador continua instalado.
                    </p>
                  </div>
                </div>

                {/* Opção: Substituição */}
                <div
                  onClick={() => setResultado('substituicao')}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                    resultado === 'substituicao' 
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" 
                      : "border-muted hover:border-muted-foreground/30"
                  )}
                >
                  <div className={cn(
                    "p-2 rounded-full",
                    resultado === 'substituicao' ? "bg-blue-100 text-blue-600" : "bg-muted text-muted-foreground"
                  )}>
                    <RefreshCw className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Substituição de Rastreador</p>
                    <p className="text-sm text-muted-foreground">
                      Trocar por outro rastreador do seu estoque. Antigo vai para triagem ou baixa.
                    </p>
                  </div>
                </div>

                {/* Opção: Não Resolvido */}
                <div
                  onClick={() => setResultado('nao_resolvido')}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                    resultado === 'nao_resolvido' 
                      ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30" 
                      : "border-muted hover:border-muted-foreground/30"
                  )}
                >
                  <div className={cn(
                    "p-2 rounded-full",
                    resultado === 'nao_resolvido' ? "bg-orange-100 text-orange-600" : "bg-muted text-muted-foreground"
                  )}>
                    <XCircle className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Não Resolvido</p>
                    <p className="text-sm text-muted-foreground">
                      Não tinha peça ou substituto. Precisa reagendar ou cancelar.
                    </p>
                  </div>
                </div>
              </div>

              {/* Campos dinâmicos por resultado */}
              {resultado === 'substituicao' && (
                <div className="space-y-4 pt-2 border-t">
                  {/* Destino do rastreador antigo */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">O que fazer com o rastreador antigo?</Label>
                    <RadioGroup 
                      value={destinoRastreadorAntigo} 
                      onValueChange={(v) => setDestinoRastreadorAntigo(v as DestinoRastreadorSubstituido)}
                      className="space-y-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="retorno_base" id="retorno" />
                        <Label htmlFor="retorno" className="text-sm cursor-pointer flex items-center gap-2">
                          <RotateCcw className="h-4 w-4 text-blue-600" />
                          Enviar para Triagem (Base)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="baixado" id="baixar" />
                        <Label htmlFor="baixar" className="text-sm cursor-pointer flex items-center gap-2">
                          <Trash2 className="h-4 w-4 text-red-600" />
                          Baixar Definitivamente
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Seleção do novo rastreador */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Rastreador Substituto *</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por código, IMEI..."
                        value={buscaRastreador}
                        onChange={(e) => setBuscaRastreador(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    
                    {loadingRastreadores ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : rastreadorFiltrados.length === 0 ? (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Você não tem rastreadores em seu porte. Solicite ao coordenador que transfira equipamentos para você.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                        {rastreadorFiltrados.slice(0, 10).map((r) => (
                          <div
                            key={r.id}
                            onClick={() => setRastreadorNovoId(r.id)}
                            className={cn(
                              "p-3 cursor-pointer transition-colors w-full",
                              rastreadorNovoId === r.id 
                                ? "bg-primary/10 border-l-2 border-l-primary" 
                                : "hover:bg-muted/50"
                            )}
                          >
                            <p className="font-medium text-sm break-words">{r.codigo}</p>
                            <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                              {r.numero_serie && (
                                <span className="break-all">S/N: <span className="font-mono">{r.numero_serie}</span></span>
                              )}
                              {r.imei && (
                                <span className="break-all">IMEI: <span className="font-mono">{r.imei}</span></span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ID Plataforma (opcional) */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">ID na Plataforma (opcional)</Label>
                    <Input
                      placeholder="Ex: 12345"
                      value={idPlataforma}
                      onChange={(e) => setIdPlataforma(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Informe se o rastreador já está cadastrado na plataforma
                    </p>
                  </div>
                </div>
              )}

              {resultado === 'nao_resolvido' && (
                <div className="space-y-3 pt-2 border-t">
                  <Label className="text-sm font-medium">O que deseja fazer?</Label>
                  <RadioGroup 
                    value={acaoNaoResolvido} 
                    onValueChange={(v) => setAcaoNaoResolvido(v as AcaoNaoResolvido)}
                    className="space-y-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="reagendar" id="reagendar" />
                      <Label htmlFor="reagendar" className="text-sm cursor-pointer">
                        Reagendar manutenção (volta para a fila)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="cancelar" id="cancelar" />
                      <Label htmlFor="cancelar" className="text-sm cursor-pointer">
                        Cancelar manutenção
                      </Label>
                    </div>
                  </RadioGroup>

                  {acaoNaoResolvido === 'cancelar' && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        Ao cancelar, o rastreador voltará ao status "instalado" sem manutenção.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {/* Campo de descrição (sempre obrigatório) */}
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-sm font-medium">
                  Descrição do que foi feito *
                </Label>
                <Textarea
                  placeholder={
                    resultado === 'resolvido' 
                      ? "Ex: Refiz a fiação do positivo que estava solta..."
                      : resultado === 'substituicao'
                      ? "Ex: Rastreador apresentava defeito no módulo GPS. Substituído por novo equipamento..."
                      : "Ex: Não tinha rastreador substituto disponível no momento..."
                  }
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Fotos de Manutenção (VM-02) - Aparece para resolvido e substituicao */}
              {(resultado === 'resolvido' || resultado === 'substituicao') && (
                <FotosManutencao
                  fotos={fotosManutencao}
                  onFotosChange={setFotosManutencao}
                  minFotos={2}
                  maxFotos={6}
                  obrigatorio={true}
                />
              )}

              {/* Fotos opcionais para não resolvido */}
              {resultado === 'nao_resolvido' && (
                <FotosManutencao
                  fotos={fotosManutencao}
                  onFotosChange={setFotosManutencao}
                  minFotos={0}
                  maxFotos={6}
                  obrigatorio={false}
                />
              )}
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 p-4 border-t flex-shrink-0 bg-background">
            <Button
              variant="outline"
              onClick={() => setShowResultadoModal(false)}
              className="flex-1"
              disabled={registrarResultado.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConcluirComResultado}
              disabled={
                !descricao.trim() || 
                (resultado === 'substituicao' && !rastreadorNovoId) ||
                ((resultado === 'resolvido' || resultado === 'substituicao') && fotosManutencao.length < 2) ||
                registrarResultado.isPending
              }
              className="flex-1"
            >
              {registrarResultado.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Confirmar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
