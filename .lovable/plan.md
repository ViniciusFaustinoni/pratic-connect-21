## Diagnóstico

ANDREIA (KZH6F38, FIPE R$ 40.539 — acima do mínimo) fez autovistoria opcional (já aprovada). Para sair da fila do Cadastro e liberar R/F adiantado, falta apenas o Cadastro aprovar — mas a edge `aprovar-proposta` bloqueia com `409 sem_agendamento` porque **não existe** `instalacoes`, nem `servicos.tipo='instalacao'`, nem `agendamentos_base` para essa cotação.

O agendamento "19/05 tarde com encaixe" que você relatou foi combinado fora do sistema; nunca foi materializado.

## Correção

### 1. Materializar a instalação técnica (atendendo ao guard)

`INSERT` em `instalacoes` para o contrato `0aefdc1f-…`:
```
data_agendada = 2026-05-19
periodo       = 'tarde'
status        = 'agendada'
encaixe       = true    (campo padrão de encaixe, se existir na tabela)
endereco_*    = herdado da cotacao.vistoria_endereco_*
```
Espelhar com um `INSERT` em `servicos` (`tipo='instalacao'`, mesma data/periodo, `status='agendada'`) — segue o padrão da `criar-instalacao-pos-pagamento`.

### 2. Aprovar Cadastro

Atualizar contrato:
```
cadastro_aprovado = true
aprovado_por      = <profile.id do Diretor>
aprovado_em       = now()
```
Isso tira da fila Cadastro, libera R/F adiantado (autovistoria já aprovada), e o veículo segue `instalacao_pendente` aguardando a visita do técnico em 19/05 tarde.

### 3. Sem alterações de código

Edge function, RLS, triggers — nada muda. É correção pontual de dados, não de fluxo.

### Confirmação necessária

Confirma os dois pontos antes de eu aplicar?

- **Data e período**: 19/05/2026, tarde, com encaixe → OK?
- **Endereço da instalação**: usar o mesmo endereço da autovistoria (`cotacao.vistoria_endereco_*`)? Ou outro endereço foi combinado?

Após confirmação, aplico via 1 migration (INSERT instalacoes + INSERT servicos + UPDATE contratos).

## Observação — origem do problema

Esse caso é diferente do ANDRE/ROMARIO (que tinham `instalacoes` agendadas corretamente). Andreia caiu numa lacuna do fluxo "autovistoria acima FIPE": o cliente provavelmente saiu do link público antes de agendar a instalação técnica, ou agendou e o registro não foi gravado. Posso, se você quiser, abrir uma segunda tarefa depois para investigar a causa-raiz e adicionar um guard que force o cliente a completar o agendamento antes de finalizar a autovistoria opcional — mas isso é fora do escopo desta correção pontual.
