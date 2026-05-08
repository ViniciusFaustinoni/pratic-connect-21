import { Tutorial } from './types';
import novaCotacaoBotao from '@/assets/tutoriais/nova-cotacao-botao.png';
import tipoVendaModal from '@/assets/tutoriais/tipo-venda-modal.png';
import cotacaoComumDados from '@/assets/tutoriais/cotacao-comum-dados.png';
import cotacaoRegiaoUsoPlaca from '@/assets/tutoriais/cotacao-regiao-uso-placa.png';
import cotacaoValorCenario from '@/assets/tutoriais/cotacao-valor-cenario.png';
import cotacaoVencimentoCriar from '@/assets/tutoriais/cotacao-vencimento-criar.png';
import cotacaoCopiarLink from '@/assets/tutoriais/cotacao-copiar-link.png';
import associadoEscolhaPlano from '@/assets/tutoriais/associado-escolha-plano.png';
import associadoDocumentos from '@/assets/tutoriais/associado-documentos.png';
import associadoVistoriaBaseData from '@/assets/tutoriais/associado-vistoria-base-data.png';
import associadoAssinaturaEmail from '@/assets/tutoriais/associado-assinatura-email.png';
import associadoAgendamentoTecnico from '@/assets/tutoriais/associado-agendamento-tecnico.png';
import associadoPagamentoPix from '@/assets/tutoriais/associado-pagamento-pix.png';

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
      titulo: 'Defina a Data de Vencimento e crie a cotação',
      descricao:
        'Selecione o dia de vencimento das mensalidades (dia 10 ou dia 15), confira o resumo final (associado, veículo, FIPE e plano selecionado com a mensalidade) e clique em "Criar Cotação" para gerar a proposta.',
      imagem: cotacaoVencimentoCriar,
      dicas: [
        'O dia escolhido vale para todas as mensalidades futuras — confirme com o cliente.',
        'Revise o nome do associado, o veículo e o valor antes de clicar em Criar Cotação.',
      ],
    },
    {
      numero: 9,
      titulo: 'Abra a cotação criada e envie o link ao associado',
      descricao:
        'Após "Criar Cotação", abra a cotação gerada (status Rascunho) e use os botões do topo: "Copiar para WhatsApp" envia o texto pronto com o link da proposta, "PDF" baixa a proposta, "Acessar Link" abre a página pública e "Copiar Link" copia só a URL para colar onde precisar. "Duplicar" cria uma cópia para simular outro cenário.',
      imagem: cotacaoCopiarLink,
      dicas: [
        'Prefira "Copiar para WhatsApp" — o texto já vai formatado com saudação, valores e link.',
        'O link público é o mesmo que o cliente recebe por WhatsApp/e-mail — pode reenviar quantas vezes precisar.',
        'Se o cliente pedir alterações, edite a cotação ou duplique para um novo cenário; não force assinatura de proposta antiga.',
      ],
      links: [
        { label: 'Contratos', url: '/vendas/contratos' },
      ],
    },
    {
      numero: 10,
      titulo: '👤 [Ação do Associado] Escolher o plano na página pública',
      descricao:
        'ATENÇÃO: esta etapa é executada pelo PRÓPRIO ASSOCIADO, não pelo vendedor. Ao abrir o link enviado, o cliente vê a jornada pública (Escolha do Plano › Documentos › Contrato › Vistoria › Pagamento). Na primeira tela ele compara os planos elegíveis, clica em "Selecionar" no plano desejado (o card fica marcado como "Selecionado ✓") e confirma em "Continuar com este plano" para avançar para a etapa de Documentos.',
      imagem: associadoEscolhaPlano,
      dicas: [
        'O vendedor NÃO deve concluir essa etapa pelo cliente — a escolha precisa partir do associado para validar o aceite.',
        'Os planos exibidos são exatamente os elegíveis para o veículo cotado (mesma regra da cotação interna).',
        'Se o cliente tiver dúvida entre planos, oriente por WhatsApp/ligação, mas deixe ele clicar em "Continuar com este plano".',
        'Só depois desse aceite o fluxo libera Documentos › Contrato (assinatura facial Autentique).',
      ],
    },
    {
      numero: 11,
      titulo: '👤 [Ação do Associado] Enviar documentos (leitura por IA)',
      descricao:
        'ATENÇÃO: esta etapa também é executada pelo PRÓPRIO ASSOCIADO. Após escolher o plano, ele cai na tela de Documentos e envia tudo de uma só vez (CNH/RG/CiN, CRLV/Nota Fiscal/ATPV-e e Comprovante de Residência) — pode arrastar todos os arquivos juntos. A IA identifica automaticamente cada tipo de documento e pré-preenche os dados. O cliente confere os dados extraídos, completa Contato (e-mail e WhatsApp) e clica em "Continuar" para seguir para a assinatura.',
      imagem: associadoDocumentos,
      dicas: [
        'O vendedor NÃO sobe documentos pelo cliente — o aceite e os dados precisam vir do próprio associado.',
        'Aceita JPG, PNG e PDF (máx. 10MB por arquivo). Como comprovante de residência, vale também declaração de residência (modelo livre, com CPF e assinatura).',
        'Mesmo com OCR/IA aprovando, todo documento ainda passa por revisão manual no Cadastro.',
        'Chassi (VIN) é sempre digitado manualmente — a IA nunca preenche esse campo.',
        'Se a IA não ler algum dado do veículo, use "A IA não leu tudo? Preencher dados do veículo manualmente".',
      ],
    },
    {
      numero: 12,
      titulo: '👤 [Ação do Associado] Assinar a proposta pelo e-mail (Autentique)',
      descricao:
        'ATENÇÃO: esta etapa também é executada pelo PRÓPRIO ASSOCIADO. Ao avançar de Documentos, a etapa "Contrato" mostra o aviso "SUA PROPOSTA DE FILIAÇÃO ESTÁ NO SEU E-MAIL PARA ASSINATURA!" e o passo a passo "Como assinar via Email": (1) acessar o e-mail cadastrado, (2) abrir o e-mail da Autentique e clicar em "Assinar documento", (3) seguir o fluxo da Autentique com reconhecimento facial (PF_FACIAL), (4) voltar à página da proposta — a confirmação é automática e o fluxo libera Vistoria.',
      imagem: associadoAssinaturaEmail,
      dicas: [
        'A assinatura é exclusivamente por e-mail com biometria facial — não existe assinatura desenhada/manual.',
        'O vendedor NUNCA assina pelo cliente. Se o cliente não receber o e-mail, peça para checar Spam/Promoções antes de reenviar.',
        'Se faltar crédito Autentique, o sistema avisa; nesse caso, acione o suporte interno.',
        'Após assinar, o associado não precisa atualizar a página — a confirmação é automática e o status do contrato vai para "Assinado".',
      ],
    },
    {
      numero: 13,
      titulo: '👤 [Ação do Associado] Escolher modalidade de vistoria',
      descricao:
        'ATENÇÃO: esta etapa também é executada pelo PRÓPRIO ASSOCIADO. Após a assinatura, o sistema avança automaticamente para "Vistoria do Veículo" e mostra até 3 opções: (a) Autovistoria — Roubo & Furto (Recomendado, disponível para planos com cobertura de R&F), (b) Quero que o técnico venha até mim (Sugerido, agendamento em até 48h) e (c) Quero levar meu veículo à Base (endereço da unidade Praticcar). O associado escolhe a modalidade que preferir; o vendedor só orienta caso o cliente tenha dúvida.',
      dicas: [
        'Autovistoria só aparece quando o plano contratado tem cobertura de Roubo & Furto.',
        'Diesel, carros FIPE ≥ R$ 30k e motos ≥ R$ 9k exigem instalação de rastreador (técnico ou base) — autovistoria não substitui a instalação.',
        'A escolha aqui define para qual fila o serviço cai (Autovistoria automática, Rota do técnico ou Agenda da Base).',
      ],
    },
    {
      numero: 14,
      titulo: '👤 [Ação do Associado] Opção A — Autovistoria (Vídeo 360°)',
      descricao:
        'Se o associado escolher Autovistoria, a tela abre o passo a passo "Grave o Vídeo 360°" (Etapa 1 de 2). O cliente grava um único vídeo, pelo celular, seguindo as Instruções de Gravação: (1) frente do veículo com a placa visível, (2) lateral direita caminhando lentamente, (3) traseira com a placa visível, (4) lateral esquerda até voltar à frente, (5) interior (bancos, forração e teto), (6) painel ligado mostrando hodômetro e indicadores, (7) compartimento do motor com o capô aberto. Duração mínima 30 segundos / máxima 2 minutos. Depois, segue para a Etapa 2 (foto do chassi/documentos) e envia.',
      dicas: [
        'Filmar em local bem iluminado, sem cortes — um único vídeo contínuo cobrindo os 7 pontos.',
        'Placa precisa estar legível na frente E na traseira; chassi sempre digitado manualmente (nunca lido por OCR).',
        'Se o vídeo não atender (pontos faltando, escuro, curto demais), a aprovação manual reprova e o cliente refaz pelo mesmo link.',
        'Mesmo aprovada por IA, a autovistoria SEMPRE passa por revisão manual no Monitoramento.',
      ],
    },
    {
      numero: 15,
      titulo: '👤 [Ação do Associado] Opção B — Vistoria presencial (técnico vai até você)',
      descricao:
        'Se o associado escolher "Quero que o técnico venha até mim", abre a tela "Agendar Vistoria Presencial". O cliente seleciona a data nos cards (segunda/terça/quarta…), escolhe o período (Manhã 08:00–12:00 / Tarde 14:00–18:00 — com a quantidade de vagas disponíveis exibida em verde), define quem vai receber o técnico (Eu mesmo ou Outra pessoa — neste caso preenche nome/telefone) e, se quiser, ativa "Permitir encaixe de horário". Ao final, clica em "Revisar agendamento" para confirmar. O técnico vai até o endereço cadastrado em até 48h.',
      imagem: associadoAgendamentoTecnico,
      dicas: [
        'Período é Manhã (08:00–12:00) ou Tarde (14:00–18:00) — não horário fechado. As vagas disponíveis aparecem abaixo de cada período.',
        '"Outra pessoa" exige telefone válido com WhatsApp — é por ele que o técnico avisa o ETA.',
        'Encaixe de horário (opcional): se ativado, e houver um técnico próximo finalizando outro atendimento antes do período agendado, ele pode antecipar a visita. O associado é avisado com antecedência via WhatsApp — agiliza muito a instalação.',
        'Diesel / FIPE ≥ 30k carro / ≥ 9k moto: o técnico instala rastreador junto com a vistoria.',
      ],
    },
    {
      numero: 16,
      titulo: '👤 [Ação do Associado] Opção C — Levar veículo à Base Praticcar',
      descricao:
        'Se o associado escolher "Quero levar meu veículo à Base", a tela mostra o endereço fixo da Oficina Praticcar (Av. Perimetral Brigadeiro Lima e Silva, 592 — Parque Duque, Duque de Caxias/RJ) com os horários de funcionamento (Manhã 08:00–12:00 / Tarde 13:00–18:00). O cliente seleciona uma data nos cards (Segunda 11/Terça 12/Quarta 13/…) e clica em "Confirmar Agendamento" — receberá a notificação com os detalhes do agendamento.',
      imagem: associadoVistoriaBaseData,
      dicas: [
        'A Base só aceita o veículo dentro dos horários informados — chegar fora do horário invalida o agendamento do dia.',
        'O período (Manhã/Tarde) é definido na chegada — basta respeitar o intervalo do horário escolhido.',
        'Vale para vistoria pura (FIPE menor) e também para instalação de rastreador na Base, conforme o plano contratado.',
      ],
    },
    {
      numero: 17,
      titulo: '👤 [Ação do Associado] Pagamento da Taxa de Adesão',
      descricao:
        'Após escolher a modalidade de vistoria, o associado vai para a etapa "Pagamento" (último passo da jornada pública). A tela exibe o valor da Taxa de Adesão e duas formas de pagamento: PIX (QR Code + Copia e Cola) ou Cartão de crédito. No PIX, basta escanear o QR pelo app do banco ou copiar o código "PIX Copia e Cola" e colar no banco. Concluído o pagamento, o sistema reconhece automaticamente — não precisa enviar comprovante.',
      imagem: associadoPagamentoPix,
      dicas: [
        'Reconhecimento PIX é automático via webhook do Asaas — o cliente vê a confirmação na hora.',
        'Cartão de crédito é cobrado e confirmado na mesma tela; também é automático.',
        'Sem o pagamento da Taxa de Adesão a proposta não avança para Aprovação de Cadastro.',
        'O valor da Taxa de Adesão é calculado como percentual da FIPE conforme a regra do plano contratado.',
      ],
    },
    {
      numero: 18,
      titulo: '🏢 Análise interna: Cadastro → Vistoria/Instalação → Monitoramento → Ativação',
      descricao:
        'A partir daqui o consultor não precisa fazer mais nada — entra em ação a equipe interna (Cadastro + Operação + Monitoramento) que conduz toda a análise documental, vistoria, instalação do rastreador (quando aplicável) e a aprovação final que ativa o associado. O fluxo é totalmente rastreável e o cliente é avisado por WhatsApp em cada mudança de status.',
      dicas: [
        '1️⃣ **Cadastro** confere CNH e CRLV/CRV/NF (mesmo OCR aprovado passa por revisão manual). Se houver pendência, o cliente recebe link por WhatsApp para reenviar.',
        '2️⃣ **Operação** executa a vistoria escolhida pelo associado (Autovistoria 360°, Técnico no endereço ou Base Praticcar). Para Diesel / Carro FIPE ≥ R$ 30k / Moto ≥ R$ 9k, o rastreador é instalado nessa mesma visita.',
        '3️⃣ **Monitoramento** recebe automaticamente a fila com fotos, posição do rastreador e laudo. Aprova, reprova ou pede ajustes.',
        '4️⃣ **Ativação automática**: aprovada a vistoria/instalação, a edge function `ativar-associado` promove associado, contrato e veículo para "ativo", libera as coberturas e sincroniza com o SGA Hinova (situação Pendente — promoção para Ativo é manual no painel SGA).',
        '📩 **O que o associado recebe por WhatsApp:** confirmação de cada etapa (cadastro aprovado, técnico a caminho com ETA, vistoria concluída, contrato ativado) e, ao ser ativado, **um link exclusivo para criar a senha de acesso ao app do associado** (`/app/criar-senha?token=…`).',
        '🔐 **Criação de senha no app:** o link tem validade limitada e uso único. O associado define senha (mín. 6 caracteres com pelo menos 1 número), confirma e já entra direto no App do Associado — onde acompanha boletos, aciona assistência, abre sinistros e gerencia o veículo.',
        '💰 **Comissões** da venda são liberadas conforme a grade do vendedor que originou a cotação (a cadeia supervisor/gerente/agência também é paga).',
      ],
      links: [
        { label: 'Propostas Pendentes (Cadastro)', url: '/cadastro/propostas' },
        { label: 'Aprovações de Associados (Monitoramento)', url: '/monitoramento/aprovacoes-unificadas' },
      ],
    },
  ],
};
