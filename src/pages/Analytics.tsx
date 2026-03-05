import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Activity, MessageSquare, FileText, Users, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface AuditLog {
  id: string;
  query: string;
  category: string | null;
  created_at: string | null;
  user_id: string | null;
}

const COLORS = [
  "hsl(175, 65%, 45%)",
  "hsl(45, 90%, 55%)",
  "hsl(260, 60%, 55%)",
  "hsl(340, 65%, 55%)",
];

export default function Analytics() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState("");
  const [docCount, setDocCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("id, query, category, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(200);
      setLogs(data || []);

      const { count } = await supabase
        .from("documents")
        .select("id", { count: "exact", head: true });
      setDocCount(count || 0);
    };
    load();
  }, []);

  // Category breakdown
  const catCounts: Record<string, number> = {};
  logs.forEach((l) => {
    const cat = l.category || "General Operations";
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  });
  const pieData = Object.entries(catCounts).map(([name, value]) => ({ name, value }));

  // Daily query counts (last 7 days)
  const dailyCounts: Record<string, number> = {};
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dailyCounts[d.toLocaleDateString("en-US", { weekday: "short" })] = 0;
  }
  logs.forEach((l) => {
    if (!l.created_at) return;
    const d = new Date(l.created_at);
    const key = d.toLocaleDateString("en-US", { weekday: "short" });
    if (key in dailyCounts) dailyCounts[key]++;
  });
  const barData = Object.entries(dailyCounts).map(([day, count]) => ({ day, count }));

  // Unique users
  const uniqueUsers = new Set(logs.map((l) => l.user_id).filter(Boolean)).size;

  const filteredLogs = logs.filter((l) =>
    l.query.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 h-[calc(100vh-64px)] overflow-y-auto">
      <h1 className="text-xl font-bold text-foreground mb-6">Analytics Dashboard</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Queries", value: logs.length, icon: MessageSquare, color: "text-primary" },
          { label: "Documents", value: docCount, icon: FileText, color: "text-accent" },
          { label: "Active Users", value: uniqueUsers, icon: Users, color: "text-chart-3" },
          { label: "Categories", value: Object.keys(catCounts).length, icon: Activity, color: "text-chart-4" },
        ].map((stat) => (
          <div key={stat.label} className="glass-panel rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">{stat.label}</span>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="glass-panel rounded-xl p-4">
          <h3 className="text-sm font-medium text-foreground mb-4">Queries (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData}>
              <XAxis dataKey="day" tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(222, 40%, 10%)",
                  border: "1px solid hsl(222, 25%, 18%)",
                  borderRadius: "8px",
                  color: "hsl(210, 20%, 92%)",
                }}
              />
              <Bar dataKey="count" fill="hsl(175, 65%, 45%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-panel rounded-xl p-4">
          <h3 className="text-sm font-medium text-foreground mb-4">Query Categories</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "hsl(222, 40%, 10%)",
                  border: "1px solid hsl(222, 25%, 18%)",
                  borderRadius: "8px",
                  color: "hsl(210, 20%, 92%)",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2 justify-center">
            {pieData.map((d, i) => (
              <span key={d.name} className="text-xs flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="text-muted-foreground">{d.name} ({d.value})</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Audit log table */}
      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">Audit Log</h3>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search queries..."
              className="pl-10 h-8 text-sm bg-secondary/50 border-border/50"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-2 text-xs text-muted-foreground font-medium">Query</th>
                <th className="px-4 py-2 text-xs text-muted-foreground font-medium">Category</th>
                <th className="px-4 py-2 text-xs text-muted-foreground font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id} className="border-b border-border/50 hover:bg-secondary/30">
                  <td className="px-4 py-2 text-foreground truncate max-w-xs">{log.query}</td>
                  <td className="px-4 py-2">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-accent/15 text-accent">
                      {log.category || "General"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">
                    {log.created_at ? new Date(log.created_at).toLocaleString() : "-"}
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                    No audit logs yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
