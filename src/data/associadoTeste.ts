// ============================================
// DADOS MOCK DO ASSOCIADO DE TESTE
// ============================================

export interface EnderecoTeste {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
}

export interface RastreadorTeste {
  id: string;
  modelo: string;
  imei: string;
  status: 'ativo' | 'inativo' | 'manutencao';
  ultimaPosicao: {
    lat: number;
    lng: number;
    data: string;
    endereco: string;
  };
}

export interface VeiculoTeste {
  id: string;
  marca: string;
  modelo: string;
  anoFabricacao: number;
  anoModelo: number;
  cor: string;
  placa: string;
  chassi: string;
  renavam: string;
  valorFipe: number;
  rastreador: RastreadorTeste | null;
}

export interface BoletoTeste {
  id: string;
  referencia: string;
  valor: number;
  vencimento: string;
  status: 'pendente' | 'pago' | 'vencido' | 'cancelado';
  dataPagamento?: string;
  linhaDigitavel?: string;
  pixCopiaCola?: string;
}

export interface ChamadoTeste {
  id: string;
  protocolo: string;
  tipo: string;
  status: 'aberto' | 'em_atendimento' | 'concluido' | 'cancelado';
  dataAbertura: string;
  dataConclusao?: string;
  endereco: string;
  avaliacao?: number;
}

export interface SinistroTeste {
  id: string;
  protocolo: string;
  tipo: string;
  status: 'aberto' | 'em_analise' | 'aprovado' | 'negado' | 'concluido';
  dataOcorrencia: string;
  local: string;
  descricao: string;
  valorFipe: number;
}

export interface ManifestacaoTeste {
  id: string;
  protocolo: string;
  tipo: string;
  assunto: string;
  status: 'aberto' | 'em_analise' | 'respondido' | 'concluido';
  data: string;
}

export interface DocumentoTeste {
  id: string;
  tipo: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  dataEnvio: string;
}

export interface NotificacaoTeste {
  id: string;
  titulo: string;
  mensagem: string;
  data: string;
  lida: boolean;
}

export interface RevistoriaHistoricoTeste {
  id: string;
  data: string;
  tipo: 'carro' | 'moto';
  status: 'aprovada' | 'reprovada';
  fotos: number;
}

export interface RevistoriaTeste {
  diasAtraso: number;
  necessaria: boolean;
  status: 'pendente' | 'em_analise' | 'aprovada' | 'reprovada' | null;
  tipoVeiculo: 'carro' | 'moto' | null;
  motivoSuspensao: string | null;
  dataSuspensao: string | null;
  dataLimiteRevistoria: string | null;
  dataEnvio: string | null;
  ultimaRevistoria: string | null;
  motivosReprovacao: string[];
  historico: RevistoriaHistoricoTeste[];
}

export interface AssociadoTeste {
  id: string;
  codigo: string;
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  whatsapp: string;
  dataNascimento: string;
  endereco: EnderecoTeste;
  status: 'ativo' | 'inativo' | 'suspenso' | 'bloqueado';
  associadoDesde: string;
  plano: string;
  valorMensalidade: number;
  diaVencimento: number;
  veiculos: VeiculoTeste[];
  boletos: BoletoTeste[];
  chamados: ChamadoTeste[];
  sinistros: SinistroTeste[];
  manifestacoes: ManifestacaoTeste[];
  documentos: DocumentoTeste[];
  notificacoes: NotificacaoTeste[];
  revistoria: RevistoriaTeste;
}

// ============================================
// CREDENCIAIS DE TESTE
// ============================================
export const TEST_CREDENTIALS = {
  cpf: '12345678900', // Formato sem máscara
  cpfFormatted: '123.456.789-00',
  password: 'teste123',
};

// ============================================
// DADOS COMPLETOS DO ASSOCIADO
// ============================================
export const ASSOCIADO_TESTE: AssociadoTeste = {
  id: 'teste-001',
  codigo: 'PRATIC-10001',
  nome: 'João da Silva Teste',
  cpf: '123.456.789-00',
  email: 'joao.teste@email.com',
  telefone: '(11) 99999-1234',
  whatsapp: '(11) 99999-1234',
  dataNascimento: '1985-05-15',
  endereco: {
    cep: '01310-100',
    logradouro: 'Av. Paulista',
    numero: '1000',
    complemento: 'Apto 101',
    bairro: 'Bela Vista',
    cidade: 'São Paulo',
    estado: 'SP',
  },
  status: 'ativo',
  associadoDesde: '2024-01-15',
  plano: 'Proteção Completa',
  valorMensalidade: 189.90,
  diaVencimento: 10,

  veiculos: [
    {
      id: 'veiculo-001',
      marca: 'Volkswagen',
      modelo: 'Gol 1.0',
      anoFabricacao: 2021,
      anoModelo: 2022,
      cor: 'Prata',
      placa: 'ABC-1234',
      chassi: '9BWAG45N1YT123456',
      renavam: '12345678901',
      valorFipe: 58500.00,
      rastreador: {
        id: 'rastr-001',
        modelo: 'Suntech ST4100',
        imei: '123456789012345',
        status: 'ativo',
        ultimaPosicao: {
          lat: -23.561684,
          lng: -46.655981,
          data: '2026-01-08T14:30:00',
          endereco: 'Av. Paulista, 1000 - São Paulo/SP',
        },
      },
    },
  ],

  boletos: [
    {
      id: 'bol-001',
      referencia: 'Jan/2026',
      valor: 189.90,
      vencimento: '2026-01-10',
      status: 'pendente',
      linhaDigitavel: '23793.38128 60000.000003 00000.000400 1 84340000018990',
      pixCopiaCola: '00020126580014br.gov.bcb.pix0136a1b2c3d4-e5f6-7890-abcd-ef1234567890520400005303986540189.905802BR5925PRATIC PROTECAO VEICULAR6009SAO PAULO62070503***63041234',
    },
    {
      id: 'bol-002',
      referencia: 'Dez/2025',
      valor: 189.90,
      vencimento: '2025-12-10',
      status: 'pago',
      dataPagamento: '2025-12-08',
    },
    {
      id: 'bol-003',
      referencia: 'Nov/2025',
      valor: 189.90,
      vencimento: '2025-11-10',
      status: 'pago',
      dataPagamento: '2025-11-10',
    },
    {
      id: 'bol-004',
      referencia: 'Out/2025',
      valor: 189.90,
      vencimento: '2025-10-10',
      status: 'pago',
      dataPagamento: '2025-10-09',
    },
  ],

  chamados: [
    {
      id: 'cham-001',
      protocolo: 'ASS-2025-00892',
      tipo: 'pneu_furado',
      status: 'concluido',
      dataAbertura: '2025-11-20T08:30:00',
      dataConclusao: '2025-11-20T10:15:00',
      endereco: 'Rodovia Anhanguera, km 45',
      avaliacao: 5,
    },
  ],

  sinistros: [
    {
      id: 'sin-001',
      protocolo: 'SIN-2025-00156',
      tipo: 'colisao',
      status: 'em_analise',
      dataOcorrencia: '2025-12-15T18:30:00',
      local: 'Rua Augusta, 500 - São Paulo/SP',
      descricao: 'Colisão traseira em semáforo',
      valorFipe: 58500.00,
    },
  ],

  manifestacoes: [
    {
      id: 'ouv-001',
      protocolo: 'OUV-2026-00015',
      tipo: 'sugestao',
      assunto: 'Melhorar notificações do app',
      status: 'respondido',
      data: '2026-01-05',
    },
  ],

  documentos: [
    { id: 'doc-001', tipo: 'CNH', status: 'aprovado', dataEnvio: '2024-01-10' },
    { id: 'doc-002', tipo: 'CRLV', status: 'aprovado', dataEnvio: '2024-01-10' },
    { id: 'doc-003', tipo: 'Comprovante de Residência', status: 'aprovado', dataEnvio: '2024-01-10' },
    { id: 'doc-004', tipo: 'Contrato Assinado', status: 'aprovado', dataEnvio: '2024-01-15' },
  ],

  notificacoes: [
    {
      id: 'not-001',
      titulo: 'Boleto disponível',
      mensagem: 'Seu boleto de Janeiro/2026 está disponível',
      data: '2026-01-05',
      lida: false,
    },
    {
      id: 'not-002',
      titulo: 'Sinistro atualizado',
      mensagem: 'Seu sinistro SIN-2025-00156 está em análise',
      data: '2026-01-03',
      lida: true,
    },
  ],

  // ============================================
  // REVISTORIA - CENÁRIOS DE TESTE
  // ============================================
  // Para testar outros cenários, troque os valores abaixo:
  //
  // CENÁRIO 1 - EM DIA (sem atraso):
  //   diasAtraso: 0, necessaria: false, status: null
  //
  // CENÁRIO 2 - SUSPENSO SEM REVISTORIA (1-5 dias):
  //   diasAtraso: 3, necessaria: false, status: null
  //
  // CENÁRIO 3 - REVISTORIA OBRIGATÓRIA (6+ dias):
  //   diasAtraso: 6, necessaria: true, status: 'pendente'
  //
  // CENÁRIO 4 - EM ANÁLISE:
  //   diasAtraso: 8, necessaria: true, status: 'em_analise', dataEnvio: '2026-01-07T14:30:00'
  //
  // CENÁRIO 5 - REPROVADA:
  //   diasAtraso: 10, necessaria: true, status: 'reprovada', motivosReprovacao: ['Foto do painel: veículo não estava ligado']
  //
  revistoria: {
    // ATIVO: Cenário 3 - Revistoria Obrigatória (6+ dias)
    diasAtraso: 6,
    necessaria: true,
    status: 'pendente',
    tipoVeiculo: null,
    motivoSuspensao: 'Boleto vencido',
    dataSuspensao: '2026-01-02',
    dataLimiteRevistoria: '2026-01-07',
    dataEnvio: null,
    ultimaRevistoria: null,
    motivosReprovacao: [],
    historico: [
      { id: 'rev-001', data: '2025-06-15', tipo: 'carro', status: 'aprovada', fotos: 11 },
    ]
  },
};

// ============================================
// STORAGE KEYS
// ============================================
export const STORAGE_KEYS = {
  TEST_MODE: 'pratic_test_mode',
  TEST_DATA: 'pratic_test_data',
} as const;
