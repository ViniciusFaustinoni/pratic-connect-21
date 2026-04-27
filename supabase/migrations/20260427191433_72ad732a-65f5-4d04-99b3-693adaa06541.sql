-- Wallace: sem evidência clara — segue concluído com pedido de mais info
UPDATE public.error_reports
SET status = 'em_tratamento',
    tratado_em = now(),
    observacao_diretor = 'Investigado: o sistema não estava fora do ar no horário do relato. A vinculação do rastreador ocorre via fluxo padrão (estoque -> instalado). Caso o problema retorne, pedimos enviar print do erro e o IMEI/placa para diagnóstico mais preciso. Mensagem de erro do hook já exibe a causa real (rastreador indisponível, em manutenção, etc.).'
WHERE id = '787b1d53-2f35-426d-8add-ebf110010b55';

UPDATE public.error_reports
SET status = 'concluido',
    concluido_em = now()
WHERE id = '787b1d53-2f35-426d-8add-ebf110010b55';

-- Kaike: corrigido
UPDATE public.error_reports
SET status = 'em_tratamento',
    tratado_em = now(),
    observacao_diretor = 'Bug corrigido na edge function softruck-buscar-dispositivo: agora reconcilia automaticamente o veiculo_id local quando o rastreador já existia mas só estava vinculado na Softruck. Ao buscar a placa na aba Rastreadores, clique em "Buscar na Softruck" no banner azul — a placa passará a aparecer normalmente e ficará disponível para agendar manutenção.'
WHERE id = '33dd6856-38e1-4a32-9667-0ee0fd6a8371';

UPDATE public.error_reports
SET status = 'concluido',
    concluido_em = now()
WHERE id = '33dd6856-38e1-4a32-9667-0ee0fd6a8371';

-- Kleytonn: implementado
UPDATE public.error_reports
SET status = 'em_tratamento',
    tratado_em = now(),
    observacao_diretor = 'Funcionalidade implementada: novo botão "Marcar como feito (prestador externo)" disponível no detalhe do serviço (ao lado de "Liberar serviço"), visível para Diretor, Admin Master, Desenvolvedor e Coordenador de Monitoramento. Pede local, data, executor e observações. Conclui o serviço, grava o registro nas observações e dispara automaticamente a sincronização com o SGA (Hinova) para liberar as coberturas.'
WHERE id = '363fc0b4-adef-4787-9a2a-d5e4ec4440f5';

UPDATE public.error_reports
SET status = 'concluido',
    concluido_em = now()
WHERE id = '363fc0b4-adef-4787-9a2a-d5e4ec4440f5';