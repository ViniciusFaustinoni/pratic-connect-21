## Objetivo

Centralizar tudo que é relacionado a OCR na tela **Configurações → Integrações → Inteligência Artificial** (`/configuracoes/integracoes/ia`):

- **Configuração** do modelo de IA + motor de OCR (já está lá)
- **Logs de OCR** (auditoria das execuções)
- **Testes de OCR** (banco de fixtures, baseline, comparação por modelo)

Hoje "Logs de OCR" e "Testes de OCR" vivem dentro de **Diretoria → Logs de Auditoria**, o que é confuso (não são logs de auditoria genéricos, são logs operacionais de OCR).

## Mudanças

### 1. `src/pages/configuracoes/IntegracaoIA.tsx`

Reorganizar em **3 abas**:

```text
┌─ Inteligência Artificial ───────────────────────────┐
│ [ Configuração ] [ Logs de OCR ] [ Testes de OCR ]  │
├─────────────────────────────────────────────────────┤
│ Conteúdo da aba ativa                                │
└─────────────────────────────────────────────────────┘
```

- **Configuração**: `AIModelConfigCard` + `OcrEngineConfigCard` + Alert global (conteúdo atual)
- **Logs de OCR**: reusa `<OcrLogsTab />` (componente já pronto e autocontido)
- **Testes de OCR**: reusa `<OcrTestesTab />` (componente já pronto e autocontido)

Ambos os componentes já fazem suas próprias queries no Supabase, então não precisam de props ou contexto.

### 2. `src/pages/diretoria/LogsAuditoria.tsx`

Remover as duas abas duplicadas para evitar dois pontos de entrada divergentes:

- Remover `TabsTrigger value="ocr"` e `TabsTrigger value="ocr-testes"`
- Remover `TabsContent value="ocr"` e `TabsContent value="ocr-testes"`
- Remover imports de `OcrLogsTab`, `OcrTestesTab`, `ScanText`, `FlaskConical`

A página continua existindo só com **Todos os logs** + **Histórico de Hierarquia**, que é o escopo correto de uma tela de auditoria genérica.

### 3. Sem mudanças nos componentes

`OcrLogsTab.tsx` e `OcrTestesTab.tsx` ficam como estão — só mudam de lugar onde são montados.

### 4. Sem mudanças no banco / edge functions

Nenhuma alteração de schema ou lógica de OCR — é puramente reorganização de UI.

## Acesso e permissões

A rota `/configuracoes/integracoes/ia` já é restrita (configurações do sistema). `OcrEngineConfigCard` já valida `isDiretor || isDesenvolvedor` antes de permitir edição. `OcrLogsTab` e `OcrTestesTab` já estão sendo usados pela diretoria — mantém o mesmo nível de acesso (só leitura para não-diretor, edição para diretor).

## Resultado visual

A tela `/configuracoes/integracoes/ia` passa a ter as 3 abas no topo. Quem entrar nessa tela vai conseguir, sem trocar de menu:

- Trocar provedor/modelo de IA
- Configurar motor de OCR (Auto / Mistral / Anthropic / Google) e chave Mistral
- Ver últimas execuções de OCR com filtros (status, tipo de doc, datas)
- Rodar testes em PDFs/imagens de fixtures e comparar resultado por modelo
