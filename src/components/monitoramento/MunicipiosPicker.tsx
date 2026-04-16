import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { ChevronDown, Search } from 'lucide-react';

interface MunicipioIBGE {
  nome: string;
  microrregiao: {
    mesorregiao: {
      UF: {
        sigla: string;
        nome: string;
      };
    };
  };
}

interface MunicipiosPickerProps {
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
}

export function MunicipiosPicker({ value, onChange, label = 'Municípios de Atuação' }: MunicipiosPickerProps) {
  const [busca, setBusca] = useState('');
  const [estadosAbertos, setEstadosAbertos] = useState<string[]>([]);

  const { data: municipiosIBGE = [] } = useQuery({
    queryKey: ['municipios-ibge-todos'],
    queryFn: async () => {
      const res = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome');
      if (!res.ok) throw new Error('Erro ao buscar municípios do IBGE');
      return res.json() as Promise<MunicipioIBGE[]>;
    },
    staleTime: 1000 * 60 * 60 * 24,
  });

  const municipiosAgrupados = useMemo(() => {
    const mapa: Record<string, string[]> = {};
    for (const m of municipiosIBGE) {
      const uf = m.microrregiao?.mesorregiao?.UF?.sigla;
      if (!uf) continue;
      if (!mapa[uf]) mapa[uf] = [];
      mapa[uf].push(m.nome);
    }
    return Object.entries(mapa).sort(([a], [b]) => a.localeCompare(b));
  }, [municipiosIBGE]);

  const municipiosFiltrados = useMemo(() => {
    if (!busca.trim()) return municipiosAgrupados;
    const termo = busca.toLowerCase();
    return municipiosAgrupados
      .map(([uf, cidades]) => [uf, cidades.filter(c => c.toLowerCase().includes(termo))] as [string, string[]])
      .filter(([, cidades]) => cidades.length > 0);
  }, [municipiosAgrupados, busca]);

  const formatKey = (cidade: string, uf: string) => `${cidade} - ${uf}`;

  const toggleMunicipio = (cidade: string, uf: string) => {
    const key = formatKey(cidade, uf);
    onChange(value.includes(key) ? value.filter(m => m !== key) : [...value, key]);
  };

  const toggleEstado = (uf: string, cidades: string[]) => {
    const keys = cidades.map(c => formatKey(c, uf));
    const todosSelecionados = keys.every(k => value.includes(k));
    if (todosSelecionados) {
      onChange(value.filter(m => !keys.includes(m)));
    } else {
      onChange([...new Set([...value, ...keys])]);
    }
  };

  const toggleEstadoAberto = (uf: string) => {
    setEstadosAbertos(prev =>
      prev.includes(uf) ? prev.filter(e => e !== uf) : [...prev, uf]
    );
  };

  return (
    <div className="space-y-2">
      <Label>{label} ({value.length} selecionados)</Label>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2 max-h-20 overflow-y-auto">
          {value.map(m => (
            <Badge key={m} variant="secondary" className="text-xs cursor-pointer" onClick={() => {
              onChange(value.filter(x => x !== m));
            }}>
              {m} ×
            </Badge>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar cidade..."
          className="pl-8"
        />
      </div>
      <ScrollArea className="h-60 border rounded-md p-2">
        {municipiosFiltrados.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma cidade encontrada.</p>
        ) : (
          <div className="space-y-1">
            {municipiosFiltrados.map(([uf, cidades]) => {
              const keys = cidades.map(c => formatKey(c, uf));
              const todosSel = keys.every(k => value.includes(k));
              const algunsSel = !todosSel && keys.some(k => value.includes(k));
              const aberto = estadosAbertos.includes(uf);

              return (
                <Collapsible key={uf} open={aberto} onOpenChange={() => toggleEstadoAberto(uf)}>
                  <div className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/50">
                    <Checkbox
                      checked={todosSel}
                      className={algunsSel ? 'opacity-60' : ''}
                      onCheckedChange={() => toggleEstado(uf, cidades)}
                    />
                    <CollapsibleTrigger className="flex items-center gap-1 flex-1 text-sm font-medium">
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${aberto ? 'rotate-0' : '-rotate-90'}`} />
                      {uf} ({cidades.length} cidades)
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent>
                    <div className="ml-6 space-y-1 py-1">
                      {cidades.map(cidade => (
                        <div key={cidade} className="flex items-center gap-2">
                          <Checkbox
                            checked={value.includes(formatKey(cidade, uf))}
                            onCheckedChange={() => toggleMunicipio(cidade, uf)}
                          />
                          <span className="text-sm">{cidade}</span>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
