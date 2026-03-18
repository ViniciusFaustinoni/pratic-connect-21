

## Plano: Filtrar marcas de moto aceitas no cotador

### Objetivo
Quando o tipo de veículo for "moto" no cotador, filtrar as marcas FIPE para exibir apenas as que constam na lista configurável `marcas_aceitas_motos`. Criar essa chave no banco com os valores iniciais.

### Alterações

**1. Inserir chave `marcas_aceitas_motos` na tabela `configuracoes`**
- Valor: `["Honda", "Yamaha", "Shineray", "BMW", "Haojue", "Suzuki"]` (JSON array de strings)
- Adicionar descrição à constante `CONFIG_DESCRIPTIONS` em `Configuracoes.tsx`

**2. `src/hooks/useConteudosSistema.ts`**
- Novo hook: `useMarcasAceitasMotos()` → `useConfiguracaoJson<string[]>('marcas_aceitas_motos', ['Honda', 'Yamaha', 'Shineray', 'BMW', 'Haojue', 'Suzuki'])`

**3. `src/components/cotacoes/CotacaoFormDialog.tsx`**
- Importar `useMarcasAceitasMotos`
- No `SearchableSelect` de marca (linha ~1650), quando `tipoFipeSelecionado === 'motos'`, filtrar as opções: manter apenas marcas cujo `nome` (case-insensitive) esteja presente na lista `marcasAceitasMotos`
- Se nenhuma marca passar no filtro, exibir mensagem "Nenhuma marca de moto disponível"

Lógica do filtro:
```typescript
const marcasFiltradas = marcas
  .filter((m) => m.tipoFipe === tipoFipeSelecionado)
  .filter((m) => {
    if (tipoFipeSelecionado !== 'motos') return true;
    return marcasAceitasMotos.some(aceita => 
      m.nome.toLowerCase().includes(aceita.toLowerCase())
    );
  })
  .map((m) => ({ value: `${m.tipoFipe}:${m.codigo}`, label: m.nome }));
```

**4. `src/pages/diretoria/Configuracoes.tsx`**
- Adicionar case `'marcas_aceitas_motos'` no switch de renderização: editor de lista de strings (array simples) com botões de adicionar/remover
- Adicionar descrição no `CONFIG_DESCRIPTIONS`

### Arquivos

| Arquivo | Alteração |
|---|---|
| BD (configuracoes) | INSERT chave `marcas_aceitas_motos` |
| `src/hooks/useConteudosSistema.ts` | Novo hook `useMarcasAceitasMotos` |
| `src/components/cotacoes/CotacaoFormDialog.tsx` | Filtro de marcas por lista aceita quando tipo=motos |
| `src/pages/diretoria/Configuracoes.tsx` | Editor visual para a lista + descrição |

