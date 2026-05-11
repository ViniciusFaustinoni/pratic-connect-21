import { Tutorial } from './types';
import novaCotacaoBotao from '@/assets/tutoriais/nova-cotacao-botao.png';
import tipoVendaModal from '@/assets/tutoriais/tipo-venda-modal.png';
import trocaTitularidadeBusca from '@/assets/tutoriais/troca-titularidade-busca.png';
import trocaTitularidadeNovoTitular from '@/assets/tutoriais/troca-titularidade-novo-titular.png';

export const trocaTitularidade: Tutorial = {
  id: 'troca-titularidade',
  slug: 'troca-titularidade',
  titulo: 'Troca de Titularidade',
  descricao:
    'Quando o veículo é vendido e o novo dono quer manter a proteção: como localizar o contrato atual e iniciar a troca de titular sem perder a carência.',
  categoria: 'Operação Comercial',
  tempoEstimadoMin: 10,
  novo: true,
  steps: [
    {
      numero: 1,
      titulo: 'Inicie uma nova cotação',
      descricao:
        'Em Vendas › Cotação, clique em "Nova Cotação". Informe a placa do veículo que está sendo vendido — é por ela que o sistema vai localizar o contrato e o titular atual.',
      imagem: novaCotacaoBotao,
      dicas: [
        'A placa precisa ser a mesma do contrato ativo do antigo dono.',
        'Confira a categoria FIPE detectada antes de seguir.',
      ],
      links: [
        { label: 'Nova Cotação', url: '/vendas/cotacoes' },
      ],
    },
    {
      numero: 2,
      titulo: 'Selecione "Troca de Titularidade"',
      descricao:
        'No modal "O que você deseja fazer?" escolha a opção Troca de Titularidade. Esse fluxo é específico para veículo vendido — preserva a carência já cumprida e transfere a proteção para o novo proprietário.',
      imagem: tipoVendaModal,
      dicas: [
        'Use Troca de Titularidade somente quando o veículo foi vendido e o novo dono quer assumir a proteção.',
        'Se o associado trocou de carro (mesmo dono, outro veículo), o fluxo correto é Substituição de Placa.',
      ],
    },
    {
      numero: 3,
      titulo: 'Busque o associado atual pelo CPF',
      descricao:
        'Abre o painel "Troca de Titularidade". Digite o CPF do dono atual do veículo (também aceita nome, telefone ou placa — mínimo 2 caracteres). O sistema lista os associados ativos que batem com a busca; selecione o titular para puxar o contrato e seguir com a transferência para o novo dono.',
      imagem: trocaTitularidadeBusca,
      dicas: [
        'Prefira buscar pelo CPF — é o identificador único e evita confusão com homônimos.',
        'Só aparecem associados com status ativo: se não encontrar, confira se o contrato está em dia.',
        'O badge "ativo" ao lado do nome confirma que o associado pode ceder a titularidade.',
      ],
    },
    {
      numero: 4,
      titulo: 'Selecione o veículo e cadastre o novo titular',
      descricao:
        'Selecionado o associado anterior, abre o painel "Troca de Titularidade" com a lista de veículos vinculados a ele (locais e os trazidos do SGA Hinova). Escolha o veículo a transferir e preencha os dados do novo titular: nome completo, CPF, e-mail e telefone/WhatsApp. Esses dados criam a cotação que será enviada para assinatura do novo dono.',
      imagem: trocaTitularidadeNovoTitular,
      dicas: [
        'A lista mostra todos os veículos do associado anterior — confira marca/modelo/placa antes de seguir.',
        'CPF e nome do novo titular são obrigatórios; telefone/WhatsApp é por onde o link da proposta será enviado.',
        'Após preencher, o sistema gera o link público; a solicitação passa por aprovação do Cadastro e do Monitoramento antes da assinatura.',
      ],
    },
    {
      numero: 5,
      titulo: 'Envie o link da proposta para o novo titular',
      descricao:
        'Salvo o cadastro, a cotação aparece em Vendas › Cotações › "Outros Processos" com badge "Troca de Titularidade". Use "Copiar link" para enviar por WhatsApp/e-mail ao novo dono ou aguarde o disparo automático configurado para o canal padrão.',
      dicas: [
        'A aba "Outros Processos" reúne trocas, substituições, inclusões e migrações — não confunda com cotações comuns.',
        'O link público é único por cotação; reenviar não invalida o anterior.',
      ],
      links: [
        { label: 'Cotações › Outros Processos', url: '/vendas/cotacoes' },
      ],
    },
    {
      numero: 6,
      titulo: 'Novo titular escolhe plano, envia documentos e assina',
      descricao:
        'Pelo link público o novo dono escolhe o plano (a carência já cumprida pelo titular antigo é preservada), envia CNH e CRLV, e assina o contrato com biometria facial via Autentique. Concluída a assinatura, a cotação muda para "Aguardando aprovação do Cadastro" e some da fila do vendedor.',
      dicas: [
        'Não há cobrança de taxa de adesão na troca de titularidade — o contrato é uma continuidade.',
        'Se a assinatura travar por crédito do Autentique, o sistema avisa o Cadastro automaticamente.',
      ],
    },
    {
      numero: 7,
      titulo: 'Cadastro envia o Termo de Cancelamento e aprova',
      descricao:
        'O Cadastro abre a solicitação em Cadastro › Processos › Titularidade, dispara o Termo de Cancelamento para o titular antigo (e-mail + biometria), aguarda a assinatura e então aprova. A assinatura do termo já desvincula logicamente o veículo do antigo dono — é o que destrava a placa para a nova titularidade.',
      dicas: [
        'Enquanto o termo não é assinado, a aprovação fica bloqueada.',
        'Débitos em aberto no SGA do antigo dono também travam a aprovação até quitação.',
      ],
      links: [
        { label: 'Tutorial completo do Cadastro', url: '/tutoriais/aprovacao-troca-titularidade-cadastro' },
        { label: 'Cadastro › Processos › Titularidade', url: '/cadastro/processos?tab=titularidade' },
      ],
    },
    {
      numero: 8,
      titulo: 'Monitoramento aprova a vistoria de campo',
      descricao:
        'Ao aprovar no Cadastro, o sistema cria automaticamente um serviço de vistoria (origem "troca de titularidade") em Monitoramento › Serviços de Campo. O técnico fotografa o veículo (sem instalar nada novo) e a fila de Monitoramento › Aprovações › Aprovação de Associados decide. A cobertura segue suspensa até essa decisão.',
      dicas: [
        'A vistoria aqui é só de conferência — não há instalação de rastreador novo, o equipamento existente continua.',
        'Reprovação volta a solicitação ao Cadastro com o motivo registrado.',
      ],
      links: [
        { label: 'Monitoramento › Serviços de Campo', url: '/monitoramento/servicos-campo' },
        { label: 'Aprovação de Associados', url: '/monitoramento/aprovacoes' },
      ],
    },
    {
      numero: 9,
      titulo: 'Ativação automática do novo associado',
      descricao:
        'Aprovada a vistoria, o sistema executa a efetivação: cancela o contrato do titular antigo, ativa o contrato do novo, transfere o veículo, religa a cobertura e sincroniza tudo no SGA Hinova. O novo titular passa a constar como ativo em Cadastro › Associados, com o histórico de carência preservado.',
      dicas: [
        'Toda essa ativação passa pela edge function única de ativação — não é preciso rodar nada manual.',
        'No SGA Hinova a situação do novo associado é criada como Pendente; a promoção para Ativo é manual no painel SGA.',
      ],
      links: [
        { label: 'Cadastro › Associados', url: '/cadastro/associados' },
      ],
    },
  ],
};

