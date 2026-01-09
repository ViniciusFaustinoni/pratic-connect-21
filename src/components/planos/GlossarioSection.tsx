import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  GLOSSARIO, 
  REGRAS_IMPORTANTES, 
  COTAS_TAXAS, 
  TAXAS_PROCEDIMENTOS 
} from '@/data/planosPrecos';
import { BookOpen, AlertTriangle, DollarSign } from 'lucide-react';

export function GlossarioTermos() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Glossário</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Termos importantes para o consultor
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <Accordion type="multiple" className="w-full">
          {GLOSSARIO.map((item, index) => (
            <AccordionItem key={index} value={`termo-${index}`}>
              <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                {item.termo}
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground">
                  {item.definicao}
                </p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

export function RegrasImportantes() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-500" />
        <h3 className="text-lg font-semibold">Regras Importantes</h3>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {REGRAS_IMPORTANTES.map((regra, index) => (
          <Card 
            key={index}
            className="overflow-hidden border-l-4 border-l-primary"
          >
            <CardHeader className="pb-2 bg-muted/50">
              <CardTitle className="text-sm flex items-center gap-2">
                <span className="text-xl shrink-0">{regra.icone}</span>
                <span className="truncate">{regra.titulo}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <ul className="space-y-1.5">
                {regra.itens.map((item, i) => (
                  <li key={i} className="text-xs text-muted-foreground leading-relaxed">
                    • {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function TabelaCotasTaxas() {
  return (
    <div className="space-y-6">
      {/* Cotas de Participação */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Cotas de Participação</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Categoria</TableHead>
                <TableHead className="text-center font-semibold">% FIPE</TableHead>
                <TableHead className="text-center font-semibold">Mínimo</TableHead>
                <TableHead className="text-center font-semibold">Com Deságio</TableHead>
                <TableHead className="text-center font-semibold">Mín. Deságio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {COTAS_TAXAS.map((cota, index) => (
                <TableRow 
                  key={index}
                  className={index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}
                >
                  <TableCell className="font-medium">{cota.categoria}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{cota.percentual}</Badge>
                  </TableCell>
                  <TableCell className="text-center text-sm">{cota.minimo}</TableCell>
                  <TableCell className="text-center">
                    {cota.comDesagio ? (
                      <Badge variant="outline" className="text-green-600 dark:text-green-400">
                        {cota.comDesagio}
                      </Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {cota.minimoDesagio || '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Alerta sobre Deságio */}
      <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800 dark:text-amber-200">
          Regra do Deságio
        </AlertTitle>
        <AlertDescription className="text-amber-700 dark:text-amber-300 text-sm">
          Quando a cota de participação for inferior a 10% (Passeio 6%, Diesel 6%) e o associado 
          optar pelo <strong>DESÁGIO</strong> (desconto de 10% na mensalidade por uso de adesivo publicitário), 
          a cota de participação passa automaticamente para <strong>8%</strong> com mínimo de <strong>R$2.000</strong>.
        </AlertDescription>
      </Alert>

      {/* Taxas de Procedimentos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Taxas de Procedimentos</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Procedimento</TableHead>
                <TableHead className="text-right font-semibold">Taxa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {TAXAS_PROCEDIMENTOS.map((taxa, index) => (
                <TableRow 
                  key={index}
                  className={index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}
                >
                  <TableCell className="font-medium">{taxa.procedimento}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary">{taxa.taxa}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
