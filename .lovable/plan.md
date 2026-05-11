Reset do teste de troca de titularidade — limpeza via edge function `delete-associado` (que agora trata `solicitacoes_troca_titularidade`).

## Alvos identificados

- **MARCUS VINICIUS FAUSTINONI DE FREITAS** — `a4e62fa5-c217-48c3-acd7-9390f13985eb` (CPF 12493649737)
  - Veículo **LTB4J74** — `8a1b4af8-880c-4d71-b6f5-8e347c55fa3f` (vinculado a ele; será removido junto)
- **MARCOS VINICIUS DATIVO MACHADO** — `1b4ff2ba-3312-4914-a9d2-4035f8b4e137` (CPF 14194896742)

## Execução

1. Invocar `delete-associado` para `a4e62fa5...` (Marcus Faustinoni) — remove o veículo LTB4J74 em cascata, contratos, vistorias, solicitações de troca de titularidade (antigo/novo), serviços, agendamentos.
2. Invocar `delete-associado` para `1b4ff2ba...` (Marcos Dativo).
3. Validar que ambos sumiram e que não restou solicitação de troca pendente referenciando-os.

## Observação

A edge function já foi corrigida na mensagem anterior para limpar `solicitacoes_troca_titularidade` antes do delete final, então o erro de FK não deve mais ocorrer. Aprove para eu executar as duas chamadas.