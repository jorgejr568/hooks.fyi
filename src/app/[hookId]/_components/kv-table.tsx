interface Props {
  data: Record<string, string | string[]>;
  emptyLabel: string;
}

export function KvTable({ data, emptyLabel }: Props) {
  const entries = Object.entries(data);
  if (entries.length === 0) {
    return (
      <p className="px-1 py-4 text-sm text-muted-foreground">{emptyLabel}</p>
    );
  }
  return (
    <div className="overflow-hidden rounded-md border border-border/50">
      <table className="w-full text-sm">
        <tbody className="divide-y divide-border/40">
          {entries.map(([k, v]) => (
            <tr key={k} className="align-top">
              <th className="w-1/3 bg-muted/30 px-3 py-2 text-left font-mono text-xs font-medium text-muted-foreground">
                {k}
              </th>
              <td className="px-3 py-2 font-mono text-xs">
                {Array.isArray(v) ? (
                  v.map((item, i) => (
                    <div key={i} className="break-all">
                      {item}
                    </div>
                  ))
                ) : (
                  <span className="break-all">{v}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
