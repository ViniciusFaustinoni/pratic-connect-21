

# Adicionar captura de video na Etapa 1 - Auto Vistoria

## Problema

A Etapa 1 do link de evento (auto vistoria do associado) solicita apenas fotos. Deve tambem solicitar um video do veiculo danificado.

## Solucao

### 1. Frontend: `src/components/evento/EventoEtapa1Vistoria.tsx`

Adicionar uma secao de captura de video abaixo da grade de fotos:

- Reutilizar um input `accept="video/*" capture="environment"` simples (o associado usa celular)
- Exibir preview do video quando capturado
- Botao de remover video
- O botao "Proxima Etapa" so habilita quando tiver >= 5 fotos **e** 1 video
- No submit, enviar o video junto no FormData como `video`
- Texto: "Grave um video curto (ate 2 minutos) mostrando os danos no veiculo"

Fluxo visual:
```text
[Fotos do Veiculo Danificado]
  - Grade de fotos (existente)

[Video do Veiculo]
  - Botao "Gravar/Selecionar Video"
  - Preview do video quando capturado
  - Indicador de status (pendente/enviado)

[Botao: Proxima Etapa]
  - Desabilitado ate ter 5+ fotos E 1 video
```

### 2. Backend: `supabase/functions/salvar-etapa-evento/index.ts`

Atualizar a validacao da etapa 1:
- Linha 69: Alterar validacao para exigir pelo menos 5 fotos **e** 1 video (verificar se ha arquivo com tipo `video/*` no FormData)
- Os arquivos de video serao salvos no mesmo bucket `sinistro-eventos` no caminho `{linkId}/etapa1/`

### 3. Mensagem WhatsApp (ja atualizada anteriormente)

Adicionar mencao ao video na descricao da Etapa 1 em `src/pages/eventos/SinistroAnalise.tsx`:
- Atualizar texto da etapa 1 na mensagem para incluir "e 1 video dos danos"

## Detalhes tecnicos

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/evento/EventoEtapa1Vistoria.tsx` | Adicionar state para video, input de captura de video, preview, e incluir no FormData do submit. Condicionar botao a ter fotos + video |
| `supabase/functions/salvar-etapa-evento/index.ts` | Linha 69: validar que etapa 1 tenha >= 5 fotos e >= 1 video |
| `src/pages/eventos/SinistroAnalise.tsx` | Atualizar texto da mensagem WhatsApp para mencionar video na etapa 1 |

