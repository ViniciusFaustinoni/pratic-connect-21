## Objetivo

Estender o fluxo de sincronização de associado vindo do SGA (já implementado em `importar-associado-sga` e usado pelo botão "Sincronizar Associado SGA" em `IntegracaoSGAHinova.tsx`) para também:

1. Refletir o **estado real do associado no SGA** (ATIVO / PENDENTE / INADIMPLENTE / SUSPENSO / CANCELADO) no `associados.status` local.
2. Mostrar um **ícone discreto SGA** ao lado do nome do associado nas telas onde ele aparece — Associados, Base Antiga e Detalhe — sinalizando "sincronizado/origem SGA · cód. XXXXX".

> Nota técnica importante: a API Hinova v2 **não expõe endpoints para baixar fotos nem documentos** do associado/veículo — só permite enviar (`POST /veiculo/foto/cadastrar`). Por isso ficamos no escopo metadados + situação + badge, conforme você confirmou.

---

## Mudanças

### 1. Edge function `importar-associado-sga` — puxar situação real

No `fetchAssociadoMeta`, ler os campos `situacao` / `codigo_situacao` / `situacao_associado` que o SGA já devolve no `GET /associado/buscar/:cpf/cpf`.

Mapear para o enum local `associados.status`:

```text
SGA "ATIVO"        → ativo
SGA "PENDENTE"     → pendente
SGA "INADIMPLENTE" → bloqueado  (tipo_saida = 'inadimplencia')
SGA "SUSPENSO"     → bloqueado
SGA "CANCELADO"    → cancelado  (tipo_saida = 'cancelamento_voluntario')
```

Aplicar o status mapeado tanto no INSERT (associado novo) quanto no UPDATE (associado já existente). Se o SGA não devolver situação reconhecível, preservar o `status` local atual.

Também gravar `data_cadastro_sga` quando o payload trouxer essa data, e atualizar `sincronizado_hinova_em` em todo import.

### 2. Novo componente `BadgeSincronizadoSGA`

Arquivo: `src/components/associados/BadgeSincronizadoSGA.tsx`

Ícone Lucide `CloudCheck` (h-3.5 w-3.5) em `text-primary`, dentro de um `<Tooltip>` mostrando:
- "Sincronizado com SGA"
- "Código Hinova: {codigo}"
- "Última sync: {data formatada}"

Aceita props `{ codigoHinova: number | null; sincronizadoEm: string | null }` e só renderiza quando `codigoHinova` existe.

### 3. Usar o badge em 3 telas

- **`src/pages/cadastro/Associados.tsx`** — na coluna Nome, ao lado do nome do associado.
- **`src/pages/cadastro/BaseAntiga.tsx`** — na linha da tabela (substitui o texto "Hinova: 30157" por nome + ícone com tooltip; manter a coluna de código separado).
- **`src/pages/cadastro/AssociadoDetalhe.tsx`** — no header, ao lado do nome principal.

### 4. RAFAEL RODRIGUES (cód. 30157)

Após o deploy da edge atualizada, basta clicar em "Sincronizar Associado SGA" e digitar o CPF `68446543249`. O upsert vai:
- Atualizar `status` para o valor real vindo do SGA (provavelmente `ativo`).
- Atualizar `sincronizado_hinova_em`.
- Fazer o ícone aparecer automaticamente nas 3 telas.

Nenhum backfill manual no banco é necessário.

---

## Aspectos técnicos

- Mantém a regra canônica: "sistema NUNCA envia situação ATIVO ao SGA". Aqui só **lemos** a situação que o SGA declarar e refletimos local — não estamos promovendo nada via `alterar-situacao-para`.
- O badge não chama o SGA — usa só os campos `codigo_hinova` e `sincronizado_hinova_em` já existentes em `associados`, sem custo de query extra.
- Sem mudanças de schema: as colunas `codigo_hinova`, `sincronizado_hinova`, `sincronizado_hinova_em`, `data_cadastro_sga` e `status` já existem.

---

## O que NÃO entra neste plano

- Fotos e documentos do SGA (Hinova v2 não expõe download). Se no futuro a Hinova liberar endpoint, abrimos uma tarefa separada.
- Sincronização em lote / cron de status SGA — por enquanto o status é reavaliado só quando o operador clica em "Sincronizar Associado SGA".
- Reescrita da fila `sga_sync_queue` (que é para envio, não recepção).