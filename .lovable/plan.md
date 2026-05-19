## Diagnóstico do caso FLAVIO VILLARDO DOS SANTOS — placa TTX8A88

**Veículo:** Yamaha NMAX 160 · 2026 · FIPE R$ 22.802,00 (moto > R$ 9k → fluxo canônico "FIPE acima do mínimo" = autovistoria opcional + instalação técnica obrigatória com rastreador).

**Estado real no banco (limbo confirmado):**

| Camada | Estado |
|---|---|
| `cotacoes.status_contratacao` | `pagamento_ok` |
| `contratos.cadastro_aprovado` | `true` (aprovado 17/05 17:28 por `cefd786a-…`) |
| `contratos.status` | `assinado` |
| `veiculos.status` | `instalacao_pendente`, R/F=`false` |
| `associados.status` | `aguardando_instalacao` |
| `agendamentos_base` | 1 registro · **18/05 13:00** · oficina `41ef21e6-…` · status `agendado` |
| `instalacoes` | ❌ **nenhum registro** |
| `servicos` | ❌ **nenhum registro** (nem `instalacao` nem `vistoria_entrada`) |
| `vistorias` | ❌ **nenhum registro** |

O cliente assinou, pagou, agendou Base no link público (18/05 13:00) e o Cadastro aprovou — mas a `criar-instalacao-pos-pagamento` não materializou `instalacoes` nem `servicos`. Resultado: invisível no quadro do técnico, invisível na fila do Monitoramento, "aguardando instalação 17/05" só porque é a data do `cadastro_aprovado_em`. É o mesmo padrão do bug do Marllon (etapa quebrada de materialização).

O usuário pediu duas coisas: (a) realocar para **hoje 19/05** na Base e (b) **passar antes pelo Cadastro** para reaprovar os documentos.

---

## Plano de resolução (somente este caso)

### 1. Rewind do Cadastro do Flavio (SQL transacional)

- `contratos`: `cadastro_aprovado=false`, `aprovado_por=NULL`, `aprovado_em=NULL`.
- `cotacoes`: `status_contratacao='aguardando_aprovacao_cadastro'`.
- `associados.status='em_analise'`.
- `veiculos.status='instalacao_pendente'` (mantém), R/F já está `false`.
- Inserir `associados_historico` (`tipo='status_alterado'`, `motivo='Rewind manual — limbo pós-pagamento sem instalação materializada; devolvido ao Cadastro para reaprovação de docs antes de realocar para 19/05 (Base)'`).

### 2. Realocar agendamento_base de 18/05 → 19/05 (hoje)

- `agendamentos_base a0d21e62-…`: `data_agendada='2026-05-19'`, mantém `horario='13:00:00'` (período Tarde) e mesma oficina. Status segue `agendado`.

Não criamos `instalacoes` agora — a materialização correta acontece quando o analista do Cadastro reaprovar e a edge `aprovar-proposta` rodar (ela lê o `agendamentos_base` existente e cria `instalacoes` + `servicos.tipo='instalacao'` para 19/05 13:00 automaticamente). Esse é o caminho canônico e evita o bypass que originou o limbo.

### 3. Auditoria do bug raiz (somente diagnóstico, sem implementar correção neste loop)

Registrar no plano que o gatilho do limbo é o mesmo já tratado no caso Marllon: `criar-instalacao-pos-pagamento`/`aprovar-proposta` não materializou `instalacoes` apesar de `cadastro_aprovado=true` e `agendamentos_base` existir. A correção sistêmica entra em loop separado se o usuário pedir.

---

## Detalhes técnicos

- Migração de dados via `supabase--migration` (UPDATEs + INSERT histórico) — não há mudança de schema.
- Após o rewind, o caso reaparece em **Cadastro › Propostas Pendentes** (com badge "Pendente Vistoria Inicial" se a UI não enxergar autovistoria — e não há, é fluxo acima de FIPE sem autovistoria opcional realizada).
- Quando o analista clicar em "Aprovar Cadastro", `aprovar-proposta` deve criar `instalacoes` para 19/05 13:00 na oficina `41ef21e6-…`, vinculada ao `agendamentos_base` existente, e gerar `servicos.tipo='instalacao'` em `em_analise` que aparece na fila do Monitoramento. Se isso não ocorrer (mesmo bug do Marllon), abriremos loop específico para corrigir a função.

---

## Checklist de execução (na próxima aprovação)

1. Migração SQL com BEGIN/COMMIT executando rewind + reagendamento + histórico.
2. Confirmar via SELECT que a cotação voltou para `aguardando_aprovacao_cadastro` e o `agendamentos_base` ficou em 19/05.
3. Informar ao usuário que o caso já está na fila do Cadastro pronto para reaprovação manual.
