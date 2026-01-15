import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CotacaoStepper } from '@/components/cotacao/CotacaoStepper';
import { EtapaDadosAssociado } from '@/components/cotacao/EtapaDadosAssociado';
import { EtapaConsultaFipe } from '@/components/cotacao/EtapaConsultaFipe';
import { EtapaCriteriosCotacao } from '@/components/cotacao/EtapaCriteriosCotacao';
import { EtapaResultado } from '@/components/cotacao/EtapaResultado';
import { usePlanosOficiais, type PlanoOficial } from '@/hooks/usePlanosOficiais';

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

const calcularFipeMock = (marca: string, _modelo: string, ano: number): number => {
  let valor = 30000;
  const ajusteMarca: Record<string, number> = {
    Toyota: 1.3, Honda: 1.25, Hyundai: 1.15, Volkswagen: 1.1, Chevrolet: 1.05,
    Fiat: 1.0, Renault: 0.95, Nissan: 1.1, Jeep: 1.4, Ford: 1.0, Outras: 1.0,
  };
  valor *= ajusteMarca[marca] || 1.0;
  const anoAtual = new Date().getFullYear();
  const idadeVeiculo = anoAtual - ano;
  valor *= Math.max(0.5, 1 - (idadeVeiculo * 0.07));
  return Math.round(valor / 100) * 100;
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function CotacaoPage() {
  const navigate = useNavigate();
  
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
  
  // ============================================
  // ETAPA 4 - RESULTADO
  // ============================================
  const [isCalculando, setIsCalculando] = useState(false);
  const [planoSelecionado, setPlanoSelecionado] = useState<PlanoOficial | null>(null);
  const [valorAdesaoCustomizado, setValorAdesaoCustomizado] = useState<number | null>(null);

  // Atualizar valor de adesão quando plano é selecionado
  const handleSelecionarPlano = useCallback((plano: PlanoOficial | null) => {
    setPlanoSelecionado(plano);
    if (plano) {
      setValorAdesaoCustomizado(plano.valorAdesao);
    } else {
      setValorAdesaoCustomizado(null);
    }
  }, []);

  // Hook de planos oficiais - calcula automaticamente baseado nos parâmetros
  const { planos: planosOficiais, isLoading: isLoadingPlanos } = usePlanosOficiais({
    valorFipe: valorFipe || 0,
    regiao: regiao || 'rio_de_janeiro',
    combustivel: combustivel || 'gasolina',
    categoria: modalidade === 'aplicativo' ? 'aplicativo' : 'passeio',
    anoVeiculo: ano ? parseInt(ano) : undefined,
    tipoVeiculo: 'carro',
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
    
    // Se não tem valor FIPE, calcular mock
    let fipeParaCalculo = valorFipe;
    if (!fipeParaCalculo && marca && modelo && ano) {
      fipeParaCalculo = calcularFipeMock(marca, modelo, parseInt(ano));
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
    // Reset Etapa 4
    setPlanoSelecionado(null);
    setValorAdesaoCustomizado(null);
  }, []);

  // Gerar PDF
  const handleGerarPDF = useCallback(() => {
    toast.info('Funcionalidade de PDF em desenvolvimento');
  }, []);

  // Iniciar Cadastro - redireciona para contratos com dados da cotação
  const handleIniciarCadastro = useCallback(() => {
    if (!planoSelecionado) {
      toast.error('Selecione um plano primeiro');
      return;
    }
    
    const valorAdesaoFinal = valorAdesaoCustomizado ?? planoSelecionado.valorAdesao ?? 0;
    if (valorAdesaoFinal <= 0) {
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
        id: planoSelecionado.idReal || planoSelecionado.id,
        nome: planoSelecionado.nome,
        valorAdesao: valorAdesaoFinal,
        valorMensal: planoSelecionado.valorMensal || 0,
      },
      lead_id: leadId,
      consultor_id: consultorId,
      regiao: regiao,
      modalidade: modalidade,
    };
    
    toast.success('Redirecionando para cadastro de contrato...');
    navigate('/vendas/contratos', { state: { fromCotacao: true, dadosCotacao } });
  }, [planoSelecionado, navigate, veiculoEncontrado, placa, marca, modelo, ano, valorFipe, nomeAssociado, emailAssociado, telefone1, telefone2, leadId, consultorId, regiao, modalidade, valorAdesaoCustomizado]);

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
            leadId={leadId}
            setLeadId={setLeadId}
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
            onBack={handleEtapa3Back}
            onCalcular={handleCalcular}
            isCalculando={isCalculando}
          />
        )}

        {/* ETAPA 4 - RESULTADO */}
        {etapaAtual === 4 && (
          <EtapaResultado
            veiculoFipe={veiculoEncontrado}
            marca={marca}
            modelo={modelo}
            ano={ano}
            valorFipe={valorFipe}
            placa={placa}
            categoria={modalidade}
            regiao={regiao}
            combustivel={combustivel}
            planos={planosOficiais}
            planoSelecionado={planoSelecionado}
            setPlanoSelecionado={handleSelecionarPlano}
            valorAdesao={valorAdesaoCustomizado}
            onValorAdesaoChange={setValorAdesaoCustomizado}
            onNovaCotacao={handleNovaCotacao}
            onGerarPDF={handleGerarPDF}
            onIniciarCadastro={handleIniciarCadastro}
            isLoading={isCalculando || isLoadingPlanos}
          />
        )}
      </div>
    </div>
  );
}
