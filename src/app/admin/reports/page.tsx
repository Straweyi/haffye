import { getAuditLogs } from "@/lib/queries/admin";
import { formatDateTime } from "@/lib/format";
import { ExportPanel } from "@/components/admin/export-panel";
import { Badge } from "@/components/ui/badge";
import { EmptyRow, PageHeader, Section, TableWrap, tableCls, tdCls, thCls } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  const logs = await getAuditLogs(100);

  return (
    <>
      <PageHeader title="Reports & Operational Logs" subtitle="Export database reports to CSV and inspect system audit logs." />

      <div className="space-y-5">
        <Section title="Export CSV Reports">
          <ExportPanel />
        </Section>

        <Section title={`Operational Audit Logs (latest ${logs.length})`}>
          {logs.length === 0 ? (
            <EmptyRow />
          ) : (
            <TableWrap>
              <table className={tableCls}>
                <thead>
                  <tr>
                    <th className={thCls}>Time</th>
                    <th className={thCls}>Actor</th>
                    <th className={thCls}>Action</th>
                    <th className={thCls}>Entity</th>
                    <th className={thCls}>Metadata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-coffee/10">
                  {logs.map((l) => (
                    <tr key={l.id}>
                      <td className={tdCls}>{formatDateTime(l.created_at)}</td>
                      <td className={`${tdCls} font-semibold`}>{l.actor}</td>
                      <td className={tdCls}>
                        <Badge variant="outline">{l.action}</Badge>
                      </td>
                      <td className={tdCls}>
                        {l.entity}
                        {l.entity_id ? ` (${l.entity_id.slice(0, 8)}…)` : ""}
                      </td>
                      <td className={`${tdCls} max-w-[260px] truncate text-[11px] text-coffee`}>
                        {Object.keys(l.metadata ?? {}).length > 0 ? JSON.stringify(l.metadata) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Section>
      </div>
    </>
  );
}
