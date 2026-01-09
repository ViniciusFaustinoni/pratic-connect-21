import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CotacaoStepper } from '@/components/cotacao/CotacaoStepper';
import { EtapaConsultaFipe } from '@/components/cotacao/EtapaConsultaFipe';
import { EtapaCategoriaVeiculo } from '@/components/cotacao/EtapaCategoriaVeiculo';
import { EtapaDadosVeiculo } from '@/components/cotacao/EtapaDadosVeiculo';
import { EtapaResultado } from '@/components/cotacao/EtapaResultado';
import { useCalcularCotacao } from '@/hooks/useCalcularCotacao';
import { TipoUsoVeiculo, PlanoCalculado as PlanoCalculadoAPI, COBERTURAS_POR_PLANO } from '@/types/cotacaoPublica';

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

interface PlanoCalculado {
  id: string;
  idReal: string;
  codigo: string;
  nome: string;
  descricao: string;
  coberturas: string[];
  naoInclui: string[];
  valorAdesao: number;
  valorMensal: number;
  destaque: boolean;
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

// Mapeia os planos da API para o formato da interface
const mapearPlanosAPI = (planosAPI: PlanoCalculadoAPI[]): PlanoCalculado[] => {
  const descricoes: Record<string, string> = {
    'Básico': 'Proteção essencial para seu veículo',
    'Completo': 'O mais vendido - melhor custo-benefício',
    'Premium': 'Proteção máxima com todos os benefícios',
  };

  const naoIncluiMap: Record<string, string[]> = {
    'Básico': ['Vidros laterais', 'Carro reserva', 'APP Invalidez'],
    'Completo': ['APP Invalidez', 'Danos Morais'],
    'Premium': [],
  };

  return planosAPI.map((plano) => ({
    id: plano.categoria.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
    idReal: plano.categoria,
    codigo: plano.categoria.toUpperCase(),
    nome: `Proteção ${plano.categoria}`,
    descricao: descricoes[plano.categoria] || '',
    coberturas: plano.coberturas,
    naoInclui: naoIncluiMap[plano.categoria] || [],
    valorAdesao: plano.valor_adesao,
    valorMensal: plano.valor_mensal,
    destaque: plano.destaque || false,
    tag: plano.tag,
  }));
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function CotacaoPage() {
  const navigate = useNavigate();
  
  // Estado da etapa atual
  const [etapaAtual, setEtapaAtual] = useState(1);
  const [etapasCompletas, setEtapasCompletas] = useState<number[]>([]);

  // Etapa 1 - Consulta FIPE
  const [placa, setPlaca] = useState('');
  const [veiculoEncontrado, setVeiculoEncontrado] = useState<VeiculoEncontrado | null>(null);
  const [modoEntrada, setModoEntrada] = useState<'fipe' | 'manual'>('fipe');

  // Etapa 2 - Categoria
  const [categoria, setCategoria] = useState<string | null>(null);
  const [usoApp, setUsoApp] = useState(false);

  // Etapa 3 - Dados do Veículo
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [ano, setAno] = useState('');
  const [valorFipe, setValorFipe] = useState<number | null>(null);
  const [combustivel, setCombustivel] = useState('');
  const [regiao, setRegiao] = useState('');
  
  // Etapa 4 - Resultado
  const [isCalculando, setIsCalculando] = useState(false);
  const [planoSelecionado, setPlanoSelecionado] = useState<PlanoCalculado | null>(null);
  const [planos, setPlanos] = useState<PlanoCalculado[]>([]);
  const [isLoadingPlanos, setIsLoadingPlanos] = useState(false);

  // Hook de cálculo de cotação
  const { calcular, isLoading: isLoadingCalculo, resultado } = useCalcularCotacao();

  // Atualiza planos quando o resultado muda
  useEffect(() => {
    if (resultado && resultado.planos.length > 0) {
      const planosMapeados = mapearPlanosAPI(resultado.planos);
      setPlanos(planosMapeados);
      setIsLoadingPlanos(false);
    }
  }, [resultado]);

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
    setIsLoadingPlanos(true);
    
    // Se não tem valor FIPE, calcular mock
    let fipeParaCalculo = valorFipe;
    if (!fipeParaCalculo && marca && modelo && ano) {
      fipeParaCalculo = calcularFipeMock(marca, modelo, parseInt(ano));
      setValorFipe(fipeParaCalculo);
    }
    
    if (fipeParaCalculo) {
      try {
        const tipoUso: TipoUsoVeiculo = usoApp ? 'aplicativo' : 'particular';
        await calcular({ valor_fipe: fipeParaCalculo, tipo_uso: tipoUso });
        toast.success('Cotação calculada com sucesso!');
      } catch (error) {
        console.error('Erro ao calcular cotação:', error);
        toast.error('Erro ao calcular cotação. Tente novamente.');
        setIsLoadingPlanos(false);
      }
    }
    
    setIsCalculando(false);
    marcarEtapaCompleta(3);
    setEtapaAtual(4);
  }, [marca, modelo, ano, valorFipe, usoApp, marcarEtapaCompleta, calcular]);

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
    setPlanos([]);
  }, []);

  // Gerar PDF
  const handleGerarPDF = useCallback(() => {
    toast.info('Funcionalidade de PDF em desenvolvimento');
  }, []);

  // Iniciar Cadastro
  const handleIniciarCadastro = useCallback(() => {
    if (!planoSelecionado) {
      toast.error('Selecione um plano primeiro');
      return;
    }
    toast.success('Redirecionando para cadastro...');
    // Poderia navegar para página de cadastro com dados preenchidos
    navigate('/vendas/leads');
  }, [planoSelecionado, navigate]);

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
            planos={planos}
            planoSelecionado={planoSelecionado}
            setPlanoSelecionado={setPlanoSelecionado}
            onNovaCotacao={handleNovaCotacao}
            onGerarPDF={handleGerarPDF}
            onIniciarCadastro={handleIniciarCadastro}
            isLoading={isLoadingPlanos || isLoadingCalculo}
          />
        )}
      </div>
    </div>
  );
}
