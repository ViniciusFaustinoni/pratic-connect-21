

# Fluxo Sequencial de Fotos para o Vistoriador com Instruções Detalhadas

## Problema
O vistoriador atualmente vê uma grid de cards e precisa clicar em cada foto individualmente. Falta:
1. Fluxo sequencial (tirou uma, avança para a próxima automaticamente)
2. Instruções claras de como tirar cada foto (distância, ângulo, o que mostrar)

## Solução

### 1. Adicionar instruções a cada foto em `src/data/vistoriaConfig.ts`

Expandir a interface `VistoriaFotoConfig` com campos `descricao`, `instrucoes`, `evitar` e `dicaExtra` (mesma estrutura de `FotoAutovistoria`). Adicionar instruções detalhadas para cada uma das 31 fotos do automóvel e 10 da moto. Exemplos:

- **Vistoriador (selfie)**: "Posicione-se a 2 metros do veículo, de frente, com o veículo visível ao fundo. Placa deve aparecer." / Evitar: "Selfie close-up sem veículo, fundo escuro."
- **Frente lateral direita c/ placa**: "Fique a 3-4 metros de distância na diagonal frontal direita. A placa deve estar legível." / Evitar: "Foto de muito longe, placa ilegível, reflexo no para-brisa."
- **Sola do pneu**: "Aproxime a câmera da banda de rodagem. O sulco do pneu deve ser visível e nítido." / Evitar: "Foto do pneu inteiro sem detalhe da sola."
- **Odômetro**: "Veículo ligado. Aproxime até o hodômetro digital/analógico estar completamente legível." / Evitar: "Reflexo na tela, veículo desligado."

Cada foto terá instruções específicas de distância, posição e o que deve aparecer.

### 2. Criar componente `src/components/vistorias/VistoriaFotoSequencial.tsx`

Componente sequencial inspirado na `AutovistoriaCotacao`:

- **Props**: lista flat de fotos, fotos já enviadas, `uploadingFoto`, callback `onUpload`
- **Estado**: `fotoAtualIndex`, `previewLocal`
- **Barra de miniaturas** no topo com scroll horizontal (indicadores de check/número)
- **Área central** com:
  - Nome e descrição da foto atual em destaque
  - Card de instruções com ícone de dica: lista de "Como tirar" e "Evitar"
  - Dica extra quando disponível
  - Área de preview/captura (aspect-ratio 4:3)
  - Input `<input type="file" accept="image/*" capture="environment">`
- **Auto-avanço**: após upload bem-sucedido (~800ms delay), avança para a próxima foto pendente
- **Navegação manual**: clicar nas miniaturas para voltar/substituir fotos
- **Animação**: `framer-motion` para transição suave entre fotos
- **Estado final**: quando todas as fotos estão enviadas, mostrar mensagem de conclusão

### 3. Atualizar `src/pages/instalador/InstaladorChecklist.tsx`

Substituir o bloco de categorias com `Collapsible` + `VistoriaFotoCard` (linhas 1264-1329) por:

```tsx
<VistoriaFotoSequencial
  fotos={fotosConfig}  // lista flat de todas as fotos
  fotosEnviadas={fotosVistoria}
  uploadingFoto={uploadingFoto}
  onUpload={(fotoId, file) => handleFotoCapture(fotoId, file)}
/>
```

Onde `fotosConfig` é a lista flat de `FOTOS_AUTOMOVEL` ou `FOTOS_MOTO` (sem agrupamento por categoria). Remover imports e estado de `openCategorias`, `toggleCategoria`, `Collapsible`, `VistoriaFotoCard` se não usados em outro lugar.

## Arquivos

| Arquivo | Acao |
|---|---|
| `src/data/vistoriaConfig.ts` | Adicionar `descricao`, `instrucoes`, `evitar`, `dicaExtra` a cada foto (31 auto + 10 moto) |
| `src/components/vistorias/VistoriaFotoSequencial.tsx` | Criar componente sequencial com instruções visíveis |
| `src/pages/instalador/InstaladorChecklist.tsx` | Substituir grid por componente sequencial |

