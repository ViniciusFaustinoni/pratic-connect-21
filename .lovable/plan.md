## Reorientação

Esquece coluna de cilindrada. O que precisa ir pro termo é o **nome completo do veículo igual ao CRLV** (campo `MARCA / MODELO / VERSÃO` → "FIAT/ARGO 1.0"). A cilindrada vem de brinde dentro dessa string — não precisa de campo separado.

## Diagnóstico curto (com base no que já levantei)

- `plate-lookup` (`supabase/functions/plate-lookup/index.ts:285-339`) já recebe a string crua do DETRAN em `veiculo.marca_modelo` (ex.: `"FIAT/ARGO 1.0"`) e também a `fipeData.descricao` (ex.: `"ARGO 1.0 FIRE FLEX 5p"`). Hoje a função quebra essa string em `marca` + `modelo` curto (`"argo"`) e devolve as duas partes — perdendo o "1.0".
- Só `EtapaConsultaFipe.tsx:144` aplica a regra "modelo = descrição FIPE". O link público (`useNewLeadFlow.ts:320,356`) e `useCotacaoPublica.ts:251` salvam `state.vehicleData.modelo` cru — daí RTZ5C34 ficou `modelo='argo'`.
- Termo (`supabase/functions/_shared/termo-afiliacao-template.ts:424`) renderiza literal `${marca} ${modelo}`. Se modelo for "ARGO 1.0", o termo já mostra "FIAT ARGO 1.0".

Ou seja: o conserto é **garantir que `veiculo_modelo` gravado SEMPRE seja o nome completo CRLV/FIPE**, sem precisar tocar em schema nem template.

## Correção raiz (sem migration, sem coluna nova)

### 1. Helper canônico único
`src/lib/quotation/modelo-canonico.ts` (novo):
```ts
// Retorna o nome do veículo no formato esperado pelo termo:
//   1º) descrição oficial FIPE quando disponível ("ARGO 1.0 FIRE FLEX 5p")
//   2º) marca_modelo cru do DETRAN sem a marca ("ARGO 1.0")
//   3º) fallback: modelo curto ("argo")
export function resolverModeloCanonico(opts: {
  fipeDescricao?: string | null;
  marcaModeloDetran?: string | null; // "FIAT/ARGO 1.0"
  modeloCurtoDetran?: string | null; // "argo"
  marca?: string | null;
}): string { ... }
```
Regra: prefere FIPE; quando FIPE não vier, extrai do `marca_modelo` removendo o prefixo `MARCA/` (mantendo o que sobra — "ARGO 1.0").

### 2. plate-lookup devolve o nome completo já resolvido
`supabase/functions/plate-lookup/index.ts`:
- Adicionar no payload de retorno `modelo_completo` = aplicação do helper acima sobre `fipeData.descricao` ⟂ `veiculo.marca_modelo`.
- Manter `modelo` curto por compatibilidade.

### 3. Forçar TODOS os call-sites a usar o nome completo
| Arquivo | Linha | Mudança |
|---|---|---|
| `src/components/cotacao/EtapaConsultaFipe.tsx` | 141-149 | trocar a regra inline por `resolverModeloCanonico(...)` (sem mudança funcional, só centraliza) |
| `src/components/cotacao/EtapaConsultaFipe.tsx` | 211-225 (`handleTrocarFipe`) | usar `resolverModeloCanonico` na troca manual de variante FIPE |
| `src/hooks/useNewLeadFlow.ts` | 319-320 e 355-356 | gravar `veiculo_modelo: resolverModeloCanonico(...)` (ler `state.fipeData?.descricao` e `state.vehicleData?.marca_modelo`) |
| `src/hooks/useCotacaoPublica.ts` | 230-260 (`CriarCotacaoPublicaParams`) | aceitar campo extra `veiculoModeloCompleto` e usá-lo em `veiculo_modelo` no `insert` |
| Edge `contrato-gerar` (vamos localizar o arquivo) | snapshot de veículo | ao copiar `veiculo_modelo` da cotação para o contrato, aplicar `resolverModeloCanonico` defensivo caso o snapshot da cotação esteja curto |
| Edge `autentique-create` / `autentique-create-by-token` | onde monta `templateData.veiculo.modelo` (via `termo-afiliacao-utils.ts:465`) | adicionar fallback final: se `contrato.veiculo_modelo` parece "curto" (sem dígito ou sem espaço), tentar recompor com `veiculoDB.codigo_fipe` consultando `fipe_cache`/última descrição conhecida; senão deixa como está. Isso é cinto + suspensório para contratos já em voo. |

### 4. Saneamento do caso RTZ5C34
SQL one-shot via insert tool:
```sql
UPDATE veiculos
   SET modelo = 'ARGO 1.0'
 WHERE placa = 'RTZ5C34' AND modelo = 'argo';

UPDATE contratos
   SET veiculo_modelo = 'ARGO 1.0'
 WHERE veiculo_id = '08699d5f-04e7-44bf-9a05-e92deb54e707'
   AND veiculo_modelo = 'argo';

UPDATE cotacoes
   SET veiculo_modelo = 'ARGO 1.0'
 WHERE veiculo_placa = 'RTZ5C34'
   AND veiculo_modelo = 'argo';

UPDATE leads
   SET veiculo_modelo = 'ARGO 1.0'
 WHERE veiculo_placa = 'RTZ5C34'
   AND veiculo_modelo = 'argo';
```
Como o termo deste contrato já está **Assinado/Aprovado** (screenshot 26/05 11:04), pra ele virar "FIAT ARGO 1.0" também no documento, precisa **reemissão versionada** via `retificar-termo-filiacao` (memória `mem://features/contracts/retificacao-termo-filiacao`).

### 5. Memória
- Atualizar `mem://logic/quotation/fipe-variant-selection-heuristica`: listar os call-sites que DEVEM passar pelo helper `resolverModeloCanonico` (EtapaConsultaFipe, useNewLeadFlow, useCotacaoPublica, contrato-gerar, autentique-create).

## Fora de escopo (intencional)
- Nada de coluna `cilindrada` — o nome completo do CRLV já carrega a cilindrada.
- Nada de mexer em template do termo / variável nova.
- Sem backfill em massa de outros veículos com modelo curto — só RTZ5C34 agora; varredura ampla fica como item futuro (impacto em termos antigos imutáveis precisa decisão).
- Sem mudança em SGA Hinova / FIPE pricing / RLS.

## Validação
1. Após deploy, criar nova cotação pelo link público com qualquer placa → conferir `leads.veiculo_modelo`, `cotacoes.veiculo_modelo`, `contratos.veiculo_modelo` e `veiculos.modelo` todos = descrição FIPE completa.
2. Gerar termo → HTML deve mostrar `Marca/Modelo: FIAT ARGO 1.0 FIRE FLEX 5p` (ou equivalente conforme FIPE).
3. Rodar saneamento + `retificar-termo-filiacao` para RTZ5C34 e conferir nova versão do termo no Autentique.