import { useState, useCallback, useMemo } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CotacaoStepper } from '@/components/cotacao/CotacaoStepper';
import { EtapaDadosAssociado } from '@/components/cotacao/EtapaDadosAssociado';
import { EtapaConsultaFipe } from '@/components/cotacao/EtapaConsultaFipe';
import { EtapaCriteriosCotacao } from '@/components/cotacao/EtapaCriteriosCotacao';
import { EtapaResultado } from '@/components/cotacao/EtapaResultado';
import { usePlanosCotacao, type PlanoCotacao, type PlanoNegadoInfo } from '@/hooks/usePlanosCotacao';
import { AlertaElegibilidadeNegada } from '@/components/cotacao/AlertaElegibilidadeNegada';
import { detectarTipoVeiculo } from '@/data/vistoriaConfigCompleta';

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
  const { isVendedorExterno } = usePermissions();
  
  // Estado da etapa atual
  const [etapaAtual, setEtapaAtual] = useState(1);
  const [etapasCompletas, setEtapasCompletas] = useState<number[]>([]);

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
  const [categoria, setCategoria] = useState(''); // Categoria/Deságio
  
  // ============================================
  // ETAPA 4 - RESULTADO
  // ============================================
  const [isCalculando, setIsCalculando] = useState(false);
  const [planosSelecionados, setPlanosSelecionados] = useState<PlanoCotacao[]>([]);
  const [valorAdesaoCustomizado, setValorAdesaoCustomizado] = useState<number | null>(null);

  // Handler para toggle de seleção de planos (sem limite de quantidade)
  const handleTogglePlano = useCallback((plano: PlanoCotacao) => {
    setPlanosSelecionados(prev => {
      const jaExiste = prev.some(p => p.id === plano.id);
      if (jaExiste) {
        const novos = prev.filter(p => p.id !== plano.id);
        // Se remover todos, limpa valor de adesão
        if (novos.length === 0) {
          setValorAdesaoCustomizado(null);
        }
        return novos;
      }
      // Se for o primeiro, define valor de adesão
      if (prev.length === 0) {
        setValorAdesaoCustomizado(plano.valorAdesao);
      }
      return [...prev, plano];
    });
  }, []);

  // Detectar tipo de veículo automaticamente
  const tipoVeiculoDetectado = useMemo(() => {
    if (!marca && !modelo) return 'carro' as const;
    const tipo = detectarTipoVeiculo(undefined, modelo, marca);
    return tipo === 'moto' ? 'moto' as const : 'carro' as const;
  }, [marca, modelo]);

  // Hook de planos - busca do banco de dados e calcula baseado nos parâmetros
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

  // Etapa 1 -> 2 (Dados Associado -> Veículo)
  const handleEtapa1Next = useCallback(() => {
    marcarEtapaCompleta(1);
    setEtapaAtual(2);
  }, [marcarEtapaCompleta]);

  // Etapa 2 -> 3 (Veículo -> Critérios)
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

  // Entrada manual na etapa 2 -> vai direto para etapa 3
  const handleEntradaManual = useCallback(() => {
    setModoEntrada('manual');
    setVeiculoEncontrado(null);
    marcarEtapaCompleta(2);
    setEtapaAtual(3);
  }, [marcarEtapaCompleta]);

  // Etapa 2 <- Voltar para Etapa 1
  const handleEtapa2Back = useCallback(() => {
    setEtapaAtual(1);
  }, []);

  // Etapa 3 -> 4 (Calcular)
  const handleCalcular = useCallback(async () => {
    setIsCalculando(true);
    
    // Se não tem valor FIPE, usar estimativa
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

  // Etapa 3 <- Voltar para Etapa 2
  const handleEtapa3Back = useCallback(() => {
    setEtapaAtual(2);
  }, []);

  // Nova Cotação (reset)
  const handleNovaCotacao = useCallback(() => {
    setEtapaAtual(1);
    setEtapasCompletas([]);
    // Reset Etapa 1
    setLeadId(null);
    setNomeAssociado('');
    setEmailAssociado('');
    setTelefone1('');
    setTelefone2('');
    setConsultorId('');
    setIsIndicacao(false);
    setIndicadorId('');
    setIndicadorNome('');
    // Reset Etapa 2
    setPlaca('');
    setVeiculoEncontrado(null);
    setModoEntrada('fipe');
    setMarca('');
    setModelo('');
    setAno('');
    setValorFipe(null);
    // Reset Etapa 3
    setRegiao('');
    setModalidade('passeio');
    setCombustivel('');
    setCategoria('');
    // Reset Etapa 4
    setPlanosSelecionados([]);
    setValorAdesaoCustomizado(null);
  }, []);

  // Gerar PDF
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

  // Iniciar Cadastro - redireciona para contratos com dados da cotação
  const handleIniciarCadastro = useCallback(() => {
    if (planosSelecionados.length === 0) {
      toast.error('Selecione pelo menos um plano');
      return;
    }
    
    // Usa o primeiro plano selecionado para o contrato
    const planoParaContrato = planosSelecionados[0];
    const valorAdesaoFinal = valorAdesaoCustomizado ?? planoParaContrato.valorAdesao ?? 0;
    if (valorAdesaoFinal <= 0 && !isVendedorExterno) {
      toast.error('A taxa de filiação deve ser maior que zero');
      return;
    }
    
    // Dados da cotação para pré-preencher o contrato
    const dadosCotacao = {
      associado: {
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
      indicacao: isIndicacao ? {
        indicador_id: indicadorId,
        indicador_nome: indicadorNome,
      } : null,
    };
    
    toast.success('Redirecionando para cadastro de contrato...');
    navigate('/vendas/contratos', { state: { fromCotacao: true, dadosCotacao } });
  }, [planosSelecionados, navigate, veiculoEncontrado, placa, marca, modelo, ano, valorFipe, nomeAssociado, emailAssociado, telefone1, telefone2, leadId, consultorId, regiao, modalidade, valorAdesaoCustomizado, isIndicacao, indicadorId, indicadorNome]);

  // Click no stepper
  const handleStepClick = useCallback((step: number) => {
    if (step < etapaAtual || etapasCompletas.includes(step)) {
      setEtapaAtual(step);
    }
  }, [etapaAtual, etapasCompletas]);

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="h-full flex flex-col space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Cotação</h1>
        <p className="text-muted-foreground">
          Calcule o valor da proteção veicular em 4 passos simples
        </p>
      </div>

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
            {/* Botão Voltar */}
            <div className="flex justify-start">
              <button
                onClick={handleEtapa2Back}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Voltar para Dados do Solicitante
              </button>
            </div>
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
            categoria={categoria}
            setCategoria={setCategoria}
            onBack={handleEtapa3Back}
            onCalcular={handleCalcular}
            isCalculando={isCalculando}
          />
        )}

        {/* ETAPA 4 - RESULTADO */}
        {etapaAtual === 4 && (
          <>
            {planosNegados.length > 0 && (
              <div className="mb-4">
                <AlertaElegibilidadeNegada
                  planosNegados={planosNegados.map(p => ({ ...p, solicitacaoStatus: null }))}
                  marca={marca}
                  modelo={modelo}
                  ano={parseInt(ano) || new Date().getFullYear()}
                  combustivel={combustivel || 'flex'}
                  placa={placa}
                />
              </div>
            )}
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
