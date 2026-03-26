

# Reconfigurar Gestao Comercial — Limpeza e Padronizacao

## Estado Atual

As secoes principais (Catalogo, Linhas/Planos, PlanoFormSheet, Marcas/Modelos) ja existem e seguem o padrao correto. Os problemas estao nos **CRUDs de Tabelas de Apoio**, que violam as regras de interface:

| Componente | Problemas |
|---|---|
| `CategoriasVeiculoTab` | Usa Dialog (nao Sheet), mostra Slug, usa Table, tem botao excluir |
| `CategoriasEspeciaisTab` | Mesmos problemas, e nao consta no spec (remover da nav) |
| `RegioesTab` | Usa Dialog, mostra Codigo/Multiplicador/Cidades/Ordem, tem botao excluir |
| `TiposUsoTab` | Usa Dialog, mostra Slug, usa Table, tem botao excluir |
| `TiposPlacaTab` | Precisa verificar (provavelmente mesmo padrao) |

## Plano

### 1. Reescrever os 4 CRUDs de Tabelas de Apoio

Padronizar todos para o mesmo layout clean:
- **Lista simples** (sem Table/TableRow) — linhas com nome + Switch de ativar/desativar + botao editar (hover)
- **Sheet lateral** para criar/editar com apenas campo **Nome**
- Sem slugs, codigos, IDs, multiplicadores ou campos tecnicos visiveis
- Sem botao excluir — apenas Switch de desativacao

Componentes afetados:
- `CategoriasVeiculoTab.tsx` — reescrever
- `TiposUsoTab.tsx` — reescrever
- `TiposPlacaTab.tsx` — reescrever
- `RegioesTab.tsx` — reescrever (simplificar para nome + switch; manter dados internos como cidades/multiplicador mas nao exibir na lista)

### 2. Atualizar CadastrosBase

- Remover aba "Categorias Especiais" (nao consta no spec)
- Manter 4 abas: Tipos de Veiculo, Regioes, Modalidades de Uso, Tipos de Placa

### 3. Navegacao e banners

- Verificar se os 4 itens de navegacao estao corretos: Coberturas e Beneficios, Linhas e Planos, Tabelas de Apoio, Marcas/Modelos/Combustiveis
- Remover secoes extras (Simulador de Rateio, Config Rateio, Elegibilidade, Regras de Venda, Instalacao e Rotas, Mapa de Atendimento) se existirem na navegacao — ou manter conforme ja esta (depende do escopo)

## Arquivos a Editar

| Arquivo | Acao |
|---|---|
| `cadastros/CategoriasVeiculoTab.tsx` | Reescrever — Sheet + lista clean |
| `cadastros/TiposUsoTab.tsx` | Reescrever — Sheet + lista clean |
| `cadastros/TiposPlacaTab.tsx` | Reescrever — Sheet + lista clean |
| `cadastros/RegioesTab.tsx` | Reescrever — Sheet + lista clean (nome apenas) |
| `CadastrosBase.tsx` | Remover aba Categorias Especiais |

Nenhuma migration necessaria — apenas UI.

