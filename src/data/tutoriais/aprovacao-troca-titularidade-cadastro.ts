import { Tutorial } from './types';

export const aprovacaoTrocaTitularidadeCadastro: Tutorial = {
  id: 'aprovacao-troca-titularidade-cadastro',
  slug: 'aprovacao-troca-titularidade-cadastro',
  titulo: 'Aprovação de Troca de Titularidade pelo Cadastro',
  descricao:
    'Como o Cadastro analisa, envia o termo de cancelamento e aprova uma troca de titularidade — do momento em que a solicitação chega até passar para o Monitoramento.',
  categoria: 'Cadastro',
  tempoEstimadoMin: 5,
  novo: true,
  steps: [
    {
      numero: 1,
      titulo: 'Abra a fila em Cadastro › Processos › Titularidade',
      descricao:
        'Acesse Cadastro › Processos e selecione a aba "Titularidade". A sub-aba "Aguardando Cadastro" lista as solicitações que estão sob análise — inclui tanto as que ainda estão com a cotação em andamento quanto as que já tiveram o termo assinado e aguardam decisão.',
      links: [{ label: 'Cadastro › Processos', url: '/cadastro/processos?tab=titularidade' }],
      dicas: [
        'O contador no card do topo "Titularidade pendente" mostra apenas o que precisa de ação do Cadastro.',
        'Solicitações com badge "Cotação em andamento" ainda dependem do envio/assinatura do termo antes de poderem ser aprovadas.',
      ],
    },
    {
      numero: 2,
      titulo: 'Abra os Detalhes e revise as abas',
      descricao:
        'Clique em "Detalhes" para abrir o drawer da solicitação. Confira na ordem: Dados (titular antigo, novo titular, veículo, cotação vinculada), Termo (status do Termo de Cancelamento — sua próxima ação), Análise prévia (snapshot só é gerado após você aprovar) e Financeiro Antigo (precisa estar adimplente).',
      dicas: [
        'Se houver débito em aberto no SGA, um alerta vermelho aparece no topo — a aprovação fica bloqueada até a quitação.',
        'Use o botão "Abrir cotação" na aba Dados para revisar o que o novo titular preencheu.',
      ],
    },
    {
      numero: 3,
      titulo: 'Envie o Termo de Cancelamento (aba "Termo")',
      descricao:
        'Na aba "Termo" clique em "Enviar Termo de Cancelamento (Autentique)". O sistema dispara o documento por e-mail para o titular antigo, que assina com biometria facial. Enquanto não há envio, o drawer mostra um aviso de "Próximo passo: enviar Termo de Cancelamento".',
      dicas: [
        'O e-mail e telefone usados são os do cadastro do titular antigo (aba Dados).',
        'Após o envio, o status do termo passa a "Enviado em … — aguardando assinatura".',
      ],
    },
    {
      numero: 4,
      titulo: 'Aguarde a assinatura do titular antigo',
      descricao:
        'Quando o titular antigo assina, o webhook do Autentique muda automaticamente o status da solicitação de "Cotação em andamento" para "Aguardando Cadastro". O drawer recarrega e a aba "Análise prévia" passa a mostrar o snapshot (base local + SGA Hinova) assim que você clicar em Aprovar.',
      dicas: [
        'Não é preciso ficar atualizando manualmente — o realtime atualiza a fila.',
        'Se a assinatura demorar, reabra o drawer; o status do termo na aba "Termo" mostra a data de envio.',
      ],
    },
    {
      numero: 5,
      titulo: 'Clique em Aprovar (ou Reprovar)',
      descricao:
        'Com termo assinado e sem débito pendente, o rodapé do drawer libera os botões "Reprovar" e "Aprovar". Preencha a observação (opcional) e clique em Aprovar — a solicitação migra para "Aguardando Monitoramento" e some da sua fila. Para reprovar, é obrigatório justificar o motivo.',
      dicas: [
        'O botão "Aprovar" passa o tooltip do motivo do bloqueio quando ainda não está liberado (assinatura pendente ou débito em aberto).',
        'Após aprovar, acompanhe pela aba "Aprovadas" ou pela Timeline da solicitação.',
      ],
    },
  ],
};
