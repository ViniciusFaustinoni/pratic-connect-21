

# Adicionar Campos para Importacao de Prestadores

## Resumo

Adicionar 5 novos campos ao sistema de prestadores de assistencia: `telefone_extra` na tabela principal e `km_franquia`, `hr_trabalhada`, `hr_parada`, `diaria_base` na tabela de valores. Atualizar o formulario de cadastro/edicao e a pagina de detalhes.

---

## 1. Migration - Novas Colunas

Criar migration SQL adicionando:

**Tabela `prestadores_assistencia`:**
- `telefone_extra` VARCHAR, nullable

**Tabela `prestadores_assistencia_valores`:**
- `km_franquia` NUMERIC, nullable
- `hr_trabalhada` NUMERIC, nullable
- `hr_parada` NUMERIC, nullable
- `diaria_base` NUMERIC, nullable

---

## 2. NovoPrestadorModal.tsx - Aba "Dados Gerais"

Adicionar campo "Telefone Extra" logo apos o grid de Telefone/WhatsApp (linha 627).

- Usar componente `TelefoneInput` (mesma mascara do telefone principal)
- Campo opcional, sem validacao obrigatoria
- Adicionar `telefone_extra` ao schema Zod (string opcional)
- Adicionar ao `buildPayload` (linha 335-358)
- Adicionar ao `form.reset` nos dois useEffects (linhas 218-241 e 243-268)
- Adicionar a interface `PrestadorParaEdicao` (linha 120-144)

---

## 3. NovoPrestadorModal.tsx - Aba "Valores"

Para cada card de servico, adicionar 4 novos campos abaixo dos campos existentes (Valor de Saida/Valor Km ou Valor Fixo):

Layout em grid 2x2:
```text
+-------------------+-------------------+
| KM Franquia       | Hora Trabalhada   |
+-------------------+-------------------+
| Hora Parada       | Diaria Base       |
+-------------------+-------------------+
```

Alteracoes tecnicas:
- Expandir interface `ValorItem` (linha 111-118) com os 4 novos campos
- Atualizar `updateValor` para suportar os novos campos
- Atualizar `saveValores` (linha 360-392) para incluir os novos campos no INSERT
- Atualizar o useEffect de carregamento de valores existentes (linha 273-290) para ler os novos campos
- Renderizar os 4 inputs tipo number dentro de cada card de servico (linhas 978-1013)

---

## 4. PrestadorDetalhe.tsx - Tabela de Valores

Atualizar a tabela de valores (linha 448-486) para exibir as novas colunas:

Adicionar colunas ao TableHeader:
- KM Franquia
- Hr Trabalhada
- Hr Parada
- Diaria Base

Adicionar cells correspondentes ao TableBody.

Tambem exibir `telefone_extra` no card de Dados Cadastrais (linha 377-398), ao lado dos outros botoes de contato.

---

## Arquivos Modificados

| Arquivo | Alteracao |
|---|---|
| Migration SQL (nova) | ALTER TABLE para adicionar 5 colunas |
| src/components/assistencia/NovoPrestadorModal.tsx | Schema, interface, buildPayload, saveValores, formulario (2 locais: aba dados e aba valores) |
| src/pages/assistencia/PrestadorDetalhe.tsx | Interface Prestador, tabela de valores, card de contato |

## O que NAO sera alterado

- Nenhum campo existente sera modificado
- Nenhuma logica de salvamento sera alterada (apenas novos campos adicionados)
- Nenhuma outra tabela sera tocada
- RLS policies permanecem inalteradas

