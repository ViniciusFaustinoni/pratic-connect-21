import { useState, useCallback, useMemo, useEffect } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { CotacaoStepper } from '@/components/cotacao/CotacaoStepper';
import { EtapaDadosAssociado } from '@/components/cotacao/EtapaDadosAssociado';
import { EtapaConsultaFipe } from '@/components/cotacao/EtapaConsultaFipe';
import { EtapaCriteriosCotacao } from '@/components/cotacao/EtapaCriteriosCotacao';
import { EtapaResultado } from '@/components/cotacao/EtapaResultado';
import { usePlanosCotacao, type PlanoCotacao, type PlanoNegadoInfo } from '@/hooks/usePlanosCotacao';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeftRight } from 'lucide-react';

import { useDetectarTipoVeiculo } from '@/hooks/useDetectarTipoVeiculo';

// ============================================
// INTERFACES
// ============================================

interface VeiculoEncontrado {
  placa: string;
  marca: string;
  modelo: string;
  ano: string;
  cor?: string;
  combustivel?: string;
  codigoFipe?: string;
  valorFipe?: number;
}

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

// Função estimativa de FIPE — centralizada em src/utils/fipe.ts
import { estimarValorFipe } from '@/utils/fipe';

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function CotacaoPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isVendedorExterno } = usePermissions();
  
  // Detectar contexto de inclusão ou substituição
  const associadoIdParam = searchParams.get('associado_id');
  const tipoEntrada = searchParams.get('tipo_entrada');
  const isInclusaoVeiculo = tipoEntrada === 'inclusao' && !!associadoIdParam;
  const isSubstituicao = tipoEntrada === 'substituicao' && !!associadoIdParam;
  const skipEtapa1 = isInclusaoVeiculo || isSubstituicao;

  // Dados do veículo antigo (substituição)
  const veiculoAntigoId = searchParams.get('veiculo_antigo_id');
  const veiculoAntigoPlaca = searchParams.get('veiculo_antigo_placa') || '';
  const veiculoAntigoModelo = searchParams.get('veiculo_antigo_modelo') || '';
  
  // Estado da etapa atual
  const [etapaAtual, setEtapaAtual] = useState(skipEtapa1 ? 2 : 1);
  const [etapasCompletas, setEtapasCompletas] = useState<number[]>(skipEtapa1 ? [1] : []);
  const [inclusaoAssociadoNome, setInclusaoAssociadoNome] = useState('');

  // ============================================
  // ETAPA 1 - DADOS DO ASSOCIADO/SOLICITANTE
  // ============================================
  const [leadId, setLeadId] = useState<string | null>(null);
  const [nomeAssociado, setNomeAssociado] = useState('');
  const [emailAssociado, setEmailAssociado] = useState('');
  const [telefone1, setTelefone1] = useState('');
  const [telefone2, setTelefone2] = useState('');
  const [consultorId, setConsultorId] = useState('');
  
  // Indicação
  const [isIndicacao, setIsIndicacao] = useState(false);
  const [indicadorId, setIndicadorId] = useState('');
  const [indicadorNome, setIndicadorNome] = useState('');

  // Buscar dados do associado quando for inclusão ou substituição
  useEffect(() => {
    if (!skipEtapa1 || !associadoIdParam) return;
    const fetchAssociado = async () => {
      const { data } = await supabase
        .from('associados')
        .select('nome, email, telefone, whatsapp')
        .eq('id', associadoIdParam)
        .single();
      if (data) {
        setNomeAssociado(data.nome || '');
        setEmailAssociado(data.email || '');
        setTelefone1(data.telefone || '');
        setTelefone2(data.whatsapp || '');
        setInclusaoAssociadoNome(data.nome || '');
      }
    };
    fetchAssociado();
  }, [skipEtapa1, associadoIdParam]);

  // ============================================
  // ETAPA 2 - IDENTIFICAÇÃO DO VEÍCULO
  // ============================================
  const [placa, setPlaca] = useState('');
  const [veiculoEncontrado, setVeiculoEncontrado] = useState<VeiculoEncontrado | null>(null);
  const [modoEntrada, setModoEntrada] = useState<'fipe' | 'manual'>('fipe');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [ano, setAno] = useState('');
  const [valorFipe, setValorFipe] = useState<number | null>(null);

  // ============================================
  // ETAPA 3 - CRITÉRIOS DA COTAÇÃO
  // ============================================
  const [regiao, setRegiao] = useState('');
  const [modalidade, setModalidade] = useState<'passeio' | 'aplicativo'>('passeio');
  const [combustivel, setCombustivel] = useState('');
  const [categoria, setCategoria] = useState('');
  
  // ============================================
  // ETAPA 4 - RESULTADO
  // ============================================
  const [isCalculando, setIsCalculando] = useState(false);
  const [planosSelecionados, setPlanosSelecionados] = useState<PlanoCotacao[]>([]);
  const [valorAdesaoCustomizado, setValorAdesaoCustomizado] = useState<number | null>(null);

  const handleTogglePlano = useCallback((plano: PlanoCotacao) => {
    setPlanosSelecionados(prev => {
      const jaExiste = prev.some(p => p.id === plano.id);
      if (jaExiste) {
        const novos = prev.filter(p => p.id !== plano.id);
        if (novos.length === 0) setValorAdesaoCustomizado(null);
        return novos;
      }
      if (prev.length === 0) setValorAdesaoCustomizado(plano.valorAdesao);
      return [...prev, plano];
    });
  }, []);

  const { tipoVeiculo: tipoVeiculoDetectado } = useDetectarTipoVeiculo(marca, modelo);

  const { planos: planosCalculados, planosNegados, isLoading: isLoadingPlanos } = usePlanosCotacao({
    valorFipe: valorFipe || 0,
    regiao: regiao || 'rio_de_janeiro',
    combustivel: combustivel || 'gasolina',
    categoria: categoria || undefined,
    anoVeiculo: ano ? parseInt(ano) : undefined,
    tipoVeiculo: tipoVeiculoDetectado,
    usoApp: modalidade === 'aplicativo',
    marca: marca || undefined,
    modelo: modelo || undefined,
  });

  // ============================================
  // HANDLERS DE NAVEGAÇÃO
  // ============================================

  const marcarEtapaCompleta = useCallback((etapa: number) => {
    setEtapasCompletas(prev => 
      prev.includes(etapa) ? prev : [...prev, etapa]
    );
  }, []);

  const handleEtapa1Next = useCallback(() => {
    marcarEtapaCompleta(1);
    setEtapaAtual(2);
  }, [marcarEtapaCompleta]);

  const handleEtapa2Next = useCallback(() => {
    if (veiculoEncontrado) {
      setMarca(veiculoEncontrado.marca);
      setModelo(veiculoEncontrado.modelo);
      setAno(veiculoEncontrado.ano);
      setValorFipe(veiculoEncontrado.valorFipe || null);
      setModoEntrada('fipe');
    }
    marcarEtapaCompleta(2);
    setEtapaAtual(3);
  }, [veiculoEncontrado, marcarEtapaCompleta]);

  const handleEntradaManual = useCallback(() => {
    setModoEntrada('manual');
    setVeiculoEncontrado(null);
    marcarEtapaCompleta(2);
    setEtapaAtual(3);
  }, [marcarEtapaCompleta]);

  const handleEtapa2Back = useCallback(() => {
    setEtapaAtual(1);
  }, []);

  const handleCalcular = useCallback(async () => {
    setIsCalculando(true);
    let fipeParaCalculo = valorFipe;
    if (!fipeParaCalculo && marca && ano) {
      fipeParaCalculo = estimarValorFipe(marca, parseInt(ano));
      setValorFipe(fipeParaCalculo);
    }
    toast.success('Cotação calculada com sucesso!');
    setIsCalculando(false);
    marcarEtapaCompleta(3);
    setEtapaAtual(4);
  }, [marca, modelo, ano, valorFipe, marcarEtapaCompleta]);

  const handleEtapa3Back = useCallback(() => {
    setEtapaAtual(2);
  }, []);

  const handleNovaCotacao = useCallback(() => {
    setEtapaAtual(1);
    setEtapasCompletas([]);
    setLeadId(null);
    setNomeAssociado('');
    setEmailAssociado('');
    setTelefone1('');
    setTelefone2('');
    setConsultorId('');
    setIsIndicacao(false);
    setIndicadorId('');
    setIndicadorNome('');
    setPlaca('');
    setVeiculoEncontrado(null);
    setModoEntrada('fipe');
    setMarca('');
    setModelo('');
    setAno('');
    setValorFipe(null);
    setRegiao('');
    setModalidade('passeio');
    setCombustivel('');
    setCategoria('');
    setPlanosSelecionados([]);
    setValorAdesaoCustomizado(null);
  }, []);

  const handleGerarPDF = useCallback(async () => {
    if (planosSelecionados.length === 0) {
      toast.error('Selecione pelo menos um plano');
      return;
    }
    const { gerarPdfCotacaoComparativa } = await import('@/lib/gerarPdfCotacao');
    try {
      await gerarPdfCotacaoComparativa({
        numero: `COT-${Date.now()}`,
        created_at: new Date().toISOString(),
        validade_dias: 7,
        nome_solicitante: nomeAssociado,
        telefone1_solicitante: telefone1,
        email_solicitante: emailAssociado,
        veiculo_marca: marca,
        veiculo_modelo: modelo,
        veiculo_ano: ano ? parseInt(ano) : null,
        veiculo_placa: placa,
        valor_fipe: valorFipe,
        planosComparar: planosSelecionados.map(p => ({
          nome: p.nome,
          valorMensal: p.valorMensal,
          valorAdesao: p.valorAdesao,
          coberturas: p.coberturas,
          naoInclui: p.naoInclui,
          coberturaFipe: p.coberturaFipe,
          cota: p.cota,
        })),
      });
      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF');
    }
  }, [planosSelecionados, nomeAssociado, telefone1, emailAssociado, marca, modelo, ano, placa, valorFipe]);

  const handleIniciarCadastro = useCallback(() => {
    if (planosSelecionados.length === 0) {
      toast.error('Selecione pelo menos um plano');
      return;
    }
    const planoParaContrato = planosSelecionados[0];
    const valorAdesaoFinal = valorAdesaoCustomizado ?? planoParaContrato.valorAdesao ?? 0;
    if (valorAdesaoFinal <= 0 && !isVendedorExterno) {
      toast.error('A taxa de filiação deve ser maior que zero');
      return;
    }
    const dadosCotacao = {
      associado: {
        id: skipEtapa1 ? associadoIdParam : undefined,
        nome: nomeAssociado,
        email: emailAssociado,
        telefone: telefone1,
        telefone2: telefone2,
      },
      veiculo: {
        placa: veiculoEncontrado?.placa || placa,
        marca: marca,
        modelo: modelo,
        ano: ano,
        valorFipe: valorFipe,
      },
      plano: {
        id: planoParaContrato.id,
        nome: planoParaContrato.nome,
        valorAdesao: valorAdesaoFinal,
        valorMensal: planoParaContrato.valorMensal || 0,
      },
      lead_id: leadId,
      consultor_id: consultorId,
      regiao: regiao,
      modalidade: modalidade,
      tipo_entrada: isSubstituicao ? 'substituicao' : isInclusaoVeiculo ? 'inclusao' : undefined,
      // Dados extras para substituição
      ...(isSubstituicao && {
        veiculo_antigo_id: veiculoAntigoId,
        veiculo_antigo_placa: veiculoAntigoPlaca,
        veiculo_antigo_modelo: veiculoAntigoModelo,
      }),
      indicacao: isIndicacao ? {
        indicador_id: indicadorId,
        indicador_nome: indicadorNome,
      } : null,
    };
    toast.success('Redirecionando para cadastro de contrato...');
    navigate('/vendas/contratos', { state: { fromCotacao: true, dadosCotacao } });
  }, [planosSelecionados, navigate, veiculoEncontrado, placa, marca, modelo, ano, valorFipe, nomeAssociado, emailAssociado, telefone1, telefone2, leadId, consultorId, regiao, modalidade, valorAdesaoCustomizado, isIndicacao, indicadorId, indicadorNome, skipEtapa1, associadoIdParam, isSubstituicao, isInclusaoVeiculo, veiculoAntigoId, veiculoAntigoPlaca, veiculoAntigoModelo]);

  const handleStepClick = useCallback((step: number) => {
    if (step < etapaAtual || etapasCompletas.includes(step)) {
      setEtapaAtual(step);
    }
  }, [etapaAtual, etapasCompletas]);

  // ============================================
  // RENDER
  // ============================================

  const titulo = isSubstituicao ? 'Substituição de Placa' : isInclusaoVeiculo ? 'Inclusão de Veículo' : 'Cotação';
  const subtitulo = isSubstituicao 
    ? `Cotação do novo veículo para ${inclusaoAssociadoNome || 'associado'}`
    : isInclusaoVeiculo 
      ? `Adicionando novo veículo para ${inclusaoAssociadoNome || 'associado'}`
      : 'Calcule o valor da proteção veicular em 4 passos simples';

  return (
    <div className="h-full flex flex-col space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{titulo}</h1>
        <p className="text-muted-foreground">{subtitulo}</p>
      </div>

      {/* Banner de substituição */}
      {isSubstituicao && veiculoAntigoPlaca && (
        <Alert className="border-primary/30 bg-primary/5">
          <ArrowLeftRight className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <span className="font-medium">Veículo atual:</span>{' '}
            <span className="font-mono">{veiculoAntigoPlaca}</span>
            {veiculoAntigoModelo && ` — ${veiculoAntigoModelo}`}
            <span className="text-muted-foreground ml-2">→ Cotando novo veículo</span>
          </AlertDescription>
        </Alert>
      )}

      {/* Stepper */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-6">
        <CotacaoStepper
          currentStep={etapaAtual}
          completedSteps={etapasCompletas}
          onStepClick={handleStepClick}
        />
      </div>

      {/* Conteúdo da Etapa */}
      <div className="flex-1">
        {/* ETAPA 1 - DADOS DO ASSOCIADO */}
        {etapaAtual === 1 && (
          <EtapaDadosAssociado
            nome={nomeAssociado}
            setNome={setNomeAssociado}
            email={emailAssociado}
            setEmail={setEmailAssociado}
            telefone1={telefone1}
            setTelefone1={setTelefone1}
            telefone2={telefone2}
            setTelefone2={setTelefone2}
            consultorId={consultorId}
            setConsultorId={setConsultorId}
            isIndicacao={isIndicacao}
            setIsIndicacao={setIsIndicacao}
            indicadorId={indicadorId}
            setIndicadorId={setIndicadorId}
            indicadorNome={indicadorNome}
            setIndicadorNome={setIndicadorNome}
            onNext={handleEtapa1Next}
            onSubstituicao={(associadoId) => {
              navigate(`/vendas/substituicao/${associadoId}`);
            }}
          />
        )}

        {/* ETAPA 2 - IDENTIFICAÇÃO DO VEÍCULO */}
        {etapaAtual === 2 && (
          <div className="space-y-4">
            <EtapaConsultaFipe
              placa={placa}
              setPlaca={setPlaca}
              veiculoEncontrado={veiculoEncontrado}
              setVeiculoEncontrado={setVeiculoEncontrado}
              marca={marca}
              setMarca={setMarca}
              modelo={modelo}
              setModelo={setModelo}
              ano={ano}
              setAno={setAno}
              valorFipe={valorFipe}
              setValorFipe={setValorFipe}
              onNext={handleEtapa2Next}
              onManualEntry={handleEntradaManual}
            />
            {/* Botão Voltar - só mostra se não for inclusão/substituição */}
            {!skipEtapa1 && (
              <div className="flex justify-start">
                <button
                  onClick={handleEtapa2Back}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Voltar para Dados do Solicitante
                </button>
              </div>
            )}
          </div>
        )}

        {/* ETAPA 3 - CRITÉRIOS DA COTAÇÃO */}
        {etapaAtual === 3 && (
          <EtapaCriteriosCotacao
            regiao={regiao}
            setRegiao={setRegiao}
            modalidade={modalidade}
            setModalidade={setModalidade}
            combustivel={combustivel}
            setCombustivel={setCombustivel}
            onBack={handleEtapa3Back}
            onCalcular={handleCalcular}
            isCalculando={isCalculando}
          />
        )}

        {/* ETAPA 4 - RESULTADO */}
        {etapaAtual === 4 && (
          <>
            <EtapaResultado
            veiculoFipe={veiculoEncontrado}
            marca={marca}
            modelo={modelo}
            ano={ano}
            valorFipe={valorFipe}
            placa={placa}
            categoria={categoria || undefined}
            regiao={regiao}
            combustivel={combustivel}
            planos={planosCalculados}
            planosSelecionados={planosSelecionados}
            onTogglePlano={handleTogglePlano}
            valorAdesao={valorAdesaoCustomizado}
            onValorAdesaoChange={setValorAdesaoCustomizado}
            onNovaCotacao={handleNovaCotacao}
            onGerarPDF={handleGerarPDF}
            onIniciarCadastro={handleIniciarCadastro}
            isLoading={isCalculando || isLoadingPlanos}
            isCenarioIsento={isVendedorExterno}
            />
          </>
        )}
      </div>
    </div>
  );
}
