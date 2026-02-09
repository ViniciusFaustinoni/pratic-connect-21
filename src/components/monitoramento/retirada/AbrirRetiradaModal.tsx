import { useState, useEffect, useMemo } from 'react';
import { format, addDays, isSunday, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  CalendarIcon, 
  User, 
  Car, 
  Sun, 
  Sunset, 
  Radio,
  Wifi,
  WifiOff,
  PackageMinus,
  AlertTriangle,
  Search,
} from 'lucide-react';
import { useAbrirRetirada } from '@/hooks/useRetiradaRastreador';
import { useProfissionaisEquipe } from '@/hooks/useEquipe';
import { useVagasPeriodo } from '@/hooks/useVagasPeriodo';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import {
  MOTIVO_RETIRADA_LABELS,
  SUB_TIPO_RETIRADA_LABELS,
  type MotivoRetirada,
  type SubTipoRetirada,
} from '@/types/retirada';
import {
  PERIODOS_DISPONIVEIS,
  LIMITE_VAGAS_POR_PERIODO,
  getPeriodosDisponivelsPorHora,
  type Periodo,
  type PeriodoConfig,
} from '@/data/autovistoriaConfig';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface RastreadorInfo {
  id: string;
  codigo: string;
}

interface AbrirRetiradaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rastreador: RastreadorInfo | null;
}

type SituacaoFinanceira = 'sem_debitos' | 'com_debitos' | 'nao_verificado';
type LocalTipo = 'base' | 'volante';

export function AbrirRetiradaModal({ 
  open, 
  onOpenChange,
  rastreador,
}: AbrirRetiradaModalProps) {
  const { profile } = useAuth();
  
  // Estados - Situação Financeira
  const [situacaoFinanceira, setSituacaoFinanceira] = useState<SituacaoFinanceira | ''>('');
  const [valorDebitos, setValorDebitos] = useState('');

  // Estados - Motivo
  const [motivo, setMotivo] = useState<MotivoRetirada | ''>('');
  const [subTipo, setSubTipo] = useState<SubTipoRetirada>('somente_retirada');
  const [buscandoPlaca, setBuscandoPlaca] = useState(false);
  const [placaBusca, setPlacaBusca] = useState('');
  const [novoVeiculoId, setNovoVeiculoId] = useState<string | null>(null);
  const [novoVeiculoInfo, setNovoVeiculoInfo] = useState<string | null>(null);

  // Estados - Agendamento
  const [dataAgendada, setDataAgendada] = useState<Date | undefined>(undefined);
  const [periodo, setPeriodo] = useState<Periodo | ''>('');
  const [localTipo, setLocalTipo] = useState<LocalTipo>('base');
  const [profissionalId, setProfissionalId] = useState('');
  const [permiteEncaixe, setPermiteEncaixe] = useState(false);

  // Estados - Notificação e Observações
  const [notificarWhatsApp, setNotificarWhatsApp] = useState(true);
  const [observacoes, setObservacoes] = useState('');

  // Hooks
  const { data: equipe, isLoading: loadingEquipe } = useProfissionaisEquipe();
  const abrirRetiradaMutation = useAbrirRetirada();
  const { isDiretor, isCoordenadorMonitoramento, isDesenvolvedor, isAdminMaster } = usePermissions();
  const podeHabilitarEncaixe = isDiretor || isCoordenadorMonitoramento || isDesenvolvedor || isAdminMaster;

  // Buscar dados completos do rastreador
  const { data: rastreadorCompleto, isLoading: loadingRastreador } = useQuery({
    queryKey: ['rastreador-completo-retirada', rastreador?.id],
    queryFn: async () => {
      if (!rastreador?.id) return null;
      
      const { data, error } = await supabase
        .from('rastreadores')
        .select(`
          id,
          codigo,
          imei,
          numero_serie,
          plataforma,
          ultima_comunicacao,
          veiculo_id,
          veiculo:veiculos(
            id,
            placa,
            marca,
            modelo,
            associado_id,
            associado:associados(
              id,
              nome,
              cpf,
              telefone,
              whatsapp,
              logradouro,
              numero,
              bairro,
              cidade,
              uf,
              cep,
              endereco_latitude,
              endereco_longitude
            )
          )
        `)
        .eq('id', rastreador.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!rastreador?.id && open,
  });

  // Configuração de datas - hoje + próximos 2 dias úteis
  const dataMinima = startOfDay(new Date());
  const dataMaxima = addDays(dataMinima, 2);
  
  const diasDesabilitados = (date: Date) => {
    const start = startOfDay(date);
    return isSunday(start) || start < dataMinima || start > dataMaxima;
  };

  // Verificação de vagas
  const dataFormatada = dataAgendada ? format(dataAgendada, 'yyyy-MM-dd') : null;
  const { data: vagasData, isLoading: isLoadingVagas } = useVagasPeriodo(dataFormatada);

  // Períodos disponíveis
  const periodosDisponiveis = useMemo((): PeriodoConfig[] => {
    if (!dataAgendada) return PERIODOS_DISPONIVEIS;
    return getPeriodosDisponivelsPorHora(dataAgendada);
  }, [dataAgendada]);

  // Extrair dados
  const veiculo = rastreadorCompleto?.veiculo as any;
  const associado = veiculo?.associado as any;

  // Buscar veículo por placa
  const handleBuscarPlaca = async () => {
    if (placaBusca.length < 7) return;
    
    setBuscandoPlaca(true);
    try {
      const { data, error } = await supabase
        .from('veiculos')
        .select('id, placa, marca, modelo')
        .eq('placa', placaBusca.toUpperCase().replace(/[^A-Z0-9]/g, ''))
        .single();

      if (error || !data) {
        setNovoVeiculoInfo('Veículo não encontrado');
        setNovoVeiculoId(null);
      } else {
        setNovoVeiculoId(data.id);
        setNovoVeiculoInfo(`${data.marca} ${data.modelo} • ${data.placa}`);
      }
    } catch (err) {
      setNovoVeiculoInfo('Erro ao buscar veículo');
      setNovoVeiculoId(null);
    } finally {
      setBuscandoPlaca(false);
    }
  };

  // Limpar ao fechar
  useEffect(() => {
    if (!open) {
      setSituacaoFinanceira('');
      setValorDebitos('');
      setMotivo('');
      setSubTipo('somente_retirada');
      setPlacaBusca('');
      setNovoVeiculoId(null);
      setNovoVeiculoInfo(null);
      setDataAgendada(undefined);
      setPeriodo('');
      setLocalTipo('base');
      setProfissionalId('');
      setPermiteEncaixe(false);
      setNotificarWhatsApp(true);
      setObservacoes('');
    }
  }, [open]);

  // Resetar período quando data muda
  useEffect(() => {
    if (dataAgendada && periodo) {
      const periodoAindaDisponivel = periodosDisponiveis.some(p => p.id === periodo);
      if (!periodoAindaDisponivel) {
        setPeriodo('');
      }
    }
  }, [dataAgendada, periodo, periodosDisponiveis]);

  // Resetar subtipo quando motivo muda
  useEffect(() => {
    if (motivo !== 'substituicao_veiculo') {
      setSubTipo('somente_retirada');
      setNovoVeiculoId(null);
      setNovoVeiculoInfo(null);
      setPlacaBusca('');
    }
  }, [motivo]);

  const handleSubmit = async () => {
    if (!rastreadorCompleto || !motivo || !dataAgendada || !profissionalId || !periodo || !situacaoFinanceira) return;

    // Validar novo veículo se necessário
    if (motivo === 'substituicao_veiculo' && subTipo === 'retirada_com_nova_instalacao' && !novoVeiculoId) {
      return;
    }

    await abrirRetiradaMutation.mutateAsync({
      rastreadorId: rastreadorCompleto.id,
      associadoId: associado?.id || null,
      veiculoId: veiculo?.id || null,
      motivo: motivo as MotivoRetirada,
      subTipo,
      novoVeiculoId: subTipo === 'retirada_com_nova_instalacao' ? novoVeiculoId : null,
      situacaoFinanceira: situacaoFinanceira as SituacaoFinanceira,
      valorDebitos: situacaoFinanceira === 'com_debitos' ? parseFloat(valorDebitos) || 0 : undefined,
      dataAgendada: format(dataAgendada, 'yyyy-MM-dd'),
      periodo: periodo as Periodo,
      localTipo,
      profissionalId,
      permiteEncaixe,
      notificarWhatsApp,
      observacoes: observacoes || undefined,
    });

    onOpenChange(false);
  };

  // Validação
  const validacaoNovoVeiculo = motivo === 'substituicao_veiculo' && subTipo === 'retirada_com_nova_instalacao'
    ? !!novoVeiculoId
    : true;

  const isValid = situacaoFinanceira && motivo && dataAgendada && periodo && profissionalId && validacaoNovoVeiculo;
  const profissionais = equipe || [];

  if (!rastreador) return null;

  const isOnline = rastreadorCompleto?.ultima_comunicacao 
    ? (new Date().getTime() - new Date(rastreadorCompleto.ultima_comunicacao).getTime()) < 24 * 60 * 60 * 1000
    : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageMinus className="h-5 w-5 text-destructive" />
            Solicitar Retirada de Rastreador
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* ===== DADOS DO RASTREADOR ===== */}
          {loadingRastreador ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : rastreadorCompleto && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Dados do Rastreador
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono font-medium">{rastreadorCompleto.codigo}</span>
                  {rastreadorCompleto.numero_serie && (
                    <span className="text-xs text-muted-foreground">Série: {rastreadorCompleto.numero_serie}</span>
                  )}
                </div>
                {isOnline ? (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                    <Wifi className="h-3 w-3 mr-1" />
                    Online
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                    <WifiOff className="h-3 w-3 mr-1" />
                    Offline
                  </Badge>
                )}
              </div>
              {rastreadorCompleto.plataforma && (
                <div className="text-sm text-muted-foreground">
                  Plataforma: {rastreadorCompleto.plataforma}
                </div>
              )}
            </div>
          )}

          {/* ===== DADOS DO ASSOCIADO ===== */}
          {associado && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Dados do Associado
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{associado.nome}</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>CPF: {associado.cpf}</span>
                <span>Tel: {associado.telefone}</span>
              </div>
              {veiculo && (
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {veiculo.marca} {veiculo.modelo} • <span className="font-mono">{veiculo.placa}</span>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ===== SITUAÇÃO FINANCEIRA ===== */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <Label className="text-sm font-medium">Situação Financeira *</Label>
            </div>
            <RadioGroup
              value={situacaoFinanceira}
              onValueChange={(v) => setSituacaoFinanceira(v as SituacaoFinanceira)}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sem_debitos" id="sem_debitos" />
                <Label htmlFor="sem_debitos" className="font-normal">Sem débitos pendentes</Label>
              </div>
              <div className="flex items-start space-x-2">
                <RadioGroupItem value="com_debitos" id="com_debitos" className="mt-1" />
                <div className="flex-1 space-y-2">
                  <Label htmlFor="com_debitos" className="font-normal">Com débitos</Label>
                  {situacaoFinanceira === 'com_debitos' && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Valor:</span>
                      <Input
                        type="number"
                        placeholder="0,00"
                        value={valorDebitos}
                        onChange={(e) => setValorDebitos(e.target.value)}
                        className="w-32"
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="nao_verificado" id="nao_verificado" />
                <Label htmlFor="nao_verificado" className="font-normal text-amber-600">
                  Não verificado (prosseguir mesmo assim)
                </Label>
              </div>
            </RadioGroup>
            {situacaoFinanceira && situacaoFinanceira !== 'nao_verificado' && (
              <div className="text-xs text-muted-foreground">
                Conferido por: {profile?.nome || 'Usuário logado'}
              </div>
            )}
          </div>

          {/* ===== MOTIVO DA RETIRADA ===== */}
          <div className="space-y-3 pt-2 border-t">
            <Label>Motivo da Retirada *</Label>
            <Select
              value={motivo}
              onValueChange={(value) => setMotivo(value as MotivoRetirada)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MOTIVO_RETIRADA_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ===== SUBTIPO (se substituição) ===== */}
          {motivo === 'substituicao_veiculo' && (
            <div className="space-y-3 bg-muted/30 p-4 rounded-lg">
              <Label>O que fazer após retirar? *</Label>
              <RadioGroup
                value={subTipo}
                onValueChange={(v) => setSubTipo(v as SubTipoRetirada)}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="somente_retirada" id="somente_retirada" />
                  <Label htmlFor="somente_retirada" className="font-normal">
                    Somente retirar (instalar no novo veículo depois)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="retirada_com_nova_instalacao" id="retirada_com_nova_instalacao" />
                  <Label htmlFor="retirada_com_nova_instalacao" className="font-normal">
                    Retirar + Instalar no novo veículo
                  </Label>
                </div>
              </RadioGroup>

              {subTipo === 'retirada_com_nova_instalacao' && (
                <div className="space-y-2 mt-3">
                  <Label>Novo veículo (buscar por placa) *</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="ABC1234"
                      value={placaBusca}
                      onChange={(e) => setPlacaBusca(e.target.value.toUpperCase())}
                      maxLength={7}
                      className="font-mono"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleBuscarPlaca}
                      disabled={placaBusca.length < 7 || buscandoPlaca}
                    >
                      {buscandoPlaca ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                  {novoVeiculoInfo && (
                    <div className={cn(
                      'text-sm p-2 rounded',
                      novoVeiculoId ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    )}>
                      {novoVeiculoInfo}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ===== AGENDAMENTO ===== */}
          <div className="space-y-4 pt-2 border-t">
            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Agendamento
            </div>

            {/* Data */}
            <div className="space-y-2">
              <Label>Data *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !dataAgendada && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataAgendada ? format(dataAgendada, 'PPP', { locale: ptBR }) : 'Selecione a data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                  <Calendar
                    mode="single"
                    selected={dataAgendada}
                    onSelect={setDataAgendada}
                    disabled={diasDesabilitados}
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Período */}
            <div className="space-y-2">
              <Label>Período *</Label>
              {!dataAgendada ? (
                <p className="text-sm text-muted-foreground">Selecione uma data primeiro</p>
              ) : isLoadingVagas ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Verificando vagas...</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {periodosDisponiveis.map((p) => {
                    const vagasRestantes = vagasData?.[p.id] ?? LIMITE_VAGAS_POR_PERIODO;
                    const semVagas = vagasRestantes === 0;
                    const isSelected = periodo === p.id;

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => !semVagas && setPeriodo(p.id)}
                        disabled={semVagas}
                        className={cn(
                          'flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all',
                          isSelected
                            ? 'border-primary bg-primary/10'
                            : semVagas
                            ? 'border-muted bg-muted/50 opacity-50 cursor-not-allowed'
                            : 'border-muted hover:border-primary/50 cursor-pointer'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {p.id === 'manha' ? (
                            <Sun className="h-4 w-4 text-amber-500" />
                          ) : (
                            <Sunset className="h-4 w-4 text-orange-500" />
                          )}
                          <span className="font-medium">{p.label}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {p.horarioInicio} - {p.horarioFim}
                        </span>
                        <span className={cn(
                          'text-xs font-medium',
                          semVagas ? 'text-destructive' : vagasRestantes <= 3 ? 'text-amber-600' : 'text-emerald-600'
                        )}>
                          {semVagas ? 'Sem vagas' : `${vagasRestantes} vaga${vagasRestantes !== 1 ? 's' : ''}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Local */}
            <div className="space-y-2">
              <Label>Local de Atendimento *</Label>
              <RadioGroup
                value={localTipo}
                onValueChange={(v) => setLocalTipo(v as LocalTipo)}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="base" id="local_base" />
                  <Label htmlFor="local_base" className="font-normal">Base (Caxias)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="volante" id="local_volante" />
                  <Label htmlFor="local_volante" className="font-normal">Volante (domicílio)</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Técnico */}
            <div className="space-y-2">
              <Label>Técnico Responsável *</Label>
              <Select value={profissionalId} onValueChange={setProfissionalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o técnico..." />
                </SelectTrigger>
                <SelectContent>
                  {loadingEquipe ? (
                    <div className="p-2 text-center">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    </div>
                  ) : profissionais.length === 0 ? (
                    <div className="p-2 text-center text-muted-foreground">
                      Nenhum técnico disponível
                    </div>
                  ) : (
                    profissionais.map((prof) => (
                      <SelectItem key={prof.id} value={prof.id}>
                        <div className="flex items-center gap-2">
                          <span>{prof.nome}</span>
                          {prof.tarefas_hoje > 0 && (
                            <span className="text-xs text-muted-foreground">
                              ({prof.tarefas_hoje} tarefa{prof.tarefas_hoje !== 1 ? 's' : ''} hoje)
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Encaixe */}
            {podeHabilitarEncaixe && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="permite_encaixe"
                  checked={permiteEncaixe}
                  onCheckedChange={(checked) => setPermiteEncaixe(!!checked)}
                />
                <Label htmlFor="permite_encaixe" className="font-normal">
                  Permitir encaixe
                </Label>
              </div>
            )}
          </div>

          {/* ===== NOTIFICAÇÃO ===== */}
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="notificar_whatsapp"
                checked={notificarWhatsApp}
                onCheckedChange={(checked) => setNotificarWhatsApp(!!checked)}
              />
              <Label htmlFor="notificar_whatsapp" className="font-normal">
                Notificar associado via WhatsApp
              </Label>
            </div>
            <p className="text-xs text-muted-foreground pl-6">
              O associado será informado do prazo de 48h para comparecer
            </p>
          </div>

          {/* ===== OBSERVAÇÕES ===== */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Informações adicionais sobre a retirada..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Aviso */}
          <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p className="text-xs">
              Após a retirada, o rastreador será desativado na plataforma e retornará ao estoque.
              O técnico executará os procedimentos de desinstalação e devolução.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={abrirRetiradaMutation.isPending}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!isValid || abrirRetiradaMutation.isPending}
            variant="destructive"
          >
            {abrirRetiradaMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Agendando...
              </>
            ) : (
              'Agendar Retirada'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
