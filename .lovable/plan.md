## Diagnóstico confirmado

Existem **dois associados duplicados** com o nome "Adolpho Konder Homem de Carvalho Filho", e ambos estão com o nome trocado:

| Associado ID | Nome atual (errado) | CPF | Email | Quem realmente é |
|---|---|---|---|---|
| `a1fac976…` | ADOLPHO KONDER… | 127.235.327-39 | cv032779@gmail.com | **Camilly Vitória Calixto Carneiro** (já corrigido em passo anterior segundo o histórico, mas ainda consta "ADOLPHO" no banco) |
| `e4d9d1f8…` | Adolpho Konder… | 161.678.967-04 | Rayslanhudson45@gmail.com | **Rayslan Hudson Honorato Torres** (dono real do HBI8H51) |

O contrato `CTR-20260428160104-HPOGTC` (Honda CG 125 Fan ES 2011, placa HBI8H51) está corretamente vinculado ao associado `e4d9d1f8…` e ao veículo `85d3e19a…`. **O vínculo associado ↔ contrato ↔ veículo está certo** — o problema é só o **nome cadastrado**, que ficou "Adolpho" em vez de "Rayslan".

Não há duplicação real do contrato/veículo a desfazer; é uma correção de nome em cascata + reenvio do Autentique.

## Plano de correção

### 1. Corrigir nome do associado `e4d9d1f8…` (dono do HBI8H51)
UPDATE em `associados`:
- `nome` = "RAYSLAN HUDSON HONORATO TORRES"
- (CPF 161.678.967-04 e email Rayslanhudson45@gmail.com permanecem)

### 2. Corrigir nome do cliente no contrato `CTR-20260428160104-HPOGTC`
UPDATE em `contratos` (id `5e62227f…`):
- `cliente_nome` = "RAYSLAN HUDSON HONORATO TORRES"
- Os demais dados (CPF, email, telefone, veículo) já estão corretos.

### 3. Corrigir o associado duplicado `a1fac976…` (que é a Camilly)
UPDATE em `associados`:
- `nome` = "CAMILLY VITÓRIA CALIXTO CARNEIRO"
(Conforme já acordado anteriormente — confirmando que persiste a inconsistência no banco.)

### 4. Cancelar e reenviar o Autentique do contrato HPOGTC
O documento Autentique atual (`d5921bf1…`) foi gerado com o nome "Adolpho" no PDF e como signatário. Status = `viewed` (não assinado ainda). Ações:
- Chamar `autentique-cancel` para invalidar o documento atual.
- Regenerar o termo via fluxo padrão (`autentique-create`) com o nome correto "Rayslan Hudson Honorato Torres" como signatário, mantendo email `Rayslanhudson45@gmail.com` e telefone `21966855503`.
- Resetar campos no contrato: `autentique_status` = `pending`, `data_envio` = now, novo `autentique_documento_id` e `autentique_url`.

### 5. Verificação pós-correção
Após as atualizações, conferir que:
- Card de vendas mostra "Rayslan Hudson Honorato Torres" no contrato HPOGTC.
- Veículo HBI8H51 aparece sob Rayslan.
- Card "Adolpho/Camilly" do contrato 2RI0GS aparece como "Camilly Vitória".

## Detalhes técnicos

- Operações 1, 2, 3 são `UPDATE` em tabela existente → executadas via insert/update tool.
- Operação 4 usa as edge functions já existentes `autentique-cancel` e `autentique-create` (já mapeadas em `src/hooks/useAutentique.ts`).
- Nenhuma alteração de schema é necessária.
- Nenhum código de UI precisa mudar — a UI já lê `cliente_nome`/`associados.nome`, então a correção de dados resolve a exibição.

## O que NÃO será feito
- Não vou apagar nem mesclar os dois associados (são pessoas diferentes — Rayslan e Camilly).
- Não vou mexer no contrato 2RI0GS além do nome do associado vinculado (ele já está assinado e o `cliente_nome` já está correto como "CAMILLY").
- Não vou alterar o veículo HBI8H51 (já vinculado ao associado correto).
