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
  ],
};

