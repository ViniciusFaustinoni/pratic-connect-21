

## Correção dos templates Meta rejeitados + limpeza de duplicados

### Diagnóstico (vindo direto do banco e da Meta)

**1. `termo_filiacao_assinatura_v1` — REJECTED**
Motivo oficial da Meta (campo `motivo_rejeicao`):
> "O rodapé da mensagem não pode ter novas linhas ou emojis."

Causa real:
- `rodape: "Equipe PRATIC 🛡️"` → emoji proibido em footer.
- Botão URL com **variável dinâmica em meio do path** (`https://assina.ae/{{1}}`) — a Meta exige URLs estáticas OU URL com variável apenas no final, com exemplo concreto. Faltou o `example` do botão (causa rejeição secundária comum mesmo quando a Meta cita só o footer).
- Corpo tem emojis (📄) — permitido em UTILITY, mas a combinação com footer rico aumenta risco.

**2. `autorizacao_fipe_diretoria`, `aprovacao_fipe_diretoria_v2`, `aprovacao_fipe_diretoria_v3` — REJECTED**
Motivo: sem `motivo_rejeicao` salvo, mas o padrão da Meta para esse texto é claro:
- Texto ambíguo entre **UTILITY** e **MARKETING/CTA externo**: "Acesse o painel para aprovar ou recusar" + botão URL para painel **interno** (`/vendas/aprovacoes-fipe`) sem que o destinatário tenha relação prévia com aquela URL pública → Meta classifica como promocional/CTA não-transacional.
- `aprovacao_fipe_diretoria_v2` tem botão tipo `url` com `texto: "Acesse"` mas `url: https://app.praticcar.org` (URL genérica, sem contexto da ação).
- v3 e `autorizacao_fipe_diretoria` são **idênticos no corpo** (8 variáveis) — duplicação pura.

### O que vou fazer

#### Parte A — Recriar `termo_filiacao_assinatura_v1` em conformidade com a Meta

Submeter novo template **`termo_filiacao_assinatura_v2`** (a Meta não permite editar template REJECTED — precisa novo nome):

```
Categoria: UTILITY
Idioma: pt_BR
Header: none
Corpo:
Olá, {{1}}.

Seu Termo de Filiação está disponível para assinatura digital com validade jurídica.

Veículo: {{2}}
Contrato: {{3}}

Após assinar, sua proteção será ativada automaticamente.

Footer: PRATIC Proteção Veicular
(sem emoji, sem quebra de linha)

Botão (CTA URL dinâmica):
  Tipo: URL
  Texto: Assinar termo
  URL: https://app.praticcar.org/contrato/{{1}}
  Exemplo: https://app.praticcar.org/contrato/abc123
```

Justificativas para aprovação:
- Footer texto puro, sem emoji, sem `\n`.
- Emoji removido do corpo (mais seguro para UTILITY de assinatura).
- URL muda de `assina.ae` (curto/encurtador, Meta penaliza) para domínio próprio `app.praticcar.org` que já é a URL de produção (`mem://infrastructure/domain/production-url-policy`).
- `example` da URL preenchido (campo obrigatório para CTA dinâmico).
- Tom estritamente transacional, sem call-to-action promocional.

Atualizar `supabase/functions/_shared/enviar-termo-filiacao-whatsapp.ts` linha 31 para `PRIMARY_TEMPLATE = 'termo_filiacao_assinatura_v2'` (mantendo `assinatura_documento_v2` como fallback).

#### Parte B — Recriar `autorizacao_fipe_diretoria` em conformidade

Submeter novo template **`autorizacao_fipe_diretoria_v4`**:

```
Categoria: UTILITY
Idioma: pt_BR
Header: TEXT — "Nova solicitação de autorização"
Corpo:
Olá, {{1}}.

Há uma nova solicitação de autorização de veículo aguardando sua análise como diretor(a).

Veículo: {{2}}
Ano: {{3}}
Placa: {{4}}
Valor FIPE: {{5}}
Limite atual: {{6}}
Associado: {{7}}

Acesse o painel administrativo para registrar sua decisão.

Footer: PRATIC Proteção Veicular

Botão (CTA URL dinâmica):
  Tipo: URL
  Texto: Abrir painel
  URL: https://app.praticcar.org/vendas/aprovacoes-fipe/{{1}}
  Exemplo: https://app.praticcar.org/vendas/aprovacoes-fipe/sol-2026-001
```

Justificativas:
- Header dedicado deixa explícito que é UTILITY transacional ao revisor da Meta.
- Variável `{{1}}` agora é o **nome do diretor** (não placa) — segue padrão Meta de "personalização do destinatário", reduz chance de rejeição.
- "Tipo" removido (era variável vaga `{{6}}`); colocada placa em variável própria.
- Removido "ou responda diretamente com APROVAR ou RECUSAR" — esse trecho induz interação livre fora do contexto UTILITY e foi provável gatilho de rejeição.
- URL com path da solicitação específica + `example` preenchido.
- Footer texto puro.

Atualizar `supabase/functions/notificar-diretoria-fipe/index.ts` linhas 91-95 e 167-170 para usar `autorizacao_fipe_diretoria_v4` e adaptar o array `templateParams` para a nova ordem de 7 variáveis (nome diretor, veículo, ano, placa, fipe, limite, associado) + parâmetro de botão (id da solicitação).

#### Parte C — Limpeza dos duplicados

Excluir do banco `whatsapp_meta_templates` (e da Meta via API quando possível) — todos REJECTED e não usados em nenhum lugar do código:

| Template | Ação |
|---|---|
| `aprovacao_fipe_diretoria_v2` | Deletar (referenciado só como **default** em `whatsapp-submit-template/index.ts` linha 20 — vou trocar default para `autorizacao_fipe_diretoria_v4`) |
| `aprovacao_fipe_diretoria_v3` | Deletar (não referenciado) |
| `autorizacao_fipe_diretoria` (sem v) | Deletar (será substituído por `_v4`) |
| `termo_filiacao_assinatura_v1` | Deletar (substituído por `_v2`) |

Ficam apenas `autorizacao_fipe_diretoria_v4` e `termo_filiacao_assinatura_v2` — únicas versões em uso.

#### Parte D — Submissão à Meta

Disparar `whatsapp-submit-template` para os 2 novos templates via botão "Sincronizar" da própria UI (`/configuracoes/integracoes/whatsapp` → tab Templates Meta), ou via Edge Function direto.

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| Migration nova | INSERT dos 2 templates novos + DELETE dos 4 antigos rejeitados |
| `supabase/functions/_shared/enviar-termo-filiacao-whatsapp.ts` | `PRIMARY_TEMPLATE` → `termo_filiacao_assinatura_v2` + ajustar params |
| `supabase/functions/notificar-diretoria-fipe/index.ts` | Trocar nome do template + reordenar `templateParams` para 7 variáveis + adicionar param do botão |
| `supabase/functions/whatsapp-submit-template/index.ts` | Default do template para `autorizacao_fipe_diretoria_v4` |
| Sincronizar com Meta via Edge Function existente | Submete os 2 novos para aprovação |

### Critérios de aceitação

1. Banco fica com **apenas** `termo_filiacao_assinatura_v2` e `autorizacao_fipe_diretoria_v4` para esses dois fluxos — sem duplicados rejeitados.
2. Ambos passam pela validação local (footer sem emoji/quebra, botão URL com `example`).
3. Submissão à Meta retorna `PENDING` (sem erro de payload).
4. Edge Functions `enviar-termo-filiacao-whatsapp` e `notificar-diretoria-fipe` continuam funcionando, agora apontando para os templates novos.
5. UI de Templates Meta mostra os 4 antigos sumidos e os 2 novos como `PENDING` aguardando análise da Meta.

### Fora de escopo

- Migrar templates APPROVED já em produção (não precisam mexer).
- Criar versão MARKETING desses fluxos (são transacionais por natureza).
- Reescrever a tela de gestão de templates Meta.

