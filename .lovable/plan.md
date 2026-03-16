

## Diagnóstico

A tabela `plano_elegibilidade_modelos` é uma **whitelist** — só os modelos listados são aceitos. Confirmado pelos dados:
- ESPECIAL PLUS tem apenas 12 modelos específicos (C4 LOUNGE, SPRINTER, OUTLANDER, etc.)
- ESPECIAL tem 105 modelos listados com status `aceito` ou `limitado`
- SELECT BASIC tem 109 modelos listados

Com a lógica atual (blocklist: `if (!regra) return 'aprovado'`), qualquer carro NÃO listado é aprovado para TODOS os planos, incluindo ESPECIAL PLUS que deveria aceitar apenas 12 modelos.

A tentativa anterior de whitelist falhou porque a normalização de modelo é frágil — comparação exata entre "VOYAGE" (banco) e "VOYAGE 1.6 MSI" (API) falha mesmo com regex.

## Solução

**Arquivo único:** `src/hooks/usePlanosCotacao.ts`

### 1. Restaurar lógica whitelist (linha 229)
```
if (!regra) return 'aprovado';  →  if (!regra) return 'negado';
```

### 2. Substituir comparação exata por matching flexível (linhas 218-226)

Em vez de normalizar ambos os lados e comparar com `===`, usar uma estratégia de **prefixo/conteúdo**:

```typescript
const regra = regrasDoPlano.find(r => {
  const marcaMatch = r.marca.toUpperCase() === marcaNorm;
  
  // Matching flexível: o modelo do banco deve ser encontrado 
  // no início do modelo da API (ou vice-versa)
  const modeloBanco = r.modelo.trim().toUpperCase();
  const modeloAPI = veiculo.modelo.trim().toUpperCase();
  const modeloMatch = modeloAPI.startsWith(modeloBanco) 
    || modeloBanco.startsWith(modeloAPI)
    || modeloAPI === modeloBanco;
  
  const anoMatch = veiculo.ano >= r.ano_min &&
                   (r.ano_max === null || veiculo.ano <= r.ano_max);
  const combustivelMatch = r.combustivel === 'qualquer' ||
                           r.combustivel === combustivelNorm;
  return marcaMatch && modeloMatch && anoMatch && combustivelMatch;
});
```

Isso resolve:
- `"VOYAGE 1.6"` (API) → `startsWith("VOYAGE")` (banco) = match
- `"ONIX PLUS 1.0 TURBO"` → `startsWith("ONIX PLUS")` = match (mas não `startsWith("ONIX")` sozinho se houver regra "ONIX PLUS")
- `"HB20 1.6"` → `startsWith("HB20")` = match
- `"C3 PICASSO"` (banco) → `"C3 PICASSO 1.6"` (API) = match

### 3. Manter elegibilidade como sinalização visual (sem `continue`)

O resultado `'negado'` **não exclui** o plano. Os planos continuam aparecendo com badges visuais (já implementados no `PlanoCardCotacao.tsx`):
- `negado` → badge vermelho "Restrição de modelo"
- `limitado` → badge amarelo "Aceitação condicionada"

Isso garante que o consultor veja todos os planos com preço válido, mas saiba quais têm restrição de aceitação.

### 4. Remover a função `normalizarModelo` (agora desnecessária)

A normalização por regex é substituída pelo matching por prefixo, que é mais robusto e não depende de padrões de motorização.

