## Diagnóstico

A `whatsapp-send-text` bloqueia qualquer envio sem `template_name` quando o provedor ativo é Meta Cloud (linhas 246-256). O envio para o técnico funciona porque `cron-atribuir-tarefas` e `notificar-inicio-rota` chamam com `template_name: 'servico_atribuido_v1'` (APPROVED). Todos os outros pontos falham por um destes 3 motivos:

| # | Origem | Mensagem que falha | Causa raiz |
|---|--------|--------------------|------------|
| 1 | `notificar-cliente` (linhas 477, 533-591) | tecnico_em_rota, status_assistencia, contrato_gerado, etc. | Aponta para template `notificacao_geral_v1` que **não existe** em `whatsapp_meta_templates`. Lookup retorna nulo → erro "Template não encontrado". |
| 2 | `contrato-gerar` linha 1408 (troca titularidade) | "Olá X! Seu contrato de troca de titularidade (Nº ...) foi gerado..." | Envia texto puro com `force_provider: 'evolution'`, mas Evolution está **disconnected** (último log 2026-05-10) e/ou o atalho não cobre o caminho — cai em Meta sem template e é bloqueado. |
| 3 | `aprovar-troca-cadastro` linha 201 (vendedor) | "🔁 Troca de titularidade — cadastro aprovado..." | Mesmo padrão do #2: texto puro + force_provider evolution offline. |
| 4 | "Olá MARCUS! Recebemos uma solicitação de troca..." | Mensagem ao titular antigo na criação da solicitação | Caller ainda não localizado no código (provavelmente disparada por trigger/edge não rastreada); investigar via logs após deploy. |
| 5 | Templates `troca_titularidade_solicitada`, `_aprovada`, `_reprovada`, `_termo_pendente` | — | Estão **PENDING** na Meta (não APPROVED). Mesmo se chamados, Meta recusa. |

Os templates aprovados disponíveis hoje incluem: `sinistro_atualizado`, `cadastro_aprovado_botao`, `tecnico_a_caminho_1`, `assistencia_confirmada`, `documentacao_pendente`, `servico_atribuido_v1`, `confirmacao_agendamento_v1`, `cobertura_360_ativada_v3`, `assinatura_documento_v2`, `cobranca_inadimplencia_pratic`.

## Plano

### 1. Criar template Meta `notificacao_geral_v1` (registro local + submeter)
- Inserir em `whatsapp_meta_templates` o template genérico de 3 variáveis: `Olá {{1}}, {{2}}: {{3}}` (UTILITY, pt_BR), `status='APPROVED'` se já existir aprovado na Meta — caso contrário, marcar como `PENDING` e usar fallback `sinistro_atualizado` automaticamente (já implementado em whatsapp-send-text linha 150).
- Verificar via `whatsapp-meta-templates` edge a lista real na Meta antes de marcar APPROVED para não enganar o fallback.

### 2. Corrigir `contrato-gerar` (troca titularidade — linha 1404-1413)
Substituir o texto puro + `force_provider: 'evolution'` por chamada com template aprovado:
```ts
template_name: 'cadastro_aprovado_botao',
template_params: [primeiroNome, `Contrato ${contrato.numero}`, 'Troca de titularidade gerada — assine o termo no e-mail'],
```
Remover `force_provider: 'evolution'`.

### 3. Corrigir `aprovar-troca-cadastro` linha 192-207 (notificação ao vendedor)
Substituir por template `sinistro_atualizado` (já aprovado, 3 vars):
```ts
template_name: 'sinistro_atualizado',
template_params: [primeiroNomeVendedor, `Cotação ${numero} liberada`, `Troca de titularidade aprovada — novo titular: ${novoNome}`],
```
Remover `force_provider: 'evolution'`.

### 4. Localizar e corrigir o disparo da mensagem "Recebemos uma solicitação de troca…"
- Após o redeploy dos itens 2 e 3, reproduzir o fluxo (criar solicitação de troca para MARCUS) e capturar logs de `whatsapp-send-text` para identificar o caller real.
- Aplicar a mesma correção: template Meta aprovado + remover `force_provider: 'evolution'`.

### 5. Garantir versão atualizada de `notificar-inicio-rota` em produção
- Forçar redeploy. O código-fonte já tem `template_name: 'servico_atribuido_v1'` (linha 257), mas as falhas de "NOVA TAREFA - INSTALAÇÃO" no log indicam que a versão deployada não inclui esse parâmetro.

### 6. Endurecer `whatsapp-send-text` (defesa em profundidade)
Quando `provedorAtivo === 'meta_oficial'` e nenhum `template_name` for fornecido:
- Logar `caller_hint` (extrair do header `x-source` ou stack) para facilitar rastreio.
- Em vez de só lançar erro, automaticamente cair em `sinistro_atualizado` com `[primeiroNome, 'Atualização', mensagem.slice(0,200)]` — assim mensagens críticas não somem mesmo se algum caller esquecer o template.
- Manter o erro registrado em `whatsapp_mensagens` para alerta de QA.

### 7. Reenviar para MARCUS VINICIUS FAUSTINONI DE FREITAS o último template que falhou
A última mensagem com erro para MARCUS (telefone 5521969434281, 21:25 de 2026-05-11) era a notificação de "solicitação de troca de titularidade recebida". Após implementar os itens 1-6:
- Disparar manualmente via `supabase.functions.invoke('whatsapp-send-text', { body: { telefone: '5521969434281', mensagem: '...', template_name: 'sinistro_atualizado', template_params: ['MARCUS', 'Solicitação de troca de titularidade', 'Recebemos sua solicitação. Você receberá o termo de cancelamento por e-mail para assinatura.'] } })`.
- Verificar no log `whatsapp_mensagens` que `status='enviada'`.

### 8. Validação final
Rodar uma sweep dos últimos 30 dias em `whatsapp_mensagens` filtrando `status='erro' AND erro_mensagem ILIKE '%Bloqueado%'` para confirmar zero novos bloqueios após o fix.

## Detalhes técnicos

- **Migrações**: 1 migração SQL (item 1) — INSERT em `whatsapp_meta_templates`.
- **Edge functions alteradas**: `contrato-gerar`, `aprovar-troca-cadastro`, `whatsapp-send-text` (defesa em profundidade), `notificar-inicio-rota` (apenas redeploy).
- **Sem alterações de UI**.
- **Templates `troca_titularidade_*` PENDING**: deixados como estão — exigem aprovação manual no Business Manager da Meta. Plano usa `sinistro_atualizado` e `cadastro_aprovado_botao` como substitutos aprovados.
- **Memória**: alinhar com `mem://infrastructure/whatsapp/messaging-safety-and-idempotency` (já cobre o princípio).
