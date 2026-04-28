# Fix: erro "invalid input value for enum status_instalacao: 'pendente'" ao realocar

## Causa-raiz

Na função `public.realocar_servico` (migração `20260428132225_…`), a etapa que atualiza a tabela `instalacoes` quando o destino é "fila" tenta usar o valor `'pendente'`:

```sql
status = CASE WHEN _profissional_final IS NULL THEN 'pendente'::status_instalacao
              ELSE 'agendada'::status_instalacao END,
```

Mas o enum `status_instalacao` **não possui o rótulo `'pendente'`**. Os valores válidos são:
`agendada, em_rota, em_andamento, concluida, reagendada, cancelada, em_analise, nao_compareceu, atribuida, aguardando_prestador, no_local`.

Resultado: qualquer realocação para "Fila" (sem profissional) e também a realocação para "Base" (que zera profissional) explodem com `invalid input value for enum status_instalacao: "pendente"`.

É exatamente o mesmo padrão do bug do `periodo_atendimento` corrigido na migração anterior — sobrou um literal de enum inválido.

## Correção (única, na raiz)

Criar uma nova migração que substitui a função `realocar_servico` mudando apenas o `CASE` da tabela `instalacoes` para usar valores que existem no enum:

```sql
status = CASE
  WHEN _profissional_final IS NOT NULL THEN 'agendada'::status_instalacao
  WHEN _rota_final IS NOT NULL          THEN 'agendada'::status_instalacao
  ELSE 'em_analise'::status_instalacao   -- "fila"/sem técnico definido
END,
```

Justificativa do mapeamento:
- **destino=profissional** ou **destino=rota** → `agendada` (já tem responsável).
- **destino=fila** (sem profissional) → `em_analise` é o valor canônico do enum para "aguardando triagem/atribuição manual" e é compatível com o filtro existente da aba "Atribuição Manual".
- **destino=base** → também sem profissional, mesmo `em_analise` (o `agendamento_base` novo é criado logo depois, então a instalação fica corretamente "em análise" até o técnico da base assumir).

Nada mais é alterado na função: as 6 seções (servicos, instalacoes, vistorias, agendamentos_base, log, histórico) continuam idênticas. Não quebra:
- Fluxo de instalação (sequência `agendada → em_rota → em_andamento → concluida` intacta).
- Fluxo de manutenção (não usa `realocar_servico`).
- Fluxos de vistoria (atualiza apenas `data_agendada`).

## Validação

1. Aplicar a migração.
2. Logar como diretor (admin@teste.com / admin@teste.com).
3. Ir em **Monitoramento > Serviços de Campo**, abrir o serviço da placa **LTG3H67**.
4. Clicar em **Realocar**, escolher destino **Fila**, motivo válido, confirmar.
5. Esperado: sucesso, serviço aparece em "Atribuição Manual" com `instalacao.status='em_analise'`.
6. Repetir testes para destinos **Profissional**, **Rota** e **Base** para garantir que nenhum caminho regrediu.

## Arquivo a criar

- `supabase/migrations/<timestamp>_fix_realocar_status_instalacao.sql` — `CREATE OR REPLACE FUNCTION public.realocar_servico(...)` com o CASE corrigido (corpo idêntico ao atual, somente o trecho da tabela `instalacoes` mudado).