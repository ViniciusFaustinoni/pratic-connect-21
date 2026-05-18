## Exclusão definitiva — Marcos Vinicius Dativo Machado & Marcus Vinicius Faustinoni

### Registros encontrados

| Nome | ID | CPF | Status | Hinova | Veículos |
|---|---|---|---|---|---|
| MARCUS VINICIUS FAUSTINONI DE FREITAS | `988dbfa9-372f-4706-a84d-9275e647e00a` | 12493649737 | ativo | — (não sincronizado) | LTB4J74 (Corolla), KOU6D37 (Fiesta) |
| MARCOS VINICIUS DATIVO MACHADO | `76831a73-71c2-4164-b678-00f4cda225d1` | 14194896742 | ativo | 25645 | QOO5C17 (Voyage) |

### Plano

1. **Desvincular rastreadores** vinculados a esses associados/veículos (rastreadores → `veiculo_id=null`, `associado_id=null`, `status='estoque'`). Mantém o equipamento físico no estoque.
2. **Excluir veículos** dos dois associados (`DELETE FROM veiculos WHERE associado_id IN (...)`). Cascata do banco limpa: contratos, cotações, cobranças, instalações, vistorias, fotos, serviços, agendamentos, documentos, sinistros, substituições, etc. vinculados pelo `veiculo_id`/`associado_id` quando configurados com `ON DELETE CASCADE`.
3. **Excluir os associados** (`DELETE FROM associados WHERE id IN (...)`). Cascata remove qualquer registro residual ligado ao associado.
4. **Hinova/SGA:** o Marcos tem `codigo_hinova=25645`. A exclusão é **somente local** — não dispara cancelamento no Hinova. Se for preciso baixar lá, fica a critério do operador no painel SGA (regra: nunca mandamos cancelamento automático).

Este é o mesmo padrão usado em `useDeleteBaseAntiga` para limpeza de base — já validado em produção.

### Confirmação necessária

Quero que você confirme antes de eu rodar a migração de DELETE:

- (a) Excluir **ambos** os associados + 3 veículos + todos os registros vinculados em cascata?
- (b) Quer que eu mantenha algum histórico (ex.: cotações antigas) ou pode apagar tudo?
- (c) Confirma que NÃO precisa baixar nada no Hinova/SGA (Marcos tem código 25645 lá)?

Aprovando, executo via `supabase--migration` em uma única transação.