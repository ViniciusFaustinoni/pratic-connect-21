

## Plano: Reforçar adesão gratuita como argumento de venda no Agente Consultor IA

### Problema
A IA menciona a adesão isenta apenas no resumo final. Deveria usar isso como argumento de venda ativo durante a conversa, enfatizando que o lead consegue adesão gratuita ao contratar pelo atendimento.

### Solução

**Arquivo: `supabase/functions/agente-consultor-ia/index.ts`**

#### 1. Adicionar seção de técnica de vendas no system prompt (após linha 411)
Adicionar bloco de instrução de vendas:

```
## ARGUMENTO DE VENDA — ADESÃO GRATUITA
- A adesão gratuita é seu PRINCIPAL argumento de venda
- Mencione a adesão gratuita LOGO NO INÍCIO da conversa, junto com a apresentação
- Enfatize que essa condição especial é exclusiva para quem contratar por este atendimento
- Use frases como: "E tenho uma ótima notícia: consigo liberar a adesão TOTALMENTE GRATUITA pra você! 🎉"
- Reforce o benefício ao longo da conversa quando apropriado (ex: antes de pedir email, ao enviar link)
- Deixe claro que normalmente a adesão é cobrada e que essa é uma condição especial
```

#### 2. Ajustar apresentação inicial (linha 383-384)
Adicionar instrução para incluir o argumento na saudação:

```
## APRESENTAÇÃO INICIAL
Quando for a primeira mensagem do contato, use esta apresentação como base (adapte naturalmente):
"${apresentacao}"
IMPORTANTE: Na apresentação, já mencione que consegue oferecer ADESÃO GRATUITA como condição especial.
```

#### 3. Ajustar passo 7 do fluxo (linha 421)
Após calcular a cotação, reforçar o benefício:

```
7. Diga algo como: "Vou preparar sua cotação personalizada com as melhores opções! E lembrando: a adesão sai GRATUITA pra você! 🎉"
```

### Arquivos alterados
- `supabase/functions/agente-consultor-ia/index.ts` (deploy necessário)

