import type { ProjectMetadata, ProjectMetadataStore } from "@/data/projectMetadata";

async function parse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload;
}

export async function loadProjectMetadata(): Promise<ProjectMetadataStore> {
  const result = await parse<{ metadata: ProjectMetadataStore }>(
    await fetch("/api/project-metadata", { cache: "no-store" }),
  );
  return result.metadata;
}

export async function saveProjectMetadata(projectId: string, metadata: ProjectMetadata) {
  await parse<{ metadata: ProjectMetadata }>(await fetch("/api/project-metadata", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, metadata }),
  }));
}

export async function deleteProjectMetadata(projectId: string) {
  const query = new URLSearchParams({ projectId });
  await parse<{ success: true }>(await fetch(`/api/project-metadata?${query}`, { method: "DELETE" }));
}
