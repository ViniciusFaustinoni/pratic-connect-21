

# Conexão entre Marcas & Modelos e Elegibilidade do Plano

## Diagnóstico

A conexão já está implementada corretamente:
- `PlanoFormSheet.tsx` importa `useMarcasModelos()` (hook que lê a tabela `marcas_modelos`)
- Extrai marcas únicas ativas → exibe como badges selecionáveis na seção de elegibilidade
- **O problema**: a tabela `marcas_modelos` está vazia (0 marcas cadastradas), por isso nenhuma marca aparece na edição do plano

## Situação atual

```text
marcas_modelos (tabela) ──► useMarcasModelos() ──► PlanoFormSheet.tsx
         0 registros              ↓
                          uniqueBrands = []
                                 ↓
                    {uniqueBrands.length > 0 && ...}  ← não renderiza nada
```

## Ação necessária

Não há correção de código. A base de Marcas & Modelos precisa ser populada. Posso importar automaticamente as marcas e modelos mais comuns do mercado brasileiro (Fiat, Chevrolet, Volkswagen, Toyota, Honda, Hyundai, Renault, Jeep, Nissan, BMW, Mercedes, Audi, etc.) com seus respectivos modelos.

**Deseja que eu popule a tabela com uma lista padrão de marcas e modelos?**

