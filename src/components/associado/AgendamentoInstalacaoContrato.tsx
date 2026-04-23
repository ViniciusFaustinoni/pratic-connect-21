import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, CheckCircle2, Loader2, MapPin, User, Search, Phone, Shield, AlertTriangle, Sun, Sunset, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { buscarCep } from '@/lib/cep';
import { Badge } from '@/components/ui/badge';
import { useAgendarInstalacaoContrato } from '@/hooks/useContratoLink';
import { isDomingo, PERIODOS_DISPONIVEIS, getPeriodosDisponivelsPorHora, type Periodo } from '@/data/autovistoriaConfig';
import { useVagasPeriodo } from '@/hooks/useVagasPeriodo';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { useDatasBloqueadasSet } from '@/hooks/useDatasBloqueadas';
import { useEnriquecerEndereco } from '@/hooks/useEnriquecerEndereco';

interface PrazoEstado {
  estado: string;
  prazo_horas: number;
}

interface EnderecoInicial {
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
}

interface AgendamentoInstalacaoContratoProps {
  contratoId: string;
  enderecoInicial?: EnderecoInicial;
  onConfirmar: () => void;
}

export function AgendamentoInstalacaoContrato({ contratoId, enderecoInicial, onConfirmar }: AgendamentoInstalacaoContratoProps) {
  const [dataSelecionada, setDataSelecionada] = useState<Date | null>(null);
  const [periodoSelecionado, setPeriodoSelecionado] = useState<Periodo | null>(null);

  // Endereço com enriquecimento automático via ViaCEP a partir do enderecoInicial (contrato/associado/cotação)
  const {
    endereco,
    setEndereco,
    enriquecendo,
    enriquecido,
    faltaInfo: enderecoFaltaInfo,
    veioPrePreenchido,
  } = useEnriquecerEndereco(enderecoInicial);
  const { cep, logradouro, numero, complemento, bairro, cidade, estado } = endereco;

  // Setters individuais para manter o restante do componente sem alterações estruturais
  const setCep = (v: string) => setEndereco(prev => ({ ...prev, cep: v }));
  const setLogradouro = (v: string) => setEndereco(prev => ({ ...prev, logradouro: v }));
  const setNumero = (v: string) => setEndereco(prev => ({ ...prev, numero: v }));
  const setComplemento = (v: string) => setEndereco(prev => ({ ...prev, complemento: v }));
  const setBairro = (v: string) => setEndereco(prev => ({ ...prev, bairro: v }));
  const setCidade = (v: string) => setEndereco(prev => ({ ...prev, cidade: v }));
  const setEstado = (v: string) => setEndereco(prev => ({ ...prev, estado: v }));

  const [buscandoCep, setBuscandoCep] = useState(false);
  
  // Estados para responsável
  const [euMesmo, setEuMesmo] = useState(true);
  const [responsavelNome, setResponsavelNome] = useState('');
  const [responsavelTelefone, setResponsavelTelefone] = useState('');
  
  // Prazos por estado
  const [prazosEstado, setPrazosEstado] = useState<PrazoEstado[]>([]);
  
  const agendarMutation = useAgendarInstalacaoContrato();
  
  // Buscar prazos da tabela configuracoes
  useEffect(() => {
    publicSupabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'instalacao_prazos_por_estado')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.valor) {
          try {
            setPrazosEstado(JSON.parse(data.valor));
          } catch { /* fallback vazio */ }
        }
      });
  }, []);
  
  // Calcular dias úteis com base no prazo do estado
  const diasUteis = useMemo(() => {
    const FALLBACK_HORAS = 48;
    const prazoConfig = prazosEstado.find(p => p.estado === estado.toUpperCase());
    const prazoHoras = prazoConfig?.prazo_horas ?? FALLBACK_HORAS;
    return Math.ceil(prazoHoras / 24);
  }, [estado, prazosEstado]);
  
  const { set: datasBloqueadasSet } = useDatasBloqueadasSet();

  // Gerar datas disponíveis dinamicamente (pula domingos + datas bloqueadas)
  const datasDisponiveis = useMemo(() => {
    const hoje = new Date();
    const datas: Date[] = [];
    let dia = addDays(hoje, 1);
    let guard = 0;
    
    while (datas.length < diasUteis && guard < 60) {
      if (!isDomingo(dia) && !datasBloqueadasSet.has(format(dia, 'yyyy-MM-dd'))) {
        datas.push(dia);
      }
      dia = addDays(dia, 1);
      guard++;
    }
    return datas;
  }, [diasUteis, datasBloqueadasSet]);
  
  // Reset data selecionada se mudar de estado e a data não estiver mais disponível
  useEffect(() => {
    if (dataSelecionada) {
      const aindaDisponivel = datasDisponiveis.some(
        d => format(d, 'yyyy-MM-dd') === format(dataSelecionada, 'yyyy-MM-dd')
      );
      if (!aindaDisponivel) {
        setDataSelecionada(null);
        setPeriodoSelecionado(null);
      }
    }
  }, [datasDisponiveis]);

  // Períodos disponíveis (considera hora atual quando hoje)
  const periodosDisponiveis = useMemo(() => {
    if (!dataSelecionada) return PERIODOS_DISPONIVEIS;
    return getPeriodosDisponivelsPorHora(dataSelecionada);
  }, [dataSelecionada]);

  // Reset período se mudar de data e o período não estiver mais disponível
  useEffect(() => {
    if (dataSelecionada && periodoSelecionado) {
      const ok = periodosDisponiveis.some(p => p.id === periodoSelecionado);
      if (!ok) setPeriodoSelecionado(null);
    }
  }, [dataSelecionada, periodoSelecionado, periodosDisponiveis]);

  // Vagas por período
  const dataFmt = dataSelecionada ? format(dataSelecionada, 'yyyy-MM-dd') : null;
  const { data: vagasData, isLoading: isLoadingVagas } = useVagasPeriodo(dataFmt);
  
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
        setEstado(endereco.uf);
      }
      setBuscandoCep(false);
    }
  };
  
  const formatarTelefone = (value: string) => {
    const nums = value.replace(/\D/g, '');
    if (nums.length <= 2) return nums;
    if (nums.length <= 7) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
    return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7, 11)}`;
  };
  
  const handleConfirmar = async () => {
    if (!dataSelecionada || !periodoSelecionado) return;
    
    try {
      await agendarMutation.mutateAsync({
        contratoId,
        dataAgendada: format(dataSelecionada, 'yyyy-MM-dd'),
        horarioAgendado: periodoSelecionado,
          endereco: {
            cep: cep.replace(/\D/g, ''),
            logradouro,
            numero,
            complemento,
            bairro,
            cidade,
            estado,
          },
        responsavel: {
          euMesmo,
          nome: euMesmo ? undefined : responsavelNome,
          telefone: euMesmo ? undefined : responsavelTelefone.replace(/\D/g, ''),
        },
      });
      
      onConfirmar();
    } catch (error) {
      console.error('Erro ao agendar:', error);
    }
  };
  
  // Validação completa
  const enderecoCompleto = cep.replace(/\D/g, '').length === 8 && 
    logradouro.trim() !== '' && 
    numero.trim() !== '' && 
    bairro.trim() !== '' && 
    cidade.trim() !== '' && 
    estado.trim() !== '';
    
  const responsavelValido = euMesmo || (
    responsavelNome.trim() !== '' && 
    responsavelTelefone.replace(/\D/g, '').length >= 10
  );
  
  const podeConfirmar = dataSelecionada && 
    periodoSelecionado && 
    enderecoCompleto && 
    responsavelValido && 
    !agendarMutation.isPending;
  
  return (
    <div className="space-y-6">
      {/* Banner de cobertura parcial ativa */}
      <Card className="border-success/30 bg-success/5 backdrop-blur-xl">
        <CardContent className="py-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
              <Shield className="h-7 w-7 text-success" />
            </div>
            <div>
              <Badge className="bg-success/20 text-success border-success/30 mb-1">
                Autovistoria Aprovada
              </Badge>
              <h3 className="text-lg font-semibold text-foreground">
                Pagamento Confirmado!
              </h3>
              <p className="text-sm text-muted-foreground">
                Agora vamos agendar a instalação do rastreador.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Formulário de agendamento */}
      <Card className="border-border/50 bg-card/80 backdrop-blur-xl">
        <CardHeader className="text-center pb-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <span className="text-sm text-amber-500 font-medium">Última etapa!</span>
          </div>
          <CardTitle className="text-xl">Agendar Instalação do Rastreador</CardTitle>
          <p className="text-muted-foreground text-sm mt-1">
            Escolha o melhor dia e horário para a instalação
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Local da Instalação — PRIMEIRO para determinar o prazo */}
          <div className="space-y-4">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Local da Instalação
            </label>
            
            <div className="grid gap-3">
              <div>
                <Label htmlFor="cep" className="text-xs text-muted-foreground">CEP *</Label>
                <div className="relative">
                  <Input
                    id="cep"
                    placeholder="00000-000"
                    value={cep}
                    onChange={(e) => handleCepChange(e.target.value)}
                    maxLength={9}
                    className="pr-10"
                  />
                  {buscandoCep && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {!buscandoCep && cep.replace(/\D/g, '').length === 8 && (
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-success" />
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Label htmlFor="logradouro" className="text-xs text-muted-foreground">Logradouro *</Label>
                  <Input
                    id="logradouro"
                    placeholder="Rua, Av..."
                    value={logradouro}
                    onChange={(e) => setLogradouro(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="numero" className="text-xs text-muted-foreground">Número *</Label>
                  <Input
                    id="numero"
                    placeholder="123"
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="complemento" className="text-xs text-muted-foreground">Complemento</Label>
                <Input
                  id="complemento"
                  placeholder="Apto, Bloco..."
                  value={complemento}
                  onChange={(e) => setComplemento(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="bairro" className="text-xs text-muted-foreground">Bairro *</Label>
                  <Input
                    id="bairro"
                    placeholder="Centro"
                    value={bairro}
                    onChange={(e) => setBairro(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="cidade" className="text-xs text-muted-foreground">Cidade *</Label>
                  <Input
                    id="cidade"
                    placeholder="São Paulo"
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="w-24">
                <Label htmlFor="estado" className="text-xs text-muted-foreground">Estado *</Label>
                <Input
                  id="estado"
                  placeholder="SP"
                  value={estado}
                  onChange={(e) => setEstado(e.target.value.toUpperCase())}
                  maxLength={2}
                />
              </div>
            </div>
          </div>

          {/* Seleção de data */}
          <div>
            <label className="text-sm font-medium text-foreground flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-primary" />
              Data
              {estado && (
                <span className="text-xs font-normal text-muted-foreground">
                  (prazo {estado.toUpperCase()}: {diasUteis * 24}h — {diasUteis} dia{diasUteis > 1 ? 's' : ''})
                </span>
              )}
            </label>
            {!estado ? (
              <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 text-center">
                Preencha o endereço acima para ver as datas disponíveis
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {datasDisponiveis.map((data) => {
                  const selecionada = dataSelecionada && 
                    format(dataSelecionada, 'yyyy-MM-dd') === format(data, 'yyyy-MM-dd');
                  
                  return (
                    <button
                      key={data.toISOString()}
                      onClick={() => setDataSelecionada(data)}
                      className={cn(
                        "p-3 rounded-lg border text-center transition-all",
                        selecionada
                          ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                          : "border-border/50 bg-card/50 hover:bg-accent/10 hover:border-primary/50"
                      )}
                    >
                      <div className="text-xs text-muted-foreground">
                        {format(data, 'EEE', { locale: ptBR })}
                      </div>
                      <div className="font-semibold text-lg text-foreground">
                        {format(data, 'd')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(data, 'MMM', { locale: ptBR })}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Seleção de período */}
          <div>
            <label className="text-sm font-medium text-foreground flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-primary" />
              Período
            </label>
            <div className="grid grid-cols-2 gap-3">
              {periodosDisponiveis.map((periodo) => {
                const selecionado = periodoSelecionado === periodo.id;
                const vagas = vagasData ? vagasData[periodo.id] : null;
                const esgotado = vagas !== null && vagas <= 0;

                return (
                  <button
                    key={periodo.id}
                    onClick={() => !esgotado && setPeriodoSelecionado(periodo.id)}
                    disabled={esgotado}
                    className={cn(
                      "p-4 rounded-lg border-2 text-left transition-all",
                      selecionado && "border-primary bg-primary/10 ring-2 ring-primary/20",
                      esgotado && "opacity-50 cursor-not-allowed bg-muted",
                      !selecionado && !esgotado && "border-border/50 bg-card/50 hover:bg-accent/10 hover:border-primary/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center",
                        selecionado ? "bg-primary/20" : "bg-muted"
                      )}>
                        {periodo.id === 'manha'
                          ? <Sun className="h-5 w-5 text-amber-500" />
                          : <Sunset className="h-5 w-5 text-orange-500" />}
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-foreground">{periodo.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {periodo.horarioInicio} às {periodo.horarioFim}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs">
                      {isLoadingVagas ? (
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" /> Verificando...
                        </span>
                      ) : esgotado ? (
                        <span className="text-destructive font-medium">Esgotado</span>
                      ) : vagas !== null ? (
                        <span className="text-success font-medium">{vagas} vagas disponíveis</span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Responsável */}
          <div className="space-y-4">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Quem receberá o instalador?
            </label>
            
            <div className="space-y-2">
              <button
                onClick={() => setEuMesmo(true)}
                className={cn(
                  "w-full p-3 rounded-lg border text-left transition-all flex items-center gap-3",
                  euMesmo
                    ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                    : "border-border/50 bg-card/50 hover:bg-accent/10 hover:border-primary/50"
                )}
              >
                <div className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                  euMesmo ? "border-primary" : "border-muted-foreground"
                )}>
                  {euMesmo && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                </div>
                <span className="font-medium text-foreground">Eu mesmo</span>
              </button>
              
              <button
                onClick={() => setEuMesmo(false)}
                className={cn(
                  "w-full p-3 rounded-lg border text-left transition-all flex items-center gap-3",
                  !euMesmo
                    ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                    : "border-border/50 bg-card/50 hover:bg-accent/10 hover:border-primary/50"
                )}
              >
                <div className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                  !euMesmo ? "border-primary" : "border-muted-foreground"
                )}>
                  {!euMesmo && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                </div>
                <span className="font-medium text-foreground">Outra pessoa</span>
              </button>
            </div>
            
            {!euMesmo && (
              <div className="space-y-3 pl-4 border-l-2 border-primary/30 ml-2 mt-3">
                <div>
                  <Label htmlFor="responsavelNome" className="text-xs text-muted-foreground">
                    Nome completo do responsável *
                  </Label>
                  <Input
                    id="responsavelNome"
                    placeholder="João da Silva"
                    value={responsavelNome}
                    onChange={(e) => setResponsavelNome(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="responsavelTelefone" className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    Telefone de contato *
                  </Label>
                  <Input
                    id="responsavelTelefone"
                    placeholder="(11) 99999-9999"
                    value={responsavelTelefone}
                    onChange={(e) => setResponsavelTelefone(formatarTelefone(e.target.value))}
                    maxLength={15}
                  />
                </div>
              </div>
            )}
          </div>
          
          {/* Resumo */}
          {dataSelecionada && periodoSelecionado && enderecoCompleto && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <h4 className="font-medium text-foreground mb-2">Resumo do agendamento</h4>
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">
                  {format(dataSelecionada, "EEEE, d 'de' MMMM", { locale: ptBR })}
                </strong>
                {' — '}
                <strong className="text-foreground">
                  {periodoSelecionado === 'manha' ? 'Manhã (08:00–12:00)' : 'Tarde (14:00–18:00)'}
                </strong>
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {logradouro}, {numero} - {bairro}, {cidade}/{estado}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                <strong className="text-foreground">Responsável:</strong>{' '}
                {euMesmo ? 'Eu mesmo' : responsavelNome}
              </p>
            </div>
          )}
          
          {/* Botão confirmar */}
          <Button
            onClick={handleConfirmar}
            disabled={!podeConfirmar}
            className="w-full bg-primary hover:bg-primary/90"
            size="lg"
          >
            {agendarMutation.isPending ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="h-5 w-5 mr-2" />
            )}
            Confirmar Agendamento da Instalação
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
