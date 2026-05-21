
## Plano — Correção raiz da seleção da variante FIPE

### Causa raiz

`supabase/functions/plate-lookup/index.ts` escolhe a melhor variante FIPE com a heurística `pontuarFipe()`, que considera **combustível, câmbio, ano, cilindrada** — mas **ignora o nome/versão (trim) do modelo** retornado pela API de placas (DETRAN). Quando trims diferentes empatam em todos esses atributos (Renegade Sport vs Renegade 75 Anos vs Limited vs Longitude — todas Flex/Aut/1.8/2016), o desempate vira **ordem da lista**, retornando uma variante errada.

Resultado: `veiculo.modelo` fica o nome real do DETRAN, mas `codigo_fipe`/`valor_fipe` vêm de outra versão — desincronizados em cotação → contrato → veículo.

### 1. Reforçar `pontuarFipe()` com matching por nome (correção principal)

Em `supabase/functions/plate-lookup/index.ts`:

- Acrescentar entrada `nomeVeic = String(v?.modelo || v?.fipe_name || '').toUpperCase()` em `pontuarFipe`.
- Tokenizar `nomeVeic` em palavras com ≥3 caracteres, removendo ruído comum (`AUT`, `MEC`, `FLEX`, `GASOL`, dígitos, ".", "/"). Resultado: `tokensVeic` (ex.: `["RENEGADE","SPORT","AUTOMATICO"]`).
- Para cada token presente também em `desc`, +6 pontos (peso alto — distingue trim).
- Lista de **tokens de trim distintivos** (`TRIM_TOKENS`) que, quando aparecem só num lado, são penalidade −12: `SPORT, LIMITED, LONGITUDE, TRAILHAWK, MOAB, 75 ANOS, S, SE, SEL, SR, SRT, LT, LTZ, LS, EX, EXL, LX, GLX, GLS, GL, SXT, HIGHLINE, COMFORTLINE, TRENDLINE, BLACK, NIGHT, RUBICON, SAHARA, WILLYS, OUTDOOR, ADVENTURE, FREEDOM`. Se `tokensVeic` contém um trim e `desc` contém **outro trim diferente**, soma −12.
- Manter os pesos atuais (combustível, câmbio, ano, cilindrada).

Resultado esperado para PYL9A01: "Sport Automatico" gera tokens `[SPORT, AUTOMATICO]` → "Renegade Sport 1.8..." casa SPORT (+6) e ganha; "Renegade 75 Anos..." perde 12 (tem trim "75 ANOS" que conflita com SPORT).

### 2. Marcar resultado como "ambíguo" quando o top empata

Ainda em `escolherMelhorFipe`, se `ranking[0].score === ranking[1].score`, devolver `ambiguo: true` no payload (`fipeData.ambiguo`, `result.fipeAmbiguo`). A UI usa isso para **forçar o consultor a confirmar manualmente** a versão (em vez de salvar silenciosamente) — bloqueando o avanço da etapa até escolha explícita, similar ao seletor `handleTrocarFipe` que já existe em `src/components/cotacao/EtapaConsultaFipe.tsx:196`.

### 3. Sincronizar modelo ↔ codigo_fipe na UI

Em `EtapaConsultaFipe.tsx`:

- Linha 154 hoje faz `setModelo(fipeData?.descricao || vehicleData.modelo)` — manter, mas **se** `fipeData.descricao` estiver presente, sempre usar a **descrição da FIPE** (não o nome do DETRAN), já que é a versão que ficará gravada em `codigo_fipe`. O nome do DETRAN passa a ser informativo (`modeloDetran` para mostrar como observação).
- Quando `fipeAmbiguo === true` ou o consultor edita `modelo` manualmente: **invalidar** `codigo_fipe`/`valor_fipe` e abrir o seletor `fipeAlternativas` obrigatório. Sem confirmação, `canProceed` vira `false`.

### 4. Guarda na escrita (defesa em profundidade)

Em `contrato-gerar` (e em qualquer fluxo que persista `codigo_fipe` + `veiculo_modelo`), validar coerência:

- Se `codigo_fipe` veio preenchido, refazer `fipe-lookup` action `consultar` (já existe, linhas 260–290) com `codigo_fipe` para obter a descrição oficial. Comparar tokens distintivos contra `veiculo_modelo`. Se conflitar (mesmo critério de TRIM_TOKENS do item 1), retornar HTTP 409 `codigo_fipe_incompatible` exigindo correção. Log estruturado para auditoria.

### 5. Saneamento (somente lista — sem alterar)

Script de auditoria (read-only) que cruza:

```sql
SELECT v.placa, v.modelo, v.codigo_fipe
FROM veiculos v
WHERE v.codigo_fipe IS NOT NULL;
```

Para cada linha, chamar `fipe-lookup` action `consultar` com o `codigo_fipe`, comparar descrição. Emitir relatório `divergencias_fipe.csv` em `/mnt/documents/` com colunas: placa, modelo_atual, codigo_fipe, descricao_oficial, valor_atual, valor_oficial. **Não corrige automaticamente** — operador revisa caso a caso (caso PYL9A01 entra aí).

### 6. Memória

Criar `mem://logic/quotation/fipe-variant-selection-heuristica` documentando: pesos atuais (combustível +10/-6, câmbio +8/-6, ano +5/+2, cilindrada +2, **trim/nome +6 e penalidade −12**), regra de `ambiguo`, e o invariante "modelo gravado em veiculos/cotações/contratos deve ser a descrição oficial da FIPE associada ao codigo_fipe — nunca o nome livre do DETRAN".

### Verificação após implementar

1. Reproduzir PYL9A01 (placa real ou mock com `fipes[]` contendo Sport + 75 Anos + Limited, todas Flex/Aut/1.8/2016) — deve escolher **Sport** com score maior que 75 Anos.
2. Rodar script de saneamento — anexar CSV de divergências para revisão.
3. Cobertura: caso AGILE LTZ vs Easytronic já citado no código (linha 146) continua passando.

### Fora de escopo

- Migrar dados antigos automaticamente (apenas listar — correção manual).
- Substituir a API `placas.fipeapi.com.br`.
- Tela administrativa para gerenciar TRIM_TOKENS (lista hard-coded por enquanto).
