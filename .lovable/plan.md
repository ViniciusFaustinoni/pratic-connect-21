

# Completar Cadastro de Prestadores da Assistencia

## Resumo

Expandir o cadastro de prestadores da assistencia 24h com novos tipos de servico, campo de tipos de reboque condicional, tabela de valores por servico, e exibicao desses dados na tela de detalhe.

---

## 1. Banco de Dados - Migracao

### 1a. Adicionar coluna `tipos_reboque` na tabela existente

```sql
ALTER TABLE prestadores_assistencia 
ADD COLUMN tipos_reboque text[] DEFAULT '{}';
```

### 1b. Criar tabela `prestadores_assistencia_valores`

Tabela para armazenar precos por tipo de servico e tipo de reboque, com constraint UNIQUE para evitar duplicidade.

Campos: `prestador_id`, `tipo_servico`, `tipo_reboque` (nullable), `valor_saida`, `valor_km`, `valor_fixo`, `observacoes`, `ativo`.

RLS habilitado com politica permissiva (mesma abordagem da tabela pai).

---

## 2. Formulario - NovoPrestadorModal.tsx

### 2a. Expandir constante TIPOS_SERVICO

Adicionar 4 novos tipos mantendo os existentes:

| value | label |
|---|---|
| reboque | Reboque / Guincho |
| pane_seca | Pane Seca |
| socorro_mecanico | Socorro Mecanico (novo) |
| socorro_eletrico | Socorro Eletrico (novo) |
| troca_pneu | Troca de Pneu |
| chaveiro | Chaveiro |
| bateria | Bateria |
| taxi | Taxi / Transporte (novo) |
| hospedagem | Hospedagem (novo) |
| outro | Outros |

### 2b. Adicionar campo `tipos_reboque` ao schema e formulario

- Adicionar `tipos_reboque: z.array(z.string()).default([])` ao zod schema
- Adicionar ao `defaultValues` e ao `useEffect` de pre-preenchimento
- No JSX, renderizar checkboxes condicionais (so aparece quando "reboque" esta marcado):
  - Leve (leve) - "motos, carros de passeio"
  - Utilitario (utilitario) - "vans, pickups, SUVs"  
  - Pesado (pesado) - "sprinters, caminhoes"
- Incluir `tipos_reboque` no `buildPayload`

### 2c. Adicionar secao de Valores (expansivel)

- Adicionar uma 4a aba "Valores" ao TabsList (grid muda de 3 para 4 colunas)
- Usar estado local `valores` para gerenciar os cards de preco
- Para cada servico marcado:
  - Se for "reboque", gerar um card para cada tipo de reboque selecionado (ex: "Reboque - Leves")
  - Se for outro servico, gerar um card unico (ex: "Chaveiro")
- Cada card tem:
  - Servicos com km (reboque, pane_seca, socorro_mecanico, socorro_eletrico, troca_pneu, bateria): campos `Valor de Saida` e `Valor por Km`
  - Servicos de valor fixo (chaveiro, taxi, hospedagem): campo `Valor Fixo`
  - Campo opcional de observacoes
- Todos os campos sao opcionais
- No submit, salvar os valores na tabela `prestadores_assistencia_valores` (insert apos criar, upsert apos editar)
- No modo edicao, carregar valores existentes da tabela

### 2d. Atualizar interface PrestadorParaEdicao

Adicionar `tipos_reboque` ao tipo para suportar edicao.

---

## 3. Tela de Detalhe - PrestadorDetalhe.tsx

### 3a. Atualizar mapa de tipos de servico

Adicionar os 4 novos tipos ao `tiposServicoConfig`.

### 3b. Adicionar tipos de reboque ao tipo Prestador

Incluir `tipos_reboque: string[] | null` na interface.

### 3c. Mostrar tipos de reboque

No card "Tipos de Servico" (coluna lateral), se o prestador tem `tipos_reboque` com itens, exibir uma subsecao "Tipos de Reboque" com badges: Leves, Utilitarios, Pesados.

### 3d. Mostrar tabela de valores

Adicionar query para buscar `prestadores_assistencia_valores` do prestador. Exibir um novo Card "Tabela de Valores" na coluna principal (apos dados bancarios), com uma tabela simples:

| Servico | Saida | Km | Fixo |
|---|---|---|---|

Cada linha mostra o servico (e tipo reboque se aplicavel) com os valores formatados em R$.

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---|---|
| Migracao SQL | Adicionar coluna tipos_reboque + criar tabela valores + RLS |
| src/components/assistencia/NovoPrestadorModal.tsx | Novos tipos servico, checkboxes reboque, aba de valores, logica de save |
| src/pages/assistencia/PrestadorDetalhe.tsx | Novos tipos no config, exibir tipos reboque e tabela de valores |
| src/integrations/supabase/types.ts | Atualizado automaticamente apos migracao |

## Sequencia de Implementacao

1. Criar migracao (coluna + tabela + RLS)
2. Atualizar NovoPrestadorModal.tsx (tipos servico, reboque, aba valores, save)
3. Atualizar PrestadorDetalhe.tsx (exibir novos dados)
4. Testar fluxo completo

