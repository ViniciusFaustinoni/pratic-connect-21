
## Objetivo

Na tela **Financeiro › Cobranças › Emissão › Importar CSV**, permitir que o operador escolha **qualquer template Meta** (`status=APPROVED` + `disparo_habilitado=true`) e mapeie manualmente cada `{{n}}` do corpo a uma **fonte de dados do CSV** ou um texto fixo, antes de disparar o lote. Boletos continuam vindo do CSV (mesmo agrupamento por matrícula).

## Escopo (frontend + edge)

### 1) Picker de template (UI)

Arquivo: `src/components/financeiro/ImportarCobrancaCsv.tsx` (etapa `preview`).

- Acima do botão "Disparar envio", novo bloco **"Template Meta"**:
  - `Select` com lista de templates `APPROVED + disparo_habilitado=true` (fetch direto de `whatsapp_meta_templates`, ordenado por `nome`). Default: `cobranca_inadimplencia_pratic` (mantém o comportamento atual).
  - Toggle **"Usar v2 (botão URL com 2ª via)"** só aparece quando o template selecionado tem `botoes` com um botão `type='URL'` dinâmico (regex `{{1}}` no `url`). Para o template canônico mantém o default `true`.
  - Preview compacto do `corpo` (com `{{n}}` destacados) e `header_texto` quando houver.

### 2) Mapeamento de variáveis

Mesmo bloco, abaixo do select:

- Parser de `{{n}}` no `corpo` (e em `header_texto` se `header_tipo='text'`) gera a lista de variáveis a preencher.
- Para cada `{{n}}`, um `Select` de **fonte**:
  - `nome` — nome do destinatário
  - `primeiro_nome` — primeiro token do nome
  - `matricula`
  - `valor_total` — somatório dos boletos do destinatário (BRL)
  - `lista_boletos` — texto agrupado (formato atual: `• Placa X — venc. dd/mm/aaaa\n  <linha>`)
  - `placa_primeira` — primeira placa
  - `vencimento_primeiro` — primeira data
  - `linha_digitavel_primeira`
  - `valor_primeiro_boleto`
  - `qtd_boletos`
  - `texto_fixo` — abre `Input` ao lado para digitar o texto literal
- Heurística inicial: tenta preencher por nome ({{1}}→nome, {{2}}→lista_boletos quando há múltiplos boletos / valor_total quando há 1, etc.) usando `variaveis_exemplo` como dica visual de placeholder.
- Validação: bloqueia "Disparar" enquanto houver `{{n}}` sem fonte (ou `texto_fixo` vazio).

Helper novo: `src/lib/cobranca/templateVarsMapper.ts`
- `parseVariaveisTemplate(corpo, header)` → `string[]` com índices únicos
- `montarValoresParaDestinatario(destinatario, mapping)` → `Record<varIndex, string>` (executado server-side; mas exporto o tipo pra UI exibir preview).

### 3) Preview de mensagem por destinatário

Painel "Pré-visualização": pega o 1º destinatário válido, aplica o `mapping` no `corpo` substituindo `{{n}}` e mostra como ficará a mensagem real. Atualiza ao trocar template/mapping.

### 4) Edge `disparar-cobranca-csv-meta`

Arquivo: `supabase/functions/disparar-cobranca-csv-meta/index.ts`.

- Novos campos no `body` (validados): `template_nome` (já existe — passa a ser canônico), `var_mapping: Record<string, {source: string; texto?: string}>`, `template_v2_button: boolean`.
- Carrega o template do DB (uma vez por chamada) para validar:
  - Existe? `APPROVED`? `disparo_habilitado=true`? Caso contrário, 400 `template_invalido`.
  - Conta `{{n}}` no corpo e exige `var_mapping` completo. Falta de mapping → 400 `mapping_incompleto`.
- Substitui o trecho hard-coded de `components.body.parameters` por loop sobre o mapping, montando os parâmetros na ordem `{{1}}…{{N}}` via helper compartilhado (movo o `montarValoresParaDestinatario` para `_shared/cobranca-var-mapper.ts`).
- Botão URL dinâmico: se `template_v2_button=true` E template tem botão URL `{{1}}`, mantém a injeção atual do `sufixoHinova` (link 2ª via). Caso contrário, omite o componente `button`.
- Comportamento de **bloco extra** (quando lista de boletos não cabe num único parâmetro): preserva-se **apenas** quando a variável mapeada para "lista_boletos" estoura o limite Meta de 1024 chars — quebra em blocos como hoje, mas só o 1º bloco leva o botão. Para outros templates sem `lista_boletos`, envia 1 mensagem por destinatário.
- `template_nome_fallback` removido — não há mais fallback automático para `cobranca_inadimplencia_pratic` quando o operador escolheu outro template. Se v2 falhar e v1 não estiver mapeado, retorna erro do destinatário com `erro_codigo='template_v2_falhou'`.
- Mantém **integral** a regra de dedup do mesmo dia (`mem://logic/billing/dedup-cobranca-mesmo-dia`), reconciliação `cobrancas`, lote/idempotência e flag `disparo_habilitado`.

### 5) Auditoria

- `cobranca_csv_lotes`: gravar `template_nome` e `var_mapping_snapshot` (jsonb) — migration adiciona as 2 colunas (`text` + `jsonb`, nullable). Aparece como tooltip no card "Lote ativo".

## Arquivos tocados

```text
src/components/financeiro/ImportarCobrancaCsv.tsx            (UI: picker + mapping + preview)
src/components/financeiro/TemplateMetaPicker.tsx             (novo, isolável)
src/lib/cobranca/templateVarsMapper.ts                       (novo, util puro)
supabase/functions/_shared/cobranca-var-mapper.ts            (novo, util compartilhado)
supabase/functions/disparar-cobranca-csv-meta/index.ts       (validação + render dinâmico)
supabase/migrations/<ts>_lote_template_snapshot.sql          (2 colunas em cobranca_csv_lotes)
```

## Fora de escopo

- Edição de templates Meta (continua sendo só leitura nesta tela; gestão segue em WhatsApp › Templates).
- Disparo sem boletos / 1 msg por destinatário sem CSV.
- Mudanças no `LoteAtivoCobrancas.tsx` além de exibir o nome do template usado.

## Riscos / mitigação

- **Template marketing acidental**: filtro de query é `status='APPROVED' AND disparo_habilitado=true`; categoria MARKETING não é bloqueada explicitamente porque já há toggle de `disparo_habilitado`. Se quiser, posso restringir a `categoria='UTILITY'` — confirmar.
- **Variável faltando**: validação na UI + 400 server-side cobrem.
- **Limite 1024 char Meta**: já tratado pela quebra em blocos; mantemos para `lista_boletos`.

## Memória a atualizar pós-implementação

`mem://features/billing/csv-cobranca-meta-disparo` — registrar que o template é agora selecionável + mapping manual, e que o fallback automático foi removido.
