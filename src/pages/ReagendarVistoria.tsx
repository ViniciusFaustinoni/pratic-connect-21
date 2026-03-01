import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Calendar, CheckCircle2, Clock, Loader2, MapPin, Search, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { buscarCep } from '@/lib/cep';
import { toast } from 'sonner';
import { format, addDays, isSunday, isSaturday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LIMITE_VAGAS_POR_PERIODO } from '@/data/autovistoriaConfig';

interface VagasInfo {
  manha: number;
  tarde: number;
}

export default function ReagendarVistoria() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [servico, setServico] = useState<any>(null);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);

  // Form state
  const [dataSelecionada, setDataSelecionada] = useState<Date | undefined>();
  const [periodo, setPeriodo] = useState('');
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [complemento, setComplemento] = useState('');
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // Vagas state
  const [vagas, setVagas] = useState<VagasInfo | null>(null);
  const [carregandoVagas, setCarregandoVagas] = useState(false);

  useEffect(() => {
    if (token) carregarServico();
  }, [token]);

  // Buscar vagas quando data muda
  useEffect(() => {
    if (dataSelecionada) {
      buscarVagas(format(dataSelecionada, 'yyyy-MM-dd'));
      setPeriodo(''); // Reset period selection
    } else {
      setVagas(null);
    }
  }, [dataSelecionada]);

  const carregarServico = async () => {
    try {
      const { data, error } = await publicSupabase
        .from('servicos')
        .select('id, tipo, associado_id, veiculo_id, cotacao_id, status, reagendamento_token, logradouro, numero, bairro, cidade, uf, cep, local_vistoria, rastreador_id, contrato_id')
        .eq('reagendamento_token', token)
        .single();

      if (error || !data) {
        setErro('Link inválido ou expirado.');
        return;
      }

      if ((data as any).status === 'reagendada') {
        setErro('Esta vistoria já foi reagendada.');
        return;
      }

      setServico(data);
      // Pre-fill address
      if ((data as any).cep) setCep((data as any).cep);
      if ((data as any).logradouro) setLogradouro((data as any).logradouro);
      if ((data as any).numero) setNumero((data as any).numero);
      if ((data as any).bairro) setBairro((data as any).bairro);
      if ((data as any).cidade) setCidade((data as any).cidade);
      if ((data as any).uf) setUf((data as any).uf);
    } catch {
      setErro('Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  };

  const buscarVagas = async (data: string) => {
    setCarregandoVagas(true);
    try {
      const { data: servicos, error } = await publicSupabase
        .from('servicos')
        .select('periodo')
        .eq('data_agendada', data)
        .eq('local_vistoria', 'cliente')
        .not('status', 'in', '("cancelada","recusada","reagendada")');

      if (error) {
        console.error('[ReagendarVistoria] Erro ao buscar vagas:', error);
        setVagas({ manha: LIMITE_VAGAS_POR_PERIODO, tarde: LIMITE_VAGAS_POR_PERIODO });
        return;
      }

      const contagem = { manha: 0, tarde: 0 };
      servicos?.forEach(s => {
        if (s.periodo === 'manha') contagem.manha++;
        else if (s.periodo === 'tarde') contagem.tarde++;
      });

      setVagas({
        manha: Math.max(0, LIMITE_VAGAS_POR_PERIODO - contagem.manha),
        tarde: Math.max(0, LIMITE_VAGAS_POR_PERIODO - contagem.tarde),
      });
    } catch {
      setVagas({ manha: LIMITE_VAGAS_POR_PERIODO, tarde: LIMITE_VAGAS_POR_PERIODO });
    } finally {
      setCarregandoVagas(false);
    }
  };

  const handleBuscarCep = async () => {
    if (cep.replace(/\D/g, '').length !== 8) return;
    setBuscandoCep(true);
    try {
      const resultado = await buscarCep(cep);
      if (resultado) {
        setLogradouro(resultado.logradouro);
        setBairro(resultado.bairro);
        setCidade(resultado.cidade);
        setUf(resultado.uf);
      } else {
        toast.error('CEP não encontrado');
      }
    } finally {
      setBuscandoCep(false);
    }
  };

  const handleReagendar = async () => {
    if (!dataSelecionada || !periodo || !logradouro || !bairro || !cidade || !uf) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    // Validate availability for non-encaixe
    if (periodo !== 'encaixe' && vagas) {
      const vagasPeriodo = periodo === 'manha' ? vagas.manha : vagas.tarde;
      if (vagasPeriodo <= 0) {
        toast.error('Não há vagas disponíveis neste período');
        return;
      }
    }

    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke('reagendar-vistoria-publica', {
        body: {
          servico_id: servico.id,
          token,
          nova_data: format(dataSelecionada, 'yyyy-MM-dd'),
          periodo: periodo === 'encaixe' ? 'manha' : periodo,
          permite_encaixe: periodo === 'encaixe',
          endereco: {
            cep: cep.replace(/\D/g, ''),
            logradouro,
            numero,
            bairro,
            cidade,
            uf,
            complemento,
          },
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao reagendar');

      setSucesso(true);
    } catch (error: any) {
      console.error('Erro ao reagendar:', error);
      toast.error(error.message || 'Erro ao reagendar vistoria');
    } finally {
      setEnviando(false);
    }
  };

  // Disable sundays and past dates
  const disabledDays = (date: Date) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return date < addDays(hoje, 1) || isSunday(date);
  };

  const isSabado = dataSelecionada ? isSaturday(dataSelecionada) : false;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (erro) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive text-lg">{erro}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (sucesso) {
    const periodoLabel = periodo === 'encaixe'
      ? 'primeiro horário disponível (encaixe)'
      : periodo === 'manha' ? 'manhã' : 'tarde';

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-semibold text-foreground">Vistoria Reagendada!</h2>
            <p className="text-muted-foreground">
              Sua vistoria foi reagendada para{' '}
              <strong>{dataSelecionada && format(dataSelecionada, "dd/MM/yyyy", { locale: ptBR })}</strong>
              {' '}no período da <strong>{periodoLabel}</strong>.
            </p>
            <p className="text-sm text-muted-foreground">
              Você receberá uma confirmação por WhatsApp em breve.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 pt-4">
          <h1 className="text-2xl font-bold text-foreground">Reagendar Vistoria</h1>
          <p className="text-muted-foreground">
            Selecione uma nova data, horário e endereço para sua vistoria.
          </p>
        </div>

        {/* Data */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Nova Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CalendarComponent
              mode="single"
              selected={dataSelecionada}
              onSelect={setDataSelecionada}
              disabled={disabledDays}
              locale={ptBR}
              className="rounded-md border mx-auto"
            />
          </CardContent>
        </Card>

        {/* Período */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!dataSelecionada ? (
              <p className="text-sm text-muted-foreground">Selecione uma data primeiro</p>
            ) : carregandoVagas ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Verificando disponibilidade...
              </div>
            ) : (
              <RadioGroup value={periodo} onValueChange={setPeriodo} className="space-y-3">
                {/* Manhã */}
                <div className={`flex items-center justify-between rounded-lg border p-3 ${
                  vagas && vagas.manha <= 0 ? 'opacity-50' : ''
                }`}>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem
                      value="manha"
                      id="manha"
                      disabled={vagas ? vagas.manha <= 0 : false}
                    />
                    <Label htmlFor="manha" className="cursor-pointer">
                      ☀️ Manhã (08h - 12h)
                    </Label>
                  </div>
                  {vagas && (
                    <Badge variant={vagas.manha > 0 ? 'secondary' : 'destructive'} className="text-xs">
                      {vagas.manha > 0 ? `${vagas.manha} vagas` : 'Lotado'}
                    </Badge>
                  )}
                </div>

                {/* Tarde - hidden on Saturday */}
                {!isSabado && (
                  <div className={`flex items-center justify-between rounded-lg border p-3 ${
                    vagas && vagas.tarde <= 0 ? 'opacity-50' : ''
                  }`}>
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem
                        value="tarde"
                        id="tarde"
                        disabled={vagas ? vagas.tarde <= 0 : false}
                      />
                      <Label htmlFor="tarde" className="cursor-pointer">
                        🌅 Tarde (13h - 17h)
                      </Label>
                    </div>
                    {vagas && (
                      <Badge variant={vagas.tarde > 0 ? 'secondary' : 'destructive'} className="text-xs">
                        {vagas.tarde > 0 ? `${vagas.tarde} vagas` : 'Lotado'}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Encaixe */}
                <div className="flex items-center justify-between rounded-lg border border-dashed border-primary/40 p-3 bg-primary/5">
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="encaixe" id="encaixe" />
                    <div>
                      <Label htmlFor="encaixe" className="cursor-pointer flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-primary" />
                        Primeiro horário disponível
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Encaixe prioritário — atribuído ao vistoriador mais próximo
                      </p>
                    </div>
                  </div>
                </div>
              </RadioGroup>
            )}
          </CardContent>
        </Card>

        {/* Endereço */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Endereço da Vistoria
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <Label>CEP</Label>
                <Input
                  value={cep}
                  onChange={(e) => setCep(e.target.value)}
                  placeholder="00000-000"
                  maxLength={9}
                />
              </div>
              <div className="flex items-end">
                <Button variant="outline" size="icon" onClick={handleBuscarCep} disabled={buscandoCep}>
                  {buscandoCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div>
              <Label>Logradouro *</Label>
              <Input value={logradouro} onChange={(e) => setLogradouro(e.target.value)} />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Número</Label>
                <Input value={numero} onChange={(e) => setNumero(e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label>Complemento</Label>
                <Input value={complemento} onChange={(e) => setComplemento(e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Bairro *</Label>
              <Input value={bairro} onChange={(e) => setBairro(e.target.value)} />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Label>Cidade *</Label>
                <Input value={cidade} onChange={(e) => setCidade(e.target.value)} />
              </div>
              <div>
                <Label>UF *</Label>
                <Input value={uf} onChange={(e) => setUf(e.target.value)} maxLength={2} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <Button
          onClick={handleReagendar}
          disabled={enviando || !dataSelecionada || !periodo}
          className="w-full gap-2"
          size="lg"
        >
          {enviando ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Reagendando...</>
          ) : (
            'Confirmar Reagendamento'
          )}
        </Button>
      </div>
    </div>
  );
}
