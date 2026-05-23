## Diagnóstico

**Estado atual** (`associados.id = 26ac0b58-5e09-45cb-9b7b-3fda59e97176`, veículo `LSA7A65`):

| Campo | Valor gravado | Valor correto (Sergio) |
|---|---|---|
| nome | AURELIANO BARRETO DE AZEVEDO | SERGIO BARRETO DE AZEVEDO |
| cpf | 71319506704 | 06980117750 |
| rg | 055722599 | 108750191 |
| cnh_numero | 03305983606 | 08962659984 |
| data_nascimento | 1959-06-16 | 1973-08-28 |
| email | sergiobarreto393@gmail.com | (mantém) |
| telefone | 22999939488 | (mantém) |

Veículo `LSA7A65` (id `91975902-…`) e contrato em vigor já estão amarrados ao `associado_id` `26ac0b58…` — nada precisa ser remapeado, só reescrever os 5 campos de identidade no próprio registro.

**Como o erro passou** (`supabase/functions/contrato-gerar/index.ts` linhas ~507 e 595): hoje a proteção anti-colisão só compara **nome** (`nomesCoincidem`) — quando coincide CPF mas o nome diverge ela apenas alerta e segue. E o bloqueio anti-sequestro só dispara quando `veiculos.associado_id` é **diferente** do `associadoId` resolvido. Como a 2ª cotação caiu no mesmo CPF antigo (Aureliano) e o sobrenome bateu, nenhuma das duas barreiras travou.

## Correção pontual (Sergio)

1. UPDATE em `public.associados` no registro `26ac0b58-5e09-45cb-9b7b-3fda59e97176`:
   - `nome='SERGIO BARRETO DE AZEVEDO'`, `cpf='06980117750'`, `rg='108750191'`, `cnh_numero='08962659984'`, `data_nascimento='1973-08-28'`
   - email/telefone/status/id intocados → todos os FKs (contratos, veiculos, instalacoes, cotações, fila monitoramento, dashboards) seguem apontando para o mesmo registro e passam a exibir Sergio automaticamente.
2. INSERT em `public.logs_auditoria`:
   - `acao='correcao_identidade_associado'`, `modulo='cadastro'`, `tabela='associados'`, `registro_id='26ac0b58…'`
   - `dados_anteriores`/`dados_novos` = snapshot dos 5 campos
   - `descricao` = referência ao caso (placa LSA7A65, contrato em vigor, mesma classe do precedente Luiz Fernando — erro de digitação numa cotação cancelada que sobreviveu e foi reusada).
3. **Sem fila SGA** automática nesta operação — Sergio já está com `status='aguardando_instalacao'`, qualquer sync futura usa a identidade nova; se o operador quiser empurrar manualmente, usa `/configuracoes/integracoes/sga-hinova?placa=LSA7A65`.
4. **Não tocar** em `contratos`, `veiculos`, `instalacoes`, `cotacoes`, `vistorias` — todos já apontam corretamente; trocar identidade no associado já reflete em cascata.

> Execução: 1 migration de dados (UPDATE + INSERT envelopados em transação) via tool de insert.

## Reforço estrutural (anti-reuso cruzado)

Editar `supabase/functions/contrato-gerar/index.ts` para fechar a brecha do "mesmo CPF, nomes parecidos":

1. **Comparação CPF↔associado da placa** — nos 3 ramos que hoje fazem `BLOQUEIO-DONO` (linhas ~595, ~735, ~880), trazer também `associados.cpf` no SELECT do veículo e, **antes** do check `data.associado_id !== associadoId`, comparar `associadoDaPlaca.cpf` vs `cpfNormalizado` (CPF do solicitante). Se diferem → retornar 409 `code: 'PLACA_CPF_DIVERGENTE'` com mensagem pedindo tratamento manual (Substituição/Troca). Exceção mantida: `placaLiberadaPorTrocaTitularidade`.
2. **Bloquear cotação que tenta reusar associado existente com identidade divergente** — no trecho de `associadoExistente` (linha ~497): hoje, se `mesmoTitular` é false, só loga e segue sem sincronizar PII. Trocar esse caminho por **erro duro** 409 `code: 'IDENTIDADE_DIVERGENTE_MESMO_CPF'` quando (a) nomes não coincidem **e** (b) já há contrato/veículo vinculado ao associado → operador é forçado a abrir o caso. Continuar permitindo silenciosamente o caso "associado novo sem histórico" (perfil ainda vazio).
3. **Memória canônica** atualizar `mem://constraints/contracts/no-cross-owner-vehicle-reuse` registrando que a comparação agora é CPF-first com fallback de nome, e que a 2ª camada (`IDENTIDADE_DIVERGENTE_MESMO_CPF`) protege contra reuso silencioso quando o associado original carrega histórico operacional.

Nenhuma outra função/edge precisa mudar — `contrato-gerar` é a porta única de criação de contrato/veículo.

## Validação pós-execução

- `SELECT nome, cpf, rg, cnh_numero, data_nascimento FROM associados WHERE id='26ac0b58…'` → Sergio.
- Tela do associado, card no Monitoramento, Fila de Vistorias, dashboards → todos exibem Sergio (sem code change, é leitura do mesmo id).
- `logs_auditoria` traz a linha `correcao_identidade_associado`.
- Tentativa simulada: nova cotação com CPF diferente apontando para `LSA7A65` → 409 `PLACA_CPF_DIVERGENTE`. Cotação com mesmo CPF mas nome divergente sobre associado com contrato → 409 `IDENTIDADE_DIVERGENTE_MESMO_CPF`.
- Contrato em vigor segue válido (mesmo `associado_id`, mesma assinatura).

## Fora de escopo

- Limpar/cancelar a cotação original que continha o erro (já está cancelada).
- Saneamento retroativo de outros associados — sem indício de outros casos; reforço já trata os próximos.
- Mexer no fluxo de Troca de Titularidade (exceção legítima continua intacta).