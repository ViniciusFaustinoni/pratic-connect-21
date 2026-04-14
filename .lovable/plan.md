

## Plano: Agente "Vinicius" com reconhecimento de diretores e envio de relatórios

### Contexto
O agente consultor IA precisa:
1. Ter o nome padrão **"Vinicius"** (em vez de "Maya")
2. **Reconhecer diretores** pelo telefone (cruzando com `profiles.telefone`/`profiles.whatsapp` + `user_roles.role = 'diretor'`)
3. Quando um diretor entrar em contato, mudar o comportamento: em vez de fluxo de vendas, oferecer **relatórios do sistema** (dados da `view_dashboard_diretoria`, totais de cotações, leads, sinistros, associados, etc.)

### Alterações

**1. Edge Function `agente-consultor-ia/index.ts`**

- **Nome padrão**: alterar fallback de `"Maya"` para `"Vinicius"` (linha 87)
- **Detectar diretor**: após buscar/criar contato, cruzar `telLimpo` contra `profiles.telefone` e `profiles.whatsapp` → buscar `user_roles` para verificar se é `diretor`
- **System prompt condicional**: se for diretor, usar um prompt diferente que oferece relatórios do sistema em vez do fluxo de cotação
- **Nova tool `gerar_relatorio`**: consulta `view_dashboard_diretoria` e tabelas relevantes (contagem de associados, cotações pendentes, sinistros abertos, leads do mês) e retorna texto formatado
- **Fluxo para diretores**:
  1. Reconhecer pelo nome do perfil: "Olá, [nome]! Sou o Vinicius. Como posso ajudar?"
  2. Oferecer opções: relatório geral, cotações pendentes, status de sinistros, leads do mês
  3. Usar tool `gerar_relatorio` para buscar dados reais e formatar resposta

**2. Tool `gerar_relatorio` — dados disponíveis**

Consultas que o relatório pode fazer:
- `view_dashboard_diretoria` → KPIs gerais (associados ativos, inadimplentes, receita, despesas, sinistros, leads, conversões)
- `cotacoes_publicas` com status pendente → cotações aguardando
- `associados` com filtros → totais por status
- `leads` do mês → conversão e origem

O diretor pode pedir relatórios específicos como "quantos leads tivemos este mês?" ou "me dê um resumo geral".

### Arquivos editados
- `supabase/functions/agente-consultor-ia/index.ts` — nome Vinicius, detecção de diretor, tool `gerar_relatorio`, system prompt condicional

### Detalhes técnicos

A detecção de diretor usa:
```sql
profiles (telefone ou whatsapp = telLimpo) → user_id → user_roles (role = 'diretor')
```

O system prompt para diretores instrui o agente a nunca executar fluxo de vendas e a oferecer proativamente dados do sistema. As tools de cotação continuam disponíveis apenas no prompt de vendas (leads normais).

