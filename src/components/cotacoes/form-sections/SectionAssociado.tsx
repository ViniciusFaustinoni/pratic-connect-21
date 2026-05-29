import { Loader2, Mail, Phone, User, UserCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { TelefoneInput } from '@/components/inputs/MaskedInputs';
import { cn } from '@/lib/utils';
import { resolverAssociadoLocalId, type AssociadoSearchResult } from '@/hooks/useResolverAssociadoLocal';

export interface SectionAssociadoProps {
  nomeAssociado: string;
  setNomeAssociado: (v: string) => void;
  telefoneAssociado: string;
  setTelefoneAssociado: (v: string) => void;
  emailAssociado: string;
  setEmailAssociado: (v: string) => void;
  emailAssociadoValido: boolean;

  isIndicacao: boolean;
  setIsIndicacao: (v: boolean) => void;
  indicadorId: string | null;
  setIndicadorId: (v: string | null) => void;
  indicadorNome: string;
  setIndicadorNome: (v: string) => void;
  buscaIndicador: string;
  setBuscaIndicador: (v: string) => void;
  buscandoIndicador: boolean;
  resultadosIndicador: Array<{
    id: string;
    nome: string;
    telefone?: string | null;
    origem_sga?: boolean;
    [k: string]: any;
  }>;
}

export function SectionAssociado(props: SectionAssociadoProps) {
  const {
    nomeAssociado, setNomeAssociado,
    telefoneAssociado, setTelefoneAssociado,
    emailAssociado, setEmailAssociado, emailAssociadoValido,
    isIndicacao, setIsIndicacao,
    indicadorId, setIndicadorId, indicadorNome, setIndicadorNome,
    buscaIndicador, setBuscaIndicador, buscandoIndicador, resultadosIndicador,
  } = props;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <User className="h-4 w-4 text-primary" />
        Dados do Associado
      </h3>

      <div className="space-y-3">
        {/* Nome do Associado */}
        <div className="space-y-1.5">
          <Label className="text-sm">
            Nome do Associado <span className="text-destructive">*</span>
          </Label>
          <Input
            placeholder="Nome completo do associado"
            value={nomeAssociado}
            onChange={(e) => setNomeAssociado(e.target.value)}
            className={cn(
              nomeAssociado.trim().length > 0 && nomeAssociado.trim().length < 3 && "border-destructive"
            )}
          />
          {nomeAssociado.trim().length > 0 && nomeAssociado.trim().length < 3 && (
            <p className="text-xs text-destructive">Nome deve ter pelo menos 3 caracteres</p>
          )}
        </div>

        {/* Telefone/WhatsApp */}
        <div className="space-y-1.5">
          <Label className="text-sm flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5" />
            Telefone/WhatsApp <span className="text-destructive">*</span>
          </Label>
          <TelefoneInput
            value={telefoneAssociado}
            onChange={setTelefoneAssociado}
            className={cn(
              telefoneAssociado.length > 0 && telefoneAssociado.replace(/\D/g, '').length !== 11 && "border-destructive"
            )}
          />
          {telefoneAssociado.length > 0 && telefoneAssociado.replace(/\D/g, '').length !== 11 && (
            <p className="text-xs text-destructive">Telefone deve ter 11 dígitos (DDD + celular)</p>
          )}
        </div>

        {/* E-mail */}
        <div className="space-y-1.5">
          <Label className="text-sm flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            E-mail (opcional)
          </Label>
          <Input
            type="email"
            placeholder="email@exemplo.com"
            value={emailAssociado}
            onChange={(e) => setEmailAssociado(e.target.value)}
            className={cn(
              emailAssociado.trim().length > 0 && !emailAssociadoValido && "border-destructive"
            )}
          />
          {emailAssociado.trim().length > 0 && !emailAssociadoValido && (
            <p className="text-xs text-destructive">E-mail inválido</p>
          )}
        </div>

        {/* Indicação */}
        <div className="col-span-2 space-y-2 pt-1">
          <div className="flex items-center gap-3">
            <Switch
              id="indicacao-switch"
              checked={isIndicacao}
              onCheckedChange={(checked) => {
                setIsIndicacao(checked);
                if (!checked) {
                  setIndicadorId(null);
                  setIndicadorNome('');
                  setBuscaIndicador('');
                }
              }}
            />
            <Label htmlFor="indicacao-switch" className="text-sm cursor-pointer">
              Este cliente foi indicado por um associado?
            </Label>
          </div>

          {isIndicacao && (
            <div className="space-y-2">
              {indicadorId ? (
                <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/50">
                  <UserCheck className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-medium truncate flex-1">{indicadorNome}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => {
                      setIndicadorId(null);
                      setIndicadorNome('');
                      setBuscaIndicador('');
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    placeholder="Buscar por nome, CPF ou telefone..."
                    value={buscaIndicador}
                    onChange={(e) => setBuscaIndicador(e.target.value)}
                    className="pr-8"
                  />
                  {buscandoIndicador && (
                    <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {buscaIndicador.length >= 2 && resultadosIndicador.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
                      {resultadosIndicador.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                          onClick={async () => {
                            try {
                              if (a.origem_sga) {
                                toast.info('Importando indicador do SGA...');
                              }
                              const localId = await resolverAssociadoLocalId(a);
                              setIndicadorId(localId);
                              setIndicadorNome(a.nome);
                              setBuscaIndicador('');
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : 'Não foi possível selecionar este indicador');
                            }
                          }}
                        >
                          <span className="font-medium">{a.nome}</span>
                          {a.telefone && (
                            <span className="text-muted-foreground ml-2 text-xs">{a.telefone}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {buscaIndicador.length >= 2 && !buscandoIndicador && resultadosIndicador.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">Nenhum associado encontrado</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
