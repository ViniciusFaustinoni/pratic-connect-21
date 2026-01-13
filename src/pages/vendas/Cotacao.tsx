import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { CotacaoStepper } from '@/components/cotacao/CotacaoStepper';
import { EtapaConsultaFipe } from '@/components/cotacao/EtapaConsultaFipe';
import { EtapaCategoriaVeiculo } from '@/components/cotacao/EtapaCategoriaVeiculo';
import { EtapaDadosVeiculo } from '@/components/cotacao/EtapaDadosVeiculo';
import { EtapaResultado } from '@/components/cotacao/EtapaResultado';
import { usePlanosOficiais, type PlanoOficial } from '@/hooks/usePlanosOficiais';
import { useCreateCotacao } from '@/hooks/useCotacoes';
import { useAuth } from '@/contexts/AuthContext';

// ============================================
// INTERFACES
// ============================================

// Interface para dados vindos do lead
interface LeadState {
  leadId?: string;
  placa?: string;
  marca?: string;
  modelo?: string;
  ano?: string;
  valorFipe?: number;
  nome?: string;
}

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
  const location = useLocation();
  const { user } = useAuth();
  const createCotacao = useCreateCotacao();
  
  // Dados vindos de navegação (lead, etc.)
  const leadState = location.state as LeadState | null;
  
  // Estado da etapa atual
  const [etapaAtual, setEtapaAtual] = useState(1);
  const [etapasCompletas, setEtapasCompletas] = useState<number[]>([]);
  const [leadId, setLeadId] = useState<string | null>(leadState?.leadId || null);
  const [isSaving, setIsSaving] = useState(false);
  const [cotacaoSalva, setCotacaoSalva] = useState<{ id: string; numero: string } | null>(null);

  // Etapa 1 - Consulta FIPE
  const [placa, setPlaca] = useState(leadState?.placa || '');
  const [veiculoEncontrado, setVeiculoEncontrado] = useState<VeiculoEncontrado | null>(null);
  const [modoEntrada, setModoEntrada] = useState<'fipe' | 'manual'>('fipe');

  // Etapa 2 - Categoria
  const [categoria, setCategoria] = useState<string | null>(null);
  const [usoApp, setUsoApp] = useState(false);

  // Etapa 3 - Dados do Veículo
  const [marca, setMarca] = useState(leadState?.marca || '');
  const [modelo, setModelo] = useState(leadState?.modelo || '');
  const [ano, setAno] = useState(leadState?.ano || '');
  const [valorFipe, setValorFipe] = useState<number | null>(leadState?.valorFipe || null);
  const [combustivel, setCombustivel] = useState('');
  const [regiao, setRegiao] = useState('');
  
  // Etapa 4 - Resultado
  const [isCalculando, setIsCalculando] = useState(false);
  const [planoSelecionado, setPlanoSelecionado] = useState<PlanoOficial | null>(null);

  // Hook de planos oficiais - calcula automaticamente baseado nos parâmetros
  const { planos: planosOficiais, isLoading: isLoadingPlanos } = usePlanosOficiais({
    valorFipe: valorFipe || 0,
    regiao: regiao || 'rio_de_janeiro',
    combustivel: combustivel || 'gasolina',
    categoria: categoria || 'passeio',
    anoVeiculo: ano ? parseInt(ano) : undefined,
    tipoVeiculo: 'carro',
  });
  
  // Pré-preencher dados se vier de um lead
  useEffect(() => {
    if (leadState?.placa && !veiculoEncontrado) {
      // Se tem dados do lead, pode pular para etapa de categoria ou dados
      if (leadState.marca && leadState.modelo && leadState.ano) {
        setVeiculoEncontrado({
          placa: leadState.placa,
          marca: leadState.marca,
          modelo: leadState.modelo,
          ano: leadState.ano,
          valorFipe: leadState.valorFipe,
        });
      }
    }
  }, [leadState]);

  // ============================================
  // HANDLERS DE NAVEGAÇÃO
  // ============================================

  const marcarEtapaCompleta = useCallback((etapa: number) => {
    setEtapasCompletas(prev => 
      prev.includes(etapa) ? prev : [...prev, etapa]
    );
  }, []);

  // Etapa 1 -> 2
  const handleEtapa1Next = useCallback(() => {
    if (veiculoEncontrado) {
      // Preencher dados do veículo a partir da consulta FIPE
      setMarca(veiculoEncontrado.marca);
      setModelo(veiculoEncontrado.modelo);
      setAno(veiculoEncontrado.ano);
      setValorFipe(veiculoEncontrado.valorFipe || null);
      setModoEntrada('fipe');
    }
    marcarEtapaCompleta(1);
    setEtapaAtual(2);
  }, [veiculoEncontrado, marcarEtapaCompleta]);

  // Etapa 1 -> 3 (entrada manual)
  const handleEntradaManual = useCallback(() => {
    setModoEntrada('manual');
    setVeiculoEncontrado(null);
    marcarEtapaCompleta(1);
    marcarEtapaCompleta(2); // Pula categoria também se entrar manual
    setEtapaAtual(3);
  }, [marcarEtapaCompleta]);

  // Etapa 2 -> 3
  const handleEtapa2Next = useCallback(() => {
    marcarEtapaCompleta(2);
    setEtapaAtual(3);
  }, [marcarEtapaCompleta]);

  // Etapa 2 <- Voltar
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
    
    // Os planos são calculados automaticamente pelo hook usePlanosOficiais
    // Apenas precisamos avançar para a próxima etapa
    
    toast.success('Cotação calculada com sucesso!');
    setIsCalculando(false);
    marcarEtapaCompleta(3);
    setEtapaAtual(4);
  }, [marca, modelo, ano, valorFipe, marcarEtapaCompleta]);

  // Etapa 3 <- Voltar
  const handleEtapa3Back = useCallback(() => {
    if (modoEntrada === 'manual') {
      setEtapaAtual(1);
    } else {
      setEtapaAtual(2);
    }
  }, [modoEntrada]);

  // Nova Cotação (reset)
  const handleNovaCotacao = useCallback(() => {
    setEtapaAtual(1);
    setEtapasCompletas([]);
    setPlaca('');
    setVeiculoEncontrado(null);
    setModoEntrada('fipe');
    setCategoria(null);
    setUsoApp(false);
    setMarca('');
    setModelo('');
    setAno('');
    setValorFipe(null);
    setCombustivel('');
    setRegiao('');
    setPlanoSelecionado(null);
    setLeadId(null);
    setCotacaoSalva(null);
  }, []);

  // Gerar PDF
  const handleGerarPDF = useCallback(() => {
    toast.info('Funcionalidade de PDF em desenvolvimento');
  }, []);

  // Salvar cotação no banco de dados
  const handleSalvarCotacao = useCallback(async () => {
    if (!planoSelecionado) {
      toast.error('Selecione um plano primeiro');
      return null;
    }

    setIsSaving(true);
    
    try {
      // Calcular valor da cota (geralmente um percentual do valor FIPE)
      const valorFipeCalc = valorFipe || 0;
      const valorCota = Math.round(valorFipeCalc * 0.01); // 1% do FIPE como exemplo
      
      const cotacaoData = {
        lead_id: leadId || undefined,
        vendedor_id: user?.id || undefined,
        plano_id: planoSelecionado.idReal || planoSelecionado.id,
        status: 'rascunho' as const,
        veiculo_placa: veiculoEncontrado?.placa || placa || undefined,
        veiculo_marca: marca || undefined,
        veiculo_modelo: modelo || undefined,
        veiculo_ano: ano ? parseInt(ano) : undefined,
        valor_fipe: valorFipeCalc,
        valor_adesao: planoSelecionado.valorAdesao || 0,
        valor_cota: valorCota,
        valor_rastreamento: (planoSelecionado as any).valorRastreamento || 0,
        valor_total_mensal: planoSelecionado.valorMensal || 0,
        regiao: regiao || undefined,
        categoria: categoria || undefined,
        uso_aplicativo: usoApp,
      };

      const result = await createCotacao.mutateAsync(cotacaoData);
      
      setCotacaoSalva({ id: result.id, numero: result.numero });
      toast.success('Cotação salva com sucesso!');
      
      return result;
    } catch (error) {
      console.error('Erro ao salvar cotação:', error);
      toast.error('Erro ao salvar cotação');
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [planoSelecionado, leadId, user?.id, veiculoEncontrado, placa, marca, modelo, ano, valorFipe, regiao, categoria, usoApp, createCotacao]);

  // Iniciar Cadastro - salva cotação e redireciona para contratos
  const handleIniciarCadastro = useCallback(async () => {
    if (!planoSelecionado) {
      toast.error('Selecione um plano primeiro');
      return;
    }
    
    // Se ainda não salvou, salvar primeiro
    let cotacao = cotacaoSalva;
    if (!cotacao) {
      const result = await handleSalvarCotacao();
      if (!result) return;
      cotacao = { id: result.id, numero: result.numero };
    }
    
    // Dados da cotação para pré-preencher o contrato
    const dadosCotacao = {
      cotacaoId: cotacao.id,
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
        valorAdesao: planoSelecionado.valorAdesao || 0,
        valorMensal: planoSelecionado.valorMensal || 0,
      },
      categoria: categoria,
      regiao: regiao,
      usoApp: usoApp,
      leadId: leadId,
    };
    
    toast.success('Redirecionando para cadastro de contrato...');
    navigate('/vendas/contratos', { state: { fromCotacao: true, dadosCotacao } });
  }, [planoSelecionado, cotacaoSalva, handleSalvarCotacao, navigate, veiculoEncontrado, placa, marca, modelo, ano, valorFipe, categoria, regiao, usoApp, leadId]);

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
        {etapaAtual === 1 && (
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
            onNext={handleEtapa1Next}
            onManualEntry={handleEntradaManual}
          />
        )}

        {etapaAtual === 2 && (
          <EtapaCategoriaVeiculo
            categoria={categoria}
            setCategoria={setCategoria}
            setUsoApp={setUsoApp}
            onBack={handleEtapa2Back}
            onNext={handleEtapa2Next}
          />
        )}

        {etapaAtual === 3 && (
          <EtapaDadosVeiculo
            veiculoFipe={veiculoEncontrado}
            modoEntrada={modoEntrada}
            marca={marca}
            setMarca={setMarca}
            modelo={modelo}
            setModelo={setModelo}
            ano={ano}
            setAno={setAno}
            valorFipe={valorFipe}
            setValorFipe={setValorFipe}
            combustivel={combustivel}
            setCombustivel={setCombustivel}
            regiao={regiao}
            setRegiao={setRegiao}
            onBack={handleEtapa3Back}
            onCalcular={handleCalcular}
            isCalculando={isCalculando}
          />
        )}

        {etapaAtual === 4 && (
          <EtapaResultado
            veiculoFipe={veiculoEncontrado}
            marca={marca}
            modelo={modelo}
            ano={ano}
            valorFipe={valorFipe}
            placa={placa}
            categoria={categoria}
            regiao={regiao}
            combustivel={combustivel}
            planos={planosOficiais}
            planoSelecionado={planoSelecionado}
            setPlanoSelecionado={setPlanoSelecionado}
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
