

# Padronizar Auto-Preenchimento de CEP nos Formularios

## Situacao Atual

Os tres formularios ja possuem logica de auto-preenchimento de CEP via `buscarCep`, porem com implementacoes inconsistentes:

| Formulario | Componente CEP | Mascara | Auto-fill |
|---|---|---|---|
| Oficina (NovaOficinaModal) | `CepInput` (masked) | Sim (00000-000) | Funciona via `onCepComplete` |
| Auto Center (AutoCenterFormDialog) | `Input` (plain) | Nao | Via `onBlur` mas sem mascara |
| Prestador (PrestadorFormDialog) | `Input` (plain) | Nao | Via `onBlur` mas sem mascara |

## Problema

Os formularios de Auto Center e Prestador usam um `Input` simples sem mascara de CEP. Isso causa:
- Experiencia inconsistente entre os formularios
- Sem formatacao visual (00000-000)
- O usuario pode nao perceber que o auto-preenchimento funciona

## Correcao

Substituir o `Input` por `CepInput` nos dois formularios que ainda usam campo de texto simples, garantindo:
- Mascara visual 00000-000
- Auto-preenchimento automatico ao completar 8 digitos (via `onCepComplete`)
- Indicador visual de loading enquanto busca o CEP

### Arquivos a Modificar

| Arquivo | Alteracao |
|---|---|
| `src/components/oficinas/AutoCenterFormDialog.tsx` | Trocar `Input` do CEP por `CepInput` com mascara e callback `onCepComplete`; adicionar estado `buscandoCep` para loading |
| `src/components/oficinas/PrestadorFormDialog.tsx` | Mesmo ajuste: trocar `Input` por `CepInput` com mascara e loading |

### Detalhes Tecnicos

Em ambos os arquivos:
1. Importar `CepInput` de `@/components/inputs/MaskedInputs`
2. Adicionar estado `const [buscandoCep, setBuscandoCep] = useState(false)`
3. Adaptar `handleCepBlur` para receber o CEP como parametro (padrao do `onCepComplete`) e incluir loading
4. No campo CEP do formulario, substituir `<Input {...field} onBlur={handleCepBlur} />` por `<CepInput value={field.value || ''} onChange={field.onChange} onCepComplete={handleCepBlur} disabled={buscandoCep} />`

Nenhuma alteracao de banco de dados e necessaria.
