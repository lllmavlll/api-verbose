import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ResponseHeadersTableProps = {
  headers: [string, string][];
};

export function ResponseHeadersTable({
  headers,
}: ResponseHeadersTableProps) {
  if (headers.length === 0) {
    return (
      <div className="grid min-h-48 place-items-center px-4 text-center text-sm text-muted-foreground">
        No response headers available.
      </div>
    );
  }

  const sortedHeaders = headers.toSorted(([left], [right]) =>
    left.localeCompare(right, undefined, { sensitivity: "base" }),
  );

  return (
    <Table className="font-mono">
      <TableHeader>
        <TableRow>
          <TableHead className="w-52 px-4">Name</TableHead>
          <TableHead className="px-4">Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedHeaders.map(([name, value], index) => (
          <TableRow key={`${name}-${index}`}>
            <TableCell className="px-4 align-top font-medium whitespace-normal break-all">
              {name}
            </TableCell>
            <TableCell className="max-w-0 px-4 align-top whitespace-pre-wrap break-all">
              {value}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
