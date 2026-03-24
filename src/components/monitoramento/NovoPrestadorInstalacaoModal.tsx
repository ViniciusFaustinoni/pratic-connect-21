import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { ChevronDown, Search } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  prestador?: any;
}

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

export function NovoPrestadorInstalacaoModal({ open, onClose, onSuccess, prestador }: Props) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [municipiosSelecionados, setMunicipiosSelecionados] = useState<string[]>([]);
  const [ativo, setAtivo] = useState(true);
  const [busca, setBusca] = useState('');
  const [estadosAbertos, setEstadosAbertos] = useState<string[]>([]);

  const { data: municipiosIBGE = [] } = useQuery({
    queryKey: ['municipios-ibge-todos'],
    queryFn: async () => {
      const res = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome');
      if (!res.ok) throw new Error('Erro ao buscar municípios do IBGE');
      return res.json() as Promise<MunicipioIBGE[]>;
    },
    staleTime: 1000 * 60 * 60 * 24, // 24h
  });

  const municipiosAgrupados = useMemo(() => {
    const mapa: Record<string, string[]> = {};
    for (const m of municipiosIBGE) {
      const uf = m.microrregiao.mesorregiao.UF.sigla;
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

  useEffect(() => {
    if (prestador) {
      setNome(prestador.nome || '');
      setWhatsapp(prestador.whatsapp || '');
      setMunicipiosSelecionados(prestador.municipios_atuacao || []);
      setAtivo(prestador.ativo ?? true);
    } else {
      setNome('');
      setWhatsapp('');
      setMunicipiosSelecionados([]);
      setAtivo(true);
    }
    setBusca('');
    setEstadosAbertos([]);
  }, [prestador, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        nome,
        whatsapp: whatsapp || null,
        municipios_atuacao: municipiosSelecionados,
        ativo,
        updated_at: new Date().toISOString(),
      };

      if (prestador?.id) {
        const { error } = await (supabase as any)
          .from('prestadores_instalacao')
          .update(payload)
          .eq('id', prestador.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('prestadores_instalacao')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prestadores-parceiros'] });
      toast.success(prestador ? 'Prestador atualizado' : 'Prestador cadastrado');
      onSuccess();
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  const formatKey = (cidade: string, uf: string) => `${cidade} - ${uf}`;

  const toggleMunicipio = (cidade: string, uf: string) => {
    const key = formatKey(cidade, uf);
    setMunicipiosSelecionados(prev =>
      prev.includes(key) ? prev.filter(m => m !== key) : [...prev, key]
    );
  };

  const toggleEstado = (uf: string, cidades: string[]) => {
    const keys = cidades.map(c => formatKey(c, uf));
    const todosSelecionados = keys.every(k => municipiosSelecionados.includes(k));
    if (todosSelecionados) {
      setMunicipiosSelecionados(prev => prev.filter(m => !keys.includes(m)));
    } else {
      setMunicipiosSelecionados(prev => [...new Set([...prev, ...keys])]);
    }
  };

  const toggleEstadoAberto = (uf: string) => {
    setEstadosAbertos(prev =>
      prev.includes(uf) ? prev.filter(e => e !== uf) : [...prev, uf]
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{prestador ? 'Editar Prestador' : 'Novo Prestador de Instalação'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome / Razão Social *</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do prestador" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input id="whatsapp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(21) 99999-9999" />
          </div>

          <div className="space-y-2">
            <Label>Municípios de Atuação ({municipiosSelecionados.length} selecionados)</Label>
            {municipiosSelecionados.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2 max-h-20 overflow-y-auto">
                {municipiosSelecionados.map(m => (
                  <Badge key={m} variant="secondary" className="text-xs cursor-pointer" onClick={() => {
                    setMunicipiosSelecionados(prev => prev.filter(x => x !== m));
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
                    const todosSel = keys.every(k => municipiosSelecionados.includes(k));
                    const algunsSel = !todosSel && keys.some(k => municipiosSelecionados.includes(k));
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
                                  checked={municipiosSelecionados.includes(formatKey(cidade, uf))}
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

          <div className="flex items-center justify-between">
            <Label htmlFor="ativo">Ativo</Label>
            <Switch id="ativo" checked={ativo} onCheckedChange={setAtivo} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={!nome.trim() || mutation.isPending}>
            {mutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
