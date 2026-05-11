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
      titulo: 'Cadastro envia o Termo de Cancelamento ao titular antigo',
      descricao:
        'O Cadastro abre a solicitação em Cadastro › Processos › Titularidade e dispara o Termo de Cancelamento para o titular antigo (e-mail + biometria facial via Autentique). A solicitação fica "aguardando assinatura do termo" — nada avança enquanto o antigo dono não assina.',
      dicas: [
        'O termo é enviado por e-mail; a assinatura exige biometria facial (PF_FACIAL).',
        'Débitos em aberto no SGA do antigo dono travam a etapa seguinte até a quitação.',
      ],
      links: [
        { label: 'Cadastro › Processos › Titularidade', url: '/cadastro/processos?tab=titularidade' },
      ],
    },
    {
      numero: 8,
      titulo: 'Titular antigo assina o Termo de Cancelamento',
      descricao:
        'O antigo dono recebe o link, faz a biometria facial e assina o Termo de Cancelamento. Essa assinatura desvincula logicamente o veículo do antigo dono (marca em_troca_titularidade=true) e destrava a placa para a nova titularidade.',
      dicas: [
        'Assinatura é exclusivamente facial via Autentique — não há desenho manual.',
        'Sem assinatura do termo, a transferência não pode ser efetivada.',
      ],
    },
    {
      numero: 9,
      titulo: 'Cadastro aprova a troca',
      descricao:
        'Com o Termo de Cancelamento assinado pelo antigo e o contrato assinado pelo novo titular, o Cadastro aprova a solicitação em Cadastro › Processos › Titularidade. A aprovação marca cadastro_aprovado=true e libera a solicitação para Monitoramento.',
      dicas: [
        'A aprovação só fica disponível com termo + contrato assinados.',
        'Reprovação volta a solicitação ao vendedor com o motivo registrado.',
      ],
      links: [
        { label: 'Tutorial completo do Cadastro', url: '/tutoriais/aprovacao-troca-titularidade-cadastro' },
        { label: 'Cadastro › Processos › Titularidade', url: '/cadastro/processos?tab=titularidade' },
      ],
    },
    {
      numero: 10,
      titulo: 'Monitoramento aprova a solicitação',
      descricao:
        'A solicitação cai na fila de Monitoramento › Aprovações › Aprovação de Associados. O Monitoramento valida documentos e fotos prévias e libera a cotação de volta para o consultor (badge "Liberada p/ assinatura") na aba Outros Processos, para o reenvio do link público ao novo titular.',
      dicas: [
        'A cobertura segue suspensa até a decisão final do Monitoramento após a vistoria.',
        'Reprovação volta a solicitação ao Cadastro com o motivo registrado.',
      ],
      links: [
        { label: 'Monitoramento › Aprovações', url: '/monitoramento/aprovacoes' },
      ],
    },
    {
      numero: 11,
      titulo: 'Consultor reabre a cotação e envia o link ao novo associado',
      descricao:
        'Após a aprovação do Monitoramento, em Vendas › Cotações › aba "Outros Processos" o consultor localiza a cotação da troca (badge "Liberada p/ assinatura") e usa "Abrir página da cotação" (ícone vermelho) ou "Copiar link" para enviar o link público ao novo titular por WhatsApp/e-mail. O novo associado acessa o link, escolhe o plano e segue o restante do fluxo como em uma nova adesão — preservando a carência cumprida pelo titular antigo.',
      dicas: [
        'A aba "Outros Processos" reúne trocas, substituições, inclusões e migrações — não confunda com cotações comuns.',
        'O link público é único por cotação; reenviar não invalida o anterior.',
        'A escolha do plano e o envio dos documentos pelo novo titular ocorrem nessa etapa, igual a uma nova adesão.',
      ],
      links: [
        { label: 'Cotações › Outros Processos', url: '/vendas/cotacoes' },
      ],
    },
    {
      numero: 12,
      titulo: 'Atribuição manual e vistoria do técnico',
      descricao:
        'Em Monitoramento › Serviços de Campo › Atribuição Manual, o serviço (marcado como encaixe) é atribuído ao técnico. O técnico vai até o veículo e realiza a vistoria de conferência — apenas fotografa, sem instalar nada novo, pois o rastreador já existe. O resultado volta para aprovação final do Monitoramento.',
      dicas: [
        'A vistoria de troca de titularidade é só fotográfica — não há instalação de rastreador.',
        'Como é encaixe, o serviço entra direto na fila do dia, mesmo sem agenda prévia.',
      ],
      links: [
        { label: 'Atribuição Manual', url: '/monitoramento/servicos-campo' },
        { label: 'Mapa de Monitoramento', url: '/monitoramento/mapa' },
      ],
    },
    {
      numero: 13,
      titulo: 'Novo associado cria a senha e a troca é concluída',
      descricao:
        'Aprovada a vistoria, a edge function efetivar-troca-titularidade cancela o contrato do antigo, ativa o contrato do novo, transfere o veículo, religa a cobertura e sincroniza no SGA Hinova (situação Pendente). No link público o novo associado vê o convite para criar a senha de acesso ao app — ao definir a senha, a troca de titularidade é considerada concluída.',
      dicas: [
        'A ativação passa exclusivamente pela edge function única ativar-associado — não há etapa manual.',
        'No SGA Hinova o novo associado nasce Pendente; a promoção para Ativo é manual no painel do SGA.',
        'A carência cumprida pelo titular antigo é integralmente preservada para o novo.',
      ],
      links: [
        { label: 'Cadastro › Associados', url: '/cadastro/associados' },
      ],
    },
  ],
};

