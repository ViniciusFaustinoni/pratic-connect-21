# Filtro de pesquisa por IMEI — Rastreadores

## Diagnóstico

Investiguei o código do filtro (`src/hooks/useRastreadores.ts` linhas 129-178 + `src/lib/buscaUtils.ts`) e validei contra o banco. O filtro **funciona corretamente**: faz `ILIKE %termo%` em `codigo`, `numero_serie` e `imei`.

O IMEI do seu teste — `357789644835164` — **não existe** na tabela `rastreadores` da Praticcar. Confirmei via SQL:

```
SELECT * FROM rastreadores
WHERE imei ILIKE '%357789644835164%' OR codigo ILIKE '%357789644835164%';
→ 0 registros
```

Esse IMEI aparece no **Pratic Master** (X3-Tech NT20, chip Vivo 55 31 97249-9969) mas nunca foi cadastrado/importado para o estoque do Praticcar. Por isso a tela mostra "Nenhum rastreador" + o banner azul "Não encontramos … Quer verificar na Softruck por IMEI?" — comportamento desenhado.

Testei com um IMEI que **existe** localmente (`357789644846385`, status `instalado`, plataforma Softruck) e a query retorna 1 resultado normalmente.

**Conclusão técnica: não há bug no filtro.**

## O que vou fazer

Como o relato indica que você esperava encontrar o rastreador, há um gap de UX: o banner atual só oferece "Buscar na Softruck", mas o IMEI em questão está no **Pratic Master**, que é uma plataforma diferente. Vou tornar o fallback mais útil e o feedback mais claro.

### 1. Melhorar o banner de "não encontrado"

Em `src/components/rastreadores/BuscarNaSoftruckBanner.tsx` (e onde for renderizado em `Rastreadores.tsx`):

- Quando o termo for um IMEI plausível (15 dígitos numéricos), oferecer botões para todas as plataformas integradas configuradas em `plataformas_rastreio` (hoje: Softruck, Rede Veículos; futuramente Pratic Master se for adicionado), não apenas Softruck.
- Mostrar de forma explícita: "IMEI {X} não está no estoque do Praticcar. Buscar em: [Softruck] [Rede Veículos] …"
- Cada botão chama a edge function correspondente e, se encontrar, oferece importar para o estoque local (`status='estoque'`).

### 2. Acrescentar diagnóstico no console quando o filtro retornar 0

Em `useRastreadores.ts`, quando `count === 0` E o `search` parece um IMEI (15 dígitos), logar de forma estruturada:

```ts
console.info('[Rastreadores] IMEI não encontrado no estoque local', { imei: filters.search });
```

Isso ajuda no suporte a confirmar rapidamente que o IMEI não está no banco (em vez de suspeitar do filtro).

### 3. Não tocar na lógica de matching

A query SQL atual está correta. **Não vou alterar**:
- `escapeOrValue` / `normalizarBusca` — corretos para 15 dígitos.
- O `.or()` com `codigo,numero_serie,imei` — cobre todos os campos relevantes.

## Arquivos

- `src/components/rastreadores/BuscarNaSoftruckBanner.tsx` — generalizar para várias plataformas.
- `src/pages/monitoramento/Rastreadores.tsx` — passar lista de plataformas ativas para o banner.
- `src/hooks/useRastreadores.ts` — log informativo quando 0 resultados em busca por IMEI puro.

## Validação após implementação

Vou logar como diretor (`admin@teste.com`) e:
1. Pesquisar `357789644835164` — confirmar que aparece "Nenhum rastreador" + banner com opções de várias plataformas.
2. Pesquisar `357789644846385` (existe localmente) — confirmar que retorna 1 rastreador corretamente.
3. Pesquisar uma placa parcial — confirmar que continua funcionando.
4. Pesquisar parte de nome de associado — confirmar que continua funcionando.

## O que NÃO vou fazer

- Não vou criar manualmente o rastreador `357789644835164` no estoque — isso é decisão operacional da equipe de monitoramento (entrada de estoque).
- Não vou integrar com o Pratic Master (não é uma das plataformas atualmente integradas no sistema; exigiria credenciais e endpoint próprios).

Se você quer que eu **importe esse IMEI específico** para o estoque local agora, ou que eu **adicione integração com Pratic Master**, me avise — são tarefas separadas.
