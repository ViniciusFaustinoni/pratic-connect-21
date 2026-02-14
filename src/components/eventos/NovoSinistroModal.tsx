import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, Check, ChevronsUpDown, Car, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';

interface NovoSinistroModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (sinistro: any) => void;
}

const TIPO_SINISTRO_OPTIONS = [
  { value: 'colisao', label: 'Colisão' },
  { value: 'roubo', label: 'Roubo' },
  { value: 'furto', label: 'Furto' },
  { value: 'incendio', label: 'Incêndio' },
  { value: 'fenomeno_natural', label: 'Fenômeno Natural' },
  { value: 'vidros', label: 'Vidros' },
  { value: 'outro', label: 'Outro' },
];

const TIPO_LABELS: Record<string, string> = {
  colisao: 'Colisão', roubo: 'Roubo', furto: 'Furto', incendio: 'Incêndio',
  fenomeno_natural: 'Fenômeno Natural', vidros: 'Vidros', vandalismo: 'Vandalismo',
  terceiros: 'Terceiros', outro: 'Outro',
};

const DOCUMENTOS_OBRIGATORIOS: Record<string, Array<{tipo: string; nome: string; obrigatorio: boolean}>> = {
  colisao: [
    { tipo: 'cnh', nome: 'CNH do Condutor', obrigatorio: true },
    { tipo: 'crlv', nome: 'CRLV do Veículo', obrigatorio: true },
    { tipo: 'foto_dano', nome: 'Fotos dos Danos', obrigatorio: true },
    { tipo: 'foto_local', nome: 'Fotos do Local', obrigatorio: false },
    { tipo: 'bo', nome: 'Boletim de Ocorrência', obrigatorio: false },
  ],
  roubo: [
    { tipo: 'cnh', nome: 'CNH do Condutor', obrigatorio: true },
    { tipo: 'crlv', nome: 'CRLV do Veículo', obrigatorio: true },
    { tipo: 'bo', nome: 'Boletim de Ocorrência', obrigatorio: true },
    { tipo: 'chaves', nome: 'Declaração das Chaves', obrigatorio: true },
  ],
  furto: [
    { tipo: 'cnh', nome: 'CNH do Condutor', obrigatorio: true },
    { tipo: 'crlv', nome: 'CRLV do Veículo', obrigatorio: true },
    { tipo: 'bo', nome: 'Boletim de Ocorrência', obrigatorio: true },
    { tipo: 'chaves', nome: 'Declaração das Chaves', obrigatorio: true },
  ],
  incendio: [
    { tipo: 'cnh', nome: 'CNH do Condutor', obrigatorio: true },
    { tipo: 'crlv', nome: 'CRLV do Veículo', obrigatorio: true },
    { tipo: 'bo', nome: 'Boletim de Ocorrência', obrigatorio: true },
    { tipo: 'laudo_bombeiros', nome: 'Laudo dos Bombeiros', obrigatorio: true },
    { tipo: 'foto_dano', nome: 'Fotos do Veículo', obrigatorio: true },
  ],
  fenomeno_natural: [
    { tipo: 'cnh', nome: 'CNH do Condutor', obrigatorio: true },
    { tipo: 'crlv', nome: 'CRLV do Veículo', obrigatorio: true },
    { tipo: 'foto_dano', nome: 'Fotos dos Danos', obrigatorio: true },
    { tipo: 'comprovante_evento', nome: 'Comprovante do Evento (notícia/defesa civil)', obrigatorio: false },
  ],
  vidros: [
    { tipo: 'cnh', nome: 'CNH do Condutor', obrigatorio: true },
    { tipo: 'crlv', nome: 'CRLV do Veículo', obrigatorio: true },
    { tipo: 'foto_dano', nome: 'Fotos dos Danos', obrigatorio: true },
  ],
  outro: [
    { tipo: 'cnh', nome: 'CNH do Condutor', obrigatorio: true },
    { tipo: 'crlv', nome: 'CRLV do Veículo', obrigatorio: true },
    { tipo: 'foto_dano', nome: 'Fotos do Ocorrido', obrigatorio: false },
  ],
};

const UF_OPTIONS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO'
];

const formatCPF = (cpf: string) => {
  const cleaned = cpf.replace(/\D/g, '');
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

const formatCurrency = (value: number | null) => {
  if (!value) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const generateProtocolo = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `SIN-${year}${month}${day}-${random}`;
};

export function NovoSinistroModal({ open, onClose, onSuccess }: NovoSinistroModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [selectedAssociado, setSelectedAssociado] = useState<string | null>(null);
  const [selectedVeiculo, setSelectedVeiculo] = useState<string | null>(null);
  const [searchAssociado, setSearchAssociado] = useState('');
  const [openAssociadoPopover, setOpenAssociadoPopover] = useState(false);
  
  const [formData, setFormData] = useState({
    tipo: '',
    data_ocorrencia: '',
    local_ocorrencia: '',
    cidade_ocorrencia: '',
    estado_ocorrencia: '',
    bo_numero: '',
    descricao: ''
  });
  const [necessitaReboque, setNecessitaReboque] = useState(false);

  // Buscar associados
  const { data: associados = [] } = useQuery({
    queryKey: ['associados-search', searchAssociado],
    queryFn: async () => {
      if (searchAssociado.length < 3) return [];
      
      // Verificar se é busca por placa (contém letras + números no padrão de placa)
      const isBuscaPlaca = /^[A-Za-z]{3}/i.test(searchAssociado.replace(/\s/g, ''));
      
      if (isBuscaPlaca) {
        // Buscar veículo pela placa e retornar o associado
        const { data: veiculos } = await supabase
          .from('veiculos')
          .select('associado_id, placa, associado:associados!inner(id, nome, cpf, status)')
          .ilike('placa', `%${searchAssociado}%`)
          .limit(10);
        
        if (!veiculos) return [];
        
        // Extrair associados únicos dos veículos encontrados
        const associadoMap = new Map<string, any>();
        for (const v of veiculos) {
          const assoc = v.associado as any;
          if (assoc && assoc.status === 'ativo' && !associadoMap.has(assoc.id)) {
            associadoMap.set(assoc.id, { id: assoc.id, nome: `${assoc.nome} (${v.placa})`, cpf: assoc.cpf });
          }
        }
        return Array.from(associadoMap.values());
      }
      
      const { data } = await supabase
        .from('associados')
        .select('id, nome, cpf')
        .or(`nome.ilike.%${searchAssociado}%,cpf.ilike.%${searchAssociado}%`)
        .eq('status', 'ativo')
        .limit(10);
      return data || [];
    },
    enabled: searchAssociado.length >= 3
  });

  // Buscar veículos do associado
  const { data: veiculos = [] } = useQuery({
    queryKey: ['veiculos-associado', selectedAssociado],
    queryFn: async () => {
      const { data } = await supabase
        .from('veiculos')
        .select('id, placa, marca, modelo, ano_modelo, valor_fipe')
        .eq('associado_id', selectedAssociado!)
        .eq('ativo', true);
      return data || [];
    },
    enabled: !!selectedAssociado
  });

  const selectedAssociadoData = associados.find(a => a.id === selectedAssociado);
  const selectedVeiculoData = veiculos.find(v => v.id === selectedVeiculo);

  // Mutation para criar sinistro (fluxo completo alinhado com edge function criar-sinistro)
  const createMutation = useMutation({
    mutationFn: async () => {
      const veiculoSelecionado = veiculos.find(v => v.id === selectedVeiculo);
      const protocolo = generateProtocolo();

      // ===== 1. VERIFICAR SINISTRO EM ABERTO =====
      const { data: sinistroExistente } = await supabase
        .from('sinistros')
        .select('id, protocolo, status')
        .eq('veiculo_id', selectedVeiculo!)
        .in('status', ['comunicado', 'em_analise', 'documentacao_pendente', 'em_regulacao'] as any)
        .maybeSingle();

      if (sinistroExistente) {
        throw new Error(`Já existe sinistro em aberto para este veículo: ${sinistroExistente.protocolo}`);
      }

      // ===== 2. VALIDAR COBERTURA E CALCULAR FLAG =====
      const { data: veiculoCompleto, error: veicError } = await supabase
        .from('veiculos')
        .select('status, cobertura_roubo_furto, cobertura_total')
        .eq('id', selectedVeiculo!)
        .single();

      if (veicError || !veiculoCompleto) throw new Error('Erro ao buscar dados do veículo');

      const isRouboFurto = ['roubo', 'furto'].includes(formData.tipo);
      const temCoberturaTotal = veiculoCompleto.cobertura_total === true;
      const temCoberturaRouboFurto = veiculoCompleto.cobertura_roubo_furto === true;
      let alertaRecemAtivado = false;

      if (temCoberturaTotal) {
        // Cobertura total: qualquer tipo permitido
      } else if (temCoberturaRouboFurto && isRouboFurto) {
        alertaRecemAtivado = true;
        console.log('[NovoSinistroModal] ⚠️ Sinistro roubo/furto sem cobertura total - alerta ativado');
      } else if (!isRouboFurto && !temCoberturaTotal) {
        throw new Error('Veículo sem cobertura total para este tipo de sinistro. Apenas roubo/furto é permitido.');
      }

      // ===== 3. CAPTURAR POSIÇÃO DO RASTREADOR =====
      const { data: rastreador } = await supabase
        .from('rastreadores')
        .select('id, ultima_posicao_lat, ultima_posicao_lng, ultima_comunicacao')
        .eq('veiculo_id', selectedVeiculo!)
        .eq('status', 'instalado')
        .maybeSingle();

      // ===== 4. INSERIR SINISTRO =====
      const { data: sinistro, error } = await supabase
        .from('sinistros')
        .insert([{
          protocolo,
          associado_id: selectedAssociado!,
          veiculo_id: selectedVeiculo!,
          tipo: formData.tipo as any,
          data_ocorrencia: formData.data_ocorrencia,
          local_ocorrencia: formData.local_ocorrencia,
          cidade_ocorrencia: formData.cidade_ocorrencia,
          estado_ocorrencia: formData.estado_ocorrencia,
          descricao: formData.descricao,
          bo_numero: formData.bo_numero || null,
          valor_fipe: veiculoSelecionado?.valor_fipe || null,
          canal: 'presencial',
          status: 'comunicado' as any,
          necessita_reboque: necessitaReboque,
          alerta_recem_ativado: alertaRecemAtivado,
          rastreador_lat_momento: rastreador?.ultima_posicao_lat || null,
          rastreador_lng_momento: rastreador?.ultima_posicao_lng || null,
          rastreador_posicao_capturada_em: rastreador?.ultima_comunicacao || null,
        }])
        .select()
        .single();
      
      if (error) throw error;

      // ===== 5. REGISTRAR HISTÓRICO =====
      const observacaoHistorico = alertaRecemAtivado
        ? `Sinistro registrado via sistema - ${TIPO_LABELS[formData.tipo] || formData.tipo} - ⚠️ ALERTA: Associado recém-ativado (sem rastreador)`
        : `Sinistro registrado via sistema - ${TIPO_LABELS[formData.tipo] || formData.tipo}`;

      await supabase.from('sinistro_historico').insert({
        sinistro_id: sinistro.id,
        status_novo: 'comunicado',
        usuario_id: user?.id,
        observacao: observacaoHistorico,
      });

      // ===== 6. CRIAR CHAMADO DE REBOQUE =====
      if (necessitaReboque) {
        try {
          const nowAss = new Date();
          const dateStrAss = `${nowAss.getFullYear()}${String(nowAss.getMonth() + 1).padStart(2, '0')}${String(nowAss.getDate()).padStart(2, '0')}`;
          const rndAss = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
          const protocoloAss = `ASS-${dateStrAss}-${rndAss}`;

          const { data: chamadoReboque, error: chamadoError } = await supabase
            .from('chamados_assistencia')
            .insert({
              protocolo: protocoloAss,
              associado_id: selectedAssociado!,
              veiculo_id: selectedVeiculo!,
              tipo_servico: 'guincho',
              descricao: `Reboque solicitado junto ao sinistro ${protocolo}`,
              origem_endereco: formData.local_ocorrencia || null,
              canal: 'presencial',
              status: 'aberto',
              data_abertura: new Date().toISOString(),
            })
            .select('id, protocolo')
            .single();

          if (!chamadoError && chamadoReboque) {
            await supabase
              .from('sinistros')
              .update({ chamado_assistencia_id: chamadoReboque.id })
              .eq('id', sinistro.id);
            console.log('[NovoSinistroModal] Chamado de reboque criado:', chamadoReboque.protocolo);
          }
        } catch (rebError) {
          console.error('[NovoSinistroModal] Erro ao criar reboque:', rebError);
        }
      }

      // ===== 7. CRIAR DOCUMENTOS PENDENTES =====
      try {
        const documentosPendentes = DOCUMENTOS_OBRIGATORIOS[formData.tipo] || DOCUMENTOS_OBRIGATORIOS.outro;
        const docsToInsert = documentosPendentes.map(doc => ({
          sinistro_id: sinistro.id,
          tipo: doc.tipo,
          arquivo_url: '',
          nome_arquivo: doc.nome,
          status: 'pendente',
        }));
        await supabase.from('sinistro_documentos').insert(docsToInsert);
        console.log('[NovoSinistroModal] Documentos pendentes criados:', documentosPendentes.length);
      } catch (docError) {
        console.error('[NovoSinistroModal] Erro ao criar documentos (não bloqueante):', docError);
      }

      // ===== 8. NOTIFICAR ANALISTAS E DIRETORES =====
      try {
        const { data: analistas } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'analista_eventos');

        let destinatarios = analistas || [];
        if (destinatarios.length === 0) {
          const { data: diretores } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'diretor');
          destinatarios = diretores || [];
        }

        const tituloNotificacao = alertaRecemAtivado
          ? '🆕⚠️ Sinistro Recém-Ativado (sem rastreador)'
          : '🆕 Novo Sinistro Registrado';

        const veicPlaca = veiculoSelecionado?.placa || '';
        for (const dest of destinatarios) {
          await supabase.from('notificacoes').insert({
            user_id: dest.user_id,
            titulo: tituloNotificacao,
            mensagem: `Sinistro ${protocolo} - ${TIPO_LABELS[formData.tipo] || formData.tipo} - Veículo ${veicPlaca}`,
            tipo: 'alerta',
            categoria: 'sinistros',
            referencia_tipo: 'sinistro',
            referencia_id: sinistro.id,
            link: `/sinistros/${sinistro.id}`,
            lida: false,
          });
        }
        console.log('[NovoSinistroModal] Notificações enviadas para', destinatarios.length, 'analistas/diretores');
      } catch (notifError) {
        console.error('[NovoSinistroModal] Erro ao notificar analistas (não bloqueante):', notifError);
      }

      // ===== 9. NOTIFICAR ASSOCIADO =====
      try {
        const { data: associadoData } = await supabase
          .from('associados')
          .select('user_id, nome')
          .eq('id', selectedAssociado!)
          .single();

        if (associadoData?.user_id) {
          await supabase.from('notificacoes').insert({
            user_id: associadoData.user_id,
            titulo: '✅ Sinistro Registrado',
            mensagem: `Seu sinistro foi registrado com sucesso. Protocolo: ${protocolo}. Em breve iniciaremos a análise.`,
            tipo: 'info',
            categoria: 'sinistros',
            referencia_tipo: 'sinistro',
            referencia_id: sinistro.id,
            link: `/app/sinistros/${sinistro.id}`,
            lida: false,
          });
        }
      } catch (assocNotifError) {
        console.error('[NovoSinistroModal] Erro ao notificar associado (não bloqueante):', assocNotifError);
      }

      // ===== 10. AGENDAR CONTATO D+1 =====
      try {
        await supabase.functions.invoke('agendar-contato-sinistro', {
          body: { sinistro_id: sinistro.id },
        });
        console.log('[NovoSinistroModal] Contato D+1 agendado');
      } catch (agendarError) {
        console.error('[NovoSinistroModal] Erro ao agendar contato (não bloqueante):', agendarError);
      }

      // ===== 11. ENVIAR EMAIL PARA EQUIPE =====
      try {
        const veicDesc = veiculoSelecionado ? `${veiculoSelecionado.placa} - ${veiculoSelecionado.marca} ${veiculoSelecionado.modelo}` : '';
        await supabase.functions.invoke('send-email', {
          body: {
            to: 'sinistros@praticprotect.com.br',
            subject: alertaRecemAtivado
              ? `⚠️ Sinistro Recém-Ativado: ${protocolo} - ${veiculoSelecionado?.placa}`
              : `Novo Sinistro: ${protocolo} - ${veiculoSelecionado?.placa}`,
            html: `
              <h2>${alertaRecemAtivado ? '⚠️ Sinistro de Associado Recém-Ativado' : 'Novo Sinistro Registrado'}</h2>
              ${alertaRecemAtivado ? '<p style="color: #d97706; font-weight: bold;">ATENÇÃO: Este sinistro foi aberto para associado sem rastreador instalado. Requer análise especial.</p>' : ''}
              <p><strong>Protocolo:</strong> ${protocolo}</p>
              <p><strong>Tipo:</strong> ${TIPO_LABELS[formData.tipo] || formData.tipo}</p>
              <p><strong>Veículo:</strong> ${veicDesc}</p>
              <p><strong>Local:</strong> ${formData.cidade_ocorrencia}/${formData.estado_ocorrencia}</p>
              <p><strong>Canal:</strong> Presencial (registrado via sistema)</p>
              <p><strong>Descrição:</strong></p>
              <p>${formData.descricao}</p>
            `,
          },
        });
        console.log('[NovoSinistroModal] Email enviado para equipe');
      } catch (emailError) {
        console.error('[NovoSinistroModal] Erro ao enviar email (não bloqueante):', emailError);
      }

      // ===== 12. NOTIFICAR VIA EDGE FUNCTION =====
      try {
        await supabase.functions.invoke('notificar-sinistro', {
          body: { sinistro_id: sinistro.id, status: 'comunicado' },
        });
      } catch (notifError) {
        console.warn('[NovoSinistroModal] Erro ao notificar (não bloqueante):', notifError);
      }
      
      return sinistro;
    },
    onSuccess: (data) => {
      toast.success(`Sinistro ${data.protocolo} registrado com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['sinistros'] });
      queryClient.invalidateQueries({ queryKey: ['sinistros-contadores'] });
      onSuccess?.(data);
      handleClose();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Erro ao registrar sinistro');
      console.error(error);
    }
  });

  const handleClose = () => {
    setSelectedAssociado(null);
    setSelectedVeiculo(null);
    setSearchAssociado('');
    setFormData({
      tipo: '',
      data_ocorrencia: '',
      local_ocorrencia: '',
      cidade_ocorrencia: '',
      estado_ocorrencia: '',
      bo_numero: '',
      descricao: ''
    });
    setNecessitaReboque(false);
    onClose();
  };

  const isFormValid = () => {
    return (
      selectedAssociado &&
      selectedVeiculo &&
      formData.tipo &&
      formData.data_ocorrencia &&
      formData.local_ocorrencia &&
      formData.cidade_ocorrencia &&
      formData.estado_ocorrencia &&
      formData.descricao.length >= 50
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid()) return;
    createMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Novo Sinistro</DialogTitle>
          <DialogDescription>
            Preencha os dados do sinistro para comunicação
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Seção 1 - Associado e Veículo */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Associado e Veículo</h3>
            
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Associado *</Label>
                <Popover open={openAssociadoPopover} onOpenChange={setOpenAssociadoPopover}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openAssociadoPopover}
                      className="w-full justify-between"
                    >
                      {selectedAssociadoData ? (
                        <span>
                          {selectedAssociadoData.nome} - {formatCPF(selectedAssociadoData.cpf)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Buscar por nome ou CPF...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Digite nome, CPF ou placa (mín. 3 caracteres)..."
                        value={searchAssociado}
                        onValueChange={setSearchAssociado}
                      />
                      <CommandList>
                        <CommandEmpty>
                          {searchAssociado.length < 3 
                            ? 'Digite ao menos 3 caracteres...' 
                            : 'Nenhum associado encontrado.'
                          }
                        </CommandEmpty>
                        <CommandGroup>
                          {associados.map((associado) => (
                            <CommandItem
                              key={associado.id}
                              value={associado.id}
                              onSelect={() => {
                                setSelectedAssociado(associado.id);
                                setSelectedVeiculo(null);
                                setOpenAssociadoPopover(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedAssociado === associado.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span>{associado.nome}</span>
                                <span className="text-xs text-muted-foreground">
                                  {formatCPF(associado.cpf)}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Veículo *</Label>
                <Select
                  value={selectedVeiculo || ''}
                  onValueChange={setSelectedVeiculo}
                  disabled={!selectedAssociado}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      !selectedAssociado 
                        ? "Selecione um associado primeiro" 
                        : "Selecione o veículo"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {veiculos.map((veiculo) => (
                      <SelectItem key={veiculo.id} value={veiculo.id}>
                        <div className="flex items-center gap-2">
                          <Car className="h-4 w-4" />
                          <span>{veiculo.placa} - {veiculo.marca} {veiculo.modelo} {veiculo.ano_modelo}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedVeiculoData && (
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-sm text-muted-foreground">
                    Valor FIPE: <span className="font-medium text-foreground">
                      {formatCurrency(selectedVeiculoData.valor_fipe)}
                    </span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Seção 2 - Dados do Sinistro */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Dados do Sinistro</h3>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, tipo: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPO_SINISTRO_OPTIONS.map((tipo) => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data da Ocorrência *</Label>
                <Input
                  type="datetime-local"
                  value={formData.data_ocorrencia}
                  onChange={(e) => setFormData(prev => ({ ...prev, data_ocorrencia: e.target.value }))}
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Local (Endereço) *</Label>
                <Input
                  placeholder="Rua, número, bairro..."
                  value={formData.local_ocorrencia}
                  onChange={(e) => setFormData(prev => ({ ...prev, local_ocorrencia: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Cidade *</Label>
                <Input
                  placeholder="Cidade"
                  value={formData.cidade_ocorrencia}
                  onChange={(e) => setFormData(prev => ({ ...prev, cidade_ocorrencia: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Estado *</Label>
                <Select
                  value={formData.estado_ocorrencia}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, estado_ocorrencia: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {UF_OPTIONS.map((uf) => (
                      <SelectItem key={uf} value={uf}>
                        {uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Nº do Boletim de Ocorrência</Label>
                <Input
                  placeholder="Opcional"
                  value={formData.bo_numero}
                  onChange={(e) => setFormData(prev => ({ ...prev, bo_numero: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Seção 3 - Descrição */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Descrição</h3>
            
            <div className="space-y-2">
              <Textarea
                placeholder="Descreva detalhadamente as circunstâncias do sinistro..."
                value={formData.descricao}
                onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Mínimo 50 caracteres ({formData.descricao.length}/50)
              </p>
            </div>
          </div>

          {/* Precisa de reboque? */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Truck className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-sm">Precisa de reboque?</p>
                <p className="text-xs text-muted-foreground">Criar chamado de assistência 24h automaticamente</p>
              </div>
            </div>
            <Switch checked={necessitaReboque} onCheckedChange={setNecessitaReboque} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={!isFormValid() || createMutation.isPending}
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Registrar Sinistro
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
