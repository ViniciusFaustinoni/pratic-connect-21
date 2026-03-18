

## Remover seção "Aparência" das Configurações

O toggle de tema já existe no header (componente `ThemeToggle`), tornando redundante a seção de Aparência nas configurações.

### Alterações

**1. `src/pages/Configuracoes.tsx`** (aba "sistema")
- Remover o card "Aparência" (linhas 838-894) com os botões Claro/Escuro/Sistema
- Remover imports não utilizados (`Moon`, `Sun`, `Monitor`) se não forem usados em outro lugar do arquivo

**2. `src/pages/configuracoes/Sistema.tsx`**
- Remover o card "Aparência" (linhas 34-70) com os botões de tema
- Remover `tema` do state `config`
- Remover imports `Moon`, `Sun`, `Monitor` se não usados em outro lugar

**3. `src/pages/instalador/InstaladorConfiguracoes.tsx`**
- Remover o card "Aparência" (linhas 102-121) com o switch "Tema escuro"
- Remover state `temaEscuro` e import `Palette`

**4. `src/pages/app/AppConfiguracoes.tsx`**
- Remover a seção "Aparência" (linhas 619+) com o seletor de tema
- O toggle no header do layout do associado já cumpre essa função

