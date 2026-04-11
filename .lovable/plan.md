

## Plano: Filtrar opções de instalação no link público conforme cenário do consultor

### Contexto
O consultor escolhe um "Cenário de Adesão e Instalação" na cotação (`cobra_rota`, `cobra_base`, `isenta_rota`, `isenta_base`), que é salvo como `tipo_instalacao` = `'rota'` ou `'base'` na tabela `cotacoes`. Porém, no link público, o associado sempre vê as duas opções (técnico vai até ele OU levar na base). O correto é mostrar apenas a opção correspondente ao cenário definido pelo consultor.

### Lógica

| `tipo_instalacao` | Opções no link público |
|---|---|
| `'rota'` | Apenas "Técnico vai até mim" (visita em rota) |
| `'base'` | Apenas "Levar veículo à base" |
| `null` / não definido | Ambas as opções (comportamento atual) |

### Alterações

**1. `src/components/cotacao-publica/EtapaVistoria.tsx`**
- Adicionar prop `tipoInstalacao?: 'rota' | 'base' | null`
- Quando `tipoInstalacao` está definido, pular a tela `escolha-local` e ir direto para o modo correspondente (`agendada` para rota, `agendada-base` para base)
- Passar `tipoInstalacao` para `EscolhaLocalVistoria` como fallback (caso queira mostrar apenas uma opção)

**2. `src/components/cotacao-publica/EscolhaLocalVistoria.tsx`**
- Adicionar prop opcional `tipoInstalacao?: 'rota' | 'base' | null`
- Se `tipoInstalacao === 'rota'`: mostrar apenas a opção "Técnico vai até mim"
- Se `tipoInstalacao === 'base'`: mostrar apenas a opção "Levar à base"
- Se `null`/`undefined`: manter ambas (comportamento atual)

**3. `src/components/cotacao-publica/AgendamentoVistoriaCompleta.tsx`**
- Adicionar prop `tipoInstalacao` e repassar para `EscolhaLocalVistoria`
- Se `tipoInstalacao` definido, iniciar direto no modo correspondente em vez de `'escolha'`

**4. `src/pages/public/CotacaoContratacao.tsx`**
- Passar `tipoInstalacao={cotacao.tipo_instalacao}` para `EtapaVistoria` e `AgendamentoVistoriaCompleta`

### Arquivos
- **Editar**: `src/components/cotacao-publica/EscolhaLocalVistoria.tsx`
- **Editar**: `src/components/cotacao-publica/EtapaVistoria.tsx`
- **Editar**: `src/components/cotacao-publica/AgendamentoVistoriaCompleta.tsx`
- **Editar**: `src/pages/public/CotacaoContratacao.tsx`

