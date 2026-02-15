export interface ArtigoRegulamento {
  numero: string;
  titulo: string;
  texto: string;
  tema: string;
}

export interface TemaRegulamento {
  id: string;
  titulo: string;
  descricao: string;
  artigos: ArtigoRegulamento[];
}

export const TEMAS_REGULAMENTO: TemaRegulamento[] = [
  {
    id: 'irregularidades',
    titulo: 'Irregularidades e Não Coberturas (Art. 7)',
    descricao: 'Situações que excluem a cobertura do veículo protegido',
    artigos: [
      {
        numero: '7.2',
        titulo: 'Condutor sem habilitação',
        texto: 'Não haverá cobertura quando o veículo estiver sendo conduzido por pessoa sem habilitação válida para a categoria do veículo, com habilitação cassada, suspensa ou vencida há mais de 30 (trinta) dias, ou por pessoa com idade inferior a 18 (dezoito) anos, ou ainda por pessoa sob efeito de substância alcoólica ou entorpecente.',
        tema: 'irregularidades',
      },
      {
        numero: '7.58',
        titulo: 'Água salgada',
        texto: 'Não haverá cobertura para danos causados por água salgada, maresia, enchente de água do mar ou qualquer contato do veículo com água salgada, incluindo submersão parcial ou total em ambiente marítimo ou litorâneo. Os danos decorrentes de água salgada possuem natureza corrosiva progressiva e não são cobertos em nenhuma hipótese.',
        tema: 'irregularidades',
      },
    ],
  },
  {
    id: 'ressarcimento',
    titulo: 'Ressarcimento Integral (Art. 10)',
    descricao: 'Regras para cálculo e pagamento do ressarcimento',
    artigos: [
      {
        numero: '10.1',
        titulo: 'Valor base FIPE',
        texto: 'O valor de referência para o ressarcimento integral será o valor de mercado do veículo conforme Tabela FIPE vigente na data do evento (sinistro), considerando marca, modelo, ano de fabricação/modelo e combustível do veículo protegido. A consulta será feita na tabela do mês do evento.',
        tema: 'ressarcimento',
      },
      {
        numero: '10.2',
        titulo: 'Perda total (>75%)',
        texto: 'Será considerada perda total quando o custo do reparo ultrapassar 75% (setenta e cinco por cento) do valor FIPE do veículo na data do evento. Neste caso, o associado terá direito ao ressarcimento integral conforme as condições do regulamento, deduzida a cota de participação e eventuais depreciações aplicáveis.',
        tema: 'ressarcimento',
      },
      {
        numero: '10.4',
        titulo: 'Depreciações (chassi, leilão, aplicativo)',
        texto: 'Serão aplicadas as seguintes depreciações sobre o valor FIPE: (a) Veículos com chassi remarcado: depreciação de 30%; (b) Veículos oriundos de leilão (sinistrado, recuperado de furto/roubo): depreciação de 30%; (c) Veículos utilizados em aplicativos de transporte (Uber, 99, etc.): depreciação de 20%. As depreciações são cumulativas quando aplicáveis.',
        tema: 'ressarcimento',
      },
      {
        numero: '10.5',
        titulo: 'Suspensão do prazo',
        texto: 'O prazo para pagamento do ressarcimento ficará suspenso enquanto houver pendências documentais por parte do associado, pendências financeiras (inadimplência de cotas mensais), processo de sindicância em andamento, ou qualquer impedimento legal ou judicial que impossibilite a conclusão do processo de indenização.',
        tema: 'ressarcimento',
      },
      {
        numero: '10.11',
        titulo: 'Recuperação após pagamento (salvados)',
        texto: 'Após o pagamento do ressarcimento integral, o veículo sinistrado (salvado) passa a ser propriedade da associação. Caso o veículo seja recuperado após o pagamento, o associado não terá direito à devolução do veículo, cabendo à associação a destinação do salvado conforme sua conveniência, incluindo venda em leilão.',
        tema: 'ressarcimento',
      },
      {
        numero: '10.12',
        titulo: 'Reparação vs indenização (decisão da diretoria)',
        texto: 'A decisão entre reparar o veículo ou indenizar o associado cabe exclusivamente à diretoria da associação, que avaliará o custo-benefício da reparação versus a indenização integral. O associado será comunicado da decisão e deverá acatar, não cabendo recurso quanto à forma de ressarcimento escolhida.',
        tema: 'ressarcimento',
      },
    ],
  },
  {
    id: 'documentacao',
    titulo: 'Documentação (Art. 8)',
    descricao: 'Documentos necessários para abertura e tramitação de eventos',
    artigos: [
      {
        numero: '8.3',
        titulo: 'Documentos básicos',
        texto: 'Para qualquer evento, o associado deverá apresentar os seguintes documentos básicos: (a) Boletim de Ocorrência (BO) registrado em até 24 horas do evento; (b) CNH do condutor no momento do evento; (c) CRLV do veículo em dia; (d) Fotos do veículo conforme orientação da associação; (e) Relato detalhado do evento assinado pelo condutor.',
        tema: 'documentacao',
      },
      {
        numero: '8.5',
        titulo: 'Documentos para indenização integral',
        texto: 'Além dos documentos básicos, para processos de indenização integral serão necessários: (a) CRV (Certificado de Registro do Veículo) original com reconhecimento de firma; (b) Procuração pública para transferência do veículo; (c) Certidão Negativa de Débitos (multas, IPVA, licenciamento); (d) Todas as chaves originais do veículo; (e) Comprovante de quitação de financiamento (se houver); (f) Laudo de vistoria de perda total emitido por perito credenciado.',
        tema: 'documentacao',
      },
      {
        numero: '8.6',
        titulo: 'Documentos para roubo/furto',
        texto: 'Em caso de roubo ou furto, além dos documentos básicos e de indenização integral, o associado deverá apresentar: (a) Boletim de Ocorrência específico de roubo/furto com detalhamento das circunstâncias; (b) Comunicação ao DETRAN sobre o sinistro; (c) Declaração de não localização do veículo após 30 dias; (d) Comprovação de bloqueio do rastreador (quando aplicável); (e) Certidão de "nada consta" da Delegacia de Roubos e Furtos de Veículos.',
        tema: 'documentacao',
      },
    ],
  },
];
