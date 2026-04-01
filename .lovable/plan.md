

# Corrigir campos ausentes no Termo de Filiação + Adicionar Consultor

## Problema
1. O campo **CNH** não aparece no termo de filiação (o template não renderiza nem aceita esse dado)
2. O **nome do consultor/vendedor** responsável não é exibido no termo

## Correções

### Arquivo 1: `src/types/termo-filiacao.ts`
- Adicionar campos `cnh`, `cnhValidade`, `cnhCategoria` à interface `ClienteData`
- Adicionar campo `consultor?: { nome: string }` à interface `DadosTermoFiliacao`

### Arquivo 2: `src/components/cadastro/TermoFiliacaoTemplate.tsx`
- Na **Seção 1 (Qualificação do Associado)**: adicionar linha com **CNH** entre RG e Data de Nascimento
- No **cabeçalho ou rodapé do termo**: exibir o **nome do consultor responsável** (ex: "Consultor: Fulano de Tal") — pode ficar logo abaixo do número do contrato ou em uma seção dedicada
- Extrair `dados.consultor` no destructuring

### Arquivo 3: `src/pages/cadastro/GerarTermo.tsx`
- Atualizar o mock para incluir CNH e consultor nos dados de exemplo

## Detalhes da renderização

**CNH** — nova linha na seção 1, após RG:
```
CNH: 07064650202
```

**Consultor** — exibido no cabeçalho, abaixo do número do contrato:
```
Consultor Responsável: Maria Santos
```

## Impacto
- 3 arquivos alterados
- Apenas visual — não altera dados no banco
- Backend já mapeia `consultor.nome` e `associado.cnh` nos templates do Autentique

