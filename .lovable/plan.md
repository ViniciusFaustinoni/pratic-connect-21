## Confirmação do escopo

Hard delete completo de tudo localmente (sem mexer no SGA Hinova). Inclui auth.users dos dois.

### Alvos confirmados

| Tipo | Quantidade | IDs |
|---|---|---|
| Associados | 2 | Faustinoni `de5f0d04…`, Dativo `9c05d3c4…` |
| Auth/Profiles | 1 | `f8bcd79c-e1f8-4f8d-aba2-11648c6b542e` (Faustinoni — Dativo não tem login) |
| Contratos | 4 | 1 ativo + 3 cancelados |
| Veículo | 1 | KOU6D37 (`d5181403…`) |
| Trocas titularidade | 3 | 1 efetivada + 2 canceladas |
| Cotações | 4 | 3 aceitas + 1 cancelada |
| Vistorias / Serviços / Instalações | 1+1+? | derivados do veículo/contratos |

### ⚠️ Rastreador físico (NÃO apagar)

Equipamento `41accc39-df57-439c-b2c8-49572d0d0711` (IMEI `869412077334305`) está `instalado` no KOU6D37. **Rastreador é asset físico** — vou apenas **desvincular** (limpar `veiculo_id` + `instalacao_id` + voltar status para `em_estoque`), não excluir. Assim o equipamento volta pro estoque utilizável.

## Migration única (transacional)

Tudo dentro de `BEGIN … COMMIT` para garantir atomicidade. Ordem respeita FKs (filhos → pais):

```text
1.  Desvincular rastreador do veículo (UPDATE rastreadores SET veiculo_id=NULL, instalacao_id=NULL, status='em_estoque')
2.  DELETE vistoria_fotos / cotacoes_vistoria_fotos
3.  DELETE vistorias (por veiculo_id + associado_id)
4.  DELETE servicos (por veiculo_id + associado_id + contrato_id)
5.  DELETE agendamentos_base / agendamentos relacionados
6.  DELETE instalacoes (por veiculo_id + contrato_id)
7.  DELETE contratos_documentos (por contrato_id)
8.  DELETE cobrancas (por contrato_id) — 0 hoje, idempotente
9.  DELETE solicitacoes_troca_titularidade (3 registros)
10. DELETE contratos (4 registros)
11. DELETE cotacoes (4 registros) — fotos, eventos, documentos vinculados via FK CASCADE existentes
12. DELETE sga_sync_queue (associado_id IN … OR veiculo_id = …)
13. DELETE veiculos (KOU6D37)
14. DELETE associados (2 registros)
15. DELETE user_roles WHERE user_id = 'f8bcd79c…'
16. DELETE profiles WHERE id = 'f8bcd79c…'
17. DELETE auth.users WHERE id = 'f8bcd79c…'
COMMIT;
```

### Tabelas-satélite varridas defensivamente por `associado_id` ou `veiculo_id`

`historico_status_associado`, `notificacoes`, `whatsapp_mensagens` (por telefone), `mensagens_whatsapp`, `auditoria_acoes`, `cotacoes_documentos`, `vistoria_fotos`, `cotacoes_vistoria_fotos`, `eventos_cotacao`, `contratos_assinaturas`, `servicos_atribuicoes`, `sga_sync_log`, `sga_fotos_enviadas`. Faço varredura prévia no SQL e adiciono DELETEs apenas onde houver linhas. Tabelas sem linhas são puladas (no-op).

### Salvaguardas

- Toda a migration em uma única transação — se qualquer FK quebrar, rollback completo e nada é apagado.
- Antes de cada `DELETE` em tabela "principal", uso `SELECT count(*)` num CTE de log para deixar registro nos logs da migration de quantas linhas serão removidas.
- `auth.users` é apagado por último — se algum DELETE anterior falhar, o login fica intacto.
- **Não toco** em: `sga_sync_queue` no Hinova (só na nossa fila local), rastreador (apenas desvinculo), `auth.users` da Thais Dativo (homônima, fora do escopo).

## Pós-execução

Confirmo via `SELECT` que:
- `associados WHERE id IN (…) → 0 rows`
- `veiculos WHERE placa = 'KOU6D37' → 0 rows`
- `rastreadores WHERE imei = '869412077334305' → status='em_estoque', veiculo_id=NULL`
- `auth.users WHERE id = 'f8bcd79c…' → 0 rows`

## O que NÃO vou fazer

- Não mexer em Hinova/SGA externo (registros lá continuam existindo, mas não te incomodam mais — você decide se zera no painel SGA depois)
- Não apagar rastreador físico (volta pro estoque)
- Não apagar Thais Dativo (homônima)
- Não criar código de aplicação — é só migration SQL
