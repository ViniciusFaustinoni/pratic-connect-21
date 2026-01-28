import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Calendar, Clock, MapPin, User, Phone, CheckCircle2, Loader2, Shield, AlertTriangle, Puzzle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { maskCEP, maskTelefone } from '@/lib/validations';
import { motion, AnimatePresence } from 'framer-motion';
import { useFinalizarVistoriaCotacao, useAgendarVistoriaCompleta } from '@/hooks/useCotacaoVistoria';
import { isDomingo, getHorariosParaDia, HORARIOS_DISPONIVEIS } from '@/data/autovistoriaConfig';

interface EnderecoForm {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
}

export interface AgendamentoVistoriaProps {
  cotacaoId: string;
  onConfirmar: (dataAgendada?: string, horarioAgendado?: string) => void;
  
  // Contexto define variações visuais e qual hook usar
  contexto: 'presencial-direto' | 'pos-autovistoria';
  
  // Tipo de vistoria original (apenas para contexto pós-autovistoria)
  tipoVistoria?: 'autovistoria' | 'agendada';
}

export function AgendamentoVistoria({ 
  cotacaoId, 
  onConfirmar, 
  contexto,
  tipoVistoria 
}: AgendamentoVistoriaProps) {
  // Estados
  const [dataSelecionada, setDataSelecionada] = useState<Date | null>(null);
  const [horarioSelecionado, setHorarioSelecionado] = useState<string | null>(null);
  const [responsavel, setResponsavel] = useState<'eu' | 'outro'>('eu');
  const [nomeResponsavel, setNomeResponsavel] = useState('');
  const [telefoneResponsavel, setTelefoneResponsavel] = useState('');
  const [permiteEncaixe, setPermiteEncaixe] = useState(false);
  const [mostrarResumo, setMostrarResumo] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  
  const [endereco, setEndereco] = useState<EnderecoForm>({
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: ''
  });

  // Hooks de mutations
  const finalizarMutation = useFinalizarVistoriaCotacao();
  const agendarMutation = useAgendarVistoriaCompleta();
  
  const isLoading = finalizarMutation.isPending || agendarMutation.isPending;

  // === LÓGICA UNIFICADA DE DATAS/HORÁRIOS ===
  
  // Função para obter horários disponíveis para uma data específica
  const getHorariosDisponiveis = (data: Date) => {
    const agora = new Date();
    const isHoje = format(data, 'yyyy-MM-dd') === format(agora, 'yyyy-MM-dd');
    
    // Pegar horários baseado no dia (sábado tem horário reduzido)
    const horariosBase = getHorariosParaDia(data);
    
    if (!isHoje) {
      return horariosBase;
    }
    
    // Para hoje, filtrar horários que são >= 2 horas após agora
    const horaMinima = agora.getHours() + 2;
    
    return horariosBase.filter(horario => {
      const hora = parseInt(horario.split(':')[0], 10);
      return hora > horaMinima;
    });
  };
  
  // Verificar se hoje tem horários disponíveis
  const hojeTemHorarios = () => {
    const hoje = new Date();
    if (isDomingo(hoje)) return false; // Só bloqueia domingo
    return getHorariosDisponiveis(hoje).length > 0;
  };

  // Gerar próximos 7 dias úteis (incluindo hoje se válido)
  const hoje = new Date();
  const datasDisponiveis: Date[] = [];
  
  // Incluir hoje se tem horários válidos
  if (hojeTemHorarios()) {
    datasDisponiveis.push(hoje);
  }
  
  // Continuar com dias futuros até ter 7 datas (incluindo sábados)
  let dia = addDays(hoje, 1);
  while (datasDisponiveis.length < 7) {
    if (!isDomingo(dia)) { // Só bloqueia domingo
      datasDisponiveis.push(new Date(dia));
    }
    dia = addDays(dia, 1);
  }

  // Horários disponíveis para a data selecionada
  const horariosParaDataSelecionada = dataSelecionada 
    ? getHorariosDisponiveis(dataSelecionada) 
    : HORARIOS_DISPONIVEIS;

  // Reset horário se mudar a data e o horário selecionado não estiver disponível
  useEffect(() => {
    if (dataSelecionada && horarioSelecionado) {
      const horariosDisponiveis = getHorariosDisponiveis(dataSelecionada);
      if (!horariosDisponiveis.includes(horarioSelecionado)) {
        setHorarioSelecionado(null);
      }
    }
  }, [dataSelecionada, horarioSelecionado]);

  // Buscar CEP
  const buscarCep = async (cep: string) => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;
    
    setBuscandoCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await response.json();
      
      if (data.erro) {
        toast.error('CEP não encontrado');
        return;
      }
      
      setEndereco(prev => ({
        ...prev,
        logradouro: data.logradouro || '',
        bairro: data.bairro || '',
        cidade: data.localidade || '',
        estado: data.uf || ''
      }));
    } catch {
      toast.error('Erro ao buscar CEP');
    } finally {
      setBuscandoCep(false);
    }
  };

  // Validar formulário
  const formularioValido = () => {
    if (!dataSelecionada || !horarioSelecionado) return false;
    if (!endereco.cep || !endereco.logradouro || !endereco.numero || !endereco.bairro || !endereco.cidade || !endereco.estado) return false;
    if (responsavel === 'outro' && (!nomeResponsavel || !telefoneResponsavel)) return false;
    return true;
  };

  // Confirmar agendamento
  const handleConfirmar = async () => {
    if (!formularioValido() || !dataSelecionada || !horarioSelecionado) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const dataFormatada = format(dataSelecionada, 'yyyy-MM-dd');
    
    const dadosAgendamento = {
      cotacaoId,
      dataAgendada: dataFormatada,
      horarioAgendado: horarioSelecionado,
      endereco: {
        cep: endereco.cep,
        logradouro: endereco.logradouro,
        numero: endereco.numero,
        bairro: endereco.bairro,
        cidade: endereco.cidade,
        estado: endereco.estado
      },
      responsavel: {
        euMesmo: responsavel === 'eu',
        nome: responsavel === 'outro' ? nomeResponsavel : undefined,
        telefone: responsavel === 'outro' ? telefoneResponsavel : undefined
      },
      permiteEncaixe
    };

    try {
      if (contexto === 'presencial-direto') {
        await finalizarMutation.mutateAsync({
          ...dadosAgendamento,
          tipoVistoria: 'agendada'
        });
        onConfirmar(dataFormatada, horarioSelecionado);
      } else {
        await agendarMutation.mutateAsync(dadosAgendamento);
        onConfirmar();
      }
    } catch (error) {
      console.error('Erro ao agendar:', error);
    }
  };

  // === VARIAÇÕES VISUAIS POR CONTEXTO ===
  
  const titulo = contexto === 'presencial-direto' 
    ? 'Agendar Vistoria Presencial'
    : 'Agendar Instalação';
    
  const subtitulo = contexto === 'presencial-direto'
    ? 'Escolha data e horário para o vistoriador ir até você'
    : 'Escolha data e horário para o técnico instalar o rastreador';

  return (
    <div className="space-y-6">
      {/* Banner de status (apenas para pós-autovistoria) */}
      {contexto === 'pos-autovistoria' && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-warning mt-0.5" />
              <div>
                <p className="font-medium text-warning">
                  {tipoVistoria === 'autovistoria' 
                    ? 'Cobertura contra Roubo/Furto ativa!'
                    : 'Aguardando vistoria completa'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {tipoVistoria === 'autovistoria'
                    ? 'Agende a vistoria completa para ativar todas as coberturas (colisão, incêndio, etc.)'
                    : 'Complete o agendamento para ativar sua proteção'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {titulo}
          </CardTitle>
          <CardDescription>{subtitulo}</CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <AnimatePresence mode="wait">
            {!mostrarResumo ? (
              <motion.div
                key="formulario"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Seleção de Data */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Escolha a data
                  </Label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
                    {datasDisponiveis.map((data) => {
                      const isHoje = format(data, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                      return (
                        <Button
                          key={data.toISOString()}
                          variant={dataSelecionada?.toDateString() === data.toDateString() ? 'default' : 'outline'}
                          className={cn(
                            'flex flex-col h-auto py-2',
                            dataSelecionada?.toDateString() === data.toDateString() && 'ring-2 ring-primary'
                          )}
                          onClick={() => setDataSelecionada(data)}
                        >
                          <span className="text-xs opacity-70">
                            {isHoje ? 'Hoje' : format(data, 'EEE', { locale: ptBR })}
                          </span>
                          <span className="text-lg font-bold">{format(data, 'd')}</span>
                          <span className="text-xs opacity-70">{format(data, 'MMM', { locale: ptBR })}</span>
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {/* Seleção de Horário */}
                {dataSelecionada && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-3"
                  >
                    <Label className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Escolha o horário
                    </Label>
                    {horariosParaDataSelecionada.length === 0 ? (
                      <div className="flex items-center gap-2 text-warning bg-warning/10 p-3 rounded-lg">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm">Não há horários disponíveis para esta data. Selecione outra data.</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-5 gap-2">
                        {horariosParaDataSelecionada.map((horario) => (
                          <Button
                            key={horario}
                            variant={horarioSelecionado === horario ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setHorarioSelecionado(horario)}
                          >
                            {horario}
                          </Button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Endereço */}
                {dataSelecionada && horarioSelecionado && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-4"
                  >
                    <Label className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Endereço para a instalação
                    </Label>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cep">CEP</Label>
                        <div className="relative">
                          <Input
                            id="cep"
                            placeholder="00000-000"
                            value={endereco.cep}
                            onChange={(e) => {
                              const masked = maskCEP(e.target.value);
                              setEndereco(prev => ({ ...prev, cep: masked }));
                              if (masked.replace(/\D/g, '').length === 8) {
                                buscarCep(masked);
                              }
                            }}
                            maxLength={9}
                          />
                          {buscandoCep && (
                            <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                        </div>
                      </div>
                      
                      <div className="md:col-span-2 space-y-2">
                        <Label htmlFor="logradouro">Logradouro</Label>
                        <Input
                          id="logradouro"
                          placeholder="Rua, Avenida..."
                          value={endereco.logradouro}
                          onChange={(e) => setEndereco(prev => ({ ...prev, logradouro: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="numero">Número</Label>
                        <Input
                          id="numero"
                          placeholder="123"
                          value={endereco.numero}
                          onChange={(e) => setEndereco(prev => ({ ...prev, numero: e.target.value }))}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="complemento">Complemento</Label>
                        <Input
                          id="complemento"
                          placeholder="Apto, Bloco..."
                          value={endereco.complemento}
                          onChange={(e) => setEndereco(prev => ({ ...prev, complemento: e.target.value }))}
                        />
                      </div>
                      
                      <div className="md:col-span-2 space-y-2">
                        <Label htmlFor="bairro">Bairro</Label>
                        <Input
                          id="bairro"
                          placeholder="Bairro"
                          value={endereco.bairro}
                          onChange={(e) => setEndereco(prev => ({ ...prev, bairro: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cidade">Cidade</Label>
                        <Input
                          id="cidade"
                          placeholder="Cidade"
                          value={endereco.cidade}
                          onChange={(e) => setEndereco(prev => ({ ...prev, cidade: e.target.value }))}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="estado">Estado</Label>
                        <Input
                          id="estado"
                          placeholder="UF"
                          value={endereco.estado}
                          onChange={(e) => setEndereco(prev => ({ ...prev, estado: e.target.value.toUpperCase() }))}
                          maxLength={2}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Responsável */}
                {endereco.logradouro && endereco.numero && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-4"
                  >
                    <Label className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Quem receberá o técnico/instalador?
                    </Label>
                    
                    <RadioGroup
                      value={responsavel}
                      onValueChange={(value) => setResponsavel(value as 'eu' | 'outro')}
                      className="space-y-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="eu" id="eu" />
                        <Label htmlFor="eu" className="cursor-pointer">Eu mesmo</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="outro" id="outro" />
                        <Label htmlFor="outro" className="cursor-pointer">Outra pessoa</Label>
                      </div>
                    </RadioGroup>

                    {responsavel === 'outro' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6"
                      >
                        <div className="space-y-2">
                          <Label htmlFor="nomeResponsavel">Nome do responsável</Label>
                          <Input
                            id="nomeResponsavel"
                            placeholder="Nome completo"
                            value={nomeResponsavel}
                            onChange={(e) => setNomeResponsavel(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="telefoneResponsavel" className="flex items-center gap-2">
                            <Phone className="h-3 w-3" />
                            Telefone
                          </Label>
                          <Input
                            id="telefoneResponsavel"
                            placeholder="(00) 00000-0000"
                            value={telefoneResponsavel}
                            onChange={(e) => setTelefoneResponsavel(maskTelefone(e.target.value))}
                          />
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {/* Opção de Encaixe */}
                {endereco.logradouro && endereco.numero && (responsavel === 'eu' || (nomeResponsavel && telefoneResponsavel)) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-4"
                  >
                    <div className="flex items-start gap-4 p-4 rounded-lg border bg-muted/30">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Puzzle className="h-4 w-4 text-primary" />
                          <Label htmlFor="encaixe" className="font-medium cursor-pointer">
                            Permitir encaixe de horário
                          </Label>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Se um profissional estiver próximo antes do horário agendado, ele pode antecipar sua visita. 
                          Você será avisado com antecedência.
                        </p>
                      </div>
                      <Switch
                        id="encaixe"
                        checked={permiteEncaixe}
                        onCheckedChange={setPermiteEncaixe}
                      />
                    </div>
                  </motion.div>
                )}

                {/* Botão Continuar */}
                {formularioValido() && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <Button
                      className="w-full"
                      size="lg"
                      onClick={() => setMostrarResumo(true)}
                    >
                      Revisar agendamento
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="resumo"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Resumo do Agendamento */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    Resumo do Agendamento
                  </h3>
                  
                  <div className="grid gap-3 text-sm">
                    <div className="flex items-start gap-3">
                      <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Data e horário</p>
                        <p className="text-muted-foreground">
                          {dataSelecionada && format(dataSelecionada, "EEEE, d 'de' MMMM", { locale: ptBR })} às {horarioSelecionado}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Endereço</p>
                        <p className="text-muted-foreground">
                          {endereco.logradouro}, {endereco.numero}
                          {endereco.complemento && ` - ${endereco.complemento}`}
                          <br />
                          {endereco.bairro} - {endereco.cidade}/{endereco.estado}
                          <br />
                          CEP: {endereco.cep}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Responsável</p>
                        <p className="text-muted-foreground">
                          {responsavel === 'eu' ? 'Você mesmo' : `${nomeResponsavel} - ${telefoneResponsavel}`}
                        </p>
                      </div>
                    </div>

                    {permiteEncaixe && (
                      <div className="flex items-start gap-3">
                        <Puzzle className="h-4 w-4 mt-0.5 text-primary" />
                        <div>
                          <p className="font-medium">Encaixe de horário</p>
                          <p className="text-muted-foreground">
                            Você permitiu que o profissional antecipe a visita se estiver próximo
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setMostrarResumo(false)}
                    disabled={isLoading}
                  >
                    Voltar
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleConfirmar}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Confirmando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Confirmar agendamento
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}
