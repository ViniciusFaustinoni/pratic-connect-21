## Diagnóstico — solicitação KOU6D37 (`6996a35a-…-4ff1`)

Reproduzi a chamada de `efetivar-troca-titularidade` direto contra a edge function e ela retorna:

```
{"success":false,"error":"Dados do novo titular incompletos (CPF obrigatório)"}
```

Estado da solicitação no banco:

- `aprovado_monitoramento_em` ✅ (a aprovação foi registrada)
- `aprovado_monitoramento_por` ✅
- `status = aguardando_monitoramento` (não promove para `efetivada` porque a etapa de efetivação caiu)
- `sga_status = falha` (fallback do `aprovar-troca-monitoramento`)
- `novo_associado_id = de5f0d04-…` (associado já existe com CPF `12493649737`)
- `novo_titular_dados = { nome:"VInicius Faustinoni", cpf:"", email:..., telefone:... }` ← **CPF vazio**

**Causa raiz:** `efetivar-troca-titularidade` valida `dadosNovoTitular.cpf` (vindo do JSON `novo_titular_dados` da solicitação). Nessa troca o snapshot foi gravado sem CPF, mesmo já existindo um `novo_associado_id` apontando para um associado real com CPF preenchido. A edge ignora o `novo_associado_id` e aborta no guard inicial (linha 227). É por isso que o botão "Aprovar" no Monitoramento parece não ter efeito: o `aprovar-troca-monitoramento` marca a aprovação, dispara a efetivação, ela falha por dado faltando, vira `sga_status=falha`, e o status volta a aparecer em "Pendentes".

## Correção

### 1. `supabase/functions/efetivar-troca-titularidade/index.ts`

Logo após o mapeamento de `solicitacao` (≈ linha 222), antes do guard de CPF obrigatório, carregar o associado real quando `novo_associado_id` existir e usar seus campos como fonte canônica (com fallback para o snapshot, sem nunca sobrescrever um valor já presente no snapshot):

- Se `novaSol.novo_associado_id` existe, buscar `associados` (`nome, cpf, email, telefone`) e mesclar em `dados_novo_titular` preenchendo apenas os campos vazios/ausentes (CPF normalizado para apenas dígitos).
- O `novoAssociadoId` no fluxo (passo 3) continua igual: o `associados` já é o mesmo registro, então o branch `associadoExistente` cobre tudo.

Esse padrão é o mesmo já adotado em outras edges quando a fonte da verdade é o registro persistido, não o snapshot.

### 2. Saneamento desta solicitação (na própria edge — sem migration)

Não é necessária migração. A chamada já vai funcionar para esta solicitação assim que a edge for atualizada — o `novo_associado_id` já está preenchido.

Para a UI sair do "limbo" (botão clicado, sem efeito visível), basta o usuário clicar em "Aprovar" novamente após o deploy. O fluxo:

- `aprovar-troca-monitoramento` é idempotente (`baseUpdate` regrava os campos de aprovação).
- `efetivar-troca-titularidade` é idempotente: tem bloco que detecta contrato existente para essa `origem_troca_titularidade_id` e reaproveita (linhas 522-570), e o veículo já está pronto para a transferência.

## Validação

Após o deploy:

1. Rodar `curl` direto no endpoint com o mesmo `solicitacao_id` e confirmar `{"success":true,...}`.
2. Verificar no banco:
   - `solicitacoes_troca_titularidade.status = 'efetivada'`
   - `efetivada_em` preenchido
   - `veiculos.associado_id = de5f0d04-…` e `em_troca_titularidade = false`
   - Contrato `CTR-…-HGFKJ1` segue como `ativo` (foi atualizado pelo bloco de idempotência)
   - Contrato anterior do antigo titular cancelado
3. Confirmar que a tela "Aprovações do Monitoramento › Troca de Titularidade › Pendentes" não lista mais KOU6D37 e ela passa a aparecer em "Aprovadas".

Avisarei quando estiver concluído e validado.

## Fora de escopo

- Não vou tocar no `aprovar-troca-monitoramento` (a aprovação em si está OK, só precisa que a efetivação volte a funcionar).
- Não vou alterar UI da tela de Aprovações — o problema é 100% backend.
- Não vou investigar por que o CPF foi gravado vazio no snapshot inicial (caso pontual — provavelmente o link público desta troca foi finalizado antes do CPF ser confirmado; o fix garante que isso nunca mais bloqueie a efetivação enquanto `novo_associado_id` existir).
