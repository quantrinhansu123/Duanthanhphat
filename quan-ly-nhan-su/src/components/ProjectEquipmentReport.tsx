"use client";
import { useEffect, useState } from "react";
import { loadProjects } from "@/lib/projectsDb";
import { loadProjectEquipment } from "@/lib/projectEquipmentDb";
import type { ProjectEquipment } from "@/lib/projectEquipment";
import ProjectEquipmentTable from "@/components/ProjectEquipmentTable";

export default function ProjectEquipmentReport({ projectNames = [] }: { projectNames?: string[] }) {
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectId, setProjectId] = useState("");
  const [rows, setRows] = useState<ProjectEquipment[]>([]);
  const [status, setStatus] = useState("");
  useEffect(() => { let live = true; loadProjects({ includeProgress: false }).then((r) => { if (live) setProjects(r.projects); }).catch(() => { if (live) setStatus("Không tải được dự án."); }); return () => { live = false; }; }, []);
  const selectedProjects = projectNames.length ? projects.filter((p) => projectNames.includes(p.name) || projectNames.includes(p.id)) : projects.filter((p) => p.id === projectId);
  const ids = selectedProjects.map((p) => p.id).join(",");
  useEffect(() => {
    if (!ids) { setRows([]); return; }
    let live = true; setStatus("Đang tải thiết bị dự án…");
    Promise.all(ids.split(",").map((id) => loadProjectEquipment(id).then((equipment) => equipment.map((m) => ({ ...m, id: `${id}:${m.id}` }))))).then((groups) => {
      if (live) { setRows(groups.flat()); setStatus(""); }
    }).catch((e) => { if (live) { setRows([]); setStatus(e instanceof Error ? e.message : "Không tải được thiết bị."); } });
    return () => { live = false; };
  }, [ids]);
  return <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
    <h2 className="mb-3 text-base font-bold">Máy móc, thiết bị được gán cho dự án</h2>
    {!projectNames.length && <label className="mb-3 block text-sm">Dự án<select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="ml-3 rounded border border-slate-300 p-2"><option value="">Chọn dự án</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
    {status ? <p role="status" className="text-sm text-slate-600">{status}</p> : <ProjectEquipmentTable rows={rows} />}
  </section>;
}
