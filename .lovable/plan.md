
# Fix: Erro 409 ao criar coberturas e beneficios consecutivos

## Problema

Dois bugs no `CatalogoCoberturasBeneficios.tsx`:

1. **Slug truncado causa duplicata**: O `codigo`/`slug` e gerado com `.slice(0, 20)`. Nomes semelhantes como "Danos a Terceiros - R$ 40.000" e "Danos a Terceiros - R$ 100.000" geram o mesmo codigo `danos-a-terceiros-r-`, violando a unique constraint `coberturas_codigo_key`.

2. **Estado do formulario nao reseta**: `useState` inicializa uma vez. Ao fechar e reabrir o Sheet para criar outro item, os campos mantem os valores anteriores, e o slug fica identico.

## Solucao

### Arquivo: `src/components/gestao-comercial/CatalogoCoberturasBeneficios.tsx`

**CoberturaSheet (linhas 17-59)**:
- Gerar `codigo` unico: usar slug completo (sem truncar em 20) + sufixo de 4 chars aleatorios para evitar colisoes
- Adicionar `useEffect` para resetar campos quando `item` ou `open` mudam
- Melhorar mensagem de erro: detectar erro de duplicata e mostrar toast especifico

**BeneficioSheet (linhas 64+)**:
- Mesmo fix para `slug`: slug completo + sufixo aleatorio
- Mesmo `useEffect` para resetar campos

### Detalhes tecnicos

Slug generation atualizada:
```ts
const slug = nome.toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');
const codigo = `${slug}-${crypto.randomUUID().slice(0, 4)}`;
```

Reset de estado com useEffect:
```ts
useEffect(() => {
  setNome(item?.nome || '');
  setDescricao(item?.descricao || '');
  setValor(item?.valor?.toString() || '0');
}, [item, open]);
```

Nenhuma migration necessaria.
