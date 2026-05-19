/**
 * REGRA CANÔNICA — Escopo de análise do Cadastro
 * ================================================
 * Cadastro avalia EXCLUSIVAMENTE:
 *   1) DOCUMENTOS (sempre)
 *   2) AUTOVISTORIA ENXUTA acima da FIPE (opcional — 2 fotos motor+chassi +
 *      vídeo 360°) — único caso que libera Roubo/Furto antecipado.
 *
 * Cadastro NUNCA avalia fotos em:
 *   - Vistoria presencial técnica (base/rota/prestador/fit) → Monitoramento decide
 *   - Autovistoria COMPLETA sub-FIPE (31 carros / 15 motos) → Monitoramento decide
 *   - Troca de titularidade (vistoria dispensada na janela)
 *
 * Esta função é a FONTE ÚNICA da decisão. Qualquer tela do Cadastro que
 * precise saber o escopo da análise DEVE importar daqui — não duplicar lógica.
 *
 * Memória: mem://logic/operations/cadastro-escopo-canonico
 */

export interface PropostaParaEscopo {
  plano_tem_roubo_furto?: boolean | null;
  tipo_vistoria?: 'autovistoria' | 'agendada' | 'agendada_base' | null;
  vistoria?: {
    modalidade?: string | null;
    tipo?: string | null;
    fotos?: Array<unknown> | null;
    video_360_url?: string | null;
  } | null;
  vistoria_base_info?: {
    status?: string | null;
  } | null;
  instalacao_info?: {
    concluida_em?: string | null;
  } | null;
}

export interface EscopoAnaliseCadastro {
  /** É autovistoria (modalidade do cliente) e não há instalação concluída. */
  isAutovistoria: boolean;
  /** Há fotos e/ou vídeo 360° já enviados. */
  temFotosOuVideo: boolean;
  /** Autovistoria completa = roteiro sub-FIPE (≥ minFotos) OU 2 fotos + vídeo 360°. */
  autovistoriaCompleta: boolean;
  /** Sub-FIPE: autovistoria completa, fotos vão para Monitoramento. */
  isAutovistoriaCompletaSubFipe: boolean;
  /** Acima FIPE: autovistoria enxuta opcional — único caso que Cadastro avalia fotos. */
  isAutovistoriaEnxutaAcimaFipe: boolean;
  /** Vistoria presencial técnica (base/rota/cliente) → Monitoramento decide. */
  isVistoriaPresencialTecnica: boolean;
  /** Vistoria agendada presencial que ainda não foi executada (sem fotos). */
  isVistoriaAgendadaSemFotos: boolean;
  /** Cadastro avalia fotos? (true só na autovistoria enxuta acima FIPE com plano R/F). */
  cadastroAvaliaFotos: boolean;
  /** Cadastro aprova só documentos (não decide fotos)? */
  aprovarApenasDocumentos: boolean;
  /** Aprovação final é do Monitoramento (banner informativo na UI). */
  aguardandoMonitoramentoVistoria: boolean;
}

export interface OpcoesEscopo {
  /** True quando o veículo é moto (15 fotos no roteiro completo); default false (31). */
  isMoto?: boolean;
}

export function resolverEscopoAnaliseCadastro(
  proposta: PropostaParaEscopo | null | undefined,
  opcoes: OpcoesEscopo = {}
): EscopoAnaliseCadastro {
  const planoTemRouboFurto = !!proposta?.plano_tem_roubo_furto;

  // Autovistoria do cliente — invalidada por instalação concluída.
  const isAutovistoria =
    (proposta?.vistoria?.modalidade === 'autovistoria' ||
      proposta?.vistoria?.tipo === 'autovistoria') &&
    !proposta?.instalacao_info?.concluida_em;

  const totalFotos = proposta?.vistoria?.fotos?.length || 0;
  const temVideo360 = !!proposta?.vistoria?.video_360_url;
  const temFotosOuVideo = totalFotos > 0 || temVideo360;

  // Roteiro completo: 15 (moto) ou 31 (carro). Aceita enxuta canônica (2 + vídeo).
  const minFotosCompleta = opcoes.isMoto ? 15 : 31;
  const autovistoriaCompleta = isAutovistoria
    ? (totalFotos >= 2 && temVideo360) || totalFotos >= minFotosCompleta
    : true;

  // Sub-FIPE = completa (≥ minFotosCompleta). A enxuta (2 + vídeo) NÃO conta como sub-FIPE
  // porque sub-FIPE exige o roteiro completo. Sem o roteiro completo, é sempre enxuta.
  const isAutovistoriaCompletaSubFipe =
    isAutovistoria && totalFotos >= minFotosCompleta;

  const isAutovistoriaEnxutaAcimaFipe =
    isAutovistoria && !isAutovistoriaCompletaSubFipe && autovistoriaCompleta;

  // Vistoria presencial técnica (base/rota/cliente) — Monitoramento avalia.
  const isVistoriaPresencialTecnica =
    !isAutovistoria &&
    (proposta?.tipo_vistoria === 'agendada_base' ||
      proposta?.tipo_vistoria === 'agendada' ||
      (!!proposta?.vistoria && proposta?.vistoria?.modalidade !== 'autovistoria'));

  const isVistoriaAgendadaSemFotos =
    !isAutovistoria &&
    !temFotosOuVideo &&
    ((proposta?.tipo_vistoria === 'agendada_base' &&
      proposta?.vistoria_base_info?.status !== 'realizado') ||
      (proposta?.tipo_vistoria === 'agendada' &&
        proposta?.instalacao_info?.concluida_em == null));

  // ÚNICO caso em que Cadastro avalia fotos:
  // plano com R/F + autovistoria enxuta acima FIPE com mídia presente.
  const cadastroAvaliaFotos =
    planoTemRouboFurto &&
    temFotosOuVideo &&
    isAutovistoriaEnxutaAcimaFipe;

  const aprovarApenasDocumentos =
    !planoTemRouboFurto ||
    isVistoriaAgendadaSemFotos ||
    isVistoriaPresencialTecnica ||
    isAutovistoriaCompletaSubFipe;

  const aguardandoMonitoramentoVistoria =
    isVistoriaPresencialTecnica || isAutovistoriaCompletaSubFipe;

  return {
    isAutovistoria,
    temFotosOuVideo,
    autovistoriaCompleta,
    isAutovistoriaCompletaSubFipe,
    isAutovistoriaEnxutaAcimaFipe,
    isVistoriaPresencialTecnica,
    isVistoriaAgendadaSemFotos,
    cadastroAvaliaFotos,
    aprovarApenasDocumentos,
    aguardandoMonitoramentoVistoria,
  };
}
