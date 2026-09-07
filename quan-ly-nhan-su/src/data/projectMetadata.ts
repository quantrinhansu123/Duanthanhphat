import type { Project } from "@/data/projects";

export type ProjectMetadata = {
  status: Project["status"];
  personnelIds: string[];
  machineTypes: string[];
  weldTypes: string[];
  railTypes: string[];
};

export type ProjectMetadataStore = Record<string, ProjectMetadata>;
