import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  cookiesFromHeaders,
  type ParsedCookie,
} from "@/lib/http/parse-set-cookie";

type ResponseCookiesTableProps = {
  headers: [string, string][];
};

function attribute(value: string | undefined) {
  return value || "—";
}

function expiration(cookie: ParsedCookie) {
  return cookie.maxAge !== undefined
    ? `Max-Age=${cookie.maxAge}`
    : attribute(cookie.expires);
}

function Flag({ present }: { present: boolean }) {
  return (
    <Badge
      aria-label={present ? "Present" : "Absent"}
      className="font-mono"
      variant="outline"
    >
      {present ? "✓" : "—"}
    </Badge>
  );
}

export function ResponseCookiesTable({
  headers,
}: ResponseCookiesTableProps) {
  const cookies = cookiesFromHeaders(headers);

  if (cookies.length === 0) {
    return (
      <div className="grid min-h-48 place-items-center px-4 text-center">
        <div>
          <p className="font-medium">No cookies set</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            The browser may hide Set-Cookie headers until the request uses the
            relay.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Table className="font-mono">
      <TableHeader>
        <TableRow>
          <TableHead className="px-4">Name</TableHead>
          <TableHead className="px-4">Value</TableHead>
          <TableHead className="px-4">Domain</TableHead>
          <TableHead className="px-4">Path</TableHead>
          <TableHead className="px-4">Expires</TableHead>
          <TableHead className="px-4">Secure</TableHead>
          <TableHead className="px-4">HttpOnly</TableHead>
          <TableHead className="px-4">SameSite</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cookies.map((cookie, index) => (
          <TableRow key={`${cookie.name}-${index}`}>
            <TableCell className="px-4 align-top font-medium whitespace-normal break-all">
              {cookie.name || "—"}
            </TableCell>
            <TableCell className="min-w-48 max-w-sm px-4 align-top whitespace-pre-wrap break-all">
              {cookie.value}
            </TableCell>
            <TableCell className="px-4 align-top whitespace-normal break-all">
              {attribute(cookie.domain)}
            </TableCell>
            <TableCell className="px-4 align-top whitespace-normal break-all">
              {attribute(cookie.path)}
            </TableCell>
            <TableCell className="px-4 align-top whitespace-normal">
              {expiration(cookie)}
            </TableCell>
            <TableCell className="px-4 align-top">
              <Flag present={cookie.secure} />
            </TableCell>
            <TableCell className="px-4 align-top">
              <Flag present={cookie.httpOnly} />
            </TableCell>
            <TableCell className="px-4 align-top">
              {cookie.sameSite ? (
                <Badge className="font-mono" variant="outline">
                  {cookie.sameSite}
                </Badge>
              ) : (
                "—"
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
