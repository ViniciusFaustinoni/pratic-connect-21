

# Configurar Telefone 0800 da Assistencia 24h

## Problema

O numero 0800 esta hardcoded em 5 arquivos do frontend e 1 do backend. Nao existe configuracao no banco de dados para o diretor alterar esse numero. O webhook do WhatsApp ja tenta buscar a chave `assistencia_telefone_central` na tabela `configuracoes`, mas ela nao existe.

## Solucao

### 1. Criar configuracao no banco de dados

Inserir a chave `assistencia_telefone_central` na tabela `configuracoes` com categoria `empresa`, tipo `texto`, editavel, para que apareca automaticamente na tela de Configuracoes do Sistema (aba Empresa).

```sql
INSERT INTO configuracoes (chave, valor, tipo, categoria, descricao, editavel)
VALUES ('assistencia_telefone_central', '0800 980 0001', 'texto', 'empresa', 
        'Telefone 0800 da Assistência 24h (exibido no app e usado pela IA)', true);
```

### 2. Criar hook para buscar o 0800

Criar `src/hooks/useConfig0800.ts` — um hook simples que busca o valor da chave `assistencia_telefone_central` da tabela `configuracoes`, com fallback para `0800 980 0001` e cache de 10 minutos.

### 3. Atualizar arquivos do frontend (5 arquivos)

Substituir todas as ocorrencias hardcoded `08009800001` e `0800 980 0001` pelo valor dinamico do hook:

| Arquivo | Ocorrencias |
|---------|------------|
| `src/pages/app/AppAssistencia.tsx` | 3 (botao, texto, FAB) |
| `src/pages/app/SolicitarAssistencia.tsx` | 2 (link tel, texto) |
| `src/pages/app/AppPlano.tsx` | 4 (detalhes plano, texto, botoes) |
| `src/pages/app/OuvidoriaMenu.tsx` | 2 (link tel, texto) |
| `src/data/planosPrecos.ts` | 1 (constante — manter hardcoded ou remover uso) |

Cada componente importara o hook e usara o valor retornado tanto no `href="tel:..."` quanto no texto visivel.

### 4. Atualizar WhatsApp webhook (hardcoded fallback)

O webhook ja busca `assistencia_telefone_central` (linha 1215). Apenas atualizar as 2 mensagens de erro (linhas 2036 e 2233) que ainda tem `0800 980 0001` hardcoded para usar a mesma variavel `telefoneCentral` — ou buscar da config nessas funcoes tambem.

### 5. Atualizar assistente-chat (se referencia o 0800)

Verificar e atualizar o assistente do App para tambem buscar o telefone da config ao inves de usar hardcoded.

---

## Resultado

- O diretor configura o 0800 em **Configuracoes do Sistema > Empresa > Assistencia Telefone Central**
- O app do associado exibe o numero configurado em todas as telas de assistencia
- A IA do WhatsApp envia o numero configurado quando necessario
- Fallback para `0800 980 0001` caso a config nao exista

