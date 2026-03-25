

# Preview Realista do Template de Documento

## Problema
A aba "Preview" no editor de templates mostra o mesmo conteudo do editor — variaveis como chips azuis, sem cabecalho, sem rodape, sem logo. O usuario quer ver como o documento vai aparecer para quem o recebe.

## Solucao
Transformar o Preview em uma simulacao de documento final: variaveis substituidas por dados ficticios, cabecalho com logo da empresa, rodape, layout estilo folha A4.

## Alteracoes

### 1. `src/components/documentos/templatePreviewData.ts` (novo)
- Mapa de valores ficticios para todas as variaveis de `VARIAVEIS_DISPONIVEIS` (ex: `associado.nome` -> "Joao Carlos da Silva", `veiculo.modelo` -> "Corolla XEi 2.0", `sistema.data_atual` -> data real do dia)
- Funcao `substituirVariaveisPreview(html)` que remove chips `<span data-variable>` e patterns `{{var}}`, substituindo pelo valor ficticio correspondente

### 2. `src/components/documentos/TemplateEditor.tsx`
- Buscar config da empresa via query na `cotacao_pdf_config` (logo_url, nome_empresa, cor_primaria) — mesmo que o gerador de PDF usa
- Receber props opcionais `cabecalhoHtml` e `rodapeHtml` do template (ja existem no form)
- Na aba Preview:
  - Envolver conteudo em container estilo A4 (fundo branco, sombra, padding, max-width 210mm)
  - Renderizar cabecalho: logo da empresa (se existir) + nome da empresa + linha separadora
  - Renderizar conteudo com variaveis substituidas por dados ficticios (sem chips)
  - Renderizar rodape: texto do rodape_html + numeracao de pagina simulada
  - Badge discreto "Preview com dados ficticios" no topo

### 3. `src/pages/documentos/TemplateForm.tsx`
- Passar `cabecalhoHtml` e `rodapeHtml` como props para o `TemplateEditor`

## Arquivos

| Arquivo | Tipo |
|---|---|
| `src/components/documentos/templatePreviewData.ts` | Novo |
| `src/components/documentos/TemplateEditor.tsx` | Editado |
| `src/pages/documentos/TemplateForm.tsx` | Editado (passar props) |

