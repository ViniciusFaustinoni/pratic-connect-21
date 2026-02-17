import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Search,
  User,
  Car,
  Phone,
  MapPin,
  Truck,
  Key,
  Circle,
  Fuel,
  Battery,
  HelpCircle,
  Loader2,
  ArrowLeft,
  LucideIcon,
  Edit,
  AlertTriangle,
  Crosshair,
  Navigation,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TelefoneInput, PlacaInput } from '@/components/inputs/MaskedInputs';
import { MapaChamado } from '@/components/assistencia/MapaChamado';

interface Veiculo {
  id: string;
  placa: string;
  marca: string | null;
  modelo: string | null;
  ano_modelo: number | null;
}

interface AssociadoComVeiculos {
  id: string;
  nome: string;
  cpf: string;
  telefone: string;
  whatsapp: string | null;
  status: string;
  veiculos: Veiculo[];
}

interface NovoChamadoModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (chamado: { id: string; protocolo: string }) => void;
}

const TIPOS_SERVICO: { value: string; label: string; icon: LucideIcon }[] = [
  { value: 'reboque', label: 'Reboque/Guincho', icon: Truck },
  { value: 'chaveiro', label: 'Chaveiro', icon: Key },
  { value: 'troca_pneu', label: 'Troca de Pneu', icon: Circle },
  { value: 'pane_seca', label: 'Pane Seca', icon: Fuel },
  { value: 'bateria', label: 'Bateria', icon: Battery },
  { value: 'outro', label: 'Outros', icon: HelpCircle },
];

const formatCPF = (cpf: string) => {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return cpf;
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

const formatPhone = (phone: string) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  return phone;
};

export function NovoChamadoModal({ open, onClose, onSuccess }: NovoChamadoModalProps) {
  const queryClient = useQueryClient();

  // Etapa do formulário
  const [etapa, setEtapa] = useState<'busca' | 'dados'>('busca');

  // Busca
  const [termoBusca, setTermoBusca] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [resultadosBusca, setResultadosBusca] = useState<AssociadoComVeiculos[]>([]);

  // Seleção
  const [associadoSelecionado, setAssociadoSelecionado] = useState<AssociadoComVeiculos | null>(null);
  const [veiculoSelecionado, setVeiculoSelecionado] = useState<string>('');

  // Modo manual (quando não encontra associado)
  const [modoManual, setModoManual] = useState(false);
  const [dadosManuais, setDadosManuais] = useState({
    nome_cliente: '',
    telefone_cliente: '',
    placa_veiculo: '',
    marca_modelo: '',
  });

  // Dados do chamado
  const [formData, setFormData] = useState({
    tipo_servico: '',
    descricao: '',
    origem_endereco: '',
    destino_endereco: '',
    origem_lat: null as number | null,
    origem_lng: null as number | null,
    destino_lat: null as number | null,
    destino_lng: null as number | null,
  });

  // Rastreador loading
  const [buscandoRastreador, setBuscandoRastreador] = useState(false);
  
  // Geocode destino debounce
  const destinoDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const [geocodificandoDestino, setGeocodificandoDestino] = useState(false);

  const handleClose = () => {
    setEtapa('busca');
    setTermoBusca('');
    setResultadosBusca([]);
    setAssociadoSelecionado(null);
    setVeiculoSelecionado('');
    setModoManual(false);
    setDadosManuais({
      nome_cliente: '',
      telefone_cliente: '',
      placa_veiculo: '',
      marca_modelo: '',
    });
    setFormData({
      tipo_servico: '',
      descricao: '',
      origem_endereco: '',
      destino_endereco: '',
      origem_lat: null,
      origem_lng: null,
      destino_lat: null,
      destino_lng: null,
    });
    onClose();
  };

  // Buscar localização do rastreador
  const buscarLocalizacaoRastreador = async () => {
    if (!veiculoSelecionado) {
      toast.error('Selecione um veículo primeiro');
      return;
    }
    setBuscandoRastreador(true);
    try {
      const { data, error } = await supabase.functions.invoke('posicao-veiculo', {
        body: { veiculo_id: veiculoSelecionado },
      });
      if (error) throw error;
      if (data?.latitude && data?.longitude) {
        setFormData(prev => ({
          ...prev,
          origem_endereco: data.endereco || `${data.latitude}, ${data.longitude}`,
          origem_lat: data.latitude,
          origem_lng: data.longitude,
        }));
        toast.success('Localização do rastreador obtida');
      } else {
        toast.error('Não foi possível obter a localização do rastreador');
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro ao buscar localização do rastreador');
    } finally {
      setBuscandoRastreador(false);
    }
  };

  // Geocodificar endereço de destino com debounce
  useEffect(() => {
    if (destinoDebounceRef.current) {
      clearTimeout(destinoDebounceRef.current);
    }
    
    if (!formData.destino_endereco || formData.destino_endereco.trim().length < 10) {
      setFormData(prev => ({ ...prev, destino_lat: null, destino_lng: null }));
      return;
    }

    destinoDebounceRef.current = setTimeout(async () => {
      setGeocodificandoDestino(true);
      try {
        const { data, error } = await supabase.functions.invoke('geocode-endereco', {
          body: { endereco: formData.destino_endereco },
        });
        if (!error && data?.success) {
          setFormData(prev => ({
            ...prev,
            destino_lat: data.latitude,
            destino_lng: data.longitude,
          }));
        }
      } catch (err) {
        console.error('[Geocode destino]', err);
      } finally {
        setGeocodificandoDestino(false);
      }
    }, 1000);

    return () => {
      if (destinoDebounceRef.current) clearTimeout(destinoDebounceRef.current);
    };
  }, [formData.destino_endereco]);

  const buscarAssociado = async () => {
    if (termoBusca.length < 3) {
      toast.error('Digite pelo menos 3 caracteres');
      return;
    }

    setBuscando(true);
    try {
      const termoLimpo = termoBusca.replace(/[.\-\s]/g, '').toUpperCase();
      const termoOriginal = termoBusca.trim();

      // Buscar por CPF
      const { data: porCPF, error: errorCPF } = await supabase
        .from('associados')
        .select(`
          id, nome, cpf, telefone, whatsapp, status,
          veiculos(id, placa, marca, modelo, ano_modelo)
        `)
        .ilike('cpf', `%${termoLimpo}%`)
        .eq('status', 'ativo')
        .limit(10);

      if (errorCPF) throw errorCPF;

      // Buscar por Nome
      const { data: porNome, error: errorNome } = await supabase
        .from('associados')
        .select(`
          id, nome, cpf, telefone, whatsapp, status,
          veiculos(id, placa, marca, modelo, ano_modelo)
        `)
        .ilike('nome', `%${termoOriginal}%`)
        .eq('status', 'ativo')
        .limit(10);

      if (errorNome) throw errorNome;

      // Buscar por placa
      const { data: porPlaca, error: errorPlaca } = await supabase
        .from('veiculos')
        .select(`
          id, placa, marca, modelo, ano_modelo,
          associado:associados!inner(id, nome, cpf, telefone, whatsapp, status)
        `)
        .ilike('placa', `%${termoLimpo}%`)
        .limit(10);

      if (errorPlaca) throw errorPlaca;

      // Combinar resultados únicos
      const associadosMap = new Map<string, AssociadoComVeiculos>();

      // Adicionar resultados por CPF
      porCPF?.forEach((a) => {
        if (a.status === 'ativo') {
          associadosMap.set(a.id, {
            id: a.id,
            nome: a.nome,
            cpf: a.cpf,
            telefone: a.telefone,
            whatsapp: a.whatsapp,
            status: a.status,
            veiculos: (a.veiculos || []) as Veiculo[],
          });
        }
      });

      // Adicionar resultados por Nome
      porNome?.forEach((a) => {
        if (a.status === 'ativo' && !associadosMap.has(a.id)) {
          associadosMap.set(a.id, {
            id: a.id,
            nome: a.nome,
            cpf: a.cpf,
            telefone: a.telefone,
            whatsapp: a.whatsapp,
            status: a.status,
            veiculos: (a.veiculos || []) as Veiculo[],
          });
        }
      });

      // Adicionar resultados por Placa
      porPlaca?.forEach((v) => {
        const assoc = v.associado as unknown as {
          id: string;
          nome: string;
          cpf: string;
          telefone: string;
          whatsapp: string | null;
          status: string;
        };
        if (assoc && assoc.status === 'ativo') {
          if (associadosMap.has(assoc.id)) {
            // Adicionar veículo ao associado existente se não existir
            const existing = associadosMap.get(assoc.id)!;
            if (!existing.veiculos.find((ve) => ve.id === v.id)) {
              existing.veiculos.push({
                id: v.id,
                placa: v.placa,
                marca: v.marca,
                modelo: v.modelo,
                ano_modelo: v.ano_modelo,
              });
            }
          } else {
            associadosMap.set(assoc.id, {
              id: assoc.id,
              nome: assoc.nome,
              cpf: assoc.cpf,
              telefone: assoc.telefone,
              whatsapp: assoc.whatsapp,
              status: assoc.status,
              veiculos: [
                {
                  id: v.id,
                  placa: v.placa,
                  marca: v.marca,
                  modelo: v.modelo,
                  ano_modelo: v.ano_modelo,
                },
              ],
            });
          }
        }
      });

      setResultadosBusca(Array.from(associadosMap.values()));
    } catch (error) {
      console.error(error);
      toast.error('Erro ao buscar associado');
    } finally {
      setBuscando(false);
    }
  };

  const selecionarAssociado = (associado: AssociadoComVeiculos) => {
    setAssociadoSelecionado(associado);
    setModoManual(false);
    if (associado.veiculos.length === 1) {
      setVeiculoSelecionado(associado.veiculos[0].id);
    }
    setEtapa('dados');
  };

  const iniciarModoManual = () => {
    setModoManual(true);
    setAssociadoSelecionado(null);
    setVeiculoSelecionado('');
    setEtapa('dados');
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const user = await supabase.auth.getUser();

      // Gerar protocolo único (ASS-YYYYMMDD-XXXX)
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
      const protocolo = `ASS-${dateStr}-${random}`;

      // Montar descrição com dados manuais se necessário
      let descricaoFinal = formData.descricao || '';
      if (modoManual) {
        const dadosCliente = [
          `[CHAMADO MANUAL]`,
          `Cliente: ${dadosManuais.nome_cliente}`,
          `Telefone: ${dadosManuais.telefone_cliente}`,
          dadosManuais.placa_veiculo ? `Placa: ${dadosManuais.placa_veiculo}` : null,
          dadosManuais.marca_modelo ? `Veículo: ${dadosManuais.marca_modelo}` : null,
        ].filter(Boolean).join('\n');
        
        descricaoFinal = formData.descricao 
          ? `${dadosCliente}\n\n${formData.descricao}`
          : dadosCliente;
      }

      const { data, error } = await supabase
        .from('chamados_assistencia')
        .insert({
          protocolo,
          associado_id: modoManual ? null : associadoSelecionado!.id,
          veiculo_id: modoManual ? null : (veiculoSelecionado || null),
          tipo_servico: formData.tipo_servico,
          descricao: descricaoFinal || null,
          origem_endereco: formData.origem_endereco,
          destino_endereco: formData.destino_endereco || null,
          origem_lat: formData.origem_lat,
          origem_lng: formData.origem_lng,
          destino_lat: formData.destino_lat,
          destino_lng: formData.destino_lng,
          canal: 'telefone',
          atendente_id: user.data.user?.id,
          status: 'aberto' as const,
        })
        .select()
        .single();

      if (error) throw error;

      // Registrar histórico
      await supabase.from('chamados_assistencia_historico').insert({
        chamado_id: data.id,
        status_novo: 'aberto',
        usuario_id: user.data.user?.id,
        observacao: modoManual 
          ? `Chamado manual aberto - Cliente: ${dadosManuais.nome_cliente}`
          : 'Chamado aberto via central telefônica',
      });

      return data;
    },
    onSuccess: (data) => {
      toast.success(`Chamado ${data.protocolo} aberto com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['chamados-assistencia'] });
      queryClient.invalidateQueries({ queryKey: ['assistencia-estatisticas'] });
      queryClient.invalidateQueries({ queryKey: ['chamados-ativos'] });
      queryClient.invalidateQueries({ queryKey: ['chamados-contadores'] });
      onSuccess?.(data);
      handleClose();
    },
    onError: (error) => {
      console.error(error);
      toast.error('Erro ao abrir chamado');
    },
  });

  const isFormValid = () => {
    const baseValid = formData.tipo_servico && formData.origem_endereco.trim().length > 0;
    const destinoValid = formData.tipo_servico !== 'reboque' || formData.destino_endereco.trim().length > 0;

    if (modoManual) {
      return (
        baseValid &&
        destinoValid &&
        dadosManuais.nome_cliente.trim().length > 0 &&
        dadosManuais.telefone_cliente.trim().length >= 10
      );
    }

    return baseValid && destinoValid && associadoSelecionado && veiculoSelecionado;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Chamado de Assistência</DialogTitle>
          <DialogDescription>
            {etapa === 'busca'
              ? 'Busque o associado por nome, CPF ou placa do veículo'
              : modoManual
              ? 'Preencha os dados do cliente e do chamado'
              : 'Preencha os dados do chamado'}
          </DialogDescription>
        </DialogHeader>

        {etapa === 'busca' ? (
          <div className="space-y-4">
            {/* Campo de Busca */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Digite nome, CPF ou placa do veículo..."
                  className="pl-9"
                  value={termoBusca}
                  onChange={(e) => setTermoBusca(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && buscarAssociado()}
                />
              </div>
              <Button onClick={buscarAssociado} disabled={buscando}>
                {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
              </Button>
            </div>

            {/* Resultados */}
            {resultadosBusca.length > 0 && (
              <div className="space-y-2">
                <Label>Resultados ({resultadosBusca.length})</Label>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {resultadosBusca.map((associado) => (
                    <Card
                      key={associado.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => selecionarAssociado(associado)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{associado.nome}</span>
                              <Badge variant="secondary" className="text-xs">
                                {associado.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              CPF: {formatCPF(associado.cpf)}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {formatPhone(associado.telefone)}
                            </div>
                            {associado.veiculos.length > 0 && (
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <Car className="h-4 w-4 text-muted-foreground" />
                                {associado.veiculos.map((v) => (
                                  <Badge key={v.id} variant="outline" className="font-mono">
                                    {v.placa}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <Button size="sm" variant="outline">
                            Selecionar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Nenhum resultado - Oferecer modo manual */}
            {resultadosBusca.length === 0 && termoBusca.length >= 3 && !buscando && (
              <div className="text-center py-6 space-y-4">
                <div className="text-muted-foreground">
                  <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="font-medium">Nenhum associado encontrado</p>
                  <p className="text-sm">Verifique os dados ou informe manualmente</p>
                </div>
                <Button variant="outline" onClick={iniciarModoManual}>
                  <Edit className="h-4 w-4 mr-2" />
                  Informar Dados Manualmente
                </Button>
              </div>
            )}

            {/* Botão para modo manual direto */}
            <div className="border-t pt-4">
              <Button 
                variant="ghost" 
                className="w-full text-muted-foreground" 
                onClick={iniciarModoManual}
              >
                <Edit className="h-4 w-4 mr-2" />
                Abrir chamado sem associado cadastrado
              </Button>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Modo Manual - Dados do Cliente */}
            {modoManual && (
              <Card className="border-warning/50 bg-warning/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-warning-foreground">
                    <AlertTriangle className="h-4 w-4" />
                    Dados do Cliente (Entrada Manual)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="nome_cliente">Nome do Cliente *</Label>
                      <Input
                        id="nome_cliente"
                        placeholder="Nome completo"
                        value={dadosManuais.nome_cliente}
                        onChange={(e) =>
                          setDadosManuais({ ...dadosManuais, nome_cliente: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="telefone_cliente">Telefone *</Label>
                      <TelefoneInput
                        id="telefone_cliente"
                        value={dadosManuais.telefone_cliente}
                        onChange={(value) =>
                          setDadosManuais({ ...dadosManuais, telefone_cliente: value })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="placa_veiculo">Placa do Veículo</Label>
                      <PlacaInput
                        id="placa_veiculo"
                        value={dadosManuais.placa_veiculo}
                        onChange={(value) =>
                          setDadosManuais({ ...dadosManuais, placa_veiculo: value })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="marca_modelo">Marca/Modelo</Label>
                      <Input
                        id="marca_modelo"
                        placeholder="Ex: Toyota Corolla"
                        value={dadosManuais.marca_modelo}
                        onChange={(e) =>
                          setDadosManuais({ ...dadosManuais, marca_modelo: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => {
                      setModoManual(false);
                      setEtapa('busca');
                    }}
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Voltar para busca
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Associado Selecionado (modo normal) */}
            {!modoManual && associadoSelecionado && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg">
                        <User className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">{associadoSelecionado?.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatPhone(associadoSelecionado?.telefone || '')}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEtapa('busca');
                        setAssociadoSelecionado(null);
                        setVeiculoSelecionado('');
                      }}
                    >
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Alterar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Veículo (apenas modo normal) */}
            {!modoManual && (
              <div className="space-y-2">
                <Label htmlFor="veiculo">Veículo *</Label>
                <Select value={veiculoSelecionado} onValueChange={setVeiculoSelecionado}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o veículo" />
                  </SelectTrigger>
                  <SelectContent>
                    {associadoSelecionado?.veiculos.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        <span className="font-mono">{v.placa}</span>
                        <span className="text-muted-foreground ml-2">
                          - {v.marca} {v.modelo} {v.ano_modelo && `(${v.ano_modelo})`}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Tipo de Serviço */}
            <div className="space-y-2">
              <Label htmlFor="tipo_servico">Tipo de Serviço *</Label>
              <Select
                value={formData.tipo_servico}
                onValueChange={(v) => setFormData({ ...formData, tipo_servico: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de serviço" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_SERVICO.map((tipo) => {
                    const Icon = tipo.icon;
                    return (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {tipo.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Descrição */}
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição do Problema</Label>
              <Textarea
                id="descricao"
                placeholder="Descreva o problema relatado pelo cliente..."
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                rows={3}
              />
            </div>

            {/* Endereço de Origem */}
            <div className="space-y-2">
              <Label htmlFor="origem_endereco">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Endereço de Origem *
                </div>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="origem_endereco"
                  placeholder="Onde o veículo está localizado"
                  value={formData.origem_endereco}
                  onChange={(e) => setFormData({ ...formData, origem_endereco: e.target.value, origem_lat: null, origem_lng: null })}
                  className="flex-1"
                />
                {!modoManual && veiculoSelecionado && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={buscarLocalizacaoRastreador}
                    disabled={buscandoRastreador}
                    className="whitespace-nowrap"
                  >
                    {buscandoRastreador ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Crosshair className="h-4 w-4 mr-1" />
                    )}
                    Rastreador
                  </Button>
                )}
              </div>
              {formData.origem_lat && formData.origem_lng && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Navigation className="h-3 w-3" />
                  Coordenadas: {formData.origem_lat.toFixed(5)}, {formData.origem_lng.toFixed(5)}
                </p>
              )}
            </div>

            {/* Endereço de Destino */}
            <div className="space-y-2">
              <Label htmlFor="destino_endereco">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Endereço de Destino {formData.tipo_servico === 'reboque' ? '*' : '(opcional)'}
                </div>
              </Label>
              <div className="relative">
                <Input
                  id="destino_endereco"
                  placeholder={formData.tipo_servico === 'reboque' ? 'Para onde levar o veículo *' : 'Para onde levar o veículo (se reboque)'}
                  value={formData.destino_endereco}
                  onChange={(e) => setFormData({ ...formData, destino_endereco: e.target.value })}
                />
                {geocodificandoDestino && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {formData.destino_lat && formData.destino_lng && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Navigation className="h-3 w-3" />
                  Coordenadas: {formData.destino_lat.toFixed(5)}, {formData.destino_lng.toFixed(5)}
                </p>
              )}
            </div>

            {/* Mapa preview para guincho */}
            {formData.tipo_servico === 'reboque' && formData.origem_lat && formData.origem_lng && formData.destino_lat && formData.destino_lng && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Rota Prevista</Label>
                <MapaChamado
                  rastreadorLat={formData.origem_lat}
                  rastreadorLng={formData.origem_lng}
                  rastreadorEndereco={formData.origem_endereco}
                  destinoLat={formData.destino_lat}
                  destinoLng={formData.destino_lng}
                  destinoEndereco={formData.destino_endereco}
                  height="h-48"
                  showControls={false}
                />
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!isFormValid() || createMutation.isPending}
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Abrir Chamado
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
