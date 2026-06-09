---
name: SGA /buscar/situacao-financeira-veiculo aceita array
description: Hinova devolve array em produção mesmo a doc dizendo objeto único — parser canônico cobre os dois formatos
type: feature
---

## Regra

`buscarSituacaoFinanceiraVeiculo` em `supabase/functions/_shared/hinova-client.ts` tem que aceitar 3 formatos de resposta HTTP 200:

1. **Objeto único** (como na doc oficial): `{"situacao_financeira": "ADIMPLENTE", …}`
2. **Array de objetos** (visto em produção): `[{"codigo_veiculo":"6711","placa":"LKP2369","situacao_financeira":"ADIMPLENTE", …}, …]`
3. **String/texto puro** (defesa): `"ADIMPLENTE"`

Quando vier array:
- preferir o item cujo `codigo_veiculo` casa com o `codigoVeiculo` consultado;
- senão, item cuja `placa` sanitizada (`A-Z0-9`) casa com a placa consultada;
- senão, `array[0]`;
- se **qualquer** item do array for `INADIMPLENTE`, o resultado é `INADIMPLENTE` (defensivo — Hinova pode devolver matrículas históricas com débito).

Log canônico: `[situacao-financeira] ok <path> param=<p> forma=<array|objeto|texto> -> <ADIMPLENTE|INADIMPLENTE|null> sample=<240 chars>`. A presença do campo `forma=` no log é o marcador para confirmar que o parser está rodando o caminho certo.

## Por quê

Caso CPF 17471431709 / veículo LKP2369 / código 6711 (09/06/2026): Hinova devolveu **200 OK com array de 1 item**. O parser antigo lia `j?.situacao_financeira` direto do array → `undefined` → `null`. Isso fez `sga-listar-boletos-associado` sinalizar todos os veículos sem sinal e `verificar-situacao-financeira-cadastro` classificar como `origem='inconclusivo'` (`sga_sem_sinal_situacao_financeira_em_todos_veiculos`), bloqueando o Cadastro com banner amarelo mesmo o associado estando ADIMPLENTE.

Não é falta de permissão do token (não houve 401/403). É puramente diferença de shape entre a doc oficial e o ambiente real do cliente Hinova.

## Como aplicar

- Não voltar a ler `j?.situacao_financeira` em cima do `JSON.parse` cego.
- Não simplificar o parser para "primeiro item do array" sem o desempate por código/placa — pode misturar matrículas históricas e devolver status errado.
- Mexer só em `buscarSituacaoFinanceiraVeiculo`. `sga-listar-boletos-associado` e `verificar-situacao-financeira-cadastro` já tratam os 3 estados (OK/INADIMPLENTE/INCONCLUSIVO) e não precisam de mudança.
