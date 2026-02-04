

# Plano: Conectar Templates Configuráveis ao Autentique

## Objetivo

Fazer com que o Termo de Afiliação enviado para assinatura via Autentique seja gerado a partir do template configurado em `/documentos/templates`, garantindo que mudanças no texto/variáveis no painel se reflitam automaticamente nos documentos enviados para assinatura.

---

## Estado Atual vs Esperado

| Aspecto | Estado Atual | Estado Esperado |
|---------|--------------|-----------------|
| Fonte do template Autentique | Arquivo TypeScript hardcoded | Banco de dados `documento_templates` |
| Edição do texto | Requer deploy de código | Via painel `/documentos/templates` |
| Variáveis disponíveis | Definidas no código | Configuráveis no editor |
| Estilos/layout | CSS inline fixo | Configuração + CSS da empresa |

---

## Arquitetura Proposta

```text
┌─────────────────────────────────────────────────────────────────────┐
│ PAINEL ADMIN: /documentos/templates                                 │
│                                                                     │
│ Template: "Termo de Afiliação ao PSM"                               │
│ Código: TERMO_AFILIACAO_V1                                          │
│ ☑ Requer assinatura digital                                        │
│ ☑ Template padrão para contratos                                   │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Editor de Conteúdo                                              │ │
│ │                                                                 │ │
│ │ # TERMO DE AFILIAÇÃO AO PSM                                     │ │
│ │ Nº {{contrato.numero}}                                          │ │
│ │                                                                 │ │
│ │ ## 1. QUALIFICAÇÃO DO ASSOCIADO                                 │ │
│ │ Nome: {{associado.nome}}                                        │ │
│ │ CPF: {{associado.cpf}}                                          │ │
│ │ ...                                                             │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ Salva no banco
┌─────────────────────────────────────────────────────────────────────┐
│ TABELA: documento_templates                                         │
│                                                                     │
│ id: uuid                                                            │
│ codigo: "TERMO_AFILIACAO_V1"                                        │
│ nome: "Termo de Afiliação ao PSM"                                   │
│ conteudo: "# TERMO DE AFILIAÇÃO AO PSM\n..."                        │
│ requer_assinatura: true                                             │
│ config_layout: { margens, fonte, logo }                             │
│ template_html: "<html>...</html>" ← NOVO CAMPO                      │
│ is_default_autentique: true ← NOVO CAMPO                            │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ Lido pela edge function
┌─────────────────────────────────────────────────────────────────────┐
│ EDGE FUNCTION: autentique-create                                    │
│                                                                     │
│ 1. Recebe contratoId                                                │
│ 2. Busca contrato, associado, veiculo, plano                        │
│ 3. BUSCA TEMPLATE do banco (is_default_autentique = true)           │
│ 4. Substitui variáveis no conteudo/template_html                    │
│ 5. Envolve com estilos padrão da Pratic                             │
│ 6. Adiciona termos condicionais (0KM, Rastreador)                   │
│ 7. Envia HTML para Autentique                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementacao Tecnica

### 1. Migração de Banco de Dados

Adicionar campos na tabela `documento_templates`:

```sql
-- Marcar template como padrao para Autentique
ALTER TABLE documento_templates
  ADD COLUMN IF NOT EXISTS is_default_autentique BOOLEAN DEFAULT false;

-- Armazenar HTML compilado (opcional, para cache)
ALTER TABLE documento_templates
  ADD COLUMN IF NOT EXISTS template_html TEXT;

-- Garantir unicidade do template padrao
CREATE UNIQUE INDEX IF NOT EXISTS idx_template_default_autentique 
  ON documento_templates (is_default_autentique) 
  WHERE is_default_autentique = true;
```

### 2. Criar Template Padrão no Banco

Inserir o conteúdo atual do `termo-afiliacao-template.ts` como um registro na tabela:

```sql
INSERT INTO documento_templates (
  codigo,
  nome,
  categoria_id,
  conteudo,
  requer_assinatura,
  is_default_autentique,
  ativo
) VALUES (
  'TERMO_AFILIACAO_V1',
  'Termo de Afiliação ao PSM',
  (SELECT id FROM documento_categorias WHERE nome ILIKE '%termo%' LIMIT 1),
  '# TERMO DE AFILIAÇÃO AO PSM...',
  true,
  true,
  true
);
```

### 3. Modificar Edge Function `autentique-create`

Atualizar para buscar template do banco:

```typescript
// ANTES (hardcoded)
import { generateTermoAfiliacao } from "../_shared/termo-afiliacao-template.ts";
const contratoHTML = generateTermoAfiliacao(templateData);

// DEPOIS (dinâmico)
// 1. Buscar template padrão do banco
const { data: template } = await supabase
  .from('documento_templates')
  .select('conteudo, config_layout')
  .eq('is_default_autentique', true)
  .single();

// 2. Substituir variáveis
const conteudoPreenchido = substituirVariaveis(template.conteudo, templateData);

// 3. Gerar HTML com estilos padrão
const contratoHTML = gerarHTMLCompleto(conteudoPreenchido, templateData);
```

### 4. Criar Função de Substituição de Variáveis

Nova função para processar variáveis do template:

```typescript
function substituirVariaveis(conteudo: string, dados: TermoAfiliacaoData): string {
  let resultado = conteudo;
  
  // Mapeamento de variáveis para dados
  const variaveis: Record<string, any> = {
    'contrato.numero': dados.contrato.numero,
    'associado.nome': dados.cliente.nome,
    'associado.cpf': formatCPF(dados.cliente.cpf),
    'associado.email': dados.cliente.email,
    'veiculo.marca': dados.veiculo.marca,
    'veiculo.modelo': dados.veiculo.modelo,
    'veiculo.placa': dados.veiculo.placa || 'ZERO QUILÔMETRO',
    'plano.nome': dados.plano.nome,
    'plano.coberturas': dados.plano.coberturas?.join(', '),
    // ... demais variáveis
  };
  
  // Substituir todas as ocorrências
  for (const [chave, valor] of Object.entries(variaveis)) {
    resultado = resultado.replace(
      new RegExp(`\\{\\{${chave}\\}\\}`, 'g'),
      valor || '—'
    );
  }
  
  return resultado;
}
```

### 5. Gerar HTML com Estilos Padrão

Manter os estilos CSS da Pratic:

```typescript
function gerarHTMLCompleto(conteudo: string, dados: TermoAfiliacaoData): string {
  // Converter markdown para HTML
  const conteudoHTML = markdownParaHTML(conteudo);
  
  // Adicionar termos condicionais
  const termo0km = ehVeiculoZeroKm(dados.veiculo) ? generateSecaoCarroZero(dados) : '';
  const termoRastreador = exigeRastreador(dados.veiculo).exige ? generateSecaoRastreador(dados) : '';
  
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Termo de Afiliação - ${dados.contrato.numero}</title>
  ${generateStyles()}
</head>
<body>
  <div class="page">
    ${generateHeader(dados)}
    ${conteudoHTML}
    ${termo0km}
    ${termoRastreador}
    ${generateFooter(dados)}
  </div>
</body>
</html>
  `;
}
```

### 6. Atualizar UI para Marcar Template Padrão

No formulário de edição de templates (`TemplateForm.tsx`), adicionar checkbox:

```tsx
<FormField
  name="is_default_autentique"
  render={({ field }) => (
    <FormItem className="flex items-center gap-3">
      <FormControl>
        <Checkbox
          checked={field.value}
          onCheckedChange={field.onChange}
        />
      </FormControl>
      <FormLabel>
        Usar como template padrão para Autentique
      </FormLabel>
      <FormDescription>
        Este template será usado para gerar o Termo de Afiliação
      </FormDescription>
    </FormItem>
  )}
/>
```

---

## Estrutura de Variáveis Disponíveis

| Grupo | Variável | Descrição |
|-------|----------|-----------|
| **contrato** | `{{contrato.numero}}` | Número do contrato |
| | `{{contrato.data_inicio}}` | Data de início |
| | `{{contrato.dia_vencimento}}` | Dia de vencimento |
| **associado** | `{{associado.nome}}` | Nome completo |
| | `{{associado.cpf}}` | CPF formatado |
| | `{{associado.rg}}` | RG |
| | `{{associado.email}}` | E-mail |
| | `{{associado.telefone}}` | Telefone |
| | `{{associado.endereco_completo}}` | Endereço completo |
| **veiculo** | `{{veiculo.marca}}` | Marca |
| | `{{veiculo.modelo}}` | Modelo |
| | `{{veiculo.placa}}` | Placa (ou "ZERO KM") |
| | `{{veiculo.chassi}}` | Chassi |
| | `{{veiculo.renavam}}` | Renavam |
| | `{{veiculo.valor_fipe}}` | Valor FIPE formatado |
| **plano** | `{{plano.nome}}` | Nome do plano |
| | `{{plano.coberturas}}` | Lista de coberturas |
| | `{{plano.cota_participacao}}` | Cota de participação |
| **empresa** | `{{empresa.nome}}` | Nome da empresa |
| | `{{empresa.cnpj}}` | CNPJ |
| | `{{empresa.endereco}}` | Endereço |
| **sistema** | `{{sistema.data_atual}}` | Data atual |
| | `{{sistema.data_extenso}}` | Data por extenso |

---

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| Nova migração SQL | CRIAR | Adicionar campos `is_default_autentique` e `template_html` |
| `supabase/functions/autentique-create/index.ts` | MODIFICAR | Buscar template do banco ao invés de hardcoded |
| `supabase/functions/_shared/template-utils.ts` | CRIAR | Funções de substituição de variáveis e geração HTML |
| `src/hooks/useDocumentoTemplates.ts` | MODIFICAR | Adicionar campo `is_default_autentique` |
| `src/pages/documentos/TemplateForm.tsx` | MODIFICAR | Checkbox para marcar template padrão |

---

## Fluxo Final

```text
1. Admin edita template em /documentos/templates
2. Salva alterações no banco documento_templates
3. Usuário cria contrato e envia para assinatura
4. Edge function autentique-create:
   a. Busca template marcado como is_default_autentique
   b. Busca dados do contrato, associado, veículo, plano
   c. Substitui variáveis {{...}} pelos valores reais
   d. Adiciona termos condicionais (0KM, Rastreador)
   e. Gera HTML completo com estilos da Pratic
   f. Envia para Autentique
5. Cliente recebe link para assinar
6. Documento reflete exatamente o que foi configurado no painel
```

---

## Compatibilidade e Migração

1. **Manter template atual como fallback**: Se não houver template marcado como padrão, usar o template hardcoded atual
2. **Migração gradual**: Primeiro criar o template no banco, depois ativar a leitura dinâmica
3. **Versionamento**: Usar campo `versao` para rastrear mudanças no template

---

## Estimativa de Tempo

| Tarefa | Tempo |
|--------|-------|
| Migração SQL | 15 min |
| Modificar edge function | 1h 30min |
| Criar funções utilitárias | 45 min |
| Atualizar frontend | 30 min |
| Testes | 30 min |
| **Total** | **~3h 30min** |

