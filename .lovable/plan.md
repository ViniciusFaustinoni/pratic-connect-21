## Objetivo

No fluxo da **Vistoria Completa do técnico** (app do vistoriador):

1. A **foto 2 — "Foto da Chave"** deixa de ser obrigatória (continua disponível, mas não bloqueia a finalização).
2. Após a **31ª foto** do roteiro, o técnico pode adicionar **fotos extras opcionais** ("Outras imagens"), em quantidade livre.

Sem mudar nenhum outro fluxo (autovistoria pública, vistoria do prestador, sub-FIPE, moto, etc.).

## Onde mexer

- `src/data/vistoriaConfigCompleta.ts` — adicionar campo `opcional?: boolean` em `VistoriaFotoConfig`; marcar `chave` como `opcional: true`; ajustar `getTotalFotosObrigatorias` e adicionar helpers `getFotosObrigatorias(tipo)` que excluem opcionais.
- `src/pages/instalador/ExecutarVistoriaCompleta.tsx` — calcular `totalFotosObrigatorias`/`totalFotosEnviadas` apenas sobre as fotos não opcionais; manter a chave navegável no carrossel mas não somar à barra de progresso "obrigatórias".
- `src/components/vistorias/VistoriaFotoSequencial.tsx` — exibir badge **"Opcional"** no slot da chave; permitir avançar sem preenchê-la (não trava o auto-avance, que já depende apenas de `isPending`); progresso do header passa a usar contagem de obrigatórias.
- **Bloco novo "Outras imagens (opcional)"** — após a 31ª foto (ou seja, ao final da lista do roteiro), renderizar uma seção dentro do `ExecutarVistoriaCompleta` que:
  - lista as fotos extras já enviadas (lidas de `vistoria_fotos` com `tipo` que começa com `extra_`),
  - botão "Adicionar imagem" que captura uma nova foto e faz upload com `tipo = extra_<n>` (n = próximo índice livre),
  - cada extra pode ser refeita ou excluída (delete na tabela; o storage segue regra existente).
  - `visivel_cliente: true` (segue o padrão do roteiro).

## Detalhes técnicos

### Schema atual

`vistoria_fotos` tem unique `(vistoria_id, tipo)`. Para extras, cada upload usa `tipo` único (`extra_1`, `extra_2`, …). O reuse `useUploadFotoVistoriaCompleta` já aceita `tipo` arbitrário — não precisa migration.

### Validação `podeAprovar`

Hoje `todasFotosEnviadas = totalFotosEnviadas >= totalFotosObrigatorias`. Vamos:
```ts
const fotosObrigatoriasDoTipo = useMemo(
  () => (modoApenasInstalacao ? ... : getFotosFiltradas(tipo, false))
        .filter(f => !f.opcional),
  [...]
);
```
Assim, "chave" não conta para o bloqueio, e os "extras" também não (eles não estão no array de config).

### UI da chave

No `VistoriaFotoSequencial`, quando `fotoAtual.opcional`, renderizar uma tag azul "Opcional — pode pular" e o contador do header (`{fotosCompletasCount}/{totalFotos} enviadas`) passa a usar `totalFotos = obrigatórias` (mantém a chave acessível pelas thumbnails, mas estilizada com borda mais discreta).

### Bloco "Outras imagens"

Componente novo `VistoriaFotosExtras` em `src/components/vistorias/`:
- props: `vistoriaId`, `fotosExtras: FotoEnviada[]`, `uploadingFoto`, `onUpload(tipo, file)`, `onRemove(fotoId)`.
- grid simples de cards (thumb + lixeira) + card "+" para adicionar.
- aparece **apenas** quando `fotoAtualIndex === totalFotos - 1` ou `todasCompletas`, logo abaixo do bloco do carrossel.

### Sincronização com laudo

`useGerarLaudoVistoria` itera sobre `FOTOS_VISTORIA_COMPLETA`. Não vai listar os extras, e está ok — o laudo continua focando no roteiro canônico. (Se quiser mostrá-los no laudo num próximo passo, é incremento separado.)

## Fora de escopo

- Autovistoria do associado (link público) — segue 2 fotos + vídeo 360° conforme regra canônica.
- Vistoria do prestador, sub-FIPE, moto — não mudam.
- Painel de aprovação (Cadastro/Monitoramento) já lê `vistoria_fotos` direto, então as extras aparecerão automaticamente na galeria de fotos da vistoria.

## Pergunta antes de implementar

Confirma duas coisas:

1. **"Chave" é mesmo a única foto obrigatória que vira opcional?** (a foto 2 do roteiro automóvel é "Foto da Chave"; em moto a foto 2 é "Traseira" — não faz sentido tornar opcional. Vou aplicar **só ao automóvel**.)
2. As **fotos extras devem aparecer também na vistoria pública (autovistoria)**, ou só no app do técnico (vistoria completa)? Pelo enunciado entendi **só no app do vistoriador**.