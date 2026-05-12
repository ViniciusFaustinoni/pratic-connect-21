## Problema

O dialog **Solicitar Documentos** (`src/components/cadastro/SolicitarDocumentosDialog.tsx`), usado na análise do Cadastro para pendenciar uma autovistoria, ainda lista apenas:

- Foto do Chassi
- Foto do Motor
- **Vídeo 360°** ← removido no novo fluxo

Isso é incoerente com o novo fluxo de autovistoria (9 fotos, sem vídeo).

## Correção proposta

Atualizar a categoria `autovistoria` em `buildCategorias()` para refletir o novo fluxo:

```text
Autovistoria — Roubo e Furto
├─ Frente — Placa + Centro
├─ Frente — Placa + Lateral Esquerda
├─ Frente — Placa + Lateral Direita
├─ Traseira — Placa + Centro
├─ Traseira — Placa + Lateral Esquerda
├─ Traseira — Placa + Lateral Direita
├─ Foto do Chassi
├─ Foto do Motor
└─ Painel com veículo ligado
```

IDs alinhados aos do `autovistoriaConfig.ts`: `frente_centro`, `frente_lateral_esquerda`, `frente_lateral_direita`, `traseira_centro`, `traseira_lateral_esquerda`, `traseira_lateral_direita`, `chassi`, `motor`, `painel_ligado`.

Remover a opção `video_360` e a importação `Video` do lucide se não for mais usada (substituir ícone da categoria por `Camera` ou `Car`).

## Detalhes técnicos

- Arquivo único: `src/components/cadastro/SolicitarDocumentosDialog.tsx` (linhas 69–85).
- Ajustar default de `selecionados` se necessário — o set inicial é vazio para autovistoria, então sem impacto.
- Garantir que o consumidor (handler de `onConfirm`) apenas repassa os IDs para a notificação/registro de pendência — não há mapeamento hardcoded para `chassi/motor/video_360` em outros pontos críticos (a confirmar com `rg "video_360"` antes de aplicar).

## Fora de escopo

- Não alterar lógica de OCR, status, edge functions, ou UI de upload.
- Não tocar no fluxo de instalação presencial (já coerente).
