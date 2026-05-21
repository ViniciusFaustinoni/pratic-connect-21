## Objetivo

Criar um **Termo de Substituição** (Autentique) — idêntico em estrutura ao Termo/Proposta de Filiação atual (`AF1`), com uma **cláusula extra** explicitando que o associado tem ciência de que o veículo anterior será cancelado e ficará sem cobertura. Esse termo deve ser enviado **automaticamente** no mesmo momento em que hoje é enviado o termo de filiação, sempre que a cotação for de substituição.

## Como o sistema decide qual template usar hoje

Ambos os edges de geração do contrato (`autentique-create` e `autentique-create-by-token`) já seguem este encadeamento:

1. Usa `plano.template_contrato_id` se o plano apontar um template específico.
2. Senão, busca o `documento_templates` com `is_default_autentique=true` (hoje é `AF1 — Proposta de Filiação`).
3. Senão, cai no HTML hardcoded `generateTermoAfiliacao()`.

Ambos os edges também já carregam `templateData.substituicao = { placa_anterior, modelo_anterior, fipe_anterior }` quando `contrato.tipo_entrada IN ('substituicao_placa','substituicao')`. Ou seja, as variáveis para a cláusula nova **já existem** no contexto — não há novo `select` a fazer.

## Plano

### 1. Schema — nova flag de default + registro do template (migração)

`documento_templates` ganha `is_default_substituicao boolean DEFAULT false`, seguindo o mesmo padrão de `is_default_autentique` / `is_default_evento` / `is_default_saida` / `is_default_rastreador`. Índice parcial único garante no máximo 1 ativo:

```sql
ALTER TABLE public.documento_templates
  ADD COLUMN IF NOT EXISTS is_default_substituicao boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_documento_templates_default_substituicao
  ON public.documento_templates (is_default_substituicao)
  WHERE is_default_substituicao = true AND ativo = true;
```

Em seguida, **clona** o conteúdo atual de `AF1 (is_default_autentique=true)` para um novo registro `AF1-SUB — Termo de Substituição` na categoria "Termos", já com `is_default_substituicao=true`, e **injeta uma cláusula nova** antes do bloco de assinatura. Texto proposto:

> **CLÁUSULA — SUBSTITUIÇÃO DE VEÍCULO.** O ASSOCIADO DECLARA estar ciente de que esta adesão substitui a proteção anteriormente vigente sobre o veículo placa **{{substituicao.placa_anterior}}** ({{substituicao.modelo_anterior}}), cuja cobertura será **integralmente CANCELADA** na data de início desta nova adesão, ficando aquele veículo **sem qualquer cobertura associativa** a partir desse momento. A presente assinatura formaliza essa ciência e autoriza o cancelamento do contrato anterior.

A migração lê `conteudo` de `AF1`, insere a cláusula imediatamente antes do `{{bloco_assinatura}}` (ou no final, se o marcador não existir), e grava como novo registro — sem alterar `AF1`.

### 2. Edges — priorizar AF1-SUB quando for substituição

`supabase/functions/autentique-create/index.ts` e `supabase/functions/autentique-create-by-token/index.ts`, no bloco `============= BUSCAR TEMPLATE DO BANCO =============` (linhas ~252 e ~451), após o lookup por `plano.template_contrato_id` e **antes** do fallback `is_default_autentique`, inserir:

```ts
const isSubstituicao =
  contrato.tipo_entrada === 'substituicao_placa' ||
  contrato.tipo_entrada === 'substituicao';

if (!templateDB && isSubstituicao) {
  const { data: subDefault } = await supabase
    .from('documento_templates')
    .select('id, codigo, nome, conteudo, config_layout')
    .eq('is_default_substituicao', true)
    .eq('ativo', true)
    .limit(1)
    .maybeSingle();
  if (subDefault) {
    templateDB = subDefault;
    console.log('[autentique-…] Usando template default de substituição:', subDefault.codigo);
  }
}
```

Resultado: o termo de substituição é escolhido **automaticamente** no mesmo momento em que o termo de filiação seria escolhido — sem mudar timing, sem mudar quem assina, sem mexer no fluxo do Cadastro/Monitoramento. Só troca o HTML enviado ao Autentique.

### 3. UI — toggle "Default para Substituição" no editor de template

`src/pages/documentos/TemplateForm.tsx` e `src/hooks/useDocumentoTemplates.ts` já tratam `is_default_autentique`, `is_default_evento`, `is_default_saida`, `is_default_rastreador`. Adicionar `is_default_substituicao` exatamente do mesmo jeito (campo no formulário + payload do save + tipo `DocumentoTemplateView`). `TemplatesList.tsx` ganha o badge "Default substituição" no card, espelhando os badges existentes.

Sem rota nova, sem dialog novo — só mais uma flag visível no editor.

### 4. Validação

- `SELECT id, codigo, nome FROM documento_templates WHERE is_default_substituicao=true AND ativo=true;` retorna 1 linha (`AF1-SUB`).
- Criar cotação de substituição → chegar ao envio do termo → conferir no log da edge: `Usando template default de substituição: AF1-SUB`.
- PDF gerado contém a cláusula nova com placa/modelo do veículo anterior preenchidos.
- Cotação comum (adesão) continua usando `AF1` (sem regressão).
- Cotação com `plano.template_contrato_id` explícito continua respeitando o template do plano.

## Fora do escopo

- Sem mudanças em `enviar-termo-cancelamento-substituicao` (esse é o **termo de cancelamento do veículo antigo**, fluxo paralelo, segue como está).
- Sem mexer no fallback hardcoded `generateTermoAfiliacao()`.
- Sem mudanças no fluxo de Troca de Titularidade.
- Sem nova edge function; reaproveita `autentique-create` / `autentique-create-by-token`.
