
## Contexto

Hoje a aba **Régua › Emissão de Cobranças** (`src/pages/financeiro/EmissaoCobrancas.tsx`) só funciona se houver um **fechamento mensal aprovado** — por isso o usuário vê "Nenhum fechamento aprovado".

A nova necessidade é independente do fechamento: importar um CSV gerado pelo Hinova/SGA com associados **inadimplentes** (nome, matrícula, placa, telefones, vencimento, linha digitável) e disparar uma cobrança via **template Meta** no WhatsApp, **agrupando todos os boletos do mesmo associado em uma única mensagem**.

## O que será construído

Acrescentar (sem remover o fluxo atual de fechamento) uma nova **subseção "Importar CSV de Inadimplentes"** dentro de `EmissaoCobrancas.tsx`, em 4 etapas guiadas:

```text
[1] Upload CSV  →  [2] Preview/parse  →  [3] Identificar WhatsApp  →  [4] Disparar
```

### Etapa 1 — Upload do CSV
- Drop zone aceitando `.csv` no formato exato do anexo (cabeçalho: `Nome, Matrícula, Placas, Telefone Celular, Telefone, Data Vencimento, Data Vencimento Original, Codigo de Barras`).
- Parser com `papaparse` (já instalado) tolerante a aspas, BOM e separador `,`.
- Validação básica do cabeçalho; erro claro se faltar coluna.

### Etapa 2 — Preview e agrupamento
Mostrar **2 cards de KPI** + **tabela**:

- **Total de boletos** (linhas no CSV)
- **Total de associados únicos** (agrupados por `Matrícula`)
- **Associados com WhatsApp válido** (recebedores)
- **Associados sem WhatsApp** (descartados)
- **Total de telefones que receberão** (somando 2º telefone quando válido)

Tabela agrupada por associado mostrando:
- Nome | Matrícula | Telefones detectados (com badge "WhatsApp" / "Fixo — descartado") | Nº de boletos | Placas | Vencimentos

Regras de agrupamento:
- Chave: `Matrícula` (fallback `Nome` normalizado).
- Cada associado guarda `boletos: [{placa, vencimento, linhaDigitavel}]`.
- Coluna `Placas` no CSV vem como `LTY3H46|24223` → exibimos só a placa real (`LTY3H46`); descartamos lado puramente numérico (matrícula).

Regra de telefone WhatsApp:
- Limpar não-dígitos. Aceitar formato BR `DDDNNNNNNNNN` (10 ou 11 dígitos). Adicionar `55` se faltar.
- Considerar **móvel/WhatsApp** quando o número local começa com `9` no 1º dígito após DDD (regra ANATEL: celulares têm 9 dígitos começando com 9).
- Descartar fixos (8 dígitos pós-DDD ou começando 2-5).
- Descartar duplicados / placeholder `(00)0000-00000`.
- Se ambos `Telefone Celular` e `Telefone` forem válidos e diferentes → mensagem vai para os dois.

### Etapa 3 — Template Meta
Criar um novo template Meta padrão **`cobranca_inadimplencia_pratic`** (categoria `UTILITY`, idioma `pt_BR`) via UI existente em Integrações › WhatsApp › Templates Meta, com corpo:

```
Olá, {{1}}! 👋

Identificamos pendência(s) financeira(s) na sua associação Praticcar.

📋 *Boletos em aberto:*
{{2}}

💳 Para regularizar, copie a linha digitável do(s) boleto(s) acima e pague em qualquer banco/app.

Em caso de dúvidas, responda esta mensagem.
```

- `{{1}}` = primeiro nome
- `{{2}}` = bloco multilinha montado dinamicamente, ex.:
  ```
  • Placa LTY3H46 — venc. 10/04/2024
    34191.09123 32079.130939 75008.900005 6 96820000018670

  • Placa BEL9I69 — venc. 28/02/2025
    34191.09370 80282.870932 75008.900005 9 10060000032413
  ```

Como Meta valida `{{2}}` como variável única, o conteúdo multilinha é montado no servidor antes do envio (Meta aceita `\n` em variáveis BODY).

### Etapa 4 — Disparo
Botão único **"Iniciar envio em massa"** com confirmação. Mostra:
- Barra de progresso `atual/total`
- Contador sucesso / erro
- Tabela final com status por destinatário

Cancelável. Throttle de 1 mensagem/seg para respeitar limites Meta.

## Implementação técnica

### Frontend
- `src/pages/financeiro/EmissaoCobrancas.tsx`: adicionar `<Tabs>` interno `Fechamento Mensal | Importar CSV (SGA)` (mantém o fluxo legado intacto).
- Novo componente `src/components/financeiro/ImportarCobrancaCsv.tsx` com as 4 etapas (stepper local via `useState`).
- Novo util `src/lib/cobranca/parseCsvInadimplentes.ts` (parser + agrupamento + classificação telefone). Coberto por teste unitário simples em `*.test.ts`.

### Backend
Nova edge function **`disparar-cobranca-csv-meta`**:

Recebe:
```ts
{
  template_nome: string,            // 'cobranca_inadimplencia_pratic'
  destinatarios: Array<{
    nome: string,
    matricula: string,
    telefones: string[],            // já formatados c/ 55
    boletos: Array<{ placa: string, vencimento: string, linha_digitavel: string }>
  }>
}
```

Para cada destinatário:
1. Monta o bloco `{{2}}` (lista markdown-like).
2. Para cada telefone, faz `POST graph.facebook.com/v21.0/{phone_number_id}/messages` com:
   ```json
   {
     "messaging_product": "whatsapp",
     "to": "55XXXXXXXXXXX",
     "type": "template",
     "template": {
       "name": "cobranca_inadimplencia_pratic",
       "language": { "code": "pt_BR" },
       "components": [{
         "type": "body",
         "parameters": [
           { "type": "text", "text": "Primeiro nome" },
           { "type": "text", "text": "Lista de boletos" }
         ]
       }]
     }
   }
   ```
3. Insere log em `whatsapp_mensagens` (`direcao='saida'`, `template_id`, `referencia_tipo='cobranca_csv'`, `referencia_id=matricula`).
4. Throttle 1 req/s; retorna `{ sucesso, erros, detalhes[] }`.

Reaproveita `whatsapp_meta_config` (mesma tabela usada por `whatsapp-meta-test`).

### Segurança / validação
- Limite de 5 MB por arquivo, máx 20.000 linhas.
- Validação Zod do payload da edge function.
- `verify_jwt = true` na edge function (apenas usuário autenticado dispara).
- Apenas perfis com permissão `cobrancas.disparar_lote` (ou Diretor) veem a aba — usar `<PermissionGate>` existente.

### Não escopo
- Não criar boleto novo no Asaas (CSV já vem com linha digitável pronta).
- Não persistir os boletos do CSV em `asaas_cobrancas` (seriam duplicidade — origem é Hinova).
- Não alterar a aba "Fechamento Mensal" existente.

## Arquivos afetados

- `src/pages/financeiro/EmissaoCobrancas.tsx` (adicionar Tabs interno)
- `src/components/financeiro/ImportarCobrancaCsv.tsx` (novo)
- `src/lib/cobranca/parseCsvInadimplentes.ts` (novo) + teste
- `supabase/functions/disparar-cobranca-csv-meta/index.ts` (novo)
- `supabase/config.toml` (registrar edge function)
- Memory: anotar formato CSV SGA inadimplentes como entrada canônica do disparo Meta

## Observações

- Template Meta precisa ser **aprovado pela Meta** antes do 1º disparo real (pode levar minutos a horas). O fluxo de criação/sincronização já está pronto na tela de Integrações; só vou criar o rascunho com o conteúdo acima.
- Pergunta: deseja que eu **já cadastre o template** automaticamente na 1ª execução, ou prefere apenas mostrar uma instrução "Crie o template em Integrações › WhatsApp"? Default do plano: **cadastrar automaticamente** como rascunho e submeter para aprovação Meta.
