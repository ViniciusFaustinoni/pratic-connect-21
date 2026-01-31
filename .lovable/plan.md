

# Melhorias e Correções na Proposta de Filiação

## Resumo dos Problemas Identificados

Analisando a imagem da proposta e o código-fonte, identifiquei **3 problemas principais**:

### 1. Benefícios Incompletos/Fixos
O documento de proposta exibe apenas 3 benefícios fixos ("Roubo e Furto", "Assistência 24h", "Rastreamento"), ignorando os benefícios reais vinculados ao plano.

**Causa:** As edge functions `autentique-create` e `autentique-create-by-token` usam a função `generateCoberturasDefault()` que tem benefícios hardcoded, pois os campos `planos.coberturas_html`, `planos.franquia` e `planos.carencia` **não existem na tabela** (o código assume que existem mas retorna valores padrão).

### 2. Termo "Franquia" Incorreto
O documento usa "Franquia" onde deveria ser "Cota de Participação" - termo padrão do sistema conforme visto na tabela `planos` que possui os campos `cota_participacao`, `cota_minima`, etc.

### 3. Dados do Plano Não Transportados
Os benefícios reais estão no campo `planos.coberturas` (array de strings) e na tabela `plan_benefits`, mas não são lidos dinamicamente para gerar o documento.

---

## Solução Proposta

### Parte 1: Gerar HTML dos Benefícios Dinamicamente

Criar uma função que leia os benefícios do plano (do array `coberturas` da tabela `planos`) e gere o HTML formatado para o documento.

```text
Fluxo atual (incorreto):
contrato.planos.coberturas_html → null → generateCoberturasDefault() → HTML fixo

Fluxo proposto (correto):
contrato.planos.coberturas (array) → gerarCoberturasHTML(coberturas) → HTML dinâmico
```

### Parte 2: Substituir "Franquia" por "Cota de Participação"

Atualizar:
1. Template do banco de dados (`documento_templates` - CONTRATO_ADESAO_V1)
2. Edge functions (valores padrão e labels)
3. Variáveis disponíveis no sistema

### Parte 3: Mapear Dados de Cota Corretamente

Utilizar os campos reais da tabela `planos`:
- `cota_participacao` → Percentual da cota (ex: 8%)
- `cota_minima` → Valor mínimo da cota (ex: R$ 1.200,00)

---

## Detalhamento Técnico

### Arquivo 1: `supabase/functions/autentique-create/index.ts`

**Alterações:**

1. Criar função `gerarCoberturasHTML(coberturas: string[])`:
```typescript
const gerarCoberturasHTML = (coberturas: string[]): string => {
  if (!coberturas || coberturas.length === 0) {
    return generateCoberturasDefault();
  }
  
  const rows = coberturas.map(cobertura => 
    `<tr><td><span class="coverage-check">✓</span> ${cobertura}</td></tr>`
  ).join('\n');
  
  return `
    <table class="coverage-table">
      ${rows}
    </table>
  `;
};
```

2. Criar função `formatarCotaParticipacao(plano)`:
```typescript
const formatarCotaParticipacao = (plano: any): string => {
  const percentual = plano?.cota_participacao;
  const minimo = plano?.cota_minima;
  
  if (percentual && minimo) {
    return `${percentual}% (mínimo ${formatCurrency(minimo)})`;
  } else if (percentual) {
    return `${percentual}%`;
  }
  return "Conforme condições do plano";
};
```

3. Atualizar mapeamento de variáveis (linhas 744-752):
```typescript
plano: {
  nome: contrato.planos?.nome || "Plano Padrão",
  codigo: contrato.planos?.codigo || "",
  descricao: contrato.planos?.descricao || "",
  tipo_uso: contrato.planos?.tipo_uso || "particular",
  cota_participacao: formatarCotaParticipacao(contrato.planos),
  carencia: "90 dias após instalação do rastreador",
  coberturas_html: gerarCoberturasHTML(contrato.planos?.coberturas),
},
```

4. Atualizar `generateCoberturasDefault()` para usar "Cota de Participação":
```typescript
<div class="highlight-box">
  <strong>Cota de Participação:</strong> Conforme tabela do plano contratado<br>
  <strong>Carência:</strong> 90 dias após instalação do rastreador
</div>
```

### Arquivo 2: `supabase/functions/autentique-create-by-token/index.ts`

Aplicar as mesmas alterações:
1. Adicionar função `gerarCoberturasHTML`
2. Adicionar função `formatarCotaParticipacao`
3. Incluir `coberturas` na query do contrato (já vem via `planos:plano_id (*)`)
4. Atualizar `generateCoberturasDefault` para usar "Cota de Participação"
5. Passar `coberturas` para o template

### Arquivo 3: Template no Banco (`documento_templates`)

Atualizar o template `CONTRATO_ADESAO_V1` para usar a nova variável:

```markdown
## 4. COBERTURAS CONTRATADAS - {{plano.nome}}

{{plano.coberturas_html}}

**Cota de Participação:** {{plano.cota_participacao}}
**Carência:** {{plano.carencia}}
```

**Nota:** A alteração no banco pode ser feita via SQL migration ou via UI de administração.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/autentique-create/index.ts` | Gerar coberturas HTML dinamicamente, usar "Cota de Participação" |
| `supabase/functions/autentique-create-by-token/index.ts` | Mesmas alterações para consistência |
| Banco: `documento_templates` | Substituir `{{plano.franquia}}` por `{{plano.cota_participacao}}` |

---

## Resultado Esperado

Após as correções, o documento de proposta exibirá:

1. **Todos os benefícios** do plano SELECT ONE:
   - ✓ Roubo e Furto
   - ✓ Colisão
   - ✓ Perda Total
   - ✓ Incêndio
   - ✓ Alagamento
   - ✓ Chuva de Granizo
   - ✓ Assistência 24h 1000km
   - ✓ Rastreador/Monitoramento
   - ✓ Danos Terceiros R$100mil
   - ✓ Vidros e Faróis
   - ✓ Reboque Excedente
   - ✓ Kit Gás
   - ✓ Carro Reserva
   - ✓ Clube Gás

2. **Nomenclatura correta:**
   - "Cota de Participação: 8% (mínimo R$ 3.000,00)" (exemplo)
   - "Carência: 90 dias após instalação do rastreador"

3. **Dados completos** transportados do cadastro

