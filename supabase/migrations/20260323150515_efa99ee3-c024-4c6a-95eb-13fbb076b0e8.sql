-- Insert 14 templates for billing/relationship sequence
INSERT INTO whatsapp_meta_templates (nome, categoria, idioma, status, header_tipo, corpo, rodape, variaveis_exemplo)
VALUES
-- 1. Boleto gerado (emissão)
('boleto_gerado_v1', 'UTILITY', 'pt_BR', 'DRAFT', 'none',
'Olá {{1}}, aqui é da PRATIC CAR, tudo bem? 😊

Estamos enviando o boleto QUE JÁ ESTÁ disponível, referente a proteção do veículo: {{2}}

Placa: {{3}}

Com vencimento em: {{4}}

No valor de: {{5}}.

⚠️ Caso já tenha efetuado o pagamento, favor desconsiderar.

Estou enviando abaixo, para copiar e colar, a linha digitável para realizar o pagamento junto ao banco e também o documento em PDF 👇

{{6}}',
'ESSA MENSAGEM É AUTOMÁTICA. FAVOR NÃO RESPONDER!',
'{"1": "João", "2": "Toyota Corolla", "3": "ABC-1234", "4": "20/03/2026", "5": "R$ 150,00", "6": "23793.38128 60000.000003 00000.000404 1 84340000015000"}'),

-- 2. Lembrete desconto D-6
('lembrete_desconto_v1', 'UTILITY', 'pt_BR', 'DRAFT', 'none',
'O PRAZO PARA DESCONTO DE 5% É ATÉ AMANHÃ!! NÃO PERCA! 🤩🚨

Bom dia Sr(a) {{1}}, tudo bem? Passando para informar que o seu boleto vence em {{2}} e o(a) Sr(a) consegue efetuar o PAGAMENTO COM 5% DE DESCONTO ATÉ AMANHÃ

Estou enviando abaixo, para copiar e colar, a linha digitável para realizar o pagamento junto ao banco e também o documento em PDF 👇

{{3}}',
NULL,
'{"1": "João", "2": "20/03/2026", "3": "23793.38128 60000.000003 00000.000404 1 84340000015000"}'),

-- 3. Boleto vence hoje D+0
('boleto_vence_hoje_v1', 'UTILITY', 'pt_BR', 'DRAFT', 'none',
'Bom dia Sr(a) {{1}}, tudo bem?? Passando para lembrar que o seu boleto com valor de {{2}} VENCE HOJE ({{3}})! 🤩

Lembrando que seu veículo só estará protegido até hoje!!!

Não deixe seu veículo {{4}} placa {{5}} ficar desprotegido!🚨🚨🚨

⚠️ Caso já tenha efetuado o pagamento, favor desconsiderar.

Estou enviando abaixo, para copiar e colar, a linha digitável para realizar o pagamento junto ao banco 👇

{{6}}

A PRATIC CAR DESEJA UMA ÓTIMA SEMANA! ❤️',
'ESSA MENSAGEM É AUTOMÁTICA. FAVOR NÃO RESPONDER!',
'{"1": "João", "2": "R$ 150,00", "3": "20/03/2026", "4": "Toyota Corolla", "5": "ABC-1234", "6": "23793.38128 60000.000003 00000.000404 1 84340000015000"}'),

-- 4. Boleto vencido urgente D+1 a D+4
('boleto_vencido_urgente_v1', 'UTILITY', 'pt_BR', 'DRAFT', 'none',
'SEU BOLETO ESTÁ VENCIDO!! 🚨🚨🚨

Bom dia Sr(a) {{1}}, tudo bem?

Seu boleto venceu {{2}}.

Corra e efetue o pagamento ainda hoje, para que não seja necessário a realização da revistoria!

LEMBRANDO QUE O SEU VEÍCULO JÁ SE ENCONTRA DESPROTEGIDO! 🗣😞

SEGUE O BOLETO ATUALIZADO!

⚠️ Caso já tenha efetuado o pagamento, favor desconsiderar.',
'ESSA MENSAGEM É AUTOMÁTICA. FAVOR NÃO RESPONDER!',
'{"1": "João", "2": "20/03/2026"}'),

-- 5. Último dia sem revistoria D+5
('ultimo_dia_sem_revistoria_v1', 'UTILITY', 'pt_BR', 'DRAFT', 'none',
'HOJE SERÁ O ÚLTIMO DIA PARA EFETUAR O PAGAMENTO SEM A REVISTORIA! ⚠️

🚨🚗🛵

Corra e efetue o PAGAMENTO ATÉ HOJE SEM A REALIZAÇÃO DA REVISTORIA!!!

😱😨

(Lembrando que o seu vencimento foi {{1}}.)

Seu veículo permanece desprotegido, corra e efetue o pagamento hoje mesmo! ✅

⚠️ Caso já tenha efetuado o pagamento, favor desconsiderar.

A PRATIC CAR DESEJA UM ÓTIMO FINAL DE SEMANA! 😊

SEGUE O BOLETO ATUALIZADO ❗',
NULL,
'{"1": "20/03/2026"}'),

-- 6. Impedimento pagamento D+6
('impedimento_pagamento_v1', 'UTILITY', 'pt_BR', 'DRAFT', 'none',
'Olá, bom dia, Sr(a). {{1}},

Espero que esteja bem. Sou da equipe da Pratic Car – Proteção Veicular. ❤️💙

Notei que houve um impedimento no pagamento referente ao boleto com vencimento em {{2}}, no valor de {{3}} e associado à placa {{4}}. 🙁

Após tentativas de contato sem sucesso, gostaria de informar que, devido ao prazo, precisaremos realizar uma breve revistoria no seu veículo.

Fico aguardando seu retorno na medida do possível.

Atenciosamente,

Relacionamento Praticcar 😁',
NULL,
'{"1": "João", "2": "20/03/2026", "3": "R$ 150,00", "4": "ABC-1234"}'),

-- 7. Reforço contato D+7
('reforco_contato_v1', 'UTILITY', 'pt_BR', 'DRAFT', 'none',
'Prezado Sr(a). {{1}}, tudo bem?

Espero que esteja bem! 😊🫱🏻‍🫲🏼

Gostaríamos de reforçar nosso contato, pois infelizmente não obtivemos sucesso novamente.

Estamos entrando em contato para solicitar uma atualização sobre o boleto em aberto com vencimento em {{2}} e a realização da revistoria pendente.

A revistoria pode ser realizada por fotos ou presencial! ✅

Sua colaboração é fundamental para que possamos manter seu histórico em dia em nosso sistema.

Ficamos no aguardo de um retorno para podermos resolver essa pendência prontamente. 😁

Agradecemos sua atenção e compreensão.

Atenciosamente, Pratic Car ❤️💙',
NULL,
'{"1": "João", "2": "20/03/2026"}'),

-- 8. Urgência revistoria D+8
('urgencia_revistoria_v1', 'UTILITY', 'pt_BR', 'DRAFT', 'none',
'Prezado Sr. {{1}}, espero que se encontre bem! 😊

Gostaria de solicitar, com urgência, um retorno referente à realização da revistoria em seu veículo.

É crucial atualizarmos o seu histórico no sistema dentro do prazo estabelecido.

Até o momento, não recebemos nenhum retorno de sua parte quanto ao agendamento da revistoria.

Sua pronta atenção a esta solicitação será fundamental para garantir a continuidade do processo com eficiência e precisão.

Agradeço desde já pela sua cooperação e aguardo ansiosamente pelo seu retorno.

Atenciosamente, Pratic Car ❤️💙',
NULL,
'{"1": "João"}'),

-- 9. Alerta retirada D+9
('alerta_retirada_v1', 'UTILITY', 'pt_BR', 'DRAFT', 'none',
'Prezado Sr. {{1}}, espero que esteja bem!! 🙌🏻

Gostaríamos de solicitar, com urgência, o seu retorno referente à realização da revistoria em seu veículo.

Lembrando que seu boleto permanece em aberto, com a data de vencimento sendo {{2}}.

É imprescindível atualizarmos o seu histórico em nosso sistema, no entanto, até o momento não foi realizada a revistoria ainda. 😕

Por favor, entre em contato o mais breve possível para que não seja necessário o agendamento da retirada do rastreador.

Ficamos à disposição para esclarecer quaisquer dúvidas adicionais. Agradecemos a sua atenção e colaboração neste assunto. 💙❤️

Atenciosamente, Pratic Car',
NULL,
'{"1": "João", "2": "20/03/2026"}'),

-- 10. Última tentativa D+10
('ultima_tentativa_v1', 'UTILITY', 'pt_BR', 'DRAFT', 'none',
'Bom dia, Sr(a) {{1}}

Espero que esteja bem! Gostaríamos de contar com a sua colaboração para a realização da revistoria no veículo, uma vez que ainda não conta com a proteção necessária no momento. 😞

O setor responsável entrará em contato em breve para agendar a retirada do rastreador, caso a revistoria não seja agendada.

Caso tenha dificuldade em realizar o procedimento através de fotos, estamos à disposição para agendar uma revisão presencial! ✅🙏🏻

A prioridade é garantir a sua comodidade e proteção.

O boleto deverá ser quitado no dia da revistoria!

Agradecemos antecipadamente pela sua colaboração e compreensão. Estamos à disposição para quaisquer esclarecimentos adicionais que possam surgir. 💙❤️

Tenha um ótimo dia!

Com carinho e atenção, Pratic Car',
NULL,
'{"1": "João"}'),

-- 11. Aviso negativação D+11
('aviso_negativacao_v1', 'UTILITY', 'pt_BR', 'DRAFT', 'none',
'Prezado {{1}}, esperamos que o(a) Sr(a) esteja bem!

Gostaríamos de chamar a sua atenção para uma questão importante referente ao pagamento do boleto vencido com data em {{2}} no valor de {{3}}. PLACA: {{4}}

Na qualidade de representantes da Pratic Car - Proteção Veicular, viemos através deste comunicado gentilmente solicitar a regularização do débito pendente. Reconhecemos que imprevistos podem acontecer e estamos aqui para ajudá-lo a resolver essa situação da melhor forma possível. 😊

Para garantir que seu nome não seja incluído nos órgãos de proteção ao crédito (como SPC E SERASA), disponibilizamos a você um prazo adicional de até 5 dias para entrar em contato com um de nossos atendentes e efetuar o pagamento.',
NULL,
'{"1": "João", "2": "20/03/2026", "3": "R$ 150,00", "4": "ABC-1234"}'),

-- 12. Débito com multa D+12
('debito_com_multa_v1', 'UTILITY', 'pt_BR', 'DRAFT', 'none',
'Prezado(a) {{1}},

Esperamos que esteja bem. 😁

Verificamos que a revistoria ainda não foi realizada! 😞

Gostaríamos de lembrá-lo(a) que consta em nosso sistema um débito referente ao boleto vencido em {{2}}, no valor de {{3}} + R$ 400,00 (multa referente a não devolução do equipamento rastreador - apenas se o seu veículo tiver o equipamento instalado), vinculado ao veículo de placa: {{4}}.

Caso o pagamento não seja identificado dentro do prazo estipulado, o débito poderá ser registrado nos órgãos de proteção ao crédito (SPC/Serasa).

Para evitar qualquer transtorno, concedemos um prazo de até 3 dias para que entre em contato com nossa equipe e regularize a pendência.',
NULL,
'{"1": "João", "2": "20/03/2026", "3": "R$ 150,00", "4": "ABC-1234"}'),

-- 13. Regularize cadastro D+13
('regularize_cadastro_v1', 'UTILITY', 'pt_BR', 'DRAFT', 'none',
'Olá Sr(a) {{1}}, tudo bem?

Gostaria de lhe comunicar que o seu boleto ainda está aberto em nosso sistema, com data de vencimento: {{2}}. ⚠️

Previna que seu nome seja registrado em entidades de proteção ao crédito, tais como SPC e SERASA! 🛑

Regularize sua dívida conosco, para que possamos reativar ou inativar sua placa em nosso sistema. 🚗

Qualquer questão, estamos disponíveis. 💬',
NULL,
'{"1": "João", "2": "20/03/2026"}'),

-- 14. Reativação proteção D+14 e D+61
('reativacao_protecao_v1', 'UTILITY', 'pt_BR', 'DRAFT', 'none',
'Olá, {{1}}! Tudo bem? 😁

Notamos que seu veículo está sem a cobertura ativa no momento.

Que tal regularizarmos isso hoje para você voltar a rodar com total tranquilidade e segurança? 🛡️

Para facilitar, você pode escolher como prefere fazer sua revistoria:

DIGITE 1 (Rápida): Realizar a revistoria agora mesmo por fotos (direto pelo celular em nosso aplicativo). 📸

DIGITE 2 (Presencial): Agendar uma visita para realizarmos a revistoria presencialmente. 📅

Qual dessas opções fica melhor para você? Me avisa aqui e eu já agilizo tudo! 💙❤️',
NULL,
'{"1": "João"}');
