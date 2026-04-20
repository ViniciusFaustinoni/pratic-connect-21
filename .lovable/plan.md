
## Corrigir lista de prestadores na atribuição manual

### Diagnóstico
O problema não é um filtro de “online”. No código atual, os prestadores externos da atribuição manual são buscados em `vistoriadores_prestadores` e filtrados apenas por `ativo`:

- `src/components/monitoramento/AtribuicaoManualTab.tsx`
- `src/components/mapa/AtribuirPrestadorPopover.tsx`
- `src/hooks/useVistoriadoresPrestadores.ts`

Só que a tela de cadastro/gestão de prestadores parceiros usa outra tabela:

- `src/pages/monitoramento/PrestadoresParceiros.tsx` → `prestadores_instalacao`

Resultado: se os prestadores foram cadastrados em `prestadores_instalacao`, a aba “Prestadores Externos” fica zerada mesmo com prestadores ativos, porque ela consulta a fonte errada. O sistema aparenta “esperar online”, mas na prática está olhando outra tabela.

### O que ajustar

**1. Unificar a fonte usada pela atribuição manual**
Criar um hook único para a atribuição manual buscar prestadores externos a partir de ambas as fontes compatíveis:
- `vistoriadores_prestadores`
- `prestadores_instalacao`

Retornar um shape normalizado, por exemplo:
- `id`
- `nome`
- `telefone`
- `ativo`
- `origem` (`vistoriador_prestador` | `prestador_instalacao`)

Isso evita que a UI dependa de onde o prestador foi cadastrado.

**2. Atualizar a aba `AtribuicaoManualTab.tsx`**
Trocar o uso direto de `useVistoriadoresPrestadores()` por esse hook unificado.
A seção “Prestadores Externos” deve:
- mostrar sempre os prestadores ativos, sem qualquer regra de turno/localização
- exibir contagem correta
- diferenciar visualmente a origem se necessário
- manter drag and drop funcionando

**3. Atualizar `AtribuirPrestadorPopover.tsx`**
Usar a mesma lista unificada no fluxo por clique (mapa/serviços).
Ao selecionar um prestador:
- se vier de `vistoriadores_prestadores`, manter `vistoriador_prestador_id`
- se vier de `prestadores_instalacao`, enviar `prestador_id`

Assim o popover passa a listar os prestadores que o usuário já vê no cadastro atual.

**4. Adaptar `useAtribuirServicoPrestador()`**
Hoje a mutation assume `prestadorId` como `vistoriador_prestador_id`.
Ajustar para aceitar também a origem do prestador:
- `origem: 'vistoriador_prestador' | 'prestador_instalacao'`

Regras:
- para vistoria: usar apenas `vistoriador_prestador_id` (fluxo público de vistoria já é baseado nisso)
- para instalação: aceitar ambos, aproveitando a retrocompatibilidade já existente em `gerar-link-prestador`

Se o usuário tentar atribuir uma vistoria a um prestador que só existe em `prestadores_instalacao`, mostrar erro claro orientando cadastrar esse prestador também como vistoriador prestador.

**5. Ajustar os textos da interface**
Deixar explícito na UI que prestadores externos:
- não dependem de “online”
- aparecem por cadastro ativo
- internos continuam dependendo de turno/localização

Exemplos de microcopy:
- “Prestadores externos ativos”
- “Disponíveis por cadastro, não por status online”

### Arquivos previstos
- `src/hooks/useVistoriadoresPrestadores.ts` ou novo hook unificado para atribuição
- `src/components/monitoramento/AtribuicaoManualTab.tsx`
- `src/components/mapa/AtribuirPrestadorPopover.tsx`
- `src/hooks/useAtribuicaoManual.ts`

### Resultado esperado
- A seção “Prestadores Externos” deixa de ficar vazia quando existem prestadores ativos cadastrados na base usada hoje pelo monitoramento.
- Prestadores aparecem sempre que estiverem ativos, sem depender de online.
- Drag and drop e atribuição por clique continuam funcionando.
- O botão “Copiar Link do Prestador” continua sendo exibido após a atribuição.

### Validação
1. Com prestadores ativos apenas em `prestadores_instalacao`, abrir `/monitoramento/vistorias-instalacoes-mon` → eles devem aparecer na seção “Prestadores Externos”.
2. No mapa e no painel de serviços, clicar numa tarefa → o popover deve listar esses prestadores.
3. Atribuir instalação a prestador externo → gerar link e mostrar “Copiar Link”.
4. Confirmar que técnicos internos continuam exigindo online/turno, mas prestadores não.
5. Tentar atribuir vistoria a prestador vindo apenas da tabela legada → sistema deve orientar corretamente se esse tipo precisar de cadastro também em `vistoriadores_prestadores`.
