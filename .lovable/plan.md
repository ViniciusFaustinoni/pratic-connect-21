

# Correções: Bloqueio Cenário B + Notificação Novo Titular

## Correção 1 — Status da vistoria no card do Cenário B

### Problema
Quando o Cenário B é determinado, um registro é criado na tabela `servicos` com `origem: 'troca_titularidade'` e `solicitacao_id`. Porém, a `processar-vistoria` não verifica a existência desse vínculo para disparar a efetivação após aprovação da vistoria. Além disso, o card na aba Titularidade não exibe o status da vistoria vinculada.

### Alterações

**1. Frontend — `ProcessosOperacionais.tsx`**

Na query de `processos-troca-titularidade`, para solicitações com `status === 'aprovado'` e cenário B, buscar o serviço vinculado na tabela `servicos` (via `solicitacao_id`) para exibir o status da vistoria em tempo real.

Adicionar uma segunda query que busca os serviços vinculados:
```sql
SELECT id, status, solicitacao_id 
FROM servicos 
WHERE solicitacao_id IN (ids das solicitações aprovadas cenário B)
  AND origem = 'troca_titularidade'
```

No card, quando cenário é B:
- Se serviço `pendente` → Badge amarela: "Aguardando vistoria"
- Se serviço `em_andamento` → Badge azul: "Vistoria em andamento"
- Se serviço `concluido` → Badge verde: "Efetivado"
- Usar os `dados.efetivado_em` da solicitação para confirmar se a efetivação já ocorreu (badge "Efetivado")

**2. Edge function — `processar-vistoria/index.ts`**

Após processar uma vistoria aprovada (bloco `decisao === 'aprovada' || 'aprovada_com_ressalvas'`), adicionar verificação:

1. Buscar na tabela `servicos` por `associado_id` + `veiculo_id` + `origem = 'troca_titularidade'` + `status = 'pendente'`
2. Se encontrado e o serviço tem `solicitacao_id`, chamar `efetivar-troca-titularidade` com essa `solicitacao_id` e `cenario_override: 'B'`
3. Atualizar o serviço como `concluido`

Isso completa o fluxo automático do Cenário B que foi planejado mas não implementado no `processar-vistoria`.

---

## Correção 2 — Notificar novo titular após efetivação

### Problema
A função `efetivar-troca-titularidade` não envia nenhuma comunicação ao novo titular após concluir a transferência.

### Alteração

**`efetivar-troca-titularidade/index.ts`**

Após o passo 13 (log de auditoria), adicionar bloco de notificação:

1. Buscar o telefone do novo titular em `dados_novo_titular.telefone` ou no registro do novo associado
2. Se telefone existir:
   - Montar mensagem de boas-vindas usando o template `cobertura_total_ativada` existente no `notificar-cliente`, adaptado com dados da troca: nome, placa do veículo, número do contrato
   - Enviar via `whatsapp-send-text`
3. Se telefone não existir:
   - Registrar no log: "Novo titular sem telefone — notificação não enviada"
   - Não bloquear o processo

A mensagem incluirá: nome do novo titular, veículo (marca/modelo/placa), número do contrato, e orientação para acessar o app.

---

## Arquivos modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/cadastro/ProcessosOperacionais.tsx` | Buscar status do serviço vinculado, exibir status da vistoria no card do Cenário B |
| `supabase/functions/processar-vistoria/index.ts` | Detectar vistoria de troca de titularidade aprovada e chamar efetivação |
| `supabase/functions/efetivar-troca-titularidade/index.ts` | Enviar WhatsApp de boas-vindas ao novo titular após efetivação |

