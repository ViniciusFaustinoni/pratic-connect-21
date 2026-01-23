import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Calendar, Clock, CheckCircle2, Loader2, MapPin, User, Search, Phone, Puzzle } from 'lucide-react';
import { useFinalizarVistoriaCotacao } from '@/hooks/useCotacaoVistoria';
import { HORARIOS_DISPONIVEIS } from '@/data/autovistoriaConfig';
import { cn } from '@/lib/utils';
import { format, addDays, isWeekend } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { buscarCep } from '@/lib/cep';

interface AgendamentoCotacaoProps {
  cotacaoId: string;
  onConfirmar: (data: string, horario: string) => void;
}

export function AgendamentoCotacao({ cotacaoId, onConfirmar }: AgendamentoCotacaoProps) {
  const [dataSelecionada, setDataSelecionada] = useState<Date | null>(null);
  const [horarioSelecionado, setHorarioSelecionado] = useState<string | null>(null);
  
  // Estados para endereço
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [buscandoCep, setBuscandoCep] = useState(false);
  
  // Estados para responsável
  const [euMesmo, setEuMesmo] = useState(true);
  const [responsavelNome, setResponsavelNome] = useState('');
  const [responsavelTelefone, setResponsavelTelefone] = useState('');
  
  // Estado para encaixe
  const [permiteEncaixe, setPermiteEncaixe] = useState(false);
  
  const finalizarMutation = useFinalizarVistoriaCotacao();
  
  const hoje = new Date();
  
  // Função para obter horários disponíveis para uma data específica
  const getHorariosDisponiveis = (data: Date) => {
    const agora = new Date();
    const isHoje = format(data, 'yyyy-MM-dd') === format(agora, 'yyyy-MM-dd');
    
    if (!isHoje) {
      return HORARIOS_DISPONIVEIS;
    }
    
    // Para hoje, filtrar horários que são >= 2 horas após agora
    const horaMinima = agora.getHours() + 2;
    
    return HORARIOS_DISPONIVEIS.filter(horario => {
      const hora = parseInt(horario.split(':')[0], 10);
      return hora > horaMinima;
    });
  };
  
  // Verificar se hoje tem horários disponíveis (pelo menos 1 slot 2h+ à frente)
  const hojeTemHorarios = () => {
    if (isWeekend(hoje)) return false;
    return getHorariosDisponiveis(hoje).length > 0;
  };
  
  // Gerar próximos 7 dias úteis (incluindo hoje se válido)
  const datasDisponiveis: Date[] = [];
  
  // Incluir hoje se válido
  if (hojeTemHorarios()) {
    datasDisponiveis.push(hoje);
  }
  
  // Continuar com dias futuros até ter 7 datas
  let dia = addDays(hoje, 1);
  while (datasDisponiveis.length < 7) {
    if (!isWeekend(dia)) {
      datasDisponiveis.push(dia);
    }
    dia = addDays(dia, 1);
  }
  
  // Handler para seleção de data - limpa horário se inválido
  const handleSelecionarData = (data: Date) => {
    setDataSelecionada(data);
    
    if (horarioSelecionado) {
      const horariosValidos = getHorariosDisponiveis(data);
      if (!horariosValidos.includes(horarioSelecionado)) {
        setHorarioSelecionado(null);
      }
    }
  };
  
  // Horários disponíveis para a data selecionada
  const horariosParaData = dataSelecionada 
    ? getHorariosDisponiveis(dataSelecionada) 
    : HORARIOS_DISPONIVEIS;
  
  const handleCepChange = async (value: string) => {
    const cepLimpo = value.replace(/\D/g, '');
    // Formatar CEP com hífen
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
    if (!dataSelecionada || !horarioSelecionado) return;
    
    try {
      await finalizarMutation.mutateAsync({
        cotacaoId,
        tipoVistoria: 'agendada',
        dataAgendada: format(dataSelecionada, 'yyyy-MM-dd'),
        horarioAgendado: horarioSelecionado,
        endereco: {
          cep: cep.replace(/\D/g, ''),
          logradouro,
          numero,
          bairro,
          cidade,
          estado,
        },
        responsavel: {
          euMesmo,
          nome: euMesmo ? undefined : responsavelNome,
          telefone: euMesmo ? undefined : responsavelTelefone.replace(/\D/g, ''),
        },
        permiteEncaixe,
      });
      
      const dataFormatada = format(dataSelecionada, 'yyyy-MM-dd');
      onConfirmar(dataFormatada, horarioSelecionado);
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
    horarioSelecionado && 
    enderecoCompleto && 
    responsavelValido && 
    !finalizarMutation.isPending;
  
  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-xl">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Agendar Vistoria Presencial</CardTitle>
        <p className="text-muted-foreground text-sm mt-1">
          Escolha uma data e horário para o vistoriador ir até você
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Seleção de data */}
        <div>
          <label className="text-sm font-medium text-foreground flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4 text-primary" />
            Data
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {datasDisponiveis.map((data) => {
              const selecionada = dataSelecionada && 
                format(dataSelecionada, 'yyyy-MM-dd') === format(data, 'yyyy-MM-dd');
              const isHoje = format(data, 'yyyy-MM-dd') === format(hoje, 'yyyy-MM-dd');
              
              return (
                <button
                  key={data.toISOString()}
                  onClick={() => handleSelecionarData(data)}
                  className={cn(
                    "p-3 rounded-lg border text-center transition-all",
                    selecionada
                      ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                      : "border-border/50 bg-card/50 hover:bg-accent/10 hover:border-primary/50"
                  )}
                >
                  <div className={cn(
                    "text-xs",
                    isHoje ? "text-primary font-semibold" : "text-muted-foreground"
                  )}>
                    {isHoje ? 'hoje' : format(data, 'EEE', { locale: ptBR })}
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
        </div>
        
        {/* Seleção de horário */}
        <div>
          <label className="text-sm font-medium text-foreground flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-primary" />
            Horário
          </label>
          <div className="grid grid-cols-4 gap-2">
            {horariosParaData.length > 0 ? (
              horariosParaData.map((horario) => {
                const selecionado = horarioSelecionado === horario;
                
                return (
                  <button
                    key={horario}
                    onClick={() => setHorarioSelecionado(horario)}
                    className={cn(
                      "p-2.5 rounded-lg border text-center font-medium transition-all",
                      selecionado
                        ? "border-primary bg-primary/10 ring-2 ring-primary/20 text-primary"
                        : "border-border/50 bg-card/50 hover:bg-accent/10 hover:border-primary/50 text-foreground"
                    )}
                  >
                    {horario}
                  </button>
                );
              })
            ) : (
              <p className="col-span-4 text-sm text-muted-foreground text-center py-4">
                Selecione uma data para ver os horários disponíveis
              </p>
            )}
          </div>
        </div>
        
        {/* Local da Vistoria */}
        <div className="space-y-4">
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Local da Vistoria
          </label>
          
          <div className="grid gap-3">
            {/* CEP */}
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
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                )}
              </div>
            </div>
            
            {/* Logradouro e Número */}
            <div className="grid grid-cols-3 gap-2">
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
            
            {/* Bairro e Cidade */}
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
            
            {/* Estado */}
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
        
        {/* Responsável */}
        <div className="space-y-4">
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Quem receberá o vistoriador?
          </label>
          
          <div className="space-y-2">
            {/* Eu mesmo */}
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
            
            {/* Outra pessoa */}
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
          
          {/* Campos da outra pessoa */}
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
        {dataSelecionada && horarioSelecionado && enderecoCompleto && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <h4 className="font-medium text-foreground mb-2">Resumo do agendamento</h4>
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">
                {format(dataSelecionada, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </strong>
              {' '}às{' '}
              <strong className="text-foreground">{horarioSelecionado}</strong>
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
        
        {/* Opção de Encaixe de Horários */}
        <Card className="border-border/30 bg-muted/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Puzzle className="h-4 w-4 text-primary" />
                  <span className="font-medium text-foreground">
                    Permitir Encaixe de Horários
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Se um vistoriador estiver próximo da sua região antes do 
                  horário agendado, ele poderá realizar a vistoria 
                  antecipadamente. Você será notificado previamente.
                </p>
              </div>
              <Switch
                checked={permiteEncaixe}
                onCheckedChange={setPermiteEncaixe}
              />
            </div>
          </CardContent>
        </Card>
        
        {/* Botão confirmar */}
        <Button
          onClick={handleConfirmar}
          disabled={!podeConfirmar}
          className="w-full bg-primary hover:bg-primary/90"
          size="lg"
        >
          {finalizarMutation.isPending ? (
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          ) : (
            <CheckCircle2 className="h-5 w-5 mr-2" />
          )}
          Confirmar Agendamento
        </Button>
      </CardContent>
    </Card>
  );
}
