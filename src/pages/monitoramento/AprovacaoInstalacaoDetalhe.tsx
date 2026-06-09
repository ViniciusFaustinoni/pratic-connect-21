import { useState } from 'react';
import { toast } from 'sonner';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  ShieldCheck,
  User,
  Car,
  Cpu,
  Camera,
  Video,
  ClipboardCheck,
  CheckCircle,
  XCircle,
  Loader2,
  MapPin,
  FileText,
  AlertTriangle,
  ExternalLink,
  Expand,
  UserSearch,
  Undo2,
  PackageMinus,

} from 'lucide-react';
import {
  useAprovarInstalacaoMonitoramento,
  useReprovarInstalacaoMonitoramento,
} from '@/hooks/useAprovacaoMonitoramento';
import { veiculoSubFipe, exigeInstalacaoTecnica } from '@/hooks/useSolicitarVistoriaTecnico';
import { useDevolverAoCadastro } from '@/hooks/useDevolverAoCadastro';
import { SolicitarVistoriaTecnicoDialog } from '@/components/monitoramento/SolicitarVistoriaTecnicoDialog';
import { MarcarRetiradaDialog } from '@/components/monitoramento/MarcarRetiradaDialog';

import { CorrigirDadosVeiculoDialog } from '@/components/monitoramento/CorrigirDadosVeiculoDialog';
import { ConfirmarDevolverCadastroDialog } from '@/components/monitoramento/ConfirmarDevolverCadastroDialog';
import { VincularRastreadorExistenteCard } from '@/components/rastreadores/VincularRastreadorExistenteCard';
import { resolverFotosVeiculo } from '@/lib/fotosVeiculo/resolverFotosVeiculo';
import { servicoConcluidoEmCampo } from '@/lib/servicos/terminaisPositivos';
import { BypassAplicadoBanner } from '@/components/cadastro/BypassAplicadoBanner';

// Hook para buscar detalhes completos do serviço
function useServicoDetalheAprovacao(servicoId: string | undefined) {
  return useQuery({
    queryKey: ['servico-detalhe-aprovacao', servicoId],
    queryFn: async () => {
      if (!servicoId) throw new Error('ID não fornecido');

      // Buscar serviço com joins (defensivo: maybeSingle p/ distinguir não-encontrado de erro)
      const { data: servico, error } = await (supabase as any)
        .from('servicos')
        .select(`
          *,
          profissional:profissional_id(id, nome),
          veiculo:veiculo_id(id, placa, chassi, marca, modelo, ano_modelo, cor, valor_fipe, combustivel, cobertura_roubo_furto, cobertura_total),
          associado:associado_id(id, nome, cpf, telefone, email, whatsapp, status)
        `)
        .eq('id', servicoId)
        .maybeSingle();

      if (error) {
        console.error('[AprovacaoInstalacaoDetalhe] erro ao carregar serviço', error);
        throw error;
      }
      if (!servico) {
        return { servico: null } as any;
      }

      // ============= FOTOS + VÍDEO 360° (resolver canônico unificado)
      // Substitui o caminho legado origem-id (instalacao_origem_id /
      // vistoria_origem_id), que quebra quando a vistoria não está
      // amarrada à instalação (caso TIB8F32: autovistoria com 34 fotos
      // em vistoria_fotos mas vistoria.instalacao_id = NULL).
      // Une vistoria_fotos + cotacoes_vistoria_fotos + instalacao_fotos
      // por veiculo_id / cotacao_id / instalacao_id, com dedupe por URL.
      const resolverInput = {
        veiculoId: servico.veiculo_id ?? null,
        contratoId: servico.contrato_id ?? null,
        cotacaoId: servico.cotacao_id ?? null,
        instalacaoId: servico.instalacao_origem_id ?? null,
      };
      const resolverResult = await resolverFotosVeiculo(resolverInput);
      const fotos = resolverResult.fotos;
      let videoInstalador = resolverResult.videoInstalador;
      let videoAssociado = resolverResult.videoAssociado;
      let vistoriaModalidade = resolverResult.vistoriaModalidade;

      console.log('[AprovacaoInstalacaoDetalhe] fotos resolvidas (canônico)', {
        servico_id: servico.id,
        input: resolverInput,
        counts: resolverResult.counts,
        video_instalador: !!videoInstalador,
        video_associado: !!videoAssociado,
      });

      // Modalidade priorizada pela vistoria diretamente vinculada ao serviço
      // (mantém compatibilidade com lógica de exibição existente).
      if (servico.vistoria_origem_id) {
        const { data: vistoriaInst } = await supabase
          .from('vistorias')
          .select('modalidade')
          .eq('id', servico.vistoria_origem_id)
          .maybeSingle();
        if (vistoriaInst?.modalidade) {
          vistoriaModalidade = vistoriaInst.modalidade;
        }
      }

      // Buscar rastreador vinculado
      let rastreador: any = null;
      if (servico.veiculo_id) {
        const { data: rData } = await supabase
          .from('rastreadores')
          .select('*')
          .eq('veiculo_id', servico.veiculo_id)
          .eq('status', 'instalado')
          .maybeSingle();
        rastreador = rData;
      }

      // ============= VISTORIA TÉCNICA (informações do técnico)
      // Busca a vistoria presencial mais recente do veículo para extrair
      // avarias, ressalvas, observações, KM, motivo de reprovação etc.
      // Fallback: qualquer vistoria mais recente, se não houver presencial.
      let vistoriaTecnico: any = null;
      if (servico.veiculo_id) {
        const baseSelect =
          'id, modalidade, avarias, ressalvas, observacoes, observacoes_analise, motivo_reprovacao, km_atual, quilometragem, concluida_em, status, instalador_responsavel_id, instalador_id';
        const { data: vPresencial } = await supabase
          .from('vistorias')
          .select(baseSelect)
          .eq('veiculo_id', servico.veiculo_id)
          .eq('modalidade', 'presencial')
          .order('concluida_em', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        vistoriaTecnico = vPresencial || null;
        if (!vistoriaTecnico) {
          const { data: vQualquer } = await supabase
            .from('vistorias')
            .select(baseSelect)
            .eq('veiculo_id', servico.veiculo_id)
            .order('concluida_em', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          vistoriaTecnico = vQualquer || null;
        }
        if (vistoriaTecnico) {
          const tecId = vistoriaTecnico.instalador_responsavel_id || vistoriaTecnico.instalador_id;
          if (tecId) {
            const { data: prof } = await supabase
              .from('profiles')
              .select('nome')
              .eq('id', tecId)
              .maybeSingle();
            vistoriaTecnico.tecnico_nome = (prof as any)?.nome || null;
          }
        }
      }

      // Buscar documentos do associado
      let documentos: any[] = [];
      if (servico.associado_id) {
        const { data: docsData } = await supabase
          .from('documentos')
          .select('*')
          .eq('associado_id', servico.associado_id)
          .order('created_at', { ascending: false });
        documentos = docsData || [];
      }

      // Mesclar documentos enviados na cotação pública (contratos_documentos)
      // Esses são CNH/CRLV/comprovante aprovados no fluxo público — não vivem em "documentos".
      if (servico.cotacao_id || servico.contrato_id) {
        let q = supabase
          .from('contratos_documentos')
          .select('id, tipo, status, arquivo_url, created_at, cotacao_id, contrato_id');
        if (servico.cotacao_id) q = q.eq('cotacao_id', servico.cotacao_id);
        else q = q.eq('contrato_id', servico.contrato_id);
        const { data: cdData, error: cdErr } = await q.order('created_at', { ascending: false });
        if (cdErr) {
          console.warn('[AprovacaoInstalacaoDetalhe] erro ao ler contratos_documentos', cdErr);
        }
        const extras = (cdData || []).map((d: any) => ({
          id: `cd-${d.id}`,
          tipo: d.tipo,
          status: d.status,
          arquivo_url: d.arquivo_url,
          created_at: d.created_at,
          origem_tabela: 'contratos_documentos',
        }));
        const chave = (d: any) => `${d.tipo}|${d.arquivo_url}`;
        const existentes = new Set(documentos.map(chave));
        documentos = [...documentos, ...extras.filter((d) => !existentes.has(chave(d)))];
        console.log('[AprovacaoInstalacaoDetalhe] documentos mesclados', {
          base: documentos.length - extras.length,
          extras: extras.length,
          totalFinal: documentos.length,
        });
      }


      // Checklist
      const checklist: any[] = [];

      // Endereço de INSTALAÇÃO (instalacoes ativa do contrato)
      let enderecoInstalacao: any = null;
      if (servico.instalacao_origem_id) {
        const { data: inst } = await supabase
          .from('instalacoes')
          .select('logradouro, numero, complemento, bairro, cidade, uf, cep, data_agendada, periodo, hora_agendada')
          .eq('id', servico.instalacao_origem_id)
          .maybeSingle();
        enderecoInstalacao = inst || null;
      }

      // Detectar atendimento na Base (vistoria_entrada ou sem instalacao vinculada)
      const isAtendimentoBase =
        servico.tipo === 'vistoria_entrada' || !servico.instalacao_origem_id;

      let enderecoBase: any = null;
      if (isAtendimentoBase) {
        const { data: cfgRows } = await supabase
          .from('configuracoes')
          .select('chave, valor')
          .in('chave', [
            'base_logradouro',
            'base_numero',
            'base_complemento',
            'base_bairro',
            'base_cidade',
            'base_uf',
            'base_cep',
          ]);
        const cfg: Record<string, string> = {};
        (cfgRows || []).forEach((r: any) => { cfg[r.chave] = r.valor; });

        // Data/horário: tentar vistoria, depois agendamento_base, depois servico
        let dataAg: string | null = null;
        let horarioAg: string | null = null;
        let periodoAg: string | null = null;

        if (servico.vistoria_origem_id) {
          const { data: v } = await supabase
            .from('vistorias')
            .select('data_agendada, horario_agendado')
            .eq('id', servico.vistoria_origem_id)
            .maybeSingle();
          dataAg = v?.data_agendada || null;
          horarioAg = (v as any)?.horario_agendado || null;
        }

        if (!dataAg && servico.contrato_id) {
          const { data: contrato } = await supabase
            .from('contratos')
            .select('cotacao_id')
            .eq('id', servico.contrato_id)
            .maybeSingle();
          if (contrato?.cotacao_id) {
            const { data: ag } = await supabase
              .from('agendamentos_base')
              .select('data_agendada, horario')
              .eq('cotacao_id', contrato.cotacao_id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            dataAg = ag?.data_agendada || null;
            horarioAg = ag?.horario || null;
          }
        }

        if (!dataAg) {
          dataAg = (servico as any).data_agendada || null;
          horarioAg = (servico as any).horario_agendado || horarioAg;
        }

        // Marcador interno 08:00 = manhã, 13:00 = tarde
        if (horarioAg) {
          const h = String(horarioAg).slice(0, 5);
          if (h === '08:00') periodoAg = 'Manhã';
          else if (h === '13:00') periodoAg = 'Tarde';
        }

        enderecoBase = {
          logradouro: cfg.base_logradouro,
          numero: cfg.base_numero,
          complemento: cfg.base_complemento,
          bairro: cfg.base_bairro,
          cidade: cfg.base_cidade,
          uf: cfg.base_uf,
          cep: cfg.base_cep,
          data_agendada: dataAg,
          periodo: periodoAg,
          hora_agendada: !periodoAg ? horarioAg : null,
        };
      }

      // Endereço CADASTRAL (do associado)
      let enderecoCadastral: any = null;
      if (servico.associado_id) {
        const { data: assoc } = await supabase
          .from('associados')
          .select('logradouro, numero, complemento, bairro, cidade, uf, cep')
          .eq('id', servico.associado_id)
          .maybeSingle();
        enderecoCadastral = assoc || null;
      }

      // Backfill contrato_id quando o servico (ex.: autovistoria materializada)
      // não carrega o vínculo direto — necessário para "Devolver ao Cadastro".
      if (!servico.contrato_id) {
        let resolvedContratoId: string | null = null;
        if (servico.vistoria_origem_id) {
          const { data: v } = await supabase
            .from('vistorias')
            .select('contrato_id')
            .eq('id', servico.vistoria_origem_id)
            .maybeSingle();
          resolvedContratoId = (v as any)?.contrato_id || null;
        }
        if (!resolvedContratoId && servico.veiculo_id) {
          const { data: c } = await supabase
            .from('contratos')
            .select('id')
            .eq('veiculo_id', servico.veiculo_id)
            .in('status', ['assinado', 'ativo'] as any)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          resolvedContratoId = (c as any)?.id || null;
        }
        if (resolvedContratoId) {
          servico.contrato_id = resolvedContratoId;
          console.log('[AprovacaoInstalacaoDetalhe] contrato_id resolvido via fallback', resolvedContratoId);
        }
      }

      // Carrega cadastro_aprovado + bypass_aplicado do contrato (canônico p/ sub-estado e banner)
      let cadastroAprovado = false;
      let bypassAplicado: any[] = [];
      if (servico.contrato_id) {
        const { data: cRow } = await supabase
          .from('contratos')
          .select('cadastro_aprovado, bypass_aplicado')
          .eq('id', servico.contrato_id)
          .maybeSingle();
        cadastroAprovado = !!(cRow as any)?.cadastro_aprovado;
        bypassAplicado = Array.isArray((cRow as any)?.bypass_aplicado) ? (cRow as any).bypass_aplicado : [];
      }

      return {
        servico,
        fotos,
        rastreador,
        checklist,
        documentos,
        videoInstalador,
        videoAssociado,
        enderecoInstalacao,
        enderecoCadastral,
        enderecoBase,
        isAtendimentoBase,
        vistoriaModalidade,
        cadastroAprovado,
        vistoriaTecnico,
        bypassAplicado,
      };
    },
    enabled: !!servicoId,
    staleTime: 10_000,
    refetchOnMount: true,
  });
}

const fotoLabels: Record<string, string> = {
  frente_veiculo: 'Frente do Veículo',
  frente: 'Frente',
  traseira_veiculo: 'Traseira do Veículo',
  traseira: 'Traseira',
  placa_veiculo: 'Placa',
  local_rastreador: 'Local do Rastreador',
  codigo_rastreador: 'Código do Rastreador',
  teste_comunicacao: 'Teste de Comunicação',
  hodometro: 'Hodômetro',
  odometro: 'Odômetro',
  painel_km: 'Painel (KM)',
  painel_completo: 'Painel Completo',
  painel_odometro_ligado: 'Painel/Odômetro Ligado',
  lateral_esquerda: 'Lateral Esquerda',
  lateral_direita: 'Lateral Direita',
  frente_lateral_esquerda: 'Frente Lateral Esquerda',
  frente_lateral_direita: 'Frente Lateral Direita',
  traseira_lateral_esquerda: 'Traseira Lateral Esquerda',
  traseira_lateral_direita: 'Traseira Lateral Direita',
  avarias: 'Avarias / Ressalvas',
  motor: 'Motor',
  motor_chassi: 'Motor / Chassi',
  motor_direito: 'Motor (Direito)',
  motor_esquerdo: 'Motor (Esquerdo)',
  chassi: 'Chassi',
  bateria: 'Bateria',
  bateria_validade: 'Validade da Bateria',
  chave: 'Chave',
  chave_roda_macaco: 'Chave de Roda / Macaco',
  farol: 'Farol',
  estepe: 'Estepe',
  parabrisa: 'Parabrisa',
  capo_aberto_placa: 'Capô Aberto (Placa)',
  mala_aberta: 'Porta-Malas',
  vistoriador_selfie: 'Selfie do Vistoriador',
  banco: 'Banco',
  banco_motorista: 'Banco do Motorista',
  banco_passageiro: 'Banco do Passageiro',
  banco_traseiro: 'Banco Traseiro',
  forracao_porta_dianteira_esquerda: 'Forração Porta Diant. Esq.',
  forracao_porta_dianteira_direita: 'Forração Porta Diant. Dir.',
  forracao_porta_traseira_esquerda: 'Forração Porta Tras. Esq.',
  forracao_porta_traseira_direita: 'Forração Porta Tras. Dir.',
  pneu_dianteiro_esquerdo: 'Pneu Diant. Esq.',
  pneu_dianteiro_direito: 'Pneu Diant. Dir.',
  pneu_traseiro_esquerdo: 'Pneu Tras. Esq.',
  pneu_traseiro_direito: 'Pneu Tras. Dir.',
  sola_pneu_dianteiro: 'Sola Pneu Dianteiro',
  sola_pneu_traseiro: 'Sola Pneu Traseiro',
  interior: 'Interior',
  assinatura_cliente: 'Assinatura do Cliente',
  video_360: 'Vídeo 360°',
};

// Tipos de foto que o técnico produz na vistoria (rastreador, avarias,
// mecânica, selfie). Exibidos em card destacado "Vistoria do Técnico".
const TECNICO_FOTO_TIPOS = new Set<string>([
  'local_rastreador',
  'codigo_rastreador',
  'teste_comunicacao',
  'avarias',
  'motor',
  'motor_chassi',
  'motor_direito',
  'motor_esquerdo',
  'painel_km',
  'painel_odometro_ligado',
  'painel_completo',
  'vistoriador_selfie',
  'bateria',
  'bateria_validade',
  'chave',
  'chave_roda_macaco',
  'farol',
]);

export default function AprovacaoInstalacaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading, error, refetch, isFetching } = useServicoDetalheAprovacao(id);
  const aprovar = useAprovarInstalacaoMonitoramento();
  const reprovar = useReprovarInstalacaoMonitoramento();
  const devolverCadastro = useDevolverAoCadastro();

  const [showReprovar, setShowReprovar] = useState(false);
  const [motivoReprovar, setMotivoReprovar] = useState('');
  const [observacoesAprovacao, setObservacoesAprovacao] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [videoExpandido, setVideoExpandido] = useState<string | null>(null);
  const [corrigirOpen, setCorrigirOpen] = useState(false);
  const [camposFaltando, setCamposFaltando] = useState<string[]>([]);
  const [solicitarVistoriaOpen, setSolicitarVistoriaOpen] = useState(false);
  const [retiradaOpen, setRetiradaOpen] = useState(false);

  const [devolverOpen, setDevolverOpen] = useState(false);
  

  if (isLoading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16 space-y-3">
        <AlertTriangle className="h-10 w-10 mx-auto text-destructive" />
        <p className="text-foreground font-medium">Erro ao carregar o serviço</p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto break-words">
          {(error as any)?.message || 'Falha de rede ou permissão.'}
        </p>
        <div className="flex justify-center gap-2 pt-2">
          <Button variant="outline" onClick={() => navigate(-1)}>Voltar</Button>
          <Button onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Tentar de novo
          </Button>
        </div>
      </div>
    );
  }

  if (!data || !(data as any).servico) {
    return (
      <div className="text-center py-16 text-muted-foreground space-y-3">
        <p>Serviço não encontrado</p>
        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={() => navigate(-1)}>Voltar</Button>
          <Button variant="ghost" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Recarregar
          </Button>
        </div>
      </div>
    );
  }

  const { servico, fotos, rastreador, checklist, documentos, videoInstalador, videoAssociado, enderecoInstalacao, enderecoCadastral, enderecoBase, isAtendimentoBase, vistoriaModalidade, cadastroAprovado, vistoriaTecnico } = data as any;
  const associado = servico.associado as any;
  const veiculo = servico.veiculo as any;
  const profissional = servico.profissional as any;

  const tentarAprovar = () => {
    aprovar.mutate({
      servicoId: servico.id,
      veiculoId: veiculo.id,
      associadoId: associado.id,
      observacoes: observacoesAprovacao || undefined,
    }, {
      onSuccess: () => navigate('/monitoramento/aprovacao-associados'),
      onError: (err: any) => {
        // Se for o erro estruturado de campos faltando, abre o dialog de correção
        if (err?.code === 'campos_obrigatorios_faltando' && Array.isArray(err.camposFaltando)) {
          setCamposFaltando(err.camposFaltando);
          setCorrigirOpen(true);
        }
        // demais erros já são tratados via toast no onError do hook
      },
    });
  };

  const handleAprovar = () => tentarAprovar();

  const handleReprovar = () => {
    if (!motivoReprovar.trim()) return;
    reprovar.mutate({
      servicoId: servico.id,
      veiculoId: veiculo.id,
      associadoId: associado.id,
      motivo: motivoReprovar,
    }, {
      onSuccess: () => {
        setShowReprovar(false);
        navigate('/monitoramento/aprovacao-associados');
      },
    });
  };

  const imageFotos = fotos.filter((f: any) => f.tipo !== 'video_360');
  const tecnicoFotos = imageFotos.filter((f: any) => TECNICO_FOTO_TIPOS.has(f.tipo));
  const outrasFotos = imageFotos.filter((f: any) => !TECNICO_FOTO_TIPOS.has(f.tipo));
  const temInfoTecnica = !!vistoriaTecnico && !!(
    vistoriaTecnico.avarias ||
    vistoriaTecnico.ressalvas ||
    vistoriaTecnico.observacoes ||
    vistoriaTecnico.observacoes_analise ||
    vistoriaTecnico.motivo_reprovacao ||
    vistoriaTecnico.km_atual ||
    vistoriaTecnico.quilometragem ||
    vistoriaTecnico.tecnico_nome
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Análise de Instalação
          </h1>
          <p className="text-sm text-muted-foreground">
            Revisar dados antes de ativar a Proteção 360
          </p>
        </div>
      </div>

      {/* Bypass aplicado (Troca de Titularidade fora da janela / convertida) — DESTAQUE */}
      <BypassAplicadoBanner bypassAplicado={(data as any)?.bypassAplicado} destaque />

      {/* Dados do Associado */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-primary" />
            Associado
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground text-xs">Nome</span>
            <p className="font-medium text-foreground">{associado?.nome || '---'}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">CPF</span>
            <p className="font-medium text-foreground">{associado?.cpf || '---'}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Telefone</span>
            <p className="font-medium text-foreground">{associado?.telefone || associado?.whatsapp || '---'}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Status</span>
            <Badge variant="outline" className="text-xs">{associado?.status || '---'}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Dados do Veículo */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Car className="h-4 w-4 text-primary" />
            Veículo
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground text-xs">Placa</span>
            <p className="font-mono font-bold text-foreground">{veiculo?.placa || '---'}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Chassi</span>
            <p className="font-mono font-medium text-foreground break-all">{veiculo?.chassi || '---'}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Veículo</span>
            <p className="font-medium text-foreground">{veiculo?.marca} {veiculo?.modelo}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Ano</span>
            <p className="font-medium text-foreground">{veiculo?.ano_modelo || '---'}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">
              {servico.tipo === 'vistoria_entrada' && !profissional?.nome ? 'Modalidade' : 'Instalador'}
            </span>
            <p className="font-medium text-foreground">
              {profissional?.nome
                ? profissional.nome
                : servico.tipo === 'vistoria_entrada'
                  ? (servico.modalidade === 'autovistoria' ? 'Autovistoria (sem instalação)' : 'Vistoria sem instalação')
                  : '---'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Endereços (Cadastral x Instalação) */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4 text-primary" />
            Endereços
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="rounded-lg border border-border/60 p-3 bg-muted/20">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Endereço cadastral
            </p>
            {enderecoCadastral?.logradouro ? (
              <>
                <p className="font-medium text-foreground">
                  {enderecoCadastral.logradouro}
                  {enderecoCadastral.numero && `, ${enderecoCadastral.numero}`}
                  {enderecoCadastral.complemento && ` — ${enderecoCadastral.complemento}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {enderecoCadastral.bairro}
                  {enderecoCadastral.cidade && ` · ${enderecoCadastral.cidade}`}
                  {enderecoCadastral.uf && `/${enderecoCadastral.uf}`}
                  {enderecoCadastral.cep && ` · CEP ${enderecoCadastral.cep}`}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground italic">Não informado</p>
            )}
          </div>
          {(() => {
            const endereco = isAtendimentoBase ? enderecoBase : enderecoInstalacao;
            const titulo = isAtendimentoBase ? 'Local da Vistoria/Instalação' : 'Endereço de instalação';
            return (
              <div className="rounded-lg border border-primary/30 p-3 bg-primary/5">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                    {titulo}
                  </p>
                  {isAtendimentoBase && (
                    <Badge variant="secondary" className="text-[10px] uppercase">
                      Atendimento na Base
                    </Badge>
                  )}
                </div>
                {endereco?.logradouro ? (
                  <>
                    <p className="font-medium text-foreground">
                      {isAtendimentoBase && 'Pratic Sede — '}
                      {endereco.logradouro}
                      {endereco.numero && `, ${endereco.numero}`}
                      {endereco.complemento && !isAtendimentoBase && ` — ${endereco.complemento}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {endereco.bairro}
                      {endereco.cidade && ` · ${endereco.cidade}`}
                      {endereco.uf && `/${endereco.uf}`}
                      {endereco.cep && ` · CEP ${endereco.cep}`}
                    </p>
                    {(endereco.data_agendada || endereco.periodo || endereco.hora_agendada) && (
                      <p className="text-xs text-foreground/80 mt-1">
                        {endereco.data_agendada && endereco.data_agendada.split('-').reverse().join('/')}
                        {(endereco.periodo || endereco.hora_agendada) && ` · ${endereco.periodo || endereco.hora_agendada}`}
                      </p>
                    )}
                  </>
                ) : isAtendimentoBase ? (
                  <p className="font-medium text-foreground">Pratic Sede — atendimento na Base</p>
                ) : (
                  <p className="text-muted-foreground italic">Sem instalação vinculada</p>
                )}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Rastreador */}
      {rastreador && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Cpu className="h-4 w-4 text-primary" />
              Rastreador Instalado
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">IMEI</span>
              <p className="font-mono font-medium text-foreground">{rastreador.imei || '---'}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Código</span>
              <p className="font-medium text-foreground">{rastreador.codigo || '---'}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Plataforma</span>
              <Badge variant="outline" className="text-xs">{rastreador.plataforma || '---'}</Badge>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Local Instalação</span>
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3 text-muted-foreground" />
                <p className="font-medium text-foreground">{rastreador.local_instalacao || 'Não informado'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vincular rastreador existente — Monitoramento decide se há rastreador físico
          no veículo cujo vínculo lógico foi perdido (ex.: troca/sub-FIPE diesel).
          Ver `mem://logic/operations/vincular-rastreador-existente-monitoramento`. */}
      {veiculo?.id && associado?.id && (
        <VincularRastreadorExistenteCard
          veiculoId={veiculo.id}
          associadoId={associado.id}
          associadoEmail={associado.email}
          exigeRastreador={exigeInstalacaoTecnica(veiculo) && !rastreador}
          jaTemRastreador={!!rastreador}
          origemContexto="aprovacao_associados"
          origemRefId={servico?.id}
          onVinculado={() => {
            qc.invalidateQueries({ queryKey: ['servico-detalhe-aprovacao', servico?.id] });
          }}
        />
      )}

      {/* Vistoria do Técnico — informações textuais preenchidas em campo */}
      {temInfoTecnica && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              Vistoria do Técnico
              {vistoriaTecnico?.modalidade && (
                <Badge variant="outline" className="text-[10px] uppercase">
                  {vistoriaTecnico.modalidade}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(vistoriaTecnico?.km_atual || vistoriaTecnico?.quilometragem) && (
                <div>
                  <span className="text-muted-foreground text-xs">Quilometragem</span>
                  <p className="font-medium text-foreground">
                    {(vistoriaTecnico.km_atual || vistoriaTecnico.quilometragem).toLocaleString('pt-BR')} km
                  </p>
                </div>
              )}
              {vistoriaTecnico?.tecnico_nome && (
                <div>
                  <span className="text-muted-foreground text-xs">Técnico</span>
                  <p className="font-medium text-foreground">{vistoriaTecnico.tecnico_nome}</p>
                </div>
              )}
              {vistoriaTecnico?.concluida_em && (
                <div>
                  <span className="text-muted-foreground text-xs">Concluída em</span>
                  <p className="font-medium text-foreground">
                    {new Date(vistoriaTecnico.concluida_em).toLocaleString('pt-BR')}
                  </p>
                </div>
              )}
              {vistoriaTecnico?.status && (
                <div>
                  <span className="text-muted-foreground text-xs">Status</span>
                  <p className="font-medium text-foreground capitalize">{String(vistoriaTecnico.status).replace(/_/g, ' ')}</p>
                </div>
              )}
            </div>

            {vistoriaTecnico?.avarias && (
              <div className="rounded-lg border border-border/60 p-3 bg-muted/20">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Avarias</p>
                <p className="text-foreground whitespace-pre-wrap">{vistoriaTecnico.avarias}</p>
              </div>
            )}
            {vistoriaTecnico?.ressalvas && (
              <div className="rounded-lg border border-warning/30 p-3 bg-warning/5">
                <p className="text-xs font-semibold text-warning uppercase tracking-wide mb-1">Ressalvas</p>
                <p className="text-foreground whitespace-pre-wrap">{vistoriaTecnico.ressalvas}</p>
              </div>
            )}
            {vistoriaTecnico?.observacoes && (
              <div className="rounded-lg border border-border/60 p-3 bg-muted/20">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Observações do técnico</p>
                <p className="text-foreground whitespace-pre-wrap">{vistoriaTecnico.observacoes}</p>
              </div>
            )}
            {vistoriaTecnico?.observacoes_analise && (
              <div className="rounded-lg border border-border/60 p-3 bg-muted/20">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Observações da análise</p>
                <p className="text-foreground whitespace-pre-wrap">{vistoriaTecnico.observacoes_analise}</p>
              </div>
            )}
            {vistoriaTecnico?.motivo_reprovacao && (
              <div className="rounded-lg border border-destructive/30 p-3 bg-destructive/5">
                <p className="text-xs font-semibold text-destructive uppercase tracking-wide mb-1">Motivo de reprovação</p>
                <p className="text-foreground whitespace-pre-wrap">{vistoriaTecnico.motivo_reprovacao}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Fotos da Vistoria Técnica — local do rastreador, avarias, mecânica */}
      {tecnicoFotos.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Camera className="h-4 w-4 text-primary" />
              Fotos da Vistoria Técnica ({tecnicoFotos.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              const grupos: Array<{ titulo: string; tipos: string[] }> = [
                { titulo: 'Rastreador', tipos: ['local_rastreador', 'codigo_rastreador', 'teste_comunicacao'] },
                { titulo: 'Avarias / Ressalvas', tipos: ['avarias'] },
                { titulo: 'Mecânica', tipos: ['motor', 'motor_chassi', 'motor_direito', 'motor_esquerdo', 'painel_km', 'painel_odometro_ligado', 'painel_completo', 'bateria', 'bateria_validade'] },
                { titulo: 'Outros', tipos: ['vistoriador_selfie', 'chave', 'chave_roda_macaco', 'farol'] },
              ];
              const usados = new Set<string>();
              return grupos.map((g) => {
                const fotosGrupo = tecnicoFotos.filter((f: any) => g.tipos.includes(f.tipo));
                fotosGrupo.forEach((f: any) => usados.add(f.id));
                if (fotosGrupo.length === 0) return null;
                return (
                  <div key={g.titulo}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      {g.titulo} ({fotosGrupo.length})
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {fotosGrupo.map((foto: any) => (
                        <div
                          key={foto.id}
                          className="group relative aspect-square rounded-xl overflow-hidden border border-border cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                          onClick={() => setSelectedImage(foto.arquivo_url)}
                        >
                          <img
                            src={foto.arquivo_url}
                            alt={fotoLabels[foto.tipo] || foto.tipo}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                            <span className="text-white text-[10px] font-medium">
                              {fotoLabels[foto.tipo] || foto.tipo}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              });
            })()}
          </CardContent>
        </Card>
      )}




      {/* Documentação do Associado */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" />
            Documentação do Associado ({documentos.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {documentos.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
              <AlertTriangle className="h-4 w-4" />
              <span>Nenhum documento enviado pelo associado</span>
            </div>
          ) : (
            <>
              {documentos.some((d: any) => d.status === 'pendente' || d.status === 'reprovado') && (
                <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>
                    Existem documentos{' '}
                    {documentos.filter((d: any) => d.status === 'pendente').length > 0 && 'pendentes'}
                    {documentos.filter((d: any) => d.status === 'pendente').length > 0 && documentos.filter((d: any) => d.status === 'reprovado').length > 0 && ' e '}
                    {documentos.filter((d: any) => d.status === 'reprovado').length > 0 && 'reprovados'}
                    {' '}que precisam de atenção.
                  </span>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {documentos.map((doc: any) => {
                  const isImage = doc.arquivo_url?.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i);
                  const tipoLabel: Record<string, string> = {
                    cnh: 'CNH',
                    crlv: 'CRLV',
                    comprovante_residencia: 'Comprovante Residência',
                    selfie_documento: 'Selfie c/ Documento',
                    contrato_assinado: 'Contrato Assinado',
                    laudo_vistoria: 'Laudo Vistoria',
                    foto_veiculo_frente: 'Frente Veículo',
                    foto_veiculo_traseira: 'Traseira Veículo',
                    foto_veiculo_lateral_esquerda: 'Lateral Esquerda',
                    foto_veiculo_lateral_direita: 'Lateral Direita',
                    foto_hodometro: 'Hodômetro',
                    foto_chassi: 'Chassi',
                  };
                  const statusConfig: Record<string, { class: string; label: string }> = {
                    aprovado: { class: 'bg-success/15 text-success border-success/30', label: 'Aprovado' },
                    pendente: { class: 'bg-warning/15 text-warning border-warning/30', label: 'Pendente' },
                    em_analise: { class: 'bg-primary/15 text-primary border-primary/30', label: 'Em análise' },
                    reprovado: { class: 'bg-destructive/15 text-destructive border-destructive/30', label: 'Reprovado' },
                  };
                  const st = statusConfig[doc.status] || statusConfig.pendente;

                  return (
                    <div
                      key={doc.id}
                      className="group relative rounded-xl overflow-hidden border border-border hover:ring-2 hover:ring-primary/50 transition-all cursor-pointer"
                      onClick={() => {
                        if (isImage) {
                          setSelectedImage(doc.arquivo_url);
                        } else {
                          window.open(doc.arquivo_url, '_blank');
                        }
                      }}
                    >
                      <div className="aspect-square bg-muted/30 flex items-center justify-center">
                        {isImage ? (
                          <img
                            src={doc.arquivo_url}
                            alt={tipoLabel[doc.tipo] || doc.tipo}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <FileText className="h-8 w-8" />
                            <ExternalLink className="h-3 w-3" />
                          </div>
                        )}
                      </div>
                      <div className="p-2 space-y-1">
                        <p className="text-[11px] font-medium text-foreground truncate">
                          {tipoLabel[doc.tipo] || doc.tipo || 'Documento'}
                        </p>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${st.class}`}>
                          {st.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Checklist */}
      {checklist.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              Checklist ({checklist.filter((c: any) => c.concluido).length}/{checklist.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {checklist.map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 text-sm p-2 rounded-lg bg-muted/30"
                >
                  {item.concluido ? (
                    <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                  )}
                  <span className="text-foreground">{item.descricao}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fotos do Veículo (gerais — exclui as fotos já exibidas no card técnico) */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="h-4 w-4 text-primary" />
            Fotos do Veículo ({outrasFotos.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {outrasFotos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma foto disponível</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {outrasFotos.map((foto: any) => (
                <div
                  key={foto.id}
                  className="group relative aspect-square rounded-xl overflow-hidden border border-border cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                  onClick={() => setSelectedImage(foto.arquivo_url)}
                >
                  <img
                    src={foto.arquivo_url}
                    alt={fotoLabels[foto.tipo] || foto.tipo}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                    <span className="text-white text-[10px] font-medium">
                      {fotoLabels[foto.tipo] || foto.tipo}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>


      {/* Vídeos 360° */}
      {(videoInstalador || videoAssociado) && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Video className="h-4 w-4 text-purple-500" />
              Vídeos 360°
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {videoInstalador && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs">
                      Instalador
                    </Badge>
                  </div>
                  <div
                    className="relative rounded-lg overflow-hidden border border-border cursor-pointer group"
                    onClick={() => setVideoExpandido(videoInstalador)}
                  >
                    <video
                      src={videoInstalador}
                      className="w-full aspect-video object-contain bg-black pointer-events-none"
                      preload="metadata"
                      muted
                      playsInline
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                      <Expand className="w-8 h-8 text-white" />
                    </div>
                  </div>
                </div>
              )}
              {videoAssociado && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/30 text-xs">
                      Associado
                    </Badge>
                  </div>
                  <div
                    className="relative rounded-lg overflow-hidden border border-border cursor-pointer group"
                    onClick={() => setVideoExpandido(videoAssociado)}
                  >
                    <video
                      src={videoAssociado}
                      className="w-full aspect-video object-contain bg-black pointer-events-none"
                      preload="metadata"
                      muted
                      playsInline
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                      <Expand className="w-8 h-8 text-white" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Observações de aprovação */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Observações (opcional)</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Observações sobre a análise..."
            value={observacoesAprovacao}
            onChange={(e) => setObservacoesAprovacao(e.target.value)}
            className="bg-muted/30 border-border"
          />
        </CardContent>
      </Card>

      {/* Ações — máquina canônica de 4 sub-estados.
          Regra canônica: o último aceite é do Monitoramento. Aprovar reaparece
          sempre que o serviço já terminou positivamente em campo
          (concluida / aprovada / aprovada_ressalvas). Reprovar fica visível
          em TODOS os sub-estados como caminho de exceção. */}
      {(() => {
        const subFipe = veiculoSubFipe(veiculo || {});
        const exigeTecnica = exigeInstalacaoTecnica(veiculo || {});
        const isMoto = ((veiculo?.categoria || '') as string).toLowerCase().includes('moto');

        const terminouEmCampo = servicoConcluidoEmCampo(servico);
        const temRastreador = !!rastreador;
        // cadastroAprovado já vem do hook (data.cadastroAprovado)
        const isAutovistoria = (vistoriaModalidade || '').toLowerCase() === 'autovistoria';

        // Sub-estados (ordem de precedência):
        // B) AGUARDA_INSTALACAO_TECNICA — autovistoria opcional sem rastreador
        //    e cadastro ainda não aprovou R&F → caminho é devolver ao Cadastro
        // C) FALTA_RASTREADOR_FISICO     — terminou em campo mas falta rastreador
        // D) SERVICO_NAO_CONCLUIDO       — não terminou em campo ainda
        // A) PRONTO_PARA_ACEITE_FINAL    — tudo pronto, Monitoramento dá o último aceite
        type SubEstado =
          | 'PRONTO_PARA_ACEITE_FINAL'
          | 'AGUARDA_INSTALACAO_TECNICA'
          | 'FALTA_RASTREADOR_FISICO'
          | 'SERVICO_NAO_CONCLUIDO';

        let subEstado: SubEstado;
        let banner: { tone: 'amber' | 'red' | 'slate'; titulo: string; texto: string } | null = null;

        if (isAutovistoria && exigeTecnica && !temRastreador && !cadastroAprovado) {
          subEstado = 'AGUARDA_INSTALACAO_TECNICA';
          banner = {
            tone: 'amber',
            titulo: 'Aprovação ainda não liberada',
            texto:
              'Esta autovistoria é opcional e libera apenas Roubo & Furto. A aprovação final só acontece após a instalação técnica do rastreador ser concluída pelo técnico em campo. Devolva ao Cadastro para liberar R&F enquanto a instalação segue agendada.',
          };
        } else if (terminouEmCampo && exigeTecnica && !temRastreador) {
          subEstado = 'FALTA_RASTREADOR_FISICO';
          banner = {
            tone: 'red',
            titulo: 'Rastreador obrigatório não vinculado',
            texto:
              'Veículo exige rastreador físico (Diesel / Carro FIPE ≥ R$ 30.000 / Moto FIPE ≥ R$ 9.000) e nenhum está vinculado. Solicite uma vistoria de técnico para instalar antes do aceite final.',
          };
        } else if (!terminouEmCampo) {
          subEstado = 'SERVICO_NAO_CONCLUIDO';
          banner = {
            tone: 'slate',
            titulo: 'Aguardando execução em campo',
            texto:
              'O serviço ainda não foi finalizado pelo técnico. Acompanhe a execução na fila de Serviços de Campo. Você pode reprovar como caminho de exceção, se necessário.',
          };
        } else {
          subEstado = 'PRONTO_PARA_ACEITE_FINAL';
        }

        // Telemetria canônica
        console.log('[AprovacaoInstalacao] sub-estado', {
          servicoId: servico.id,
          tipo: servico.tipo,
          status: servico.status,
          subEstado,
          exigeTecnica,
          temRastreador,
          cadastroAprovado,
          veiculoStatus: (veiculo as any)?.status,
          vistoriaModalidade,
        });

        const bannerClasses: Record<NonNullable<typeof banner>['tone'], string> = {
          amber: 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300',
          red: 'border-destructive/50 bg-destructive/10 text-destructive',
          slate: 'border-muted-foreground/30 bg-muted/40 text-muted-foreground',
        };
        const bannerIconClasses: Record<NonNullable<typeof banner>['tone'], string> = {
          amber: 'text-amber-500',
          red: 'text-destructive',
          slate: 'text-muted-foreground',
        };

        const mostrarAprovar = subEstado === 'PRONTO_PARA_ACEITE_FINAL';
        // Devolver ao Cadastro: caminho de exceção SEMPRE visível quando há
        // cadastro_aprovado=true (não há nada a devolver se já está false).
        // Cobre tanto o fluxo canônico de autovistoria opcional (AGUARDA_INSTALACAO_TECNICA)
        // quanto saneamentos de casos pré-correção que ficaram presos no aceite final.
        const mostrarDevolver = !!servico?.contrato_id && cadastroAprovado;
        const devolverEhPrimario = subEstado === 'AGUARDA_INSTALACAO_TECNICA';
        const mostrarSolicitarVistoria =
          subEstado === 'FALTA_RASTREADOR_FISICO' ||
          (subFipe && subEstado === 'PRONTO_PARA_ACEITE_FINAL');
        // Reprovar SEMPRE visível como caminho de exceção
        const mostrarReprovar = true;

        return (
          <>
            {banner && (
              <div className={`rounded-lg border p-4 flex gap-3 ${bannerClasses[banner.tone]}`}>
                <AlertTriangle className={`h-5 w-5 shrink-0 mt-0.5 ${bannerIconClasses[banner.tone]}`} />
                <div className="space-y-1">
                  <p className="text-sm font-semibold">{banner.titulo}</p>
                  <p className="text-xs leading-relaxed opacity-90">{banner.texto}</p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3 pb-2">
              {mostrarAprovar && (
                <Button
                  className="flex-1 min-w-[200px] bg-success hover:bg-success/90 text-success-foreground"
                  onClick={handleAprovar}
                  disabled={aprovar.isPending || reprovar.isPending}
                >
                  {aprovar.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Aprovar — Ativar Proteção 360
                </Button>
              )}

              {mostrarDevolver && (
                <Button
                  variant={devolverEhPrimario ? 'default' : 'outline'}
                  className={
                    devolverEhPrimario
                      ? 'flex-1 min-w-[220px] bg-amber-500 hover:bg-amber-500/90 text-white'
                      : 'flex-1 min-w-[180px] border-amber-500/60 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10'
                  }
                  onClick={() => setDevolverOpen(true)}
                  disabled={devolverCadastro.isPending}
                >
                  {devolverCadastro.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Undo2 className="h-4 w-4 mr-2" />
                  )}
                  {devolverEhPrimario ? 'Devolver ao Cadastro (aprovar R&F lá)' : 'Devolver ao Cadastro'}
                </Button>
              )}

              {mostrarSolicitarVistoria && (
                <Button
                  variant="outline"
                  className="flex-1 min-w-[200px] border-amber-500/60 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                  onClick={() => setSolicitarVistoriaOpen(true)}
                  disabled={aprovar.isPending || reprovar.isPending}
                >
                  <UserSearch className="h-4 w-4 mr-2" />
                  Solicitar Vistoria de Técnico
                </Button>
              )}


              {mostrarReprovar && (
                <Button
                  variant="destructive"
                  className="flex-1 min-w-[140px]"
                  onClick={() => setShowReprovar(true)}
                  disabled={aprovar.isPending || reprovar.isPending}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reprovar
                </Button>
              )}
            </div>

            {subFipe && subEstado === 'PRONTO_PARA_ACEITE_FINAL' && (
              <p className="text-xs text-muted-foreground pb-6">
                Veículo abaixo do limite FIPE — dispensa rastreador. Você pode aprovar direto, reprovar
                ou solicitar uma nova vistoria presencial pelo técnico (sem instalação,
                apenas {isMoto ? 15 : 31} fotos).
              </p>
            )}

            <SolicitarVistoriaTecnicoDialog
              open={solicitarVistoriaOpen}
              onOpenChange={setSolicitarVistoriaOpen}
              servicoId={servico.id}
              veiculoId={veiculo.id}
              associadoId={associado.id}
              isMoto={isMoto}
              cenarioPadrao={isAtendimentoBase ? 'base' : 'rota'}
              onSuccess={() => navigate('/monitoramento/aprovacao-associados')}
            />
          </>
        );
      })()}


      {/* Dialog Reprovar */}
      <Dialog open={showReprovar} onOpenChange={setShowReprovar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reprovar Instalação</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Motivo da reprovação..."
            value={motivoReprovar}
            onChange={(e) => setMotivoReprovar(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReprovar(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReprovar}
              disabled={!motivoReprovar.trim() || reprovar.isPending}
            >
              {reprovar.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirmar Reprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl p-1">
          {selectedImage && (
            <img src={selectedImage} alt="Foto ampliada" className="w-full h-auto rounded-lg" />
          )}
        </DialogContent>
      </Dialog>

      {/* Video Lightbox */}
      <Dialog open={!!videoExpandido} onOpenChange={() => setVideoExpandido(null)}>
        <DialogContent className="max-w-4xl p-1">
          {videoExpandido && (
            <video
              src={videoExpandido}
              controls
              autoPlay
              className="w-full aspect-video object-contain bg-black rounded-lg"
              playsInline
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Correção de dados faltantes — abre quando fn_validar_campos_ativacao bloqueia */}
      <CorrigirDadosVeiculoDialog
        open={corrigirOpen}
        onOpenChange={setCorrigirOpen}
        veiculoId={veiculo?.id}
        associadoId={associado?.id}
        camposFaltando={camposFaltando}
        onSaved={() => {
          // re-tenta aprovação automaticamente após correção
          tentarAprovar();
        }}
      />

      {/* Devolver ao Cadastro — usado pelo guard de aprovação prematura */}
      <ConfirmarDevolverCadastroDialog
        open={devolverOpen}
        onOpenChange={setDevolverOpen}
        isPending={devolverCadastro.isPending}
        onConfirm={(motivo) => {
          if (!servico?.contrato_id) {
            toast.error('Contrato não localizado para este serviço — recarregue a página.');
            return;
          }
          devolverCadastro.mutate(
            { contrato_id: servico.contrato_id, motivo },
            {
              onSuccess: () => {
                setDevolverOpen(false);
                navigate('/monitoramento/aprovacao-associados');
              },
            }
          );
        }}
      />

    </div>
  );
}
