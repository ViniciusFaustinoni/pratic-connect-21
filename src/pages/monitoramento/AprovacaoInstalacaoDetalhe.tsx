import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
} from 'lucide-react';
import {
  useAprovarInstalacaoMonitoramento,
  useReprovarInstalacaoMonitoramento,
} from '@/hooks/useAprovacaoMonitoramento';
import { veiculoSubFipe } from '@/hooks/useSolicitarVistoriaTecnico';
import { SolicitarVistoriaTecnicoDialog } from '@/components/monitoramento/SolicitarVistoriaTecnicoDialog';
import { CorrigirDadosVeiculoDialog } from '@/components/monitoramento/CorrigirDadosVeiculoDialog';

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
          veiculo:veiculo_id(id, placa, marca, modelo, ano_modelo, cor, valor_fipe, combustivel, cobertura_roubo_furto, cobertura_total),
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

      // Buscar fotos da instalação
      let fotos: any[] = [];
      if (servico.instalacao_origem_id) {
        const { data: fotosData } = await supabase
          .from('instalacao_fotos')
          .select('*')
          .eq('instalacao_id', servico.instalacao_origem_id)
          .order('created_at');
        fotos = fotosData || [];
      }

      // Buscar fotos de vistoria (via vistoria_origem_id ou instalacao)
      let vistoriaFotos: any[] = [];
      if (servico.vistoria_origem_id) {
        const { data: vfData } = await supabase
          .from('vistoria_fotos')
          .select('*')
          .eq('vistoria_id', servico.vistoria_origem_id)
          .order('created_at');
        vistoriaFotos = vfData || [];
      } else if (servico.instalacao_origem_id) {
        // Buscar vistoria vinculada à instalação
        const { data: vistoria } = await supabase
          .from('vistorias')
          .select('id')
          .eq('instalacao_id', servico.instalacao_origem_id)
          .maybeSingle();
        if (vistoria?.id) {
          const { data: vfData } = await supabase
            .from('vistoria_fotos')
            .select('*')
            .eq('vistoria_id', vistoria.id)
            .order('created_at');
          vistoriaFotos = vfData || [];
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
        let q = supabase.from('contratos_documentos').select('*');
        if (servico.cotacao_id) q = q.eq('cotacao_id', servico.cotacao_id);
        else q = q.eq('contrato_id', servico.contrato_id);
        const { data: cdData } = await q.order('created_at', { ascending: false });
        const extras = (cdData || []).map((d: any) => ({
          id: `cd-${d.id}`,
          tipo: d.tipo,
          status: d.status,
          arquivo_url: d.arquivo_url,
          created_at: d.created_at,
          origem_tabela: 'contratos_documentos',
        }));
        // Evitar duplicatas por (tipo + arquivo_url)
        const chave = (d: any) => `${d.tipo}|${d.arquivo_url}`;
        const existentes = new Set(documentos.map(chave));
        documentos = [...documentos, ...extras.filter((d) => !existentes.has(chave(d)))];
      }

      // Vídeo 360°: distinguir Instalador (presencial) x Associado (autovistoria)
      let videoInstalador: string | null = null;
      let videoAssociado: string | null = null;

      // Vistoria vinculada ao serviço — categorizar pela modalidade
      let vistoriaModalidade: string | null = null;
      if (servico.vistoria_origem_id) {
        const { data: vistoriaInst } = await supabase
          .from('vistorias')
          .select('video_360_url, modalidade')
          .eq('id', servico.vistoria_origem_id)
          .maybeSingle();
        const url = vistoriaInst?.video_360_url || null;
        vistoriaModalidade = vistoriaInst?.modalidade || null;
        if (vistoriaModalidade === 'autovistoria') {
          videoAssociado = url;
        } else {
          videoInstalador = url;
        }
      } else if (servico.instalacao_origem_id) {
        const { data: vistoriaInst } = await supabase
          .from('vistorias')
          .select('video_360_url')
          .eq('instalacao_id', servico.instalacao_origem_id)
          .maybeSingle();
        videoInstalador = vistoriaInst?.video_360_url || null;
      }

      // Buscar vídeo 360° do associado SOMENTE se ainda não carregado
      // (autovistoria não presencial do mesmo contrato — fluxo legacy)
      if (!videoAssociado && servico.contrato_id) {
        let autoVistoriaQuery = supabase
          .from('vistorias')
          .select('video_360_url')
          .eq('contrato_id', servico.contrato_id)
          .neq('modalidade', 'presencial');
        
        if (servico.vistoria_origem_id) {
          autoVistoriaQuery = autoVistoriaQuery.neq('id', servico.vistoria_origem_id);
        }

        const { data: autoVistoria } = await autoVistoriaQuery
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        videoAssociado = autoVistoria?.video_360_url || null;
      }

      // Fallback: buscar vídeo da autovistoria em cotacoes_vistoria_fotos
      if (!videoAssociado && servico.contrato_id) {
        const { data: contrato } = await supabase
          .from('contratos')
          .select('cotacao_id')
          .eq('id', servico.contrato_id)
          .maybeSingle();
        
        if (contrato?.cotacao_id) {
          const { data: fotoVideo } = await supabase
            .from('cotacoes_vistoria_fotos')
            .select('arquivo_url')
            .eq('cotacao_id', contrato.cotacao_id)
            .eq('tipo', 'video_360')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          videoAssociado = fotoVideo?.arquivo_url || null;
        }
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

      return {
        servico,
        fotos: [...fotos, ...vistoriaFotos],
        rastreador,
        checklist,
        documentos,
        videoInstalador,
        videoAssociado,
        enderecoInstalacao,
        enderecoCadastral,
        enderecoBase,
        isAtendimentoBase,
      };
    },
    enabled: !!servicoId,
    staleTime: 10_000,
    refetchOnMount: true,
  });
}

const fotoLabels: Record<string, string> = {
  frente_veiculo: 'Frente do Veículo',
  traseira_veiculo: 'Traseira do Veículo',
  placa_veiculo: 'Placa',
  local_rastreador: 'Local do Rastreador',
  hodometro: 'Hodômetro',
  lateral_esquerda: 'Lateral Esquerda',
  lateral_direita: 'Lateral Direita',
  avarias: 'Avarias',
  interior: 'Interior',
  assinatura_cliente: 'Assinatura do Cliente',
  video_360: 'Vídeo 360°',
};

export default function AprovacaoInstalacaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch, isFetching } = useServicoDetalheAprovacao(id);
  const aprovar = useAprovarInstalacaoMonitoramento();
  const reprovar = useReprovarInstalacaoMonitoramento();

  const [showReprovar, setShowReprovar] = useState(false);
  const [motivoReprovar, setMotivoReprovar] = useState('');
  const [observacoesAprovacao, setObservacoesAprovacao] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [videoExpandido, setVideoExpandido] = useState<string | null>(null);
  const [corrigirOpen, setCorrigirOpen] = useState(false);
  const [camposFaltando, setCamposFaltando] = useState<string[]>([]);
  const [solicitarVistoriaOpen, setSolicitarVistoriaOpen] = useState(false);

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

  const { servico, fotos, rastreador, checklist, documentos, videoInstalador, videoAssociado, enderecoInstalacao, enderecoCadastral, enderecoBase, isAtendimentoBase } = data as any;
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
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground text-xs">Placa</span>
            <p className="font-mono font-bold text-foreground">{veiculo?.placa || '---'}</p>
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

      {/* Fotos */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="h-4 w-4 text-primary" />
            Fotos da Instalação ({imageFotos.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {imageFotos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma foto disponível</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {imageFotos.map((foto: any) => (
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

      {/* Ações */}
      {(() => {
        const subFipe = veiculoSubFipe(veiculo || {});
        const isMoto = ((veiculo?.categoria || '') as string).toLowerCase().includes('moto');
        return (
          <>
            <div className="flex flex-wrap gap-3 pb-2">
              <Button
                variant="destructive"
                className="flex-1 min-w-[140px]"
                onClick={() => setShowReprovar(true)}
                disabled={aprovar.isPending || reprovar.isPending}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reprovar
              </Button>
              {subFipe && (
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
            </div>
            {subFipe && (
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
    </div>
  );
}
