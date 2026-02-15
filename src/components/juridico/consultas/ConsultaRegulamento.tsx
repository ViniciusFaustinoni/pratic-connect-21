import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Search, BookOpen } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { TEMAS_REGULAMENTO } from '@/data/regulamento';

export default function ConsultaRegulamento() {
  const [busca, setBusca] = useState('');

  const temasFiltrados = useMemo(() => {
    if (!busca) return TEMAS_REGULAMENTO;
    const termo = busca.toLowerCase();
    return TEMAS_REGULAMENTO.map(tema => ({
      ...tema,
      artigos: tema.artigos.filter(a =>
        a.numero.toLowerCase().includes(termo) ||
        a.titulo.toLowerCase().includes(termo) ||
        a.texto.toLowerCase().includes(termo)
      ),
    })).filter(t => t.artigos.length > 0);
  }, [busca]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar no regulamento..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-10"
        />
      </div>

      {temasFiltrados.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">Nenhum artigo encontrado para "{busca}".</p>
      ) : (
        <Accordion type="multiple" defaultValue={TEMAS_REGULAMENTO.map(t => t.id)}>
          {temasFiltrados.map(tema => (
            <AccordionItem key={tema.id} value={tema.id}>
              <AccordionTrigger className="text-sm font-semibold">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  {tema.titulo}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-xs text-muted-foreground mb-3">{tema.descricao}</p>
                <div className="space-y-3">
                  {tema.artigos.map(artigo => (
                    <Card key={artigo.numero}>
                      <CardContent className="p-4">
                        <p className="font-medium text-sm mb-1">Art. {artigo.numero} — {artigo.titulo}</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">{artigo.texto}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
