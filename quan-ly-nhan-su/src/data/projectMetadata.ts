import type { Project } from "@/data/projects";

export type ProjectMetadata = {
  status: Project["status"];
  personnelIds: string[];
  machineTypes: string[];
  weldTypes: string[];
  railTypes: string[];
  /** Ngày nghỉ ISO yyyy-mm-dd */
  offDays?: string[];
};

export type ProjectMetadataStore = Record<string, ProjectMetadata>;
