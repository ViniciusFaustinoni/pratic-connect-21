

# Preenchimento Automatico de Endereco por CEP no Link do Evento

## O que sera feito

Adicionar um campo de CEP no formulario de endereco do agendamento de vistoria (link do associado). Ao digitar o CEP completo (8 digitos), o sistema buscara automaticamente na API ViaCEP e preenchera os campos de Rua, Bairro e Cidade.

## Detalhes

### Arquivo: `src/components/evento/EventoAgendamento.tsx`

1. **Adicionar campo CEP** antes do campo "Rua / Avenida", com mascara de formatacao (00000-000)
2. **Estado de loading** para indicar que o CEP esta sendo consultado
3. **Auto-preenchimento**: ao digitar 8 digitos, chamar `buscarCep()` de `src/lib/cep.ts` (ja existe no projeto) e preencher automaticamente `rua`, `bairro` e `cidade`
4. **Feedback visual**: mostrar indicador de carregamento durante a busca e mensagem de erro se o CEP nao for encontrado

### Fluxo do usuario

1. Usuario digita o CEP (ex: 22710-045)
2. Sistema busca automaticamente na API ViaCEP
3. Campos Rua, Bairro e Cidade sao preenchidos automaticamente
4. Usuario preenche apenas Numero e Complemento (se necessario)
5. Campos preenchidos automaticamente permanecem editaveis caso o usuario queira ajustar

### Tecnico

- Reutilizar a funcao `buscarCep` de `src/lib/cep.ts` que ja existe no projeto
- Adicionar estado `cep` e `buscandoCep` ao componente
- Mascara de CEP: formatar para `00000-000` durante digitacao
- Disparar busca automatica quando `cep.replace(/\D/g, '').length === 8`

| Arquivo | Alteracao |
|---|---|
| `src/components/evento/EventoAgendamento.tsx` | Adicionar campo CEP com busca automatica e preenchimento dos campos de endereco |

