

## Plano: aceitar ATPV-e / CRV digital no OCR público

### O que é o documento da foto
- É a **ATPV-e** (Autorização para Transferência de Propriedade de Veículo - Digital) emitida pelo SENATRAN/DETRAN.
- Usada quando o veículo foi comprado recentemente e o CRLV ainda não foi emitido no nome do novo proprietário.
- Contém todos os dados que precisamos: placa, RENAVAM, chassi, marca/modelo, ano fab/modelo, cor, dados do vendedor, dados do comprador (nome + CPF + endereço), valor declarado da venda.

### Por que hoje não funciona
- O `systemPrompt` do `supabase/functions/document-ocr/index.ts` só conhece 5 tipos: `cnh`, `rg`, `crlv`, `nota_fiscal_veiculo`, `comprovante_residencia`.
- Documentos ATPV-e caem como `outro` e são rejeitados pelo fluxo público.
- O frontend `EtapaDadosPessoaisDocumentos.tsx` só sabe extrair dados de `crlv` e `nota_fiscal_veiculo`.

### Mudanças

**1) `supabase/functions/document-ocr/index.ts`** — adicionar reconhecimento da ATPV-e
- Novo tipo: `atpv_e` (rotulado “ATPV-e / CRV Digital”).
- Campos extraídos:
  - `placa`, `renavam`, `chassi`, `marca`, `modelo`, `ano_fabricacao`, `ano_modelo`, `cor`
  - `nome_comprador`, `cpf_comprador`, `endereco_comprador` (logradouro, cidade, uf, cep)
  - `nome_vendedor`, `cpf_cnpj_vendedor`
  - `valor_declarado_venda`, `data_emissao_crv`, `data_venda`
  - `numero_crv`, `codigo_seguranca_crv`, `numero_atpv`
- Regras: tratar como **substituto do CRLV** para fins de cotação (igual à Nota Fiscal).
- Atualizar o enum do JSON de resposta para incluir `atpv_e`.
- Atualizar `tipoLabels` para aceitar `atpv_e` quando enviado como `tipoEsperado`.

**2) `src/components/cotacao-publica/EtapaDadosPessoaisDocumentos.tsx`**
- Tratar `atpv_e` como `crlv`/`nota_fiscal_veiculo` na flag `temCrlv`.
- Adicionar bloco de extração análogo ao do CRLV: preencher `veiculo_placa`, `veiculo_chassi`, `veiculo_renavam`, `veiculo_cor`, `veiculo_ano_fabricacao`, `veiculo_ano_modelo`.
- Atualizar `origem_documento_veiculo` para incluir `'atpv_e'`.
- Mostrar badge “ATPV-e / CRV Digital (substitui CRLV)” na lista de documentos.
- Atualizar texto: “Envie CRLV, Nota Fiscal ou ATPV-e”.

**3) Pequenos ajustes de UI**
- Mensagem de instrução do upload: “CRLV, Nota Fiscal ou ATPV-e (CRV Digital)”.
- Manter o salvamento do arquivo no bucket com `tipo = 'crlv'` (não precisa migrar tabela), apenas registrar no metadado/observação que a origem é ATPV-e — evita migração de banco e mantém compatibilidade com dashboards existentes.

### Arquivos a editar
- `supabase/functions/document-ocr/index.ts`
- `src/components/cotacao-publica/EtapaDadosPessoaisDocumentos.tsx`

### Não vou mexer (por segurança)
- Schema do banco (`tipo_documento` enum) — ATPV-e será persistido como `crlv` com flag de origem, evitando migração arriscada.
- Outras telas internas (cadastro, contratos) — fora do escopo do pedido (link público).

### Resultado esperado
- No link público de contratação, o cliente pode enviar o ATPV-e/CRV digital e o sistema:
  1. detecta automaticamente o tipo
  2. extrai placa, chassi, renavam, marca, modelo, ano, cor
  3. marca o requisito “CRLV ou Nota Fiscal” como cumprido
  4. avança o fluxo normalmente

