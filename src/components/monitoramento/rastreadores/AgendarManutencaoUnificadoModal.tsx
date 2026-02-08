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
import { 
  Loader2, 
  CalendarIcon, 
  User, 
  Car, 
  MessageCircle, 
  Puzzle, 
  Sun, 
  Sunset, 
  Home, 
  Edit,
  Radio,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useAbrirEAgendarManutencao } from '@/hooks/useVistoriaManutencao';
import { useProfissionaisEquipe } from '@/hooks/useEquipe';
import { useVagasPeriodo } from '@/hooks/useVagasPeriodo';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { 
  MOTIVOS_MANUTENCAO_OPTIONS,
  LOCAL_TIPO_OPTIONS,
  type MotivoManutencao,
  type LocalTipoManutencao,
} from '@/types/vistoriaManutencao';
import {
  PERIODOS_DISPONIVEIS,
  LIMITE_VAGAS_POR_PERIODO,
  getPeriodosDisponivelsPorHora,
  type Periodo,
  type PeriodoConfig,
} from '@/data/autovistoriaConfig';
import { cn } from '@/lib/utils';
import { buscarCep } from '@/lib/cep';
import { formatDistanceToNow } from 'date-fns';

interface RastreadorInfo {
  id: string;
  codigo: string;
}

interface AgendarManutencaoUnificadoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rastreador: RastreadorInfo | null;
}

/**
 * Modal unificado para abrir E agendar manutenção numa única etapa
 * Combina AbrirManutencaoModal + AgendarManutencaoModal
 */
export function AgendarManutencaoUnificadoModal({ 
  open, 
  onOpenChange,
  rastreador,
}: AgendarManutencaoUnificadoModalProps) {
  // Estados do MOTIVO (antigo AbrirManutencaoModal)
  const [motivo, setMotivo] = useState<MotivoManutencao | ''>('');
  const [motivoDetalhe, setMotivoDetalhe] = useState('');

  // Estados do AGENDAMENTO (antigo AgendarManutencaoModal)
  const [dataAgendada, setDataAgendada] = useState<Date | undefined>(undefined);
  const [periodo, setPeriodo] = useState<Periodo | ''>('');
  const [localTipo, setLocalTipo] = useState<LocalTipoManutencao>('base');
  const [profissionalId, setProfissionalId] = useState('');
  const [notificarWhatsApp, setNotificarWhatsApp] = useState(true);
  const [permiteEncaixe, setPermiteEncaixe] = useState(false);

  // Estados para endereço (quando tipo = rota)
  const [tipoEndereco, setTipoEndereco] = useState<'cadastrado' | 'outro'>('cadastrado');
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [buscandoCep, setBuscandoCep] = useState(false);

  // Hooks
  const { data: equipe, isLoading: loadingEquipe } = useProfissionaisEquipe();
  const abrirEAgendarMutation = useAbrirEAgendarManutencao();
  const { isDiretor, isCoordenadorMonitoramento } = usePermissions();
  const podeHabilitarEncaixe = isDiretor || isCoordenadorMonitoramento;

  // Buscar dados completos do rastreador (veículo, associado)
  const { data: rastreadorCompleto, isLoading: loadingRastreador } = useQuery({
    queryKey: ['rastreador-completo-manutencao', rastreador?.id],
    queryFn: async () => {
      if (!rastreador?.id) return null;
      
      const { data, error } = await supabase
        .from('rastreadores')
        .select(`
          id,
          codigo,
          imei,
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

  // Configuração de datas - hoje + próximos 2 dias (excluindo domingos)
  const dataMinima = startOfDay(new Date());
  const dataMaxima = addDays(dataMinima, 2);
  
  const diasDesabilitados = (date: Date) => {
    const start = startOfDay(date);
    return isSunday(start) || start < dataMinima || start > dataMaxima;
  };

  // Verificação de vagas para a data selecionada
  const dataFormatada = dataAgendada ? format(dataAgendada, 'yyyy-MM-dd') : null;
  const { data: vagasData, isLoading: isLoadingVagas } = useVagasPeriodo(dataFormatada);

  // Períodos disponíveis baseados na data selecionada
  const periodosDisponiveis = useMemo((): PeriodoConfig[] => {
    if (!dataAgendada) return PERIODOS_DISPONIVEIS;
    return getPeriodosDisponivelsPorHora(dataAgendada);
  }, [dataAgendada]);

  // Extrair dados do associado
  const veiculo = rastreadorCompleto?.veiculo as any;
  const associado = veiculo?.associado as any;

  // Endereço cadastrado do associado
  const enderecoCadastrado = associado?.logradouro
    ? `${associado.logradouro}, ${associado.numero || 'S/N'} - ${associado.bairro}, ${associado.cidade}/${associado.uf}`
    : null;
  const temEnderecoCadastrado = !!associado?.logradouro;

  // Função para buscar CEP
  const handleCepChange = async (value: string) => {
    const cepLimpo = value.replace(/\D/g, '');
    if (cepLimpo.length <= 5) {
      setCep(cepLimpo);
    } else {
      setCep(`${cepLimpo.slice(0, 5)}-${cepLimpo.slice(5, 8)}`);
    }
    
    if (cepLimpo.length === 8) {
      setBuscandoCep(true);
      const endereco = await buscarCep(cepLimpo);
      if (endereco) {
        setLogradouro(endereco.logradouro);
        setBairro(endereco.bairro);
        setCidade(endereco.cidade);
        setUf(endereco.uf);
      }
      setBuscandoCep(false);
    }
  };

  // Limpar ao fechar
  useEffect(() => {
    if (!open) {
      setMotivo('');
      setMotivoDetalhe('');
      setDataAgendada(undefined);
      setPeriodo('');
      setLocalTipo('base');
      setProfissionalId('');
      setNotificarWhatsApp(true);
      setPermiteEncaixe(false);
      setTipoEndereco('cadastrado');
      setCep('');
      setLogradouro('');
      setNumero('');
      setBairro('');
      setCidade('');
      setUf('');
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

  const handleSubmit = async () => {
    if (!rastreadorCompleto || !motivo || !dataAgendada || !profissionalId || !periodo) return;

    // Montar endereço final
    let enderecoFinal = '';
    if (localTipo === 'rota') {
      if (tipoEndereco === 'cadastrado') {
        enderecoFinal = enderecoCadastrado || '';
      } else {
        enderecoFinal = `${logradouro}, ${numero} - ${bairro}, ${cidade}/${uf}`;
      }
    }

    await abrirEAgendarMutation.mutateAsync({
      rastreadorId: rastreadorCompleto.id,
      motivo,
      motivoDetalhe: motivoDetalhe || undefined,
      dataAgendada: format(dataAgendada, 'yyyy-MM-dd'),
      periodo: periodo as Periodo,
      localTipo,
      localEndereco: localTipo === 'rota' ? enderecoFinal : undefined,
      profissionalId,
      permiteEncaixe,
      notificarWhatsApp,
    });

    onOpenChange(false);
  };

  // Validação de endereço
  const enderecoValido = localTipo !== 'rota' || (
    tipoEndereco === 'cadastrado' 
      ? temEnderecoCadastrado 
      : (cep.replace(/\D/g, '').length === 8 && logradouro && numero)
  );

  const isValid = motivo && dataAgendada && periodo && profissionalId && enderecoValido;
  const profissionais = equipe || [];

  if (!rastreador) return null;

  const isOnline = rastreadorCompleto?.ultima_comunicacao 
    ? (new Date().getTime() - new Date(rastreadorCompleto.ultima_comunicacao).getTime()) < 24 * 60 * 60 * 1000
    : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar para Manutenção</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Info do rastreador */}
          {loadingRastreador ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : rastreadorCompleto && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono font-medium">{rastreadorCompleto.codigo}</span>
                </div>
                {isOnline ? (
                  <Wifi className="h-4 w-4 text-green-600" />
                ) : (
                  <WifiOff className="h-4 w-4 text-destructive" />
                )}
              </div>
              {veiculo && (
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {veiculo.marca} {veiculo.modelo} • <span className="font-mono">{veiculo.placa}</span>
                  </span>
                </div>
              )}
              {associado && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{associado.nome}</span>
                  <span className="text-xs text-muted-foreground">{associado.telefone}</span>
                </div>
              )}
              {rastreadorCompleto.ultima_comunicacao && (
                <div className="text-xs text-muted-foreground">
                  Última comunicação: {formatDistanceToNow(new Date(rastreadorCompleto.ultima_comunicacao), { locale: ptBR, addSuffix: true })}
                </div>
              )}
            </div>
          )}

          {/* SEÇÃO: MOTIVO */}
          <div className="space-y-4">
            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Motivo da Manutenção
            </div>

            <div className="space-y-2">
              <Label>Motivo *</Label>
              <Select
                value={motivo}
                onValueChange={(value) => setMotivo(value as MotivoManutencao)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o motivo..." />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVOS_MANUTENCAO_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex flex-col">
                        <span>{opt.label}</span>
                        <span className="text-xs text-muted-foreground">{opt.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Detalhes (opcional)</Label>
              <Textarea
                placeholder="Descreva detalhes adicionais sobre o problema..."
                value={motivoDetalhe}
                onChange={(e) => setMotivoDetalhe(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          {/* SEÇÃO: AGENDAMENTO */}
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
              <p className="text-xs text-muted-foreground">
                Hoje até +2 dias úteis (exceto domingos)
              </p>
            </div>

            {/* Período */}
            <div className="space-y-2">
              <Label>Período *</Label>
              {!dataAgendada ? (
                <p className="text-sm text-muted-foreground">
                  Selecione uma data para ver os períodos
                </p>
              ) : isLoadingVagas ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Verificando vagas...</span>
                </div>
              ) : periodosDisponiveis.length === 0 ? (
                <p className="text-sm text-destructive">
                  Nenhum período disponível para esta data
                </p>
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

            {/* Tipo de local */}
            <div className="space-y-2">
              <Label>Local *</Label>
              <RadioGroup
                value={localTipo}
                onValueChange={(v) => setLocalTipo(v as LocalTipoManutencao)}
                className="space-y-2"
              >
                {LOCAL_TIPO_OPTIONS
                  .filter((opt) => opt.value === 'base' || opt.value === 'rota')
                  .map((opt) => (
                    <div key={opt.value} className="flex items-start space-x-2">
                      <RadioGroupItem value={opt.value} id={`local-${opt.value}`} className="mt-1" />
                      <div className="flex flex-col">
                        <Label htmlFor={`local-${opt.value}`} className="font-normal cursor-pointer">
                          {opt.label}
                        </Label>
                        <span className="text-xs text-muted-foreground">{opt.description}</span>
                      </div>
                    </div>
                  ))}
              </RadioGroup>
            </div>

            {/* Endereço (se rota) */}
            {localTipo === 'rota' && (
              <div className="space-y-3">
                <Label>Endereço *</Label>
                
                <RadioGroup
                  value={tipoEndereco}
                  onValueChange={(v) => setTipoEndereco(v as 'cadastrado' | 'outro')}
                  className="space-y-2"
                >
                  {temEnderecoCadastrado && (
                    <div 
                      className={cn(
                        "flex items-start space-x-2 p-3 rounded-lg border-2 transition-all cursor-pointer",
                        tipoEndereco === 'cadastrado' ? "border-primary bg-primary/5" : "border-muted"
                      )}
                      onClick={() => setTipoEndereco('cadastrado')}
                    >
                      <RadioGroupItem value="cadastrado" id="end-cadastrado" className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor="end-cadastrado" className="font-medium cursor-pointer flex items-center gap-2">
                          <Home className="h-4 w-4" />
                          Endereço cadastrado
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          {enderecoCadastrado}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <div 
                    className={cn(
                      "flex items-start space-x-2 p-3 rounded-lg border-2 transition-all cursor-pointer",
                      tipoEndereco === 'outro' ? "border-primary bg-primary/5" : "border-muted"
                    )}
                    onClick={() => setTipoEndereco('outro')}
                  >
                    <RadioGroupItem value="outro" id="end-outro" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="end-outro" className="font-medium cursor-pointer flex items-center gap-2">
                        <Edit className="h-4 w-4" />
                        Informar outro endereço
                      </Label>
                    </div>
                  </div>
                </RadioGroup>
                
                {tipoEndereco === 'outro' && (
                  <div className="space-y-3 pt-2 border-t">
                    <div className="space-y-1">
                      <Label className="text-sm">CEP</Label>
                      <div className="relative">
                        <Input
                          placeholder="00000-000"
                          value={cep}
                          onChange={(e) => handleCepChange(e.target.value)}
                          maxLength={9}
                          className="pr-10"
                        />
                        {buscandoCep && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    
                    {logradouro && (
                      <div className="bg-muted/50 rounded-lg p-3 text-sm">
                        <p className="font-medium">{logradouro}</p>
                        <p className="text-muted-foreground">{bairro} - {cidade}/{uf}</p>
                      </div>
                    )}
                    
                    <div className="space-y-1">
                      <Label className="text-sm">Número *</Label>
                      <Input
                        placeholder="Número ou S/N"
                        value={numero}
                        onChange={(e) => setNumero(e.target.value)}
                        className="w-32"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Técnico */}
            <div className="space-y-2">
              <Label>Técnico Responsável *</Label>
              <Select
                value={profissionalId}
                onValueChange={setProfissionalId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o técnico..." />
                </SelectTrigger>
                <SelectContent>
                  {loadingEquipe ? (
                    <div className="p-2 text-center">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    </div>
                  ) : profissionais.length > 0 ? (
                    profissionais.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-center text-sm text-muted-foreground">
                      Nenhum profissional disponível
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Opções */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="notificar-whatsapp"
                  checked={notificarWhatsApp}
                  onCheckedChange={(checked) => setNotificarWhatsApp(!!checked)}
                />
                <Label htmlFor="notificar-whatsapp" className="font-normal cursor-pointer flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-green-600" />
                  Notificar associado via WhatsApp
                </Label>
              </div>

              {podeHabilitarEncaixe && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="permite-encaixe"
                    checked={permiteEncaixe}
                    onCheckedChange={(checked) => setPermiteEncaixe(!!checked)}
                  />
                  <Label htmlFor="permite-encaixe" className="font-normal cursor-pointer flex items-center gap-2">
                    <Puzzle className="h-4 w-4 text-amber-600" />
                    Permitir encaixe (urgente)
                  </Label>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!isValid || abrirEAgendarMutation.isPending}
          >
            {abrirEAgendarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Agendar Manutenção
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
