"use server";

import { refresh } from "next/cache";

import { requireOperator } from "@/lib/auth";
import { getProject } from "@/lib/catalog";
import { saveUpload } from "@/lib/upload";
import { parseReleaseAt, validateUpload, type UploadErrors, type UploadInput } from "@/lib/uploadValidation";

export type UploadState = {
  errors?: UploadErrors;
  /** Shown when saving failed for a reason the operator cannot fix in a field. */
  message?: string;
  saved?: { projectUuid: string; summary: string };
};

export async function submitUpload(_previous: UploadState, formData: FormData): Promise<UploadState> {
  await requireOperator();
  const text = (key: keyof UploadInput) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };
  const input: UploadInput = {
    mode: text("mode") === "existing" ? "existing" : "new",
    projectTitle: text("projectTitle"),
    companyUuid: text("companyUuid"),
    genreId: text("genreId"),
    description: text("description"),
    posterName: text("posterName"),
    projectUuid: text("projectUuid"),
    episodeNumber: text("episodeNumber"),
    campaignTitle: text("campaignTitle"),
    videoName: text("videoName"),
    durationMs: text("durationMs"),
    price: text("price"),
    releaseAt: text("releaseAt"),
  };

  try {
    const existing = input.mode === "existing" && input.projectUuid ? await getProject(input.projectUuid) : null;
    const episodeNumbers = existing?.campaigns.map((campaign) => campaign.episodeNumber) ?? [];
    const errors = validateUpload(input, episodeNumbers, new Date());
    const releaseAt = parseReleaseAt(input.releaseAt);
    // Errors can come from a stale tab, so re-render with the current projects and episode numbers.
    if (Object.keys(errors).length || !releaseAt) {
      refresh();
      return { errors };
    }

    const campaignTitle = input.campaignTitle.trim();
    const result = await saveUpload({
      newProject:
        input.mode === "new"
          ? {
              title: input.projectTitle.trim(),
              companyUuid: input.companyUuid,
              genreId: input.genreId,
              description: input.description.trim(),
            }
          : null,
      projectUuid: input.projectUuid,
      episodeNumber: Number(input.episodeNumber),
      campaignTitle,
      durationMs: Number(input.durationMs),
      pricePoints: Number(input.price),
      releaseAt,
    });
    if ("errors" in result) {
      refresh();
      return { errors: result.errors };
    }

    // Re-render this page so the project list and taken episode numbers include the new rows.
    refresh();
    return {
      saved: {
        projectUuid: result.project.uuid,
        summary: `${result.project.title} · ${input.episodeNumber}화 ${campaignTitle} · ${input.videoName}`,
      },
    };
  } catch (error) {
    console.error(error);
    return { message: "저장하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
}
