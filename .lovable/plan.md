

# Adicionar Seletor de Fornecedor (Oficina) para Mao de Obra e Servicos

## Problema

Atualmente, na tabela "Itens do Orcamento" da tela do Analista de Eventos (`SinistroAnalise.tsx`), a coluna "Fornecedor" mostra apenas "---" para itens de mao de obra e servicos. O analista precisa poder selecionar uma oficina como fornecedor para esses tipos de itens.

## Solucao

Adicionar um dropdown com busca de oficinas na coluna "Fornecedor" para itens do tipo `mao_de_obra` e `servico`. Ao salvar, o fornecedor selecionado sera persistido junto com os demais dados no `dados_vistoria`.

## Alteracoes

### Arquivo: `src/pages/eventos/SinistroAnalise.tsx`

1. **Importar `useOficinas`** de `@/hooks/useOficinas` (ja existe no projeto)

2. **Adicionar query de oficinas** proximo das queries existentes (linha ~259):
   - `useOficinas({ status: 'ativa' })` para buscar oficinas ativas

3. **Adicionar estado para fornecedores de mao de obra/servico** (linha ~232):
   - `const [fornecedoresMO, setFornecedoresMO] = useState<Record<number, { id: string; nome: string }>>({});`

4. **Alterar a coluna "Fornecedor" na tabela** (linhas 1145-1147):
   - Onde hoje mostra `<span>---</span>` para tipos que nao sao `peca`, adicionar um `Select` com as oficinas para itens `mao_de_obra` e `servico`/`servico_terceiro`
   - Se o item ja tem `fornecedor_nome` salvo e nao foi alterado localmente, exibir o nome salvo
   - Caso contrario, exibir o dropdown de oficinas

5. **Atualizar a logica de "Salvar Valores"** (linhas 1239-1298):
   - Incluir `fornecedoresMO` na condicao de disabled do botao (habilitar quando houver alteracoes em mao de obra tambem)
   - Na funcao de salvamento, aplicar o fornecedor selecionado para itens de mao de obra e servico (similar ao que ja e feito para pecas)

### Detalhes da alteracao na coluna Fornecedor

O bloco que hoje e:
```tsx
) : (
  <span className="text-muted-foreground text-xs">—</span>
)}
```

Sera expandido para:
```tsx
) : (item.tipo === 'mao_de_obra' || item.tipo === 'servico' || item.tipo === 'servico_terceiro') ? (
  item.fornecedor_nome && !fornecedoresMO[i] ? (
    <span className="text-xs font-medium">{item.fornecedor_nome}</span>
  ) : (
    <Select
      value={fornecedoresMO[i]?.id || item.fornecedor_id || ''}
      onValueChange={(val) => {
        const of = oficinas?.find((o) => o.id === val);
        if (of) {
          setFornecedoresMO(prev => ({
            ...prev,
            [i]: { id: of.id, nome: of.nome_fantasia || of.razao_social }
          }));
        }
      }}
    >
      <SelectTrigger className="h-8 w-44 text-xs">
        <SelectValue placeholder="Selecionar oficina..." />
      </SelectTrigger>
      <SelectContent>
        {oficinas?.map((of) => (
          <SelectItem key={of.id} value={of.id}>
            <span className="text-xs">{of.nome_fantasia || of.razao_social}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
) : (
  <span className="text-muted-foreground text-xs">—</span>
)
```

### Detalhes da alteracao no Salvar

- O botao "Salvar Valores" passara a considerar tambem `Object.keys(fornecedoresMO).length > 0` na condicao de habilitado
- O mapeamento de `updatedItens` aplicara fornecedor para mao de obra/servico:
  ```typescript
  if (item.tipo === 'mao_de_obra' || item.tipo === 'servico' || item.tipo === 'servico_terceiro') {
    const fornecedor = fornecedoresMO[i] || (item.fornecedor_id ? { id: item.fornecedor_id, nome: item.fornecedor_nome } : null);
    return {
      ...item,
      ...(fornecedor ? { fornecedor_id: fornecedor.id, fornecedor_nome: fornecedor.nome } : {}),
    };
  }
  ```
- O botao "Salvar Valores" sera exibido sempre que houver itens (nao apenas para pecas sem cotacao aprovada), pois agora mao de obra tambem precisa ser salva

