# Auditoria completa dos templates Meta WhatsApp

## Diagnóstico inicial (estado atual)

Status no banco (`whatsapp_meta_templates`):
- **46 APROVADOS** ✅
- **5 PENDENTES** ⏳ — `notificacao_geral_v1`, `troca_titularidade_aprovada`, `troca_titularidade_reprovada`, `troca_titularidade_solicitada`, `troca_titularidade_termo_pendente`
- **0 REJEITADOS**

Templates referenciados nas edge functions: ~30 nomes distintos (mapeados por `rg "template_name"`).

## Problemas encontrados (a confirmar/corrigir)

1. **`notificacao_geral_v1` ainda PENDING** mas é usado em 13+ pontos críticos (`notificar-cliente`, `confirmar-retirada`, `concluir-instalacao-prestador`, `concluir-vistoria-prestador`, `cron-expirar-confirmacoes`, `notificar-manutencao-whatsapp`, `asaas-webhook`). → Envios silenciosos falham.
2. **Família `troca_titularidade_*` PENDING** — fluxo de troca dispara mensagens que não saem.
3. **Parâmetros desalinhados** — `templateParams.ts` (frontend) só cobre cobrança. Edge functions montam `parameters` ad-hoc; risco de `{{N}}` ≠ qtd parâmetros enviados (motivo clássico de erro 132000 da Meta).
4. **Sem catálogo único** de "qual template é enviado em qual momento" → operador não sabe o que cada template significa.
5. Templates com sufixos antigos coexistindo (`cobertura_360_ativada` vs `_v3`, `autorizacao_fipe_diretoria` vs `_v4`) — confirmar qual está em uso e marcar o legado.

## Plano de execução

### 1. Catálogo central `src/lib/whatsapp/template-catalog.ts` (novo)
Mapa `template_name → { momento, gatilho, origem, variaveis[], deprecated? }`. Fonte da verdade compartilhada por:
- Tooltip "?" na lista de templates
- Validação de parâmetros (preview no Drawer)
- Documentação inline

Exemplo:
```ts
tecnico_a_caminho_1: {
  momento: 'Quando o técnico inicia rota até o cliente',
  gatilho: 'notificar-cliente (etapa "tecnico_a_caminho")',
  variaveis: ['nome', 'tecnico', 'eta_min'],
}
```
Cobre os ~30 templates já em uso + os 5 pendentes.

### 2. Tooltip "?" na lista (`WhatsAppMetaTemplates.tsx`)
- Ícone `HelpCircle` (lucide) ao lado do nome do template
- `Tooltip` (shadcn) mostrando: **Momento**, **Gatilho (edge function/cron)**, **Variáveis esperadas**
- Badge extra "⚠ Não mapeado" se o template não estiver no catálogo (= órfão / candidato a remoção)
- Badge extra "⛔ Legado" para versões substituídas (ex: `cobertura_360_ativada` → usar `_v3`)

### 3. Auditoria de parâmetros (script local + correções)
- Para cada template APROVADO, contar `{{N}}` no `corpo` salvo
- Comparar com `variaveis_exemplo` e com o catálogo
- Para cada chamada `template_name: 'X'` nas edge functions, contar `parameters` enviados
- **Relatório no chat** com mismatches; corrigir as edge functions afetadas (ajustando `parameters`) ou o template (campo `variaveis_exemplo`).

### 4. Reenvio dos PENDENTES com IA
Os 5 templates PENDING já existem na Meta há tempo: ou estão travados ou foram rejeitados sem sync. Ações:
- Rodar `sincronizar` para puxar status real
- Se continuar PENDING > 24h, usar o botão "IA ajusta e reenvia" já existente (`handleReenviarComIA`) — sem mudança de código, só execução

### 5. Card de health "Templates" (opcional, leve)
Acima da tabela, mini-resumo:
> ⚠ 5 templates pendentes bloqueando envios em: troca de titularidade, retirada, manutenção, conclusão de instalação.

## Arquivos a alterar

- **Novo**: `src/lib/whatsapp/template-catalog.ts`
- **Editar**: `src/components/integracoes/WhatsAppMetaTemplates.tsx` (tooltip + alerta de pendentes críticos)
- **Editar (se mismatch confirmado)**: edge functions específicas em `supabase/functions/notificar-cliente`, `disparar-cobranca-csv-meta`, etc. — lista exata sai da auditoria do passo 3.

## Fora de escopo
- Não vou alterar o fluxo de aprovação Meta nem o `whatsapp-submit-template`.
- Não vou criar templates novos sem confirmação (apenas catalogar/corrigir os existentes).

## Pergunta ao final do plano
Após a auditoria do passo 3, vou apresentar a lista de mismatches ANTES de editar edge functions, para você confirmar quais corrigir (alguns podem ser intencionais).
