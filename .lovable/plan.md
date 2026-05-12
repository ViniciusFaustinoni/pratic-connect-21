## Problema (causa raiz identificada)

O template **"Proposta de Filiação"** (`documento_templates.codigo = 'AF1'`) salvo no banco tem as duas linhas da tabela do veículo apontando para a **mesma variável**:

```
Categoria:  {{veiculo.tipo}}   ← ERRADO, deveria ser {{veiculo.categoria}}
Tipo:       {{veiculo.tipo}}   ← OK
```

Por isso ambas renderizam "Automóvel". Adicionalmente:

1. O resolver `veiculo.categoria` em `template-utils.ts` retorna **"Particular" / "Aluguel"**, mas o usuário pediu **"Particular" / "Aplicativo"**.
2. `veiculo.tipo` repassa o valor cru (`carro`, `moto`, `utilitario`) sem normalizar para o rótulo de exibição (`Automóvel`, `Motocicleta`, `Utilitário`).
3. `Ano Fab./Mod.` já usa `{{veiculo.ano_fabricacao}} - {{veiculo.ano}}` corretamente. No caso do Onix 2021/2021 os dois são realmente iguais — vamos garantir a hierarquia (contrato → veiculoDB → lead) e o fallback para que nunca repita o mesmo ano por bug.

## Correções

### 1. Template no banco (migration)
Substituir, dentro do `template_html` do registro `id = eb09759f-cfbc-4ee8-8f1f-f1cc520e7279`, a célula "Categoria" para usar `{{veiculo.categoria}}`. Manter "Tipo" usando `{{veiculo.tipo}}`. Usar `REPLACE` cirúrgico no HTML (procurar pelo bloco exato `<strong>Categoria:</strong>...<p>{{veiculo.tipo}}</p>` e trocar por `{{veiculo.categoria}}`).

### 2. `supabase/functions/_shared/template-utils.ts`
- `veiculo.categoria`: manter leitura de `dados.veiculo.categoria` (já vem resolvido), mas mapear o valor "Aluguel" para **"Aplicativo"** na exibição (o usuário pede esse rótulo).
- `veiculo.tipo`: normalizar `tipo_veiculo` para rótulo legível:
  - `carro`/`automovel` → `Automóvel`
  - `moto`/`motocicleta` → `Motocicleta`
  - `utilitario` → `Utilitário`
  - `caminhao` → `Caminhão`
  - vazio → fallback inferido a partir de `marcas_modelos.tipo_veiculo` quando disponível, senão `Automóvel`.

### 3. `supabase/functions/_shared/termo-afiliacao-utils.ts`
Atualizar `resolverCategoriaCrlv` para retornar **"Particular" | "Aplicativo"** (em vez de "Aluguel"). Manter a mesma regra (uso_aplicativo / veiculo_tipo_uso).

### 4. `src/components/documentos/templatePreviewData.ts`
- `veiculo.categoria`: `'Particular'`
- `veiculo.tipo`: `'Automóvel'`
- `veiculo.ano`: `'2024'` e `veiculo.ano_fabricacao`: `'2023'` (deixar visualmente diferentes na pré-visualização para evitar confusão futura).

### 5. `src/components/documentos/VariaveisSelector.tsx`
Atualizar descrições:
- `veiculo.categoria` → "Categoria de uso (Particular/Aplicativo)"
- `veiculo.tipo` → "Tipo do veículo (Automóvel, Motocicleta, Utilitário)"

## Validação
1. Pré-visualização do template no admin Documentos → conferir Categoria = "Particular" e Tipo = "Automóvel".
2. Gerar termo real via aprovar-proposta de uma cotação de teste e abrir o PDF gerado.
3. Para um caso uso_aplicativo=true → Categoria deve aparecer "Aplicativo".
4. Para uma moto → Tipo deve aparecer "Motocicleta".

## Fora de escopo
- Não alterar fluxo de geração/assinatura Autentique.
- Não alterar regra de inferência de uso aplicativo (apenas o rótulo final).
- Não tocar em outros templates além do `AF1`.
