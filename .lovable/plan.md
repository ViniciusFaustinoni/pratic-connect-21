## Contexto

Hoje, `supabase/functions/efetivar-troca-titularidade/index.ts` faz a troca de titularidade na Hinova em duas etapas:

1. `alterarSituacaoVeiculoHinova(codVeicAtual, 3)` — cancela o veículo do antigo titular.
2. `cadastrarVeiculoHinova({ codigo_associado: novoTitular, ... })` — cria um veículo novo para o novo titular.

Isso gera um novo `codigo_veiculo`, quebra o histórico Hinova do veículo e ignora o caminho oficial `POST /alterar/veiculo` — que já está implementado e em uso em `sga-hinova-sync` para o mesmo cenário (e está marcado como canônico em `mem://logic/integrations/sga-alterar-veiculo-troca-titularidade`).

Existem **dois lugares** com esse padrão no arquivo:

- **Bloco A** — fluxo principal: linhas ~1230–1352.
- **Bloco B** — retry/recuperação SGA: linhas ~130–230.

Ambos precisam migrar para `alterarVeiculoHinova`.

## O que vai mudar

### 1. Fluxo canônico em `efetivar-troca-titularidade`

Onde hoje há `alterarSituacaoVeiculoHinova(cancelado) → cadastrarVeiculoHinova(novo titular)`, passar a:

1. Buscar o veículo no Hinova por chassi (já feito hoje via `buscarVeiculoPorChassi`, com fallback por placa para coerência com `sga-hinova-sync`).
2. Se já vinculado ao novo titular → idempotente, nada a fazer (comportamento atual preservado).
3. Caso contrário, montar payload mínimo:
   ```
   {
     codigo_veiculo: <codigoVeiculoSga existente>,
     codigo_associado: <codigoAssociadoNovo>,
     // transferir_agregados: omitido por enquanto
   }
   ```
4. Chamar `alterarVeiculoHinova(supabase, payload)`.
5. Em sucesso: `sgaCodigoVeiculoNovo = codigoVeiculoSga` (mesmo valor que já existia — esse é o ponto central do critério de aceitação).
6. Em falha: lançar erro com prefixo claro `SGA alterarVeiculo (troca titularidade) falhou: …` — mantém a semântica atual de marcar `sga_status='falha'` e ir para fila de retry. **Não** seguir para "efetivada".

### 2. Caso degenerado: veículo nunca sincronizado no SGA

Se `buscarVeiculoPorChassi` (e fallback por placa) **não encontrar** o veículo no Hinova (ou seja, `codigoVeiculoSga` é `null`), significa que o titular antigo nunca foi sincronizado. Nesse cenário não há o que alterar — o caminho válido continua sendo `cadastrarVeiculoHinova` com o novo titular (com toda a cadeia de fallback de modelo/FIPE que já existe).

Esse fallback é mantido **explicitamente** com log/comentário deixando claro que é o caminho legado e só ocorre quando o veículo não existe no Hinova. Não roda mais `alterarSituacaoVeiculoHinova(cancelado)`.

### 3. Ponto preparado para `transferir_agregados`

A propriedade `transferir_agregados` fica explicitamente **omitida** do payload por enquanto. A função `alterarVeiculoHinova` já aceita esse campo opcional — basta o caller passar quando a regra de negócio for definida. Adicionar comentário acima do payload:

```ts
// transferir_agregados: regra ainda em definição. Quando definida,
// passar array de codigo_voluntario aqui (ver sga-hinova-sync linha ~283).
```

Sem flag em `configuracoes` neste prompt (a `sga-hinova-sync` já tem uma; manter ambos paralelos seria ruído).

### 4. Voluntário (`codigo_voluntario`)

Fora de escopo deste prompt. O fluxo de `sga-hinova-sync` resolve voluntário porque é um sweep que cobre cenários antigos; no `efetivar-troca` o novo titular acabou de ser criado e não tem voluntário ainda. **Não enviar** `codigo_voluntario` aqui.

### 5. Persistência local

Inalterado: continua escrevendo `veiculos.codigo_hinova = sgaCodigoVeiculoNovo`. A diferença é que esse valor agora é **idêntico** ao que já estava em `veiculos.codigo_hinova` antes da troca — comportamento esperado pelo critério de aceitação.

## O que NÃO muda

- Cadastro do novo associado no SGA (`cadastrarOuAtualizarAssociadoHinova`).
- Cancelamento local do antigo titular órfão.
- Criação do contrato local, triggers, religar cobertura, reapontar rastreador.
- Softruck / Rede Veículos.
- Estrutura de logs/fila SGA não-bloqueante.
- `sga-hinova-sync` (já está correto — serve de referência).

## Arquivos tocados

- `supabase/functions/efetivar-troca-titularidade/index.ts` — substituir os dois blocos (linhas ~130–230 e ~1230–1352). Importar `alterarVeiculoHinova` do `_shared/hinova-client.ts` (já exportado).
- `mem://logic/integrations/sga-alterar-veiculo-troca-titularidade.md` — atualizar para registrar que agora **dois** caminhos usam `/alterar/veiculo` (efetivar + sweep), não só o sweep.

## Validação

1. Disparar uma troca de titularidade em ambiente de teste com veículo já sincronizado no SGA.
2. Antes: anotar `veiculos.codigo_hinova` da placa.
3. Após efetivar: confirmar que `solicitacoes_troca_titularidade.sga_codigo_veiculo_novo` e `veiculos.codigo_hinova` são **iguais** ao valor anotado.
4. `buscarVeiculoPorChassi` deve retornar `codigo_associado` = código do novo titular.
5. Logs devem mostrar `alterarVeiculo` em vez de `alterarSituacaoVeiculo(3)` + `cadastrarVeiculo`.

## Riscos

- **Veículo não existe no SGA**: tratado pelo fallback degenerado (cadastrar com novo titular) — mesmo resultado de antes para esse caso de borda.
- **Hinova rejeita `/alterar/veiculo`**: troca não avança, vai pra fila de retry (igual hoje), mensagem de erro identifica o passo.
- **Agregados**: campo fica preparado mas omitido — não regride nada já que hoje também não é enviado.
