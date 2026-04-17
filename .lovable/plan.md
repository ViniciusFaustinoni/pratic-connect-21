

## Diagnóstico

Confirmei no banco: William está `ativo`, veículos cadastrados (**LSP3E65** como `instalacao_pendente`, **LUQ0573** como `ativo`), **instalação agendada** para hoje período manhã existe na tabela `instalacoes`. RLS permite diretor ver tudo.

Então por que o usuário não vê? **Dois motivos independentes**:

### 1. Build do preview está defasado (principal)
A correção do `useAssociados` (remoção do `.eq('origem_cadastro','interno')`) foi feita, mas o **último deploy falhou** por timeout do Cloudflare R2:
```
dist upload failed: ... net/http: request canceled (Client.Timeout exceeded)
```
O usuário está carregando uma versão antiga do JS — por isso continua vendo "Total Geral: 0" e busca vazia. Um hard-refresh não resolve; só publicar de novo.

### 2. Filtro `origem_cadastro='interno'` ainda existe em outros arquivos
O William foi cadastrado via `api_externa` (como 99% dos associados). Restam 3 arquivos filtrando só `interno`:
- `src/hooks/useVeiculos.ts` (linha 53) — aba Veículos não lista os dele
- `src/pages/cadastro/Veiculos.tsx` (linhas 184, 185, 200) — métricas zeradas
- `src/hooks/useBaseAntiga.ts` — esse é intencional (base migrada Hinova), **não mexer**

Na tela de monitoramento `/monitoramento/vistorias-instalacoes-mon` aba **Instalações**, o hook `useInstalacoes` NÃO tem filtro de origem — quando o build novo carregar, a instalação agendada de hoje vai aparecer naturalmente.

---

## Correções

### Passo 1 — Remover filtro `origem_cadastro='interno'` em Veículos
**`src/hooks/useVeiculos.ts`** (linha 50-55): remover `.eq('associado.origem_cadastro', 'interno')` e trocar `!inner` por join padrão.

**`src/pages/cadastro/Veiculos.tsx`** (linhas 184, 185, 200): remover os três `.eq('associado.origem_cadastro','interno')` das queries de métrica e listagem.

### Passo 2 — Forçar cache-bust do React Query em Associados/Instalações
Adicionar `refetchOnMount: 'always'` nos hooks `useAssociados` e `useInstalacoes` para garantir que, assim que o build novo subir, os dados antigos em cache do service worker/browser sejam sobrescritos.

### Passo 3 — Republicar
O build volta a subir normalmente (o timeout anterior foi infra transitória do Lovable, não do código).

---

## Validação pós-correção

1. Abrir `/cadastro/associados` como diretor → Total Geral ~9.519, buscar "WILLIAM" → aparece com status **Ativo**; buscar placa **LSP3E65** → aparece.
2. Abrir `/cadastro/veiculos` → total geral inclui os 9.400+ veículos `api_externa`; buscar **LSP3E65** e **LUQ0573** → aparecem.
3. Abrir `/monitoramento/vistorias-instalacoes-mon` → aba **Instalações** → instalação agendada da XRE 300 para hoje (período manhã) aparece na lista e na contagem "Agendadas".
4. Abrir ficha do associado → ambos veículos visíveis com os status corretos.

---

## Resumo executivo

O William **já está cadastrado certinho no banco** — a instalação dele foi agendada, os dois veículos estão com os status corretos. O que está acontecendo é que o navegador do usuário está carregando uma versão antiga do app porque a última publicação falhou por um timeout de infraestrutura. Vamos fazer mais dois ajustes pequenos (remover um filtro que escondia veículos vindos da base migrada) e republicar. Depois disso o William aparece tanto em Associados quanto em Veículos quanto no Monitoramento.

