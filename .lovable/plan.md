## Objetivo

Aceitar o XLSX no formato exato do export Hinova (incluindo a coluna **2ª Via Boleto** com `<a href="...">LINK</a>`), enviar o link da 2ª via no disparo Meta WhatsApp como **botão dinâmico de URL**, e atualizar o template baixável para refletir esse formato.

## Contexto descoberto

- `parseCsvInadimplentes.ts` já tem alias `link`, mas:
  - **não reconhece** o cabeçalho `2ª Via Boleto`
  - **não extrai** URL de uma célula HTML `<a href="https://short.hinova.com.br/v2/XXXX.pdf">LINK</a>` — exige `^https?://`, então o link vira `undefined`
  - boletos são desempatados por `linha_digitavel`; o link nunca é propagado adiante
- `templateCobrancas.ts` (download `.xlsx`) usa colunas próprias (`Link`, `Status`, etc.) — diferente do export real do Hinova que o usuário enviou
- Edge `disparar-cobranca-csv-meta` envia só `{{1}}=nome` e `{{2}}=bloco de boletos`. Não envia componente `button`
- Template Meta atual `cobranca_inadimplencia_pratic` está **APPROVED**, **sem botões** — não dá para adicionar botão sem reaprovação Meta (24–48h)

## Decisões

1. **Botão de URL dinâmico** exige um **template novo** (`cobranca_inadimplencia_pratic_v2`) submetido à Meta. Como o usuário escolheu botão, vamos:
   - Manter `cobranca_inadimplencia_pratic` (atual) como **fallback** enquanto o v2 não for aprovado
   - Criar `cobranca_inadimplencia_pratic_v2` no Meta Business Manager com:
     - Body: mesmo texto atual + linha "🔗 Acesse a 2ª via:" 
     - Componente `BUTTONS` → `URL` dinâmico (1 botão), label "Abrir 2ª via", URL base `https://short.hinova.com.br/v2/{{1}}.pdf`
   - Edge envia `parameters` do botão com o **sufixo** do link mais antigo (boleto com vencimento mais antigo) por destinatário — botão Meta só aceita 1 URL
2. **Fallback no body**: até v2 ser aprovado, **também** já incluir os links em texto no `{{2}}` (formato `… | venc dd/mm | linha | 🔗 short.hinova.com.br/v2/XXXX`) para que o operador receba o link mesmo no template antigo
3. Boletos sem link continuam funcionando normalmente (botão é opcional — quando nenhum boleto tem link, edge cai no template v1)

## Mudanças

### 1. Parser (`src/lib/cobranca/parseCsvInadimplentes.ts`)
- Adicionar aliases para a coluna `2ª Via Boleto`: `'2a via boleto'`, `'2via boleto'`, `'segunda via boleto'`, `'2 via'`, `'link 2 via'`
- Função `extrairUrlLink(raw)`: aceita URL crua **ou** extrai do primeiro `href="…"` quando o conteúdo tiver tag `<a>` HTML
- Substituir o teste `^https?://` por `extrairUrlLink`
- Tipo `BoletoCsv.link` propagado normalmente
- Adicionar testes em `parseCsvInadimplentes.test.ts` com fixture do XLSX enviado

### 2. Template `.xlsx` baixável (`src/lib/cobranca/templateCobrancas.ts`)
- Reescrever `HEADER` e `EXEMPLO` para refletir o **formato Hinova exato**:
  ```
  Data Cadastro Associado | Matrícula | Nome | Telefone Celular | Placas |
  Data Vencimento | Situação Pagamento | Valor | Codigo de Barras | 2ª Via Boleto
  ```
- Exemplo real com URL `<a href="https://short.hinova.com.br/v2/EXEMPLO.pdf" target="_blank">LINK</a>` e linha digitável real
- Atualizar instruções na aba "Instruções" explicando que `2ª Via Boleto` aceita URL crua ou tag `<a href>` HTML

### 3. UI hint (`src/components/financeiro/ImportarCobrancaCsv.tsx`)
- Atualizar texto do banner de cabeçalhos aceitos: trocar `Link` → `2ª Via Boleto`
- Mostrar contador "X boletos com link da 2ª via" no resumo pré-disparo

### 4. Edge function (`supabase/functions/disparar-cobranca-csv-meta/index.ts`)
- Aceitar nova flag `body.template_v2 = true` para escolher `cobranca_inadimplencia_pratic_v2`
- Quando `template_v2`:
  - Escolher o boleto **mais antigo** com link (menor `vencimento`) → extrair sufixo da URL Hinova (ex.: `HGt5C0NF` de `https://short.hinova.com.br/v2/HGt5C0NF.pdf`)
  - Adicionar componente:
    ```json
    {
      "type": "button",
      "sub_type": "url",
      "index": "0",
      "parameters": [{ "type": "text", "text": "<sufixo>" }]
    }
    ```
  - Se nenhum boleto tem link → cair automaticamente em `cobranca_inadimplencia_pratic` (v1) para esse destinatário
- Independente do template: incluir o link em texto no `formatarBoletoCompacto` quando presente (`• Placa XXX venc. dd/mm | linha | 🔗 short.hinova.com.br/v2/XXX`) — útil para v1 e como redundância no v2
- Persistir o link no payload `boletosResumo` salvo em `whatsapp_mensagens.payload`

### 5. Tabela DB (migração)
- `cobranca_csv_boletos.link_2via TEXT` — armazenar o link extraído (auditoria + reconciliação)
- Edge passa a inserir esse campo

### 6. Frontend toggle
- Em `ImportarCobrancaCsv.tsx`: switch "Usar template com botão (v2)" — quando ativo, envia `template_v2: true`. Default: `false` até o v2 ser aprovado pela Meta
- Aviso vermelho quando v2 selecionado e template Meta ainda `PENDING`/`REJECTED`

### 7. Cadastro do template Meta (passo manual fora do código)
- Criar `cobranca_inadimplencia_pratic_v2` no painel Meta Business Manager com 1 botão URL dinâmico — **o usuário precisa fazer isso e clicar "Sincronizar templates"** para puxar para `whatsapp_meta_templates`
- Documentar isso no banner da UI quando o switch v2 estiver desligado

## Arquivos afetados

```text
src/lib/cobranca/parseCsvInadimplentes.ts          (parser + extrairUrlLink)
src/lib/cobranca/parseCsvInadimplentes.test.ts     (fixture Hinova)
src/lib/cobranca/templateCobrancas.ts              (header + exemplo Hinova)
src/components/financeiro/ImportarCobrancaCsv.tsx  (texto + switch v2)
supabase/functions/disparar-cobranca-csv-meta/index.ts  (button URL + v2)
supabase/migrations/<novo>.sql                     (cobranca_csv_boletos.link_2via)
```

## Riscos

- O botão URL Meta só aceita **1 link** por mensagem — se o associado tem 5 boletos com 5 links diferentes, o botão aponta para o **mais antigo**. Os demais links continuam visíveis em texto no body
- Aprovação Meta do template v2 pode demorar 24h–48h. Por isso o fallback v1 + link no body é entregue **junto** e funciona imediatamente
- Sufixo da URL precisa ser exatamente o que está depois de `/v2/` e antes de `.pdf` — se a Hinova mudar o formato de URL no futuro, o regex falha (validar e fallback para v1 quando regex não bate)