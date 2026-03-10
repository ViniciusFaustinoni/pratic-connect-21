import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, Check, ChevronsUpDown, Car, Truck, AlertTriangle, Flame, CloudRain, Home, Wrench } from 'lucide-react';
import { useOficinas } from '@/hooks/useOficinas';
import { useCarenciaDiasPadrao } from '@/hooks/useConteudosSistema';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { differenceInDays } from 'date-fns';

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
  { value: 'vidros', label: 'Vidros e Faróis' },
  { value: 'outro', label: 'Outro' },
];

const TIPO_LABELS: Record<string, string> = {
  colisao: 'Colisão', roubo: 'Roubo', furto: 'Furto', incendio: 'Incêndio',
  fenomeno_natural: 'Fenômeno Natural', vidros: 'Vidros e Faróis', vandalismo: 'Vandalismo',
  terceiros: 'Terceiros', outro: 'Outro',
};

const PECAS_VIDROS = [
  'Para-brisa',
  'Vidro vigia (traseiro)',
  'Vidro lateral dianteiro esquerdo',
  'Vidro lateral dianteiro direito',
  'Vidro lateral traseiro esquerdo',
  'Vidro lateral traseiro direito',
  'Vidro fixo lateral esquerdo',
  'Vidro fixo lateral direito',
  'Farol esquerdo',
  'Farol direito',
  'Lanterna esquerda',
  'Lanterna direita',
  'Espelho retrovisor esquerdo',
  'Espelho retrovisor direito',
] as const;

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
    { tipo: 'foto_dano', nome: 'Fotos do Veículo', obrigatorio: true },
  ],
  fenomeno_natural: [
    { tipo: 'cnh', nome: 'CNH do Condutor', obrigatorio: true },
    { tipo: 'crlv', nome: 'CRLV do Veículo', obrigatorio: true },
    { tipo: 'foto_dano', nome: 'Fotos dos Danos', obrigatorio: true },
    { tipo: 'comprovante_evento', nome: 'Comprovante do Evento (notícia/defesa civil)', obrigatorio: true },
  ],
  vidros: [
    { tipo: 'foto_dano', nome: 'Fotos do Dano (2-5)', obrigatorio: true },
    { tipo: 'relato', nome: 'Relato do Ocorrido', obrigatorio: true },
    { tipo: 'bo', nome: 'Boletim de Ocorrência', obrigatorio: false },
    { tipo: 'nf_danfe', nome: 'Nota Fiscal DANFE', obrigatorio: false },
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
  
  // === Colisão: bifurcação reboque ===
  const [destinoReboqueTipo, setDestinoReboqueTipo] = useState<'associado' | 'oficina' | ''>('');
  const [destinoReboqueEndereco, setDestinoReboqueEndereco] = useState('');
  const [destinoReboqueOficinaId, setDestinoReboqueOficinaId] = useState('');

  const isColisao = formData.tipo === 'colisao';
  
  // Buscar oficinas ativas para seleção de destino do reboque
  const { data: oficinasAtivas = [] } = useOficinas({ status: 'ativo' as any });

  // === Incêndio / Fenômeno Natural state ===
  const [bombeirosAcionados, setBombeirosAcionados] = useState<boolean | null>(null);
  const [tipoAgua, setTipoAgua] = useState<'doce' | 'salgada' | ''>('');

  // === Vidros state ===
  const [pecaDanificada, setPecaDanificada] = useState('');
  const [opcaoReparo, setOpcaoReparo] = useState<'via_pratic' | 'reembolso'>('via_pratic');
  const [tentativaFurto, setTentativaFurto] = useState(false);
  const [vidrosValidacao, setVidrosValidacao] = useState<{
    carenciaOk: boolean;
    carenciaData?: string;
    beneficioOk: boolean;
    pecaLimiteOk: boolean;
    pecaBloqueada?: string;
    loading: boolean;
  }>({ carenciaOk: true, beneficioOk: true, pecaLimiteOk: true, loading: false });

  const isVidros = formData.tipo === 'vidros';
  const isIncendio = formData.tipo === 'incendio';
  const isFenomenoNatural = formData.tipo === 'fenomeno_natural';

  // Buscar associados
  const { data: associados = [] } = useQuery({
    queryKey: ['associados-search', searchAssociado],
    queryFn: async () => {
      if (searchAssociado.length < 3) return [];
      
      const isBuscaPlaca = /^[A-Za-z]{3}/i.test(searchAssociado.replace(/\s/g, ''));
      
      if (isBuscaPlaca) {
        const { data: veiculos } = await supabase
          .from('veiculos')
          .select('associado_id, placa, associado:associados!inner(id, nome, cpf, status)')
          .ilike('placa', `%${searchAssociado}%`)
          .limit(10);
        
        if (!veiculos) return [];
        
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

  // === Validação de vidros ===
  useEffect(() => {
    if (!isVidros || !selectedAssociado || !selectedVeiculo) {
      setVidrosValidacao({ carenciaOk: true, beneficioOk: true, pecaLimiteOk: true, loading: false });
      return;
    }

    const validar = async () => {
      setVidrosValidacao(prev => ({ ...prev, loading: true }));
      
      try {
        // 1. Verificar carência 120 dias
        const { data: associadoData } = await supabase
          .from('associados')
          .select('data_adesao, plano_id')
          .eq('id', selectedAssociado)
          .single();

        let carenciaOk = true;
        let carenciaData: string | undefined;

        if (associadoData?.data_adesao) {
          const diasDesdeAdesao = differenceInDays(new Date(), new Date(associadoData.data_adesao));
          if (diasDesdeAdesao < 120) {
            carenciaOk = false;
            const dataLiberacao = new Date(associadoData.data_adesao);
            dataLiberacao.setDate(dataLiberacao.getDate() + 120);
            carenciaData = dataLiberacao.toLocaleDateString('pt-BR');
          }
        }

        // 2. Verificar benefício contratado
        let beneficioOk = true;
        if (associadoData?.plano_id) {
          const { data: cobertura } = await supabase
            .from('planos_coberturas')
            .select('id')
            .eq('plano_id', associadoData.plano_id)
            .eq('cobertura_id', (await supabase.from('coberturas').select('id').eq('codigo', 'COB-VID').single()).data?.id || '')
            .maybeSingle();
          
          // Se não encontrar vínculo, mas a tabela pode estar vazia (sem dados populados)
          // Deixar beneficioOk = true para não bloquear indevidamente enquanto não houver dados
          if (cobertura === null) {
            // Verificar se a tabela planos_coberturas tem algum dado
            const { count } = await supabase.from('planos_coberturas').select('id', { count: 'exact', head: true });
            if (count && count > 0) {
              beneficioOk = false;
            }
          }
        }

        // 3. Verificar limite por peça (12 meses)
        let pecaLimiteOk = true;
        let pecaBloqueada: string | undefined;
        if (pecaDanificada) {
          const dozeAtras = new Date();
          dozeAtras.setFullYear(dozeAtras.getFullYear() - 1);
          
          const { data: historico } = await supabase
            .from('sinistro_vidros_historico')
            .select('id')
            .eq('associado_id', selectedAssociado)
            .eq('peca', pecaDanificada)
            .gte('data_utilizacao', dozeAtras.toISOString())
            .limit(1);
          
          if (historico && historico.length > 0) {
            pecaLimiteOk = false;
            pecaBloqueada = pecaDanificada;
          }
        }

        setVidrosValidacao({ carenciaOk, carenciaData, beneficioOk, pecaLimiteOk, pecaBloqueada, loading: false });
      } catch (err) {
        console.error('[NovoSinistroModal] Erro na validação de vidros:', err);
        setVidrosValidacao({ carenciaOk: true, beneficioOk: true, pecaLimiteOk: true, loading: false });
      }
    };

    validar();
  }, [isVidros, selectedAssociado, selectedVeiculo, pecaDanificada]);

  const selectedAssociadoData = associados.find(a => a.id === selectedAssociado);
  const selectedVeiculoData = veiculos.find(v => v.id === selectedVeiculo);

  const vidrosBloqueado = isVidros && (!vidrosValidacao.carenciaOk || !vidrosValidacao.beneficioOk || !vidrosValidacao.pecaLimiteOk);

  // Mutation para criar sinistro
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

      // Vidros tem validação própria, não depende de cobertura total
      if (!isVidros) {
        if (temCoberturaTotal) {
          // Cobertura total: qualquer tipo permitido
        } else if (temCoberturaRouboFurto && isRouboFurto) {
          alertaRecemAtivado = true;
          console.log('[NovoSinistroModal] ⚠️ Sinistro roubo/furto sem cobertura total - alerta ativado');
        } else if (!isRouboFurto && !temCoberturaTotal) {
          throw new Error('Veículo sem Proteção 360º para este tipo de sinistro. Apenas roubo/furto é permitido.');
        }
      }

      // ===== 3. CAPTURAR POSIÇÃO DO RASTREADOR =====
      const { data: rastreador } = await supabase
        .from('rastreadores')
        .select('id, ultima_posicao_lat, ultima_posicao_lng, ultima_comunicacao')
        .eq('veiculo_id', selectedVeiculo!)
        .eq('status', 'instalado')
        .maybeSingle();

      // ===== 4. INSERIR SINISTRO =====
      const insertData: any = {
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
        necessita_reboque: isVidros ? false : necessitaReboque,
        // Campos de destino do reboque (colisão)
        destino_reboque_tipo: (isColisao && necessitaReboque && destinoReboqueTipo) ? destinoReboqueTipo : null,
        destino_reboque_endereco: (isColisao && necessitaReboque && destinoReboqueTipo === 'associado') ? destinoReboqueEndereco || null : null,
        destino_reboque_oficina_id: (isColisao && necessitaReboque && destinoReboqueTipo === 'oficina') ? destinoReboqueOficinaId || null : null,
        assistencia_acionada_em: (isColisao && necessitaReboque) ? new Date().toISOString() : null,
        alerta_recem_ativado: alertaRecemAtivado,
        rastreador_lat_momento: rastreador?.ultima_posicao_lat || null,
        rastreador_lng_momento: rastreador?.ultima_posicao_lng || null,
        rastreador_posicao_capturada_em: rastreador?.ultima_comunicacao || null,
      };

      // Campos específicos de vidros
      if (isVidros) {
        insertData.peca_danificada = pecaDanificada;
        insertData.opcao_reparo = opcaoReparo;
      }

      // Campos específicos de incêndio
      if (isIncendio && bombeirosAcionados !== null) {
        insertData.bombeiros_acionados = bombeirosAcionados;
      }

      // Campos específicos de fenômeno natural
      if (isFenomenoNatural) {
        if (bombeirosAcionados !== null) {
          insertData.bombeiros_acionados = bombeirosAcionados;
        }
        if (tipoAgua) {
          insertData.tipo_agua = tipoAgua;
        }
        // Água salgada → auto-marcar análise interna jurídica
        if (tipoAgua === 'salgada') {
          insertData.analise_interna = true;
          insertData.analise_interna_motivos = ['agua_salgada'];
        }
      }

      const { data: sinistro, error } = await supabase
        .from('sinistros')
        .insert([insertData])
        .select()
        .single();
      
      if (error) throw error;

      // ===== 5. REGISTRAR HISTÓRICO =====
      const observacaoHistorico = isVidros
        ? `Sinistro registrado via sistema - Vidros e Faróis - Peça: ${pecaDanificada} - Opção: ${opcaoReparo === 'via_pratic' ? 'Via Pratic' : 'Reembolso'}`
        : alertaRecemAtivado
        ? `Sinistro registrado via sistema - ${TIPO_LABELS[formData.tipo] || formData.tipo} - ⚠️ ALERTA: Associado recém-ativado (sem rastreador)`
        : `Sinistro registrado via sistema - ${TIPO_LABELS[formData.tipo] || formData.tipo}`;

      await supabase.from('sinistro_historico').insert({
        sinistro_id: sinistro.id,
        status_novo: 'comunicado',
        usuario_id: user?.id,
        observacao: observacaoHistorico,
      });

      // ===== 5b. REGISTRAR HISTÓRICO DE VIDROS =====
      if (isVidros) {
        try {
          await supabase.from('sinistro_vidros_historico').insert({
            associado_id: selectedAssociado!,
            veiculo_id: selectedVeiculo!,
            sinistro_id: sinistro.id,
            peca: pecaDanificada,
          });
          console.log('[NovoSinistroModal] Histórico de vidros registrado');
        } catch (vidErr) {
          console.error('[NovoSinistroModal] Erro ao registrar histórico de vidros:', vidErr);
        }
      }

      // ===== 6. CRIAR CHAMADO DE REBOQUE (não para vidros) =====
      if (necessitaReboque && !isVidros) {
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
              descricao: isColisao && destinoReboqueTipo
                ? `Reboque solicitado junto ao sinistro ${protocolo}. Destino: ${destinoReboqueTipo === 'oficina' ? `Oficina (ID: ${destinoReboqueOficinaId})` : `Endereço do associado: ${destinoReboqueEndereco}`}`
                : `Reboque solicitado junto ao sinistro ${protocolo}`,
              origem_endereco: formData.local_ocorrencia || null,
              canal: 'presencial',
              status: 'aberto',
              data_abertura: new Date().toISOString(),
              atendente_id: user?.id || null,
            })
            .select('id, protocolo')
            .single();

          if (!chamadoError && chamadoReboque) {
            await supabase
              .from('sinistros')
              .update({ chamado_assistencia_id: chamadoReboque.id })
              .eq('id', sinistro.id);

            await supabase.from('chamados_assistencia_historico').insert({
              chamado_id: chamadoReboque.id,
              status_anterior: null,
              status_novo: 'aberto',
              usuario_id: user?.id || null,
              observacao: `Chamado de guincho criado automaticamente a partir do sinistro ${protocolo}`,
            });

            console.log('[NovoSinistroModal] Chamado de reboque criado com histórico:', chamadoReboque.protocolo);
          }
        } catch (rebError) {
          console.error('[NovoSinistroModal] Erro ao criar reboque:', rebError);
        }
      }

      // ===== 7. CRIAR DOCUMENTOS PENDENTES =====
      try {
        let documentosPendentes = (DOCUMENTOS_OBRIGATORIOS[formData.tipo] || DOCUMENTOS_OBRIGATORIOS.outro).map(doc => {
          // Para vidros com tentativa de furto, tornar B.O. obrigatório
          if (isVidros && tentativaFurto && doc.tipo === 'bo') {
            return { ...doc, obrigatorio: true };
          }
          return doc;
        });
        // Para incêndio, adicionar documento dinâmico baseado em bombeiros_acionados
        if (isIncendio && bombeirosAcionados !== null) {
          const docBombeiros = bombeirosAcionados
            ? { tipo: 'certidao_bombeiros', nome: 'Certidão de Ocorrência do Corpo de Bombeiros', obrigatorio: true }
            : { tipo: 'carta_cartorio', nome: 'Carta reconhecida em cartório explicando circunstâncias', obrigatorio: true };
          documentosPendentes = [...documentosPendentes, docBombeiros];
        }

        // Para fenômeno natural, adicionar documentos dinâmicos
        if (isFenomenoNatural) {
          // Fotos in loco sempre obrigatório
          documentosPendentes = [...documentosPendentes, 
            { tipo: 'fotos_in_loco', nome: 'Fotos in loco (local alagado, nível da água, veículo no local)', obrigatorio: true }
          ];
          if (bombeirosAcionados !== null) {
            const docBombeiros = bombeirosAcionados
              ? { tipo: 'certidao_bombeiros', nome: 'Certidão de Ocorrência do Corpo de Bombeiros', obrigatorio: true }
              : { tipo: 'carta_cartorio', nome: 'Carta reconhecida em cartório explicando circunstâncias', obrigatorio: true };
            documentosPendentes = [...documentosPendentes, docBombeiros];
          }
        }

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
        // Buscar analistas de eventos pelo role
        const { data: analistas } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'analista_eventos');

        let destinatarios = analistas || [];
        if (destinatarios.length === 0) {
          // Fallback: buscar usuários com permissão canDeleteSinistro (diretores/admins)
          const { data: configs } = await supabase
            .from('app_roles_config')
            .select('role, permissions')
            .eq('is_active', true);
          const rolesAdmin = (configs || [])
            .filter((c: any) => Array.isArray(c.permissions) && c.permissions.includes('canDeleteSinistro'))
            .map((c: any) => c.role);
          if (rolesAdmin.length > 0) {
            const { data: admins } = await supabase
              .from('user_roles')
              .select('user_id')
              .in('role', rolesAdmin);
            destinatarios = admins || [];
          }
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
              ${isVidros ? `<p><strong>Peça:</strong> ${pecaDanificada}</p><p><strong>Opção:</strong> ${opcaoReparo === 'via_pratic' ? 'Via Pratic (60/40)' : 'Reembolso (60%)'}</p>` : ''}
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

      // ===== 13. ACIONAMENTO AUTOMÁTICO DO RASTREADOR (ROUBO/FURTO) =====
      if (isRouboFurto) {
        try {
          console.log('[NovoSinistroModal] Acionando rastreador automaticamente para roubo/furto...');
          const { data: acionResult, error: acionError } = await supabase.functions.invoke('acionar-roubo-furto', {
            body: {
              sinistro_id: sinistro.id,
              veiculo_id: selectedVeiculo!,
              associado_id: selectedAssociado!,
            },
          });
          if (acionError) {
            console.error('[NovoSinistroModal] Erro ao acionar rastreador:', acionError);
          } else {
            console.log('[NovoSinistroModal] Rastreador acionado com sucesso:', acionResult);
          }
        } catch (acionarError) {
          console.error('[NovoSinistroModal] Erro ao acionar rastreador (não bloqueante):', acionarError);
        }
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
    setDestinoReboqueTipo('');
    setDestinoReboqueEndereco('');
    setDestinoReboqueOficinaId('');
    setPecaDanificada('');
    setOpcaoReparo('via_pratic');
    setBombeirosAcionados(null);
    setTipoAgua('');
    onClose();
  };

  const isFormValid = () => {
    const minDescricao = isVidros ? 20 : 50;
    const baseValid = selectedAssociado &&
      selectedVeiculo &&
      formData.tipo &&
      formData.data_ocorrencia &&
      formData.local_ocorrencia &&
      formData.cidade_ocorrencia &&
      formData.estado_ocorrencia &&
      formData.descricao.length >= minDescricao;

    if (isVidros) {
      return baseValid && pecaDanificada && opcaoReparo && !vidrosBloqueado;
    }

    // Colisão com reboque: exigir destino
    if (isColisao && necessitaReboque) {
      if (!destinoReboqueTipo) return false;
      if (destinoReboqueTipo === 'associado' && !destinoReboqueEndereco) return false;
      if (destinoReboqueTipo === 'oficina' && !destinoReboqueOficinaId) return false;
    }

    return baseValid;
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
                  onValueChange={(value) => {
                    setFormData(prev => ({ ...prev, tipo: value }));
                    if (value !== 'vidros') {
                      setPecaDanificada('');
                      setOpcaoReparo('via_pratic');
                    }
                  }}
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

              {!isVidros && (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Nº do Boletim de Ocorrência</Label>
                  <Input
                    placeholder="Opcional"
                    value={formData.bo_numero}
                    onChange={(e) => setFormData(prev => ({ ...prev, bo_numero: e.target.value }))}
                  />
                </div>
              )}
            </div>
          </div>

          {/* === SEÇÃO INCÊNDIO - Bombeiros acionados? === */}
          {isIncendio && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Incêndio - Documentação</h3>
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Flame className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="font-medium text-sm">Os bombeiros foram acionados?</p>
                    <p className="text-xs text-muted-foreground">
                      {bombeirosAcionados === true
                        ? 'Será exigida a Certidão de Ocorrência do Corpo de Bombeiros'
                        : bombeirosAcionados === false
                        ? 'Será exigida Carta reconhecida em cartório explicando as circunstâncias'
                        : 'Define qual documento adicional será obrigatório'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{bombeirosAcionados === null ? '' : bombeirosAcionados ? 'Sim' : 'Não'}</span>
                  <Switch 
                    checked={bombeirosAcionados === true} 
                    onCheckedChange={(checked) => setBombeirosAcionados(checked)} 
                  />
                </div>
              </div>
            </div>
          )}

          {/* === SEÇÃO FENÔMENO NATURAL === */}
          {isFenomenoNatural && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Fenômeno Natural - Detalhes</h3>
              
              {/* Tipo de Água */}
              <div className="space-y-2">
                <Label>Tipo de Água *</Label>
                <RadioGroup
                  value={tipoAgua}
                  onValueChange={(v) => setTipoAgua(v as 'doce' | 'salgada')}
                  className="grid grid-cols-2 gap-3"
                >
                  <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="doce" id="agua_doce" />
                    <Label htmlFor="agua_doce" className="cursor-pointer">
                      <span className="font-medium">Água Doce</span>
                      <p className="text-xs text-muted-foreground">Chuva, enchente, granizo</p>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="salgada" id="agua_salgada" />
                    <Label htmlFor="agua_salgada" className="cursor-pointer">
                      <span className="font-medium">Água Salgada</span>
                      <p className="text-xs text-muted-foreground">Maré, ressaca</p>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {tipoAgua === 'salgada' && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800 dark:text-amber-300">Análise Jurídica</p>
                    <p className="text-amber-700 dark:text-amber-400">
                      Água salgada será encaminhado automaticamente para análise jurídica.
                    </p>
                  </div>
                </div>
              )}

              {/* Bombeiros acionados? */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CloudRain className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium text-sm">Os bombeiros foram acionados?</p>
                    <p className="text-xs text-muted-foreground">
                      {bombeirosAcionados === true
                        ? 'Será exigida a Certidão de Ocorrência do Corpo de Bombeiros'
                        : bombeirosAcionados === false
                        ? 'Será exigida Carta reconhecida em cartório'
                        : 'Define qual documento adicional será obrigatório'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{bombeirosAcionados === null ? '' : bombeirosAcionados ? 'Sim' : 'Não'}</span>
                  <Switch 
                    checked={bombeirosAcionados === true} 
                    onCheckedChange={(checked) => setBombeirosAcionados(checked)} 
                  />
                </div>
              </div>
            </div>
          )}

          {/* === SEÇÃO VIDROS === */}
          {isVidros && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Vidros e Faróis</h3>

              {/* Alertas de validação */}
              {vidrosValidacao.loading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verificando elegibilidade...
                </div>
              )}

              {!vidrosValidacao.carenciaOk && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-destructive">Carência não cumprida</p>
                    <p className="text-muted-foreground">
                      Este benefício possui carência de 120 dias. Disponível a partir de {vidrosValidacao.carenciaData}.
                    </p>
                  </div>
                </div>
              )}

              {!vidrosValidacao.beneficioOk && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-destructive">Benefício não contratado</p>
                    <p className="text-muted-foreground">
                      O plano do associado não inclui a cobertura de Vidros e Faróis.
                    </p>
                  </div>
                </div>
              )}

              {!vidrosValidacao.pecaLimiteOk && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-destructive">Limite atingido</p>
                    <p className="text-muted-foreground">
                      A peça "{vidrosValidacao.pecaBloqueada}" já foi acionada nos últimos 12 meses. Selecione outra peça.
                    </p>
                  </div>
                </div>
              )}

              {/* Seletor de peça */}
              <div className="space-y-2">
                <Label>Peça Danificada *</Label>
                <Select value={pecaDanificada} onValueChange={setPecaDanificada}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a peça danificada" />
                  </SelectTrigger>
                  <SelectContent>
                    {PECAS_VIDROS.map((peca) => (
                      <SelectItem key={peca} value={peca}>{peca}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Opção de reparo */}
              <div className="space-y-2">
                <Label>Opção de Reparo *</Label>
                <RadioGroup
                  value={opcaoReparo}
                  onValueChange={(v) => setOpcaoReparo(v as 'via_pratic' | 'reembolso')}
                  className="grid grid-cols-2 gap-3"
                >
                  <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="via_pratic" id="via_pratic" />
                    <Label htmlFor="via_pratic" className="cursor-pointer">
                      <span className="font-medium">Via Pratic</span>
                      <p className="text-xs text-muted-foreground">Auto center credenciado. Associado paga 40%.</p>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="reembolso" id="reembolso" />
                    <Label htmlFor="reembolso" className="cursor-pointer">
                      <span className="font-medium">Reembolso</span>
                      <p className="text-xs text-muted-foreground">Compra por conta própria. Reembolso de 60%.</p>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Toggle tentativa de furto */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <div>
                    <p className="font-medium text-sm">O dano foi causado por tentativa de furto/roubo?</p>
                    <p className="text-xs text-muted-foreground">
                      {tentativaFurto
                        ? 'O Boletim de Ocorrência será obrigatório'
                        : 'Se sim, será exigido B.O.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{tentativaFurto ? 'Sim' : 'Não'}</span>
                  <Switch checked={tentativaFurto} onCheckedChange={setTentativaFurto} />
                </div>
              </div>
            </div>
          )}

          {/* Seção 3 - Descrição */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Descrição</h3>
            
            <div className="space-y-2">
              <Textarea
                placeholder={isVidros 
                  ? "Descreva brevemente o que aconteceu (pedra, vandalismo, etc.)..." 
                  : "Descreva detalhadamente as circunstâncias do sinistro..."}
                value={formData.descricao}
                onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                rows={isVidros ? 3 : 4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Mínimo {isVidros ? 20 : 50} caracteres ({formData.descricao.length}/{isVidros ? 20 : 50})
              </p>
            </div>
          </div>

          {/* Precisa de reboque? (não para vidros) */}
          {!isVidros && (
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
          )}

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
