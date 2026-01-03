import { useState } from 'react';
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
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

  // Dados do chamado
  const [formData, setFormData] = useState({
    tipo_servico: '',
    descricao: '',
    origem_endereco: '',
    destino_endereco: '',
  });

  const handleClose = () => {
    setEtapa('busca');
    setTermoBusca('');
    setResultadosBusca([]);
    setAssociadoSelecionado(null);
    setVeiculoSelecionado('');
    setFormData({
      tipo_servico: '',
      descricao: '',
      origem_endereco: '',
      destino_endereco: '',
    });
    onClose();
  };

  const buscarAssociado = async () => {
    if (termoBusca.length < 3) {
      toast.error('Digite pelo menos 3 caracteres');
      return;
    }

    setBuscando(true);
    try {
      const termoLimpo = termoBusca.replace(/[.\-\s]/g, '').toUpperCase();

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
    if (associado.veiculos.length === 1) {
      setVeiculoSelecionado(associado.veiculos[0].id);
    }
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

      const { data, error } = await supabase
        .from('chamados_assistencia')
        .insert({
          protocolo,
          associado_id: associadoSelecionado!.id,
          veiculo_id: veiculoSelecionado || null,
          tipo_servico: formData.tipo_servico,
          descricao: formData.descricao || null,
          origem_endereco: formData.origem_endereco,
          destino_endereco: formData.destino_endereco || null,
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
        observacao: 'Chamado aberto via central telefônica',
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
    return (
      associadoSelecionado &&
      veiculoSelecionado &&
      formData.tipo_servico &&
      formData.origem_endereco.trim().length > 0
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Chamado de Assistência</DialogTitle>
          <DialogDescription>
            {etapa === 'busca'
              ? 'Busque o associado por CPF ou placa do veículo'
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
                  placeholder="Digite o CPF ou placa do veículo..."
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

            {resultadosBusca.length === 0 && termoBusca.length >= 3 && !buscando && (
              <div className="text-center py-8 text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum associado encontrado</p>
                <p className="text-sm">Verifique o CPF ou placa informados</p>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Associado Selecionado */}
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

            {/* Veículo */}
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
                placeholder="Descreva o problema relatado pelo associado..."
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
              <Input
                id="origem_endereco"
                placeholder="Onde o veículo está localizado"
                value={formData.origem_endereco}
                onChange={(e) => setFormData({ ...formData, origem_endereco: e.target.value })}
              />
            </div>

            {/* Endereço de Destino */}
            <div className="space-y-2">
              <Label htmlFor="destino_endereco">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Endereço de Destino (opcional)
                </div>
              </Label>
              <Input
                id="destino_endereco"
                placeholder="Para onde levar o veículo (se reboque)"
                value={formData.destino_endereco}
                onChange={(e) => setFormData({ ...formData, destino_endereco: e.target.value })}
              />
            </div>

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
