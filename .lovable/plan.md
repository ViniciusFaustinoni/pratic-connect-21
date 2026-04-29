## Causa raiz

O toast `value too long for type character varying(11)` ocorre ao gravar `cotacoes` no `salvarDadosPessoais` (`src/hooks/useCotacaoContratacao.ts`).

A coluna `veiculo_renavam` é `varchar(11)`. No fluxo da tela, o OCR do CRLV preencheu `dadosExtraidos.veiculo_renavam = "244177548049"` (12 dígitos — provavelmente leitura do código de barras Renavam que inclui dígito extra, ou o OCR leu 1 número a mais).

A entrada **manual** já é defensiva (`.replace(/\D/g,'').slice(0,11)`), mas os campos vindos do **OCR** são gravados direto, sem sanitização. O mesmo risco existe para `veiculo_chassi` (varchar 17), `veiculo_placa` (varchar 10) e `cliente_uf` (varchar 2).

A função `truncar()` já existe no hook, mas só é aplicada a campos texto livres (telefone, RG, CNH). Renavam/chassi/placa/UF foram esquecidos.

## Correção (causa raiz, não paliativo)

Adicionar uma camada de **normalização de payload** centralizada em `useCotacaoContratacao.ts`, que sempre roda antes do `update` da cotação, com regras por campo:

| Campo | Regra |
|---|---|
| `veiculo_renavam` | só dígitos, slice(0, 11) |
| `veiculo_chassi` | uppercase, remove o que não for `[A-HJ-NPR-Z0-9]`, slice(0, 17) |
| `veiculo_placa` | uppercase, remove não alfanuméricos, slice(0, 10) |
| `cliente_uf` | uppercase, slice(0, 2) |
| `cliente_cep` | só dígitos, slice(0, 8) |
| `telefone1_solicitante` | só dígitos, slice(0, 30) (já truncado, mas reforçar formato) |
| `cliente_cnh_categoria` | uppercase, slice(0, 20) |

Implementar como `sanitizarPayloadCotacao(payload)` reutilizável e aplicar dentro de `salvarDadosPessoais.mutationFn` antes do `.update()`.

## Defesa adicional para o futuro

1. **Sanitizar também na captura OCR** em `EtapaDadosPessoaisDocumentos.tsx` (linhas ~296, 327, 348) — quando o OCR devolve `dados.renavam` / `dados.chassi`, normalizar com as mesmas regras antes de jogar em `dadosExtraidos`. Isso faz o usuário ver o valor correto na tela (e não um valor que será silenciosamente truncado depois).

2. **Mensagens de erro mais úteis**: trocar o `toast.error('Erro ao salvar dados: ' + error.message)` para usar `descreverErroSupabase()` (já existe em `src/lib/errors.ts`) — assim erros tipo `22001` (string too long) viram mensagem acionável apontando o campo.

3. **Não truncar silenciosamente o Renavam**: se o valor OCR tiver != 11 dígitos, manter o campo vazio e exigir preenchimento manual (Renavam tem tamanho fixo de 11). Truncar Renavam é arriscado — pode gerar número inválido. Para chassi (17) e placa (7/8 Mercosul) o slice é seguro porque OCR raramente excede.

## Arquivos a alterar

- `src/hooks/useCotacaoContratacao.ts` — adicionar `sanitizarPayloadCotacao()` e usar no `salvarDadosPessoais`. Trocar `toast.error` por `descreverErroSupabase`.
- `src/components/cotacao-publica/EtapaDadosPessoaisDocumentos.tsx` — sanitizar `dados.renavam` / `dados.chassi` / `dados.placa` na captura OCR (3 pontos: CRLV, ATPV, NF). Renavam: se != 11 dígitos após limpeza, descartar e marcar como "preencher manualmente".

Sem migração de banco. Sem mudança de schema.

## Como o usuário verá depois

- O Renavam de 12 dígitos será automaticamente cortado/rejeitado na captura OCR; campo aparecerá vazio com aviso para preencher manualmente.
- Se o usuário clicar Continuar mesmo assim, o salvamento funciona (não estoura mais o varchar).
- Qualquer erro futuro de tamanho mostra mensagem clara apontando o campo.