

# Plano: Confirmação matinal obrigatória para TODOS os tipos de serviço

## Contexto

Atualmente o `confirmar-vistorias-manha-cron` já envia confirmação matinal, mas o plano anterior previa filtrar apenas vistorias. O usuário quer que **todos os tipos** (vistoria, instalação, manutenção, remoção) passem pelo fluxo de confirmação -- só quem confirmar é atribuído à rota.

O `cron-atribuir-tarefas` já tem o filtro correto (linha 325): só atribui serviços com `confirmacao_whatsapp = null`, `confirmada`, ou `permite_encaixe = true`. Como o disparo matinal marca `confirmacao_whatsapp = 'aguardando_confirmacao_manha'`, esses serviços ficam bloqueados até confirmação.

## Alterações

### 1. `confirmar-vistorias-manha-cron/index.ts`

- **Renomear conceito** nos logs/comentários: de "vistorias" para "serviços do dia" (a function continua com o mesmo nome de deploy)
- **Remover filtro `.or('local_vistoria...')`** (linha 81) que restringe a busca -- todos os serviços agendados para hoje devem receber confirmação
- **Ajustar mensagem e template** para ser genérico: em vez de "vistoria veicular", usar o tipo correto do serviço (instalação, vistoria, manutenção, remoção)
- **Template Meta**: continuar usando `sinistro_atualizado` como fallback até template dedicado ser aprovado; ajustar parâmetros para incluir o tipo correto

### 2. Template Meta dedicado (SQL)

- Inserir template `confirmacao_servico_v1` na tabela `whatsapp_meta_templates` com corpo genérico:
  - `Olá {{1}}! Seu(a) {{2}} está agendado(a) para HOJE ({{3}}). Responda SIM para confirmar ou solicite reagendamento.`
  - Parâmetros: nome, tipo_servico, período/horário
- Inserir fallback na tabela `whatsapp_templates` com código `confirmacao_servico`

### 3. Nenhuma alteração no `cron-atribuir-tarefas`

O filtro na linha 325 já garante que serviços com `confirmacao_whatsapp = 'aguardando_confirmacao_manha'` NÃO são atribuídos. Só entra na rota quem tem `confirmacao_whatsapp = 'confirmada'` ou `null` (serviços que não passaram pelo fluxo).

## Arquivos afetados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/confirmar-vistorias-manha-cron/index.ts` | Remover filtro de tipo, tornar genérico para todos os serviços |
| SQL (migração) | Inserir templates `confirmacao_servico_v1` |

