import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaymentStatusBadge } from "@/components/payment-status-badge";
import { createCompute } from "@backend/compute";
import { loadAppData } from "@backend/load-app-data";
import { formatZAR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const data = await loadAppData();
  const {
    balanceForClient,
    clientPaymentStatus,
    getTrip,
    totalPaidForClient,
  } = createCompute(data);
  const rows = data.clients.map((c) => ({
    client: c,
    trip: getTrip(c.tripId)!,
    paid: totalPaidForClient(c.id),
    balance: balanceForClient(c),
    status: clientPaymentStatus(c),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Traveller directory
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Each booking ties to a departure, live balance, and full payment /
          invoice trail.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All travellers</CardTitle>
          <CardDescription>
            Select a name for contact details, package, and receipt history.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead className="hidden md:table-cell">Trip</TableHead>
                <TableHead className="text-right leading-snug lg:whitespace-normal max-w-[8rem]">
                  Total amount to be paid
                </TableHead>
                <TableHead className="text-right">Amount paid</TableHead>
                <TableHead className="text-right leading-snug lg:whitespace-normal max-w-[8rem]">
                  Outstanding amount
                </TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ client, trip, paid, balance, status }) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <Link
                      href={`/clients/${client.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {client.fullName}
                    </Link>
                    <div className="text-xs text-muted-foreground md:hidden">
                      {trip.name}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Link
                      href={`/trips/${trip.id}`}
                      className="text-primary hover:underline"
                    >
                      {trip.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatZAR(client.packagePrice)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-800 dark:text-emerald-300">
                    {formatZAR(paid)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatZAR(balance)}
                  </TableCell>
                  <TableCell>
                    <PaymentStatusBadge status={status} />
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
