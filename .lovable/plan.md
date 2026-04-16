
## Diagnóstico

Wallace foi atribuído a uma tarefa via mapa de monitoramento, mas ao abrir no app dele aparece "Vistoria não encontrada".

### Hipótese principal

A tela do app do técnico (provável `ExecutarVistoria` ou `VistoriaDetalhes`) busca diretamente na tabela `vistorias` por ID. Mas a atribuição feita no mapa pode ter:

1. Criado/atualizado apenas o `servicos` (e/ou `agendamentos_base`), sem registro correspondente em `vistorias`; **OU**
2. Passado o ID do `servico` no link/rota, enquanto a tela espera ID de `vistoria`; **OU**
3. RLS na tabela `vistorias` que filtra por `vistoriador_id = auth.uid()` mas o vínculo foi feito em outra tabela (`servicos.vistoriador_id`), então o select volta vazio → `.maybeSingle()` retorna null → "não encontrada".

### Investigação necessária

1. Identificar a rota/tela do app do técnico que mostra esse erro (busca por "Vistoria não encontrada" no código).
2. Ver qual ID a rota recebe e em qual tabela faz a query.
3. Conferir como `MapaVistoriasContent.tsx` persiste a atribuição (qual edge/mutation, qual tabela atualiza).
4. Checar RLS de `vistorias` para o role `vistoriador`/`profissional`.
5. Validar no banco se existe registro em `vistorias` para a tarefa do Wallace, ou só em `servicos`.

## Plano de correção (a refinar após investigação)

### Cenário A — falta registro em `vistorias`
Garantir que a edge/mutation de atribuição via mapa cria/atualiza também a `vistorias` (ou que a tela do técnico use `servicos` como fonte unificada).

### Cenário B — ID errado na rota
Ajustar `MapaVistoriasContent.tsx` (ou notificação/link enviado ao técnico) para usar o ID correto que a tela espera.

### Cenário C — RLS bloqueando
Atualizar a policy de SELECT em `vistorias` para também permitir leitura quando o profissional está vinculado via `servicos.vistoriador_id` correspondente, OU corrigir a atribuição para preencher `vistorias.vistoriador_id` direto.

### UX
- Trocar a mensagem genérica "Vistoria não encontrada" por algo mais útil quando o problema for permissão/vínculo (ex: "Você não tem acesso a esta tarefa" + botão para voltar à lista de tarefas atuais).
- Adicionar log/console claro com o ID consultado para facilitar debug futuro.

## Arquivos prováveis

- `src/pages/...` ou `src/components/vistorias/Executar*` (tela do técnico).
- `src/components/mapa/MapaVistoriasContent.tsx` (lógica de atribuição via drag).
- Edge function de atribuição (provável `atribuir-servico` ou similar).
- Migration nova de RLS, se for o caso.

## Não vou mexer

- Lógica de vagas, ETA, drag-and-drop (já corrigido).
- Outras telas do app do técnico que já funcionam.

## Resultado

Wallace consegue abrir e iniciar a tarefa atribuída via mapa direto do app dele, sem erro "Vistoria não encontrada". Mensagens de erro futuras ficam mais informativas.
