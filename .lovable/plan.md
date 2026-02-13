

# Corrigir mensagem de boas-vindas baseada no status real da instalacao

## Problema

Quando o analista aprova a proposta, o sistema **sempre** envia o template `proposta_aprovada_roubo_furto`, independentemente de a instalacao ja ter sido concluida. Isso causa:

- Diz "Cobertura Ativa: Roubo e Furto" quando na verdade a cobertura total ja esta ativa
- Diz "Proximo Passo: Instalacao do rastreador" quando a instalacao ja foi feita
- Inclui texto "Apos a instalacao, sua Cobertura Total sera ativada automaticamente!" desnecessariamente
- Nao orienta o associado a usar a IA para duvidas sobre cobertura

## Solucao

### 1. Criar template `proposta_aprovada_cobertura_total` no `notificar-cliente`

**Arquivo**: `supabase/functions/notificar-cliente/index.ts`

Adicionar novo template para quando a instalacao ja foi concluida:

```
Parabens {nome}! Seu cadastro foi aprovado! 

Veiculo Protegido:
{placa} - {marca} {modelo}

Cobertura Ativa: Cobertura Total (Roubo, Furto, Colisao, Incendio e mais)

Proximo Passo: Crie sua senha e acesse o App PRATIC

Acesse o link abaixo para criar sua conta:
{link_acompanhamento}

Para qualquer duvida sobre sua cobertura, assistencia 24h ou sinistros, 
voce pode falar com nossa IA diretamente pelo app ou por aqui no WhatsApp!

Bem-vindo a familia PRATIC!
```

### 2. Escolher template correto ao notificar

**Arquivo**: `src/hooks/usePropostasPendentes.ts` (linha 1644)

Usar `jaTemInstalacaoConcluida` para selecionar o template:

```
tipo: jaTemInstalacaoConcluida 
  ? 'proposta_aprovada_cobertura_total' 
  : 'proposta_aprovada_roubo_furto'
```

### 3. Ajustar template existente `proposta_aprovada_roubo_furto`

Adicionar orientacao sobre a IA ao final da mensagem existente:

```
Para qualquer duvida sobre sua cobertura, voce pode falar 
com nossa IA diretamente pelo app ou por aqui no WhatsApp!
```

## Arquivos modificados

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/notificar-cliente/index.ts` | Novo template `proposta_aprovada_cobertura_total` + ajuste no template roubo/furto |
| `src/hooks/usePropostasPendentes.ts` | Selecionar template correto baseado em `jaTemInstalacaoConcluida` |

