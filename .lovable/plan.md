

## Plano: Indicador visual de posição da assinatura Autentique no preview

### Objetivo
Adicionar ao preview do TemplateEditor um overlay visual mostrando onde o Autentique vai posicionar a assinatura digital em cada página, para que o editor de templates saiba exatamente onde a assinatura cairá.

### Alteração

**Editar**: `src/components/documentos/TemplateEditor.tsx`

1. **Adicionar toggle "Mostrar assinatura Autentique"** — um botão/switch na barra de preview que ativa/desativa a visualização da posição da assinatura

2. **Renderizar overlay de assinatura** — quando ativo, exibir um elemento posicionado com `position: absolute` dentro do container A4, nas coordenadas equivalentes a x=65%, y=85% (os valores padrão do `autentique-positions.ts`):
   - Retângulo tracejado semi-transparente com ícone de caneta e texto "Assinatura Autentique"
   - Posicionado via CSS `left: 65%; top: 85%` dentro do container A4 (que precisa de `position: relative`)

3. **Estilo do indicador**:
   - Borda tracejada azul/roxa
   - Background semi-transparente
   - Texto pequeno "📝 Assinatura digital aqui"
   - Dimensões aproximadas de como o Autentique renderiza (cerca de 25% largura × 8% altura)

### Detalhes técnicos
- O container A4 (div com `maxWidth: 210mm`) recebe `position: relative`
- O overlay é um `div` com `position: absolute`, `left: 65%`, `top: 85%`, `transform: translate(-50%, -50%)`
- Estado local `showSignatureOverlay` controlado por um botão na barra de info do preview
- Não depende de dados do banco — usa os valores padrão hardcoded (65%, 85%) que são os mesmos usados pela edge function

### Arquivo
- **Editar**: `src/components/documentos/TemplateEditor.tsx`

