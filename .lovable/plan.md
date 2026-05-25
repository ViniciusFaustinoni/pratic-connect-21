## Retificar Termo de Filiação — pré-preenchimento por OCR + scroll do modal

### Contexto
`RetificarTermoModal.tsx` hoje monta `defaults` apenas a partir de `associado` / `contrato` / `veiculo` que vêm do BD. Quando o cadastro original entrou com OCR parcial ou divergente, o BD tem as colunas vazias e o modal mostra Nome/RG/Data de nascimento/CNH/etc. em branco — o usuário precisa redigitar tudo.

Já existe OCR persistido em `contratos_documentos.ocr_resultado.dados` por tipo (`cnh`, `crlv`, `comprovante_residencia`, `nota_fiscal_veiculo`), com campos canônicos (nome, rg, data_nascimento, cnh_numero/categoria/validade, cep, logradouro, número, bairro, cidade, uf, placa, renavam, marca, modelo, ano_fabricacao/modelo, cor, combustivel — chassi também aparece, mas não pode ser usado automaticamente: regra canônica do projeto = chassi sempre manual).

Bug #2: dentro do `DialogContent` com `flex-col max-h-[90vh]`, a `<ScrollArea className="flex-1 pr-3">` não rola porque o viewport do Radix ScrollArea precisa de `min-h-0` no flex item (e/ou `h-full` no viewport) para respeitar o limite do pai. Hoje o conteúdo cresce e empurra o footer pra fora da janela, sem barra de rolagem.

### Mudanças propostas

#### 1. Novo hook `useRetificacaoPrefillOCR(contrato_id)`
- Arquivo: `src/hooks/useRetificacaoPrefillOCR.ts`
- Busca `contratos_documentos` por `contrato_id` (todos os `tipo`), seleciona `ocr_resultado.dados`
- Mapeia para a forma do form do modal, com prioridade por tipo:
  - **Associado**: `cnh.nome`, `cnh.rg`, `cnh.data_nascimento`, `cnh.numero_registro` → `cnh_numero`, `cnh.categoria`, `cnh.validade`; `comprovante_residencia.{cep,logradouro,numero,bairro,cidade,uf}` (fallback de cada campo: CRLV → comprovante)
  - **Veículo**: `crlv.{placa,renavam,marca,modelo,ano_fabricacao,ano_modelo,cor,combustivel}` (fallback NF para 0KM)
  - **NUNCA preencher `chassi`** (constraint `mem://constraints/operations/chassi-sempre-manual`)
- Devolve `{ prefill: Partial<FormValues>, camposPorFonte: Record<keyof FormValues, 'cnh'|'crlv'|'comprovante'|'nf'> }` para a UI indicar a origem.

#### 2. Patch em `RetificarTermoModal.tsx`
- Consumir o hook e construir `defaults` como **merge não-destrutivo**:
  ```
  campo = valor_do_BD ?? valor_do_OCR ?? ''
  ```
  (BD sempre vence; OCR só preenche quando BD vazio — coerente com regra "OCR não vence dado humano".)
- Em cada `<Field>` cujo valor saiu do OCR, mostrar microbadge `auto · CNH`/`auto · CRLV` ao lado do Label (ícone `Sparkles`) e estilo `text-xs text-muted-foreground`.
- Botão pequeno "Repreencher do OCR" no topo do form (após Motivo), que faz `form.reset({ ...defaults, motivo: form.getValues('motivo') })` puxando OCR novamente.
- `motivo` placeholder ganha exemplo "OCR preencheu RG errado…" (já tem, manter).
- Chassi continua manual — nada de OCR injetado.

#### 3. Fix de scroll
- Substituir `<ScrollArea className="flex-1 pr-3">…</ScrollArea>` por `<div className="flex-1 min-h-0 overflow-y-auto pr-3">…</div>`.
  - `min-h-0` é o que falta hoje para o flex item respeitar o limite do `max-h-[90vh]`.
  - Mantém a aparência (sem barrinha estilizada do Radix, mas com scroll funcional). Se o usuário preferir manter a `ScrollArea` estilizada, alternativa é wrappear: `<div className="flex-1 min-h-0"><ScrollArea className="h-full pr-3">…</ScrollArea></div>` — escolherei esta segunda forma para preservar o visual atual.

### Arquivos tocados
- **Criado**: `src/hooks/useRetificacaoPrefillOCR.ts`
- **Alterado**: `src/components/associados/detalhe/RetificarTermoModal.tsx` (merge OCR + badge origem + fix scroll)

### Fora de escopo
- Não mexer no edge `retificar-termo-filiacao` nem na persistência — só UI.
- Não alterar OCR pipeline.
- Não reintroduzir OCR de chassi.
- Sem migration.

### Smoke tests
1. Abrir modal num associado com nome vazio no BD mas com CNH OCR aprovada → campo Nome vem pré-preenchido com badge `auto · CNH`.
2. Abrir modal num associado com nome correto no BD → BD vence, sem badge.
3. Scrollar lista até o accordion "Contrato" → footer "Salvar e enviar para assinatura" permanece fixo, scroll funciona dentro do modal.
4. Chassi continua exigindo digitação manual mesmo com CRLV legível.
