import { Tutorial } from './types';
import novaCotacaoBotao from '@/assets/tutoriais/nova-cotacao-botao.png';
import tipoVendaModal from '@/assets/tutoriais/tipo-venda-modal.png';
import cotacaoComumDados from '@/assets/tutoriais/cotacao-comum-dados.png';
import cotacaoRegiaoUsoPlaca from '@/assets/tutoriais/cotacao-regiao-uso-placa.png';
import cotacaoValorCenario from '@/assets/tutoriais/cotacao-valor-cenario.png';

export const cotacaoAteAtivacao: Tutorial = {
  id: 'cotacao-ate-ativacao',
  slug: 'cotacao-ate-ativacao',
  titulo: 'Da Cotação à Ativação do Associado',
  descricao:
    'Passo a passo completo do consultor: criar a cotação, enviar a proposta, acompanhar a assinatura, validar cadastro, agendar a instalação e ativar o associado.',
  categoria: 'Operação Comercial',
  tempoEstimadoMin: 12,
  novo: true,
  steps: [
    {
      numero: 1,
      titulo: 'Identifique o cliente (Lead)',
      descricao:
        'Antes de cotar, registre o cliente como lead. Se ele já existe na base, abra o cadastro existente — nunca duplique. O lead garante rastreabilidade da venda e o vínculo correto com a comissão.',
      dicas: [
        'Pesquise pelo telefone ou CPF antes de criar um novo lead.',
        'Confirme que você é o vendedor responsável (o lead vai amarrar a comissão a você).',
      ],
      links: [
        { label: 'Abrir Leads', url: '/vendas/leads' },
      ],
    },
    {
      numero: 2,
      titulo: 'Inicie uma nova cotação',
      descricao:
        'Em Vendas › Cotação, clique em "Nova Cotação". Informe a placa (ou marque 0KM), o ano e a versão FIPE do veículo. O sistema busca a tabela FIPE automaticamente e detecta a categoria do veículo (carro, moto, diesel, blindado etc.).',
      imagem: novaCotacaoBotao,
      dicas: [
        'Para veículo 0KM use a opção 0KM e anexe CRLV/CRV/NF (chassi sempre digitado manualmente).',
        'Confira a categoria detectada — ela define quais planos aparecem.',
      ],
      links: [
        { label: 'Nova Cotação', url: '/vendas/cotacoes' },
      ],
    },
    {
      numero: 3,
      titulo: 'Selecione o tipo de venda',
      descricao:
        'No modal "O que você deseja fazer?" escolha o tipo de entrada correto: Nova Cotação (cliente novo ou lead), Substituição de Placa, Troca de Titularidade, Migração ou Inclusão de Veículo. Cada opção dispara um fluxo específico (carências, documentos e validações mudam conforme o tipo).',
      imagem: tipoVendaModal,
      dicas: [
        'Nova Cotação: cliente novo ou lead que quer se associar.',
        'Substituição de Placa: o associado trocou de carro e quer levar a proteção para o novo veículo.',
        'Troca de Titularidade: veículo vendido — novo dono quer manter a proteção.',
        'Migração: cliente vindo de outra associação, sem perder a carência.',
        'Inclusão de Veículo: associado já protegido quer adicionar um segundo veículo.',
      ],
    },
    {
      numero: 4,
      titulo: 'Cotação Comum — preencha dados e veículo',
      descricao:
        'Ao escolher "Nova Cotação", abre o formulário de Cotação Rápida. Preencha os dados de contato do novo associado (nome, telefone/WhatsApp e e-mail opcional) e a placa do veículo — a FIPE é calculada automaticamente. Se preferir, use "ou selecione manualmente" (Tipo, Marca, Modelo, Ano) para conferir o valor FIPE antes de seguir.',
      imagem: cotacaoComumDados,
      dicas: [
        'Telefone/WhatsApp é obrigatório — é por ele que o link da proposta será enviado.',
        'Ative "Este cliente foi indicado por um associado?" quando houver indicação para registrar a comissão de indicação.',
        'Sem placa? Use a seleção manual (Tipo › Marca › Modelo › Ano) para validar o valor FIPE.',
      ],
    },
    {
      numero: 5,
      titulo: 'Selecione Região, Uso do Veículo e Tipo de Placa',
      descricao:
        'Ainda na Cotação Rápida, escolha a Região (define a tabela de preços aplicada), o Uso do Veículo (Particular, App, Táxi etc.) e o Tipo de Placa. Esses três campos são obrigatórios para que o sistema mostre apenas os planos corretos para o perfil do veículo.',
      imagem: cotacaoRegiaoUsoPlaca,
      dicas: [
        'A Região muda os valores: SP e Região dos Lagos têm tabela própria (sem 5% off duplicado).',
        'O Tipo de Placa é o que controla categorias especiais como Táxi e Leilão — confira sempre.',
        'Mudou Uso ou Tipo de Placa? A lista de planos é recarregada automaticamente.',
      ],
    },
    {
      numero: 6,
      titulo: 'Escolha o plano',
      descricao:
        'O sistema mostra apenas os planos elegíveis para a categoria/FIPE do veículo. Selecione o plano com a mensalidade que melhor atende o cliente — a Regra do 1% é validada automaticamente.',
      dicas: [
        'Se a Regra do 1% bloquear, ajuste o plano ou solicite aprovação.',
        'Cotações acima do limite de FIPE precisam de aprovação da Diretoria antes de virar contrato.',
      ],
    },
    {
      numero: 7,
      titulo: 'Defina Valor Adicional e Cenário de Adesão',
      descricao:
        'Depois de escolher o plano, informe o Valor Adicional (somado à mensalidade, opcional) e selecione o Cenário de Adesão e Instalação: Cobra Adesão + Rota, Cobra Adesão + Base, Isenta Adesão + Rota ou Isenta Adesão + Base. Sem cenário selecionado, a cotação não avança.',
      imagem: cotacaoValorCenario,
      dicas: [
        'Rota = técnico vai até o cliente. Base = cliente leva o veículo na base.',
        'Use "Isenta Adesão" só quando estiver dentro da política comercial — adesão isenta sem alçada exige aprovação.',
        'O Valor Adicional é somado à mensalidade do plano (não substitui).',
      ],
    },
    {
      numero: 8,
      titulo: 'Envie a proposta ao cliente',
      descricao:
        'Conclua a cotação para gerar a proposta. O sistema cria automaticamente o documento Autentique e envia o link de assinatura por WhatsApp/e-mail. Acompanhe o status na tela do contrato.',
      dicas: [
        'O link público da proposta também pode ser compartilhado manualmente, se necessário.',
        'Se o cliente pedir alterações, edite a cotação e gere uma nova proposta — não force assinatura de proposta antiga.',
      ],
      links: [
        { label: 'Contratos', url: '/vendas/contratos' },
      ],
    },
    {
      numero: 9,
      titulo: 'Cliente assina com biometria facial',
      descricao:
        'A assinatura é feita pelo Autentique exclusivamente por e-mail com reconhecimento facial (PF_FACIAL). Após assinar, o sistema atualiza o status do contrato para "Assinado" e move o associado para a fila de Cadastro.',
      dicas: [
        'Não há assinatura manual/desenhada — somente facial.',
        'Se faltar crédito Autentique, o sistema avisa; nesse caso, acione o suporte interno.',
      ],
    },
    {
      numero: 10,
      titulo: 'Aprovação de Cadastro',
      descricao:
        'A equipe de Cadastro confere documentos (CNH, CRLV/CRV/NF) e libera a proposta. Documentos validados por OCR ainda passam por revisão manual obrigatória. Acompanhe em Cadastro › Propostas Pendentes.',
      dicas: [
        'Se algo for recusado, oriente o cliente a reenviar pelo link e mantenha o lead atualizado.',
      ],
      links: [
        { label: 'Propostas Pendentes', url: '/cadastro/propostas' },
      ],
    },
    {
      numero: 11,
      titulo: 'Agendamento de instalação ou autovistoria',
      descricao:
        'Após o cadastro aprovado, o cliente agenda a instalação do rastreador (obrigatória para Diesel, carros FIPE ≥ R$ 30k e motos ≥ R$ 9k). Para FIPE menores, pode ser autovistoria ou vistoria presencial sem rastreador.',
      dicas: [
        'A data de instalação é a escolhida pelo cliente — o sistema NUNCA agenda para "hoje" automaticamente.',
        'Vistoria Base é por período (Manhã/Tarde).',
      ],
    },
    {
      numero: 12,
      titulo: 'Conclusão da instalação / vistoria',
      descricao:
        'O técnico (Base, Rota, Prestador externo ou Autovistoria) registra fotos e finaliza o serviço no app. O contrato fica aguardando a aprovação final do Monitoramento.',
      dicas: [
        'Toda instalação concluída cai automaticamente na fila de Aprovação de Associados.',
      ],
    },
    {
      numero: 13,
      titulo: 'Aprovação de Monitoramento',
      descricao:
        'O time de Monitoramento confere fotos, posição do rastreador e laudo, e aprova ou solicita ajuste. Sem essa aprovação, o veículo não fica ativo e a cobertura permanece suspensa.',
      links: [
        { label: 'Aprovações de Associados', url: '/monitoramento/aprovacoes-unificadas' },
      ],
    },
    {
      numero: 14,
      titulo: 'Ativação do associado e sync com SGA',
      descricao:
        'Aprovado o monitoramento, o sistema chama a rotina central de ativação que promove associado, contrato e veículo para "ativo", libera as coberturas e sincroniza o cadastro com o SGA Hinova (situação Pendente — promoção para Ativo é feita manualmente no SGA pela equipe interna).',
      dicas: [
        'A partir desse ponto, o cliente passa a aparecer como Associado Ativo no app e pode ser cobrado normalmente.',
        'Comissões da venda são liberadas conforme a grade do vendedor que originou a venda.',
      ],
    },
  ],
};
