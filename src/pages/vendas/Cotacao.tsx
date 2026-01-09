import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CotacaoStepper } from '@/components/cotacao/CotacaoStepper';
import { EtapaConsultaFipe } from '@/components/cotacao/EtapaConsultaFipe';
import { EtapaCategoriaVeiculo } from '@/components/cotacao/EtapaCategoriaVeiculo';
import { EtapaDadosVeiculo } from '@/components/cotacao/EtapaDadosVeiculo';
import { EtapaResultado } from '@/components/cotacao/EtapaResultado';
import { usePlanosCotacao } from '@/hooks/useCotacao';

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

const mapearPlanosParaExibicao = (
  planosDB: any[],
  valorFipe: number,
  usoApp: boolean
): PlanoCalculado[] => {
  const multiplicadorApp = usoApp ? 1.3 : 1.0;
  
  const planosOrdenados = [...planosDB].sort((a, b) => 
    (a.valor_adesao || 0) - (b.valor_adesao || 0)
  );

  return planosOrdenados.map((plano, index) => {
    const basePercentual = index === 0 ? 0.004 : index === 1 ? 0.0055 : 0.007;
    const valorMensal = Math.round((valorFipe * basePercentual) * multiplicadorApp * 100) / 100;
    const valorAdesao = Math.round((plano.valor_adesao || 350) * multiplicadorApp);

    const isBasico = plano.codigo === 'BASICO';
    const isCompleto = plano.codigo === 'TOTAL';
    const isPremium = plano.codigo === 'PREMIUM';

    const coberturas = plano.coberturas?.length > 0 ? plano.coberturas : [
      'Colisão (100% FIPE)',
      'Roubo e Furto (100% FIPE)',
      'Incêndio Total',
      'Perda Total',
      ...(isCompleto || isPremium ? ['Vidros completos', 'App de Rastreamento 24h'] : []),
      ...(isPremium ? ['Carro reserva (7 dias)', 'Proteção para terceiros'] : []),
      isBasico ? 'Assistência 24h básica' : 'Assistência 24h completa',
    ];

    const naoInclui = isBasico 
      ? ['Vidros', 'App de rastreamento', 'Carro reserva']
      : isCompleto 
        ? ['Carro reserva', 'Proteção para terceiros']
        : [];

    return {
      id: plano.codigo?.toLowerCase() || `plano-${index}`,
      idReal: plano.id,
      codigo: plano.codigo || '',
      nome: plano.nome || `Plano ${index + 1}`,
      descricao: plano.descricao || 
        (isBasico ? 'Proteção essencial para seu veículo' :
         isCompleto ? 'O mais vendido - melhor custo-benefício' :
         'Proteção máxima com todos os benefícios'),
      coberturas,
      naoInclui,
      valorAdesao,
      valorMensal,
      destaque: isCompleto,
    };
  });
};

// Planos mock caso não tenha dados do banco
const calcularPlanosMock = (valorFipe: number, usoApp: boolean): PlanoCalculado[] => {
  const multiplicador = usoApp ? 1.3 : 1.0;
  
  return [
    {
      id: 'basico',
      idReal: 'mock-basico',
      codigo: 'BASICO',
      nome: 'Select Basic',
      descricao: 'Proteção essencial para seu veículo',
      coberturas: [
        'Colisão (100% FIPE)',
        'Roubo e Furto (100% FIPE)',
        'Incêndio Total',
        'Perda Total',
        'Assistência 24h (400km)',
      ],
      naoInclui: ['Vidros', 'App de rastreamento', 'Carro reserva'],
      valorAdesao: Math.round(350 * multiplicador),
      valorMensal: Math.round(valorFipe * 0.004 * multiplicador * 100) / 100,
      destaque: false,
    },
    {
      id: 'total',
      idReal: 'mock-total',
      codigo: 'TOTAL',
      nome: 'Select Premium',
      descricao: 'O mais vendido - melhor custo-benefício',
      coberturas: [
        'Colisão (100% FIPE)',
        'Roubo e Furto (100% FIPE)',
        'Incêndio Total',
        'Perda Total',
        'Vidros completos',
        'App de Rastreamento 24h',
        'Assistência 24h (1000km)',
        'Danos a Terceiros R$40mil',
      ],
      naoInclui: ['Carro reserva'],
      valorAdesao: Math.round(450 * multiplicador),
      valorMensal: Math.round(valorFipe * 0.0055 * multiplicador * 100) / 100,
      destaque: true,
    },
    {
      id: 'premium',
      idReal: 'mock-premium',
      codigo: 'PREMIUM',
      nome: 'Select Exclusive',
      descricao: 'Proteção máxima com todos os benefícios',
      coberturas: [
        'Colisão (100% FIPE)',
        'Roubo e Furto (100% FIPE)',
        'Incêndio Total',
        'Perda Total',
        'Vidros completos',
        'App de Rastreamento 24h',
        'Assistência 24h Ilimitada',
        'Danos a Terceiros R$60mil',
        'Carro reserva (7 dias)',
        'Kit Gás protegido',
        '100% FIPE para APP',
      ],
      naoInclui: [],
      valorAdesao: Math.round(550 * multiplicador),
      valorMensal: Math.round(valorFipe * 0.007 * multiplicador * 100) / 100,
      destaque: false,
    },
  ];
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

  // Dados do banco
  const { data: planosDB } = usePlanosCotacao();

  // Calcular planos disponíveis
  const planos = useMemo(() => {
    if (!valorFipe) return [];
    
    if (planosDB && planosDB.length > 0) {
      return mapearPlanosParaExibicao(planosDB, valorFipe, usoApp);
    }
    
    return calcularPlanosMock(valorFipe, usoApp);
  }, [valorFipe, usoApp, planosDB]);

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
    
    // Simular delay de cálculo
    await new Promise(resolve => setTimeout(resolve, 600));
    
    // Se não tem valor FIPE, calcular mock
    if (!valorFipe && marca && modelo && ano) {
      const fipeMock = calcularFipeMock(marca, modelo, parseInt(ano));
      setValorFipe(fipeMock);
    }
    
    setIsCalculando(false);
    marcarEtapaCompleta(3);
    setEtapaAtual(4);
    toast.success('Cotação calculada com sucesso!');
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
          />
        )}
      </div>
    </div>
  );
}
