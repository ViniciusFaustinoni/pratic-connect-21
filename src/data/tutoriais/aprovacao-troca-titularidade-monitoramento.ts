import { Tutorial } from './types';

export const aprovacaoTrocaTitularidadeMonitoramento: Tutorial = {
  id: 'aprovacao-troca-titularidade-monitoramento',
  slug: 'aprovacao-troca-titularidade-monitoramento',
  titulo: 'Aprovação de Troca de Titularidade pelo Monitoramento',
  descricao:
    'Como o Monitoramento analisa uma troca de titularidade já aprovada pelo Cadastro — incluindo a decisão de solicitar (ou não) uma vistoria do veículo antes de liberar a troca.',
  categoria: 'Monitoramento',
  tempoEstimadoMin: 4,
  novo: true,
  steps: [
    {
      numero: 1,
      titulo: 'Abra Monitoramento › Aprovações › Troca de Titularidade',
      descricao:
        'Acesse a central "Aprovações do Monitoramento" e selecione a aba "Troca de Titularidade". A sub-aba "Pendentes" lista as solicitações que o Cadastro já aprovou e que aguardam sua análise final.',
      links: [
        { label: 'Aprovações do Monitoramento', url: '/monitoramento/aprovacoes-unificadas?tab=titularidade' },
      ],
      dicas: [
        'Cada card mostra o titular antigo → novo titular, veículo e placa, além do badge "Termo assinado".',
        'A fila atualiza em tempo real assim que o Cadastro aprova uma nova solicitação.',
      ],
    },
    {
      numero: 2,
      titulo: 'Clique em "Analisar" para abrir os detalhes',
      descricao:
        'No card da solicitação, clique em "Analisar". O drawer mostra os dados do novo titular, do veículo, o termo de cancelamento assinado e o histórico da aprovação anterior do Cadastro.',
      dicas: [
        'Revise especialmente o veículo e o histórico do titular antigo — é o momento de avaliar risco.',
        'Documentos do novo titular já foram conferidos pelo Cadastro; aqui o foco é o veículo e o perfil de uso.',
      ],
    },
    {
      numero: 3,
      titulo: 'Decida: aprovar direto ou solicitar vistoria',
      descricao:
        'Você tem duas opções: (a) aprovar direto, transferindo o veículo para o novo titular; ou (b) solicitar uma vistoria do veículo antes de decidir. A vistoria é opcional e fica a critério do Monitoramento — use quando o veículo precisa ser revalidado fisicamente (foto, hodômetro, condições gerais).',
      dicas: [
        'Sem vistoria: o veículo já passa para "Aprovadas" e a troca pode ser efetivada.',
        'Com vistoria: a solicitação muda para "Em Vistoria" e a etapa "Vistoria" é destravada automaticamente no link público de contratação para o NOVO titular escolher (autovistoria, técnico em casa ou levar à base). Nenhum serviço de campo é criado nesta etapa — a vistoria roda 100% dentro do fluxo do cliente.',
      ],
    },
    {
      numero: 4,
      titulo: 'Acompanhe o resultado da vistoria (se solicitada)',
      descricao:
        'Enquanto o novo titular não conclui a vistoria pelo link público, o botão "Aprovar" fica oculto neste drawer (somente "Reprovar" disponível). Assim que a vistoria for finalizada, o botão "Aprovar" reaparece automaticamente para você liberar a troca.',
      dicas: [
        'Não há serviço em "Serviços de Campo" para esta vistoria — ela é executada pelo próprio cliente no link público.',
        'Você pode reabrir o drawer a qualquer momento pela aba "Em Vistoria" para acompanhar o andamento.',
      ],
    },
    {
      numero: 5,
      titulo: 'Aprove ou Reprove para finalizar',
      descricao:
        'No rodapé do drawer, clique em "Aprovar" para efetivar a troca (o veículo é transferido para o novo titular e a cobertura é religada em nome dele) ou "Reprovar" informando o motivo. Após a decisão, a solicitação migra para "Aprovadas" ou "Recusadas" e some da sua fila de pendentes.',
      dicas: [
        'A aprovação dispara automaticamente a transferência no SGA Hinova e a sincronização do veículo com o novo associado.',
        'Reprovação é definitiva nesta etapa — o novo titular precisaria abrir uma nova solicitação caso queira tentar novamente.',
      ],
    },
  ],
};
