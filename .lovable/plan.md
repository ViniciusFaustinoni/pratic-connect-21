# Plano para corrigir o cancelamento do veículo e remover todos os processos das filas

## O que vou ajustar

1. Corrigir a cascata do `cancelar-veiculo`
   - Ao cancelar um veículo, além de cotações, instalações, serviços, vistorias e contrato, também encerrar os `documentos_solicitados` vinculados ao processo desse veículo.
   - Usar o status já suportado pelo banco (`cancelado`) em vez de deixar a pendência viva.
   - Manter o escopo no veículo/contrato cancelado, sem afetar outros veículos do mesmo associado.

2. Corrigir as consultas das filas e alertas
   - Ajustar a fila do sino de `Documentos Pendentes` para não mostrar pendências de contrato/veículo já cancelado.
   - Ajustar a leitura de propostas pendentes no Cadastro para ignorar documentos solicitados de processos cancelados.
   - Revisar a tela pública de acompanhamento para não exibir pendências de um processo já cancelado.

3. Bloquear efeitos colaterais após cancelamento
   - Ajustar rotinas que ainda consomem `documentos_solicitados` pendentes, como lembretes/WhatsApp, para ignorar itens cancelados ou contratos cancelados.
   - Garantir que o cancelamento faça essas pendências sumirem das filas imediatamente após invalidação/refetch.

4. Validar o caso real
   - Conferir o fluxo do caso KRN6G76 para garantir que, após o cancelamento, ele não apareça mais em `Documentos Pendentes` nem em outras filas relacionadas.

## Resultado esperado

- Cancelar um veículo encerra todos os processos daquele veículo.
- O associado continua ativo se ainda tiver outros veículos/processos válidos.
- Pendências do veículo cancelado somem das filas, do sino e dos lembretes.
- Nenhum outro veículo do mesmo associado é afetado.

## Detalhes técnicos

- Hoje o problema principal é que a edge function já cancela várias entidades, mas não encerra `documentos_solicitados` do processo cancelado.
- Os consumidores atuais da fila de pendências consultam `documentos_solicitados` por `associado_id` e/ou `status='pendente'` sem cruzar corretamente com o estado do contrato/veículo.
- O banco já aceita `documentos_solicitados.status = 'cancelado'`, então a correção pode seguir o padrão existente sem mudança estrutural obrigatória.
- A implementação deve preservar auditoria e escopo por contrato/veículo, evitando cancelar pendências de outros veículos do mesmo associado.