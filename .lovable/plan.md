

## Diagnóstico (3 perguntas do usuário)

**1. "Deve ser possível passar de fase sem atribuir o técnico"**
No modal `AgendarManutencaoUnificadoModal.tsx`, a validação atual exige técnico:
```ts
// linha 281
const isValid = motivo && dataAgendada && periodo && profissionalId && enderecoValido;
```
E o submit aborta se faltar (`linha 243`). Preciso tornar `profissionalId` opcional.

**2. "Ele deve aparecer no mapa para atribuição"**
**Já funciona se o serviço for criado sem `profissional_id`.** O `MapaVistoriasContent.tsx` (linhas 448-451, 584, 727) já trata vistorias com `!v.vistoriador_id` como **arrastáveis** no modo "Atribuição Manual" — ícone com hint amarelo "Arraste até um técnico para atribuir". A view `view_vistorias_mapa` retorna `vistoriador_id = NULL` quando não atribuído, e o mapa renderiza tudo que tem latitude. **Manutenções de rota sem técnico vão aparecer automaticamente** desde que tenham `latitude/longitude`.

**3. "O sistema capta a localização em algum momento?"**
**Sim, em duas camadas:**
- **Endereço do associado**: `associados.endereco_latitude/longitude` é gravado na vistoria criada (`useVistoriaManutencao.ts` linhas 1263-1264, 1315-1316). Isso já alimenta o pin no mapa.
- **Endereço alternativo digitado**: hoje grava `latitude = null` (linhas 1286-1287). O CEP é resolvido via `buscarCep` mas **não geocodifica** lat/lng. Resultado: se o usuário digita endereço novo, a manutenção **não aparece no mapa** (sem coordenadas).

## O que muda

### 1. Tornar técnico opcional no modal de manutenção
**Arquivo**: `src/components/monitoramento/rastreadores/AgendarManutencaoUnificadoModal.tsx`

- Linha 243 (`handleSubmit`): remover `!profissionalId` da guarda de saída.
- Linha 281 (`isValid`): remover `profissionalId &&`.
- Linhas 631-659 (campo "Técnico Responsável"):
  - Mudar label para `"Técnico Responsável"` (sem `*`).
  - Adicionar opção `<SelectItem value="__sem__">Atribuir depois (no mapa)</SelectItem>` no topo da lista.
  - Adicionar texto auxiliar abaixo: *"Tarefas de rota sem técnico aparecem no Mapa de Atribuições para serem arrastadas para um técnico em campo. Tarefas na base aparecem na fila de Serviços de Campo."*
- Mudar texto do botão (linha 701) para algo dinâmico:
  - Com técnico → "Agendar Manutenção"
  - Sem técnico → "Agendar (atribuir depois)"

### 2. Ajustar hook para aceitar profissional null
**Arquivo**: `src/hooks/useVistoriaManutencao.ts`

- Interface `AbrirEAgendarManutencaoParams` (linha 1157): mudar `profissionalId: string` → `profissionalId: string | null`.
- Linha 1298: `profissional_id: params.profissionalId || null`.
- Linha 1292: manter `status: 'agendada'` se tiver técnico; usar `'pendente'` se for sem técnico (assim aparece como "para atribuir" nas listagens corretas).

### 3. Geocodificar endereço alternativo (para aparecer no mapa)
**Arquivo**: `src/components/monitoramento/rastreadores/AgendarManutencaoUnificadoModal.tsx`

Hoje, quando o usuário escolhe "Informar outro endereço", o `buscarCep` preenche logradouro/bairro/cidade mas **não grava coordenadas**. Verificar se `src/lib/cep.ts` retorna lat/lng (provavelmente não — ViaCEP não geocodifica).

Solução simples: usar **Nominatim/OSM** (já provavelmente disponível no projeto via OSRM) ou edge function existente de geocoding. Vou:
- Após `buscarCep`, chamar geocoding por endereço completo (`logradouro + numero + cidade + uf`) e armazenar em estado `latGeo`, `lngGeo`.
- Passar essas coordenadas no `enderecoAlternativo` e gravar no serviço.

Se já existir helper de geocoding no projeto (a investigar antes da implementação), reutilizar; caso contrário criar `src/lib/geocode.ts` simples usando Nominatim com cache.

### 4. Banner informativo no modal

Adicionar logo abaixo do campo Técnico:

> ℹ️ **Como funciona sem técnico atribuído:**
> - Tarefas **na base**: aparecem na fila de **Serviços de Campo** para o coordenador atribuir.
> - Tarefas em **rota**: aparecem como pin no **Mapa de Atribuições** — basta arrastar até um técnico em campo (no modo "Atribuição Manual").

Com 2 botões pequenos: "Abrir Mapa" e "Serviços de Campo".

## Validação

1. Abrir manutenção, escolher motivo, data, período, **local = Rota** com endereço cadastrado, deixar técnico vazio → botão habilita ("Agendar (atribuir depois)") → cria serviço sem `profissional_id`.
2. Ir em **Monitoramento → Mapa**, ativar **"Atribuição Manual"** → o pin da nova manutenção aparece com hint amarelo "Arraste até um técnico" → arrastar até técnico em campo → atribui.
3. Mesma manutenção mas **local = Base** sem técnico → aparece em **Serviços de Campo** na coluna "Não atribuído" / fila pendente.
4. Endereço **alternativo** (digitado) → confirmar que pin aparece no mapa (geocoding ok).
5. Fluxo com técnico atribuído → continua funcionando idêntico (regressão).

## Arquivos a editar

- `src/components/monitoramento/rastreadores/AgendarManutencaoUnificadoModal.tsx`
- `src/hooks/useVistoriaManutencao.ts`
- (possivelmente) `src/lib/geocode.ts` (novo) — só se não houver utilitário existente

## Resposta direta às perguntas

| Pergunta | Resposta |
|---|---|
| Pode passar sem atribuir técnico? | Hoje não, mas é trivial liberar. Vou tornar opcional. |
| Aparece no mapa para atribuição? | Sim, automaticamente, **se tiver latitude/longitude**. |
| Sistema capta localização? | **Sim**, do endereço do associado (já grava lat/lng no serviço). Para endereços digitados manualmente, hoje **não geocodifica** — preciso adicionar isso para o pin aparecer. |

