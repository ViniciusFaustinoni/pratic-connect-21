
# Correcao: Termo de Rastreador nao incluido no PDF (template do banco)

## Diagnostico

O contrato CTR-20260302161419-LFCH32 do associado MARCUS VINICIUS FAUSTINONI DE FREITAS (moto Honda NXR160 Bros, FIPE R$ 16.484, categoria "moto") deveria incluir a secao de Termo de Responsabilidade de Rastreador, pois o valor FIPE excede o limite de R$ 9.000 para motos.

**Causa raiz**: O sistema esta usando o template do banco de dados ("Proposta de Filiacao" AF1), e nesse caminho a funcao `generateSecaoRastreador()` **nunca e chamada**. Ela so existe no fallback hardcoded. O fluxo do template de banco depende de `termos_aditivos` para anexar secoes condicionais, mas **nao existe nenhum aditivo configurado para rastreador**.

### Fluxo atual (banco de dados template - USADO):
1. Busca template AF1 do banco
2. Substitui variaveis com `substituirVariaveis()`
3. Busca aditivos com `buscarEGerarAditivos()` - so encontra "0Km" e "Vidros"
4. **Rastreador e ignorado**

### Fluxo fallback (hardcoded - NAO USADO):
1. Chama `generateTermoAfiliacao()` que inclui `generateSecaoRastreador()`
2. Rastreador funciona corretamente

## Correcao Proposta

Injetar a secao de rastreador diretamente no fluxo do template de banco, **apos os aditivos**, quando `exigeRastreador()` retornar `true`. Isso garante que independente do caminho (banco ou fallback), o termo de rastreador apareca.

### Arquivo a editar

**`supabase/functions/autentique-create-by-token/index.ts`** (linhas ~207-230)

Apos gerar `aditivosHTML`, verificar se rastreador e obrigatorio e, se sim, chamar `generateSecaoRastreador()` e concatenar ao HTML final.

**`supabase/functions/autentique-create/index.ts`** (mesmo ajuste, se tambem usar template de banco)

Aplicar a mesma logica para garantir consistencia entre os dois endpoints de geracao de contrato.

### Logica da correcao

```text
1. Importar generateSecaoRastreador do termo-afiliacao-template
2. Apos gerar aditivosHTML, chamar:
   const rastreadorResult = exigeRastreador(templateData.veiculo, templateData.configRastreador)
   const rastreadorHTML = rastreadorResult.exige ? generateSecaoRastreador(templateData) : ''
3. Incluir rastreadorHTML no HTML final, entre aditivosHTML e assinaturaHTML
```

### Resumo de alteracoes

- **Editar**: `supabase/functions/autentique-create-by-token/index.ts` — injetar secao rastreador no fluxo de template de banco
- **Editar**: `supabase/functions/autentique-create/index.ts` — mesma correcao para consistencia
- **Exportar**: `generateSecaoRastreador` de `supabase/functions/_shared/termo-afiliacao-template.ts` (verificar se ja esta exportada)

Nenhuma migration necessaria. A correcao e puramente na logica de geracao de HTML do termo.
