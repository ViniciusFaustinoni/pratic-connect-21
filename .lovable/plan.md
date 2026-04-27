## Por que as fotos estão indo incompletas para o SGA

A função `sga-hinova-sync` (PASSO 7, linhas 1826–1903 de `supabase/functions/sga-hinova-sync/index.ts`) tem **3 bugs encadeados** que descartam silenciosamente quase todas as fotos. Reproduzi cada um consultando o banco real.

### Bug 1 (raiz) — Campo de URL errado, todas as fotos viram `link: undefined` e são descartadas

Linha 1868:

```ts
link: doc.url_arquivo || doc.arquivo_url
```

A coluna em `documentos` (e em `contratos_documentos`) chama-se **`arquivo_url`** — não existe `url_arquivo` em lugar nenhum do schema (confirmado via `information_schema`).

Em seguida, na linha 1870, há um `.filter(f => f.link)` que remove todas as fotos sem link. Como o operador `||` só serve de fallback, o bug não é fatal **por enquanto**, mas qualquer documento que entre por outra fonte (ex.: `contratos_documentos` no `.map` da linha 1848 mantém `arquivo_url` no novo objeto) sobrevive por sorte. Há registros legados onde a única coluna preenchida varia, então documentos válidos somem.

Pior: o nome do campo errado mascara silenciosamente — o `logSync` registra `qtd_fotos: fotos.length` **depois do filter**, então o log marca `success` com `qtd: 1` mesmo quando 4 fotos foram descartadas. Foi exatamente o que vi: os últimos logs `enviar_fotos` aparecem como `success` com `qtd` entre 1 e 5, mas há cadastros com 6+ documentos aprovados.

### Bug 2 — Mapeamento `tipo_foto` não casa com os tipos reais usados no upload

A consulta a `hinova_mapeamentos` mostra que os mapeamentos cadastrados para fotos esperam chaves como `foto_chassi`, `foto_motor`, `foto_frontal_veiculo`, `foto_traseira_veiculo`, `foto_lateral_esquerda`, `foto_lateral_direita`, `foto_hodometro`, `foto_km`, `foto_painel`.

Mas a tabela `documentos` está gravando os tipos como: **`chassi`**, **`motor`**, **`frente`**, **`traseira`**, **`lateral_direita`**, **`lateral_esquerda`**, **`odometro`** (sem o prefixo `foto_` e com nomes mais curtos).

Como nenhuma dessas chaves casa, `getMapeamento('tipo_foto', doc.tipo)` retorna `null` e a linha 1864 cai no fallback `|| 1` (que é o código de **CNH** no Hinova). Resultado: **toda foto de veículo enviada vai catalogada como CNH no SGA**, e o associado fica sem identificação correta de chassi, motor, painel, lateral, etc. Para o operador SGA isso aparece como "cadastro sem fotos do veículo".

### Bug 3 — Documentos `pendentes` (válidos via OCR) ficam de fora

Linha 1836: `eq('status', 'aprovado')`. No banco existem hoje 18 documentos: 8 aprovados e **10 pendentes**. Pela memória `aprovacao-manual-documentos-vistoria`, documentos aprovados via OCR caem em `em_analise` para revisão manual — mas no schema atual ficam como `pendente` até o analista aprovar. Quando o cadastro é sincronizado com o SGA antes da aprovação manual, **as fotos pendentes nem são tentadas**.

A política correta é: sincronizar com SGA tudo que já passou pelo OCR e foi aceito (status `aprovado` **ou** `em_analise` quando o documento veio do fluxo de vistoria/contratação).

## Plano de correção

### 1. `supabase/functions/sga-hinova-sync/index.ts` (PASSO 7)

- **Bug 1**: Trocar `link: doc.url_arquivo || doc.arquivo_url` por `link: doc.arquivo_url` (única coluna real). Remover o fallback inexistente.
- **Bug 1.b — observabilidade**: antes do `.filter`, calcular `const fotosBrutas = batch.length` e logar `{ qtd_fotos_enviadas: fotos.length, qtd_fotos_descartadas: fotosBrutas - fotos.length, descartadas_ids: batch.filter(d => !d.arquivo_url).map(d => d.id) }`. Sem isso o problema continua invisível em produção.
- **Bug 2**: Adicionar normalização do tipo antes de chamar `getMapeamento`:
  ```ts
  const tipoNormalizado = normalizarTipoFoto(doc.tipo);
  const tipoFoto = getMapeamento('tipo_foto', tipoNormalizado);
  if (!tipoFoto) {
    console.warn('[SGA Sync] tipo_foto sem mapeamento, pulando', { tipo: doc.tipo, id: doc.id });
    return null; // não envia como CNH
  }
  ```
  Onde `normalizarTipoFoto` mapeia `chassi → foto_chassi`, `motor → foto_motor`, `frente → foto_frontal_veiculo`, `traseira → foto_traseira_veiculo`, `odometro → foto_hodometro`, `painel → foto_painel`, `lateral_esquerda → foto_lateral_esquerda`, `lateral_direita → foto_lateral_direita`. Documentos pessoais (`cnh`, `crlv`, `cpf`, `rg`, `comprovante_residencia`) já casam direto.
  
  Filtrar `null`s depois do map e contar quantos foram descartados por tipo desconhecido (incluir no log).

- **Bug 3**: Trocar o filtro de `documentos`:
  ```ts
  .in('status', ['aprovado', 'em_analise'])
  ```
  e idem para `contratos_documentos`. Isso preserva o requisito de revisão manual no painel interno mas garante que o SGA receba o material que já passou pelo OCR.

### 2. Seeds em `hinova_mapeamentos` (migração)

Para não depender só de normalização no código, inserir aliases diretos no banco para que futuros tipos novos não exijam deploy:

```sql
INSERT INTO hinova_mapeamentos (tipo, codigo_local, codigo_hinova, descricao, ativo)
VALUES
  ('tipo_foto','chassi',9,'FOTO CHASSI',true),
  ('tipo_foto','motor',8,'FOTO MOTOR',true),
  ('tipo_foto','frente',4,'FOTO FRENTE',true),
  ('tipo_foto','traseira',5,'FOTO TRASEIRA',true),
  ('tipo_foto','lateral_esquerda',6,'FOTO LATERAL ESQUERDA',true),
  ('tipo_foto','lateral_direita',7,'FOTO LATERAL DIREITA',true),
  ('tipo_foto','odometro',10,'FOTO KM',true),
  ('tipo_foto','painel',10,'FOTO PAINEL',true),
  ('tipo_foto','laudo_vistoria',13,'LAUDO VISTORIA',true)
ON CONFLICT DO NOTHING;
```
(Confirmar com você o `codigo_hinova` correto para `laudo_vistoria` antes de aplicar — provavelmente vai como anexo PDF; se o Hinova não aceitar PDF nessa rota, **não enviar** e logar.)

### 3. Reprocessamento dos cadastros já incompletos

Após o deploy, rodar `sga-reprocessar-cotacoes-ativacoes` (já existe) **só** para os veículos com `sincronizado_hinova = true` cujos `sga_sync_logs.action='enviar_fotos'` registraram `qtd < total_documentos_aprovados`. Vou listar essa query antes de executar para você aprovar a lista.

### 4. Validação como diretor (após deploy)

Logar como `admin@teste.com / admin@teste.com`, abrir um cadastro recente, conferir no painel SGA-Hinova que as fotos aparecem com os tipos corretos (CHASSI, MOTOR, FRENTE etc., não tudo como CNH) e a quantidade bate com `documentos` aprovados/em_analise do veículo.

## Resumo do impacto

- **Bug 1** descartava silenciosamente parte das fotos (campo de URL inexistente como primeira opção).
- **Bug 2** fazia toda foto de veículo virar "CNH" no SGA — esse é o motivo principal do "cadastro incompleto" relatado pelo operador.
- **Bug 3** ignorava documentos válidos ainda em `em_analise`/`pendente`.

Os três precisam ser corrigidos juntos; consertar só o 1 mantém as fotos chegando rotuladas erradas.
