## Diagnóstico raiz

Rastreador, Vidros e Faróis e Reboque Excedente **não sumiram do banco**. Eles aparecem normalmente dentro dos planos (que carregam via join filtrado pelo `plano_id`), mas somem da aba **Configurações › Gestão Comercial › Coberturas e Benefícios** porque a tela está exibindo apenas as **primeiras 1000 linhas alfabéticas** da tabela `benefits`.

### Evidências

- A tabela `benefits` tem **1777 registros ativos**. A aba mostra exatamente **"Benefícios (1000)"** — número idêntico ao limite default do PostgREST.
- Ordenando por `name` ASC, os itens começam em:
  - `Rastreador/Monitoramento - Select One Aplicativo` → linha **1259**
  - Vidros e Faróis e Reboque Excedente caem ainda mais adiante
- Como ficam fora das primeiras 1000, nunca chegam ao cliente — por isso a busca no front (`.filter().includes()`) retorna "Nenhum item cadastrado".

### Onde está o bug

`src/hooks/usePlans.ts` → `useBenefits()` faz:

```ts
supabase.from('benefits').select('*').order('name')
```

Sem `.range()` nem paginação, o PostgREST trunca em 1000. Mesmo padrão em `useCoberturas()` (tabela `coberturas` tem 1000 linhas no badge também — mesmo sintoma, ainda sem reclamação porque coberturas têm menos volume).

## Plano de correção raiz

### 1. Paginação completa nos hooks do catálogo (`src/hooks/usePlans.ts`)

Substituir `useBenefits()` e `useCoberturas()` por uma busca paginada que percorre `.range(offset, offset+999)` em loop até esgotar (`data.length < pageSize`). Retorna o array completo, com mesma forma de dados (não muda contrato de tipos).

Pseudocódigo:

```text
pageSize = 1000
offset = 0
all = []
loop:
  rows = select(...).order('name').range(offset, offset + pageSize - 1)
  all.push(...rows)
  if rows.length < pageSize: break
  offset += pageSize
return all
```

Aplicar idêntico em `useCoberturas()` (mesmo risco latente).

### 2. Verificar outras leituras de catálogo sujeitas ao mesmo teto

Buscar `from('benefits')` e `from('coberturas')` com `.select('*')` sem paginação no projeto e aplicar o mesmo helper onde a intenção for "catálogo inteiro" (não onde já há filtro estreito, ex. join por `plano_id`).

### 3. Validação pós-fix

- Aba "Benefícios" passa a mostrar `(1777)` e os itens reaparecem na busca por "Rastreador", "Vidros", "Reboque Excedente".
- Os planos continuam exibindo os mesmos itens (não houve mudança em `planos_beneficios`).

### 4. Higiene (fora do escopo desta correção, apenas registro)

Há duplicações claras em `benefits` (ex.: "Rastreador/Monitoramento - Select One Aplicativo" aparece 2× com nomes idênticos e linhas diferentes). Não toco agora — exige limpeza com auditoria de vínculos em `planos_beneficios`. Posso abrir tarefa separada se quiser.

## Não está no escopo

- Não mudar UI/UX da tela.
- Não mexer em `beneficios_adicionais` (tabela diferente, não impacta esta aba).
- Não deduplicar registros sem aprovação.
