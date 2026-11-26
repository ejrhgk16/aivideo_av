import "server-only";

import { randomUUID } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";

import { listProjects } from "@/lib/catalog";
import { db } from "@/lib/db";
import type { UploadErrors } from "@/lib/uploadValidation";

export type UploadOptions = {
  companies: { uuid: string; name: string }[];
  genres: { id: number; name: string }[];
  /** Newest first, with the episode numbers already taken. */
  projects: { uuid: string; title: string; episodeNumbers: number[] }[];
};

export async function loadUploadOptions(): Promise<UploadOptions> {
  const [[companies], [genres], projects] = await Promise.all([
    db.query<RowDataPacket[]>("SELECT uuid, name FROM production_companies WHERE status = 'ACTIVE' ORDER BY name"),
    db.query<RowDataPacket[]>("SELECT id, name FROM genres ORDER BY display_order"),
    listProjects(),
  ]);
  return {
    companies: companies.map((row) => ({ uuid: row.uuid, name: row.name })),
    genres: genres.map((row) => ({ id: row.id, name: row.name })),
    projects: projects.map((project) => ({
      uuid: project.uuid,
      title: project.title,
      episodeNumbers: project.campaigns.map((campaign) => campaign.episodeNumber),
    })),
  };
}

/** Validated values. newProject is null when the campaign is added to the existing project projectUuid. */
export type UploadRecord = {
  newProject: { title: string; companyUuid: string; genreId: string; description: string } | null;
  projectUuid: string;
  episodeNumber: number;
  campaignTitle: string;
  durationMs: number;
  pricePoints: number;
  releaseAt: Date;
};

export type UploadResult = { errors: UploadErrors } | { project: { uuid: string; title: string } };

const isDuplicateEpisode = (error: unknown) =>
  error instanceof Error &&
  "code" in error &&
  error.code === "ER_DUP_ENTRY" &&
  error.message.includes("uq_episodes_drama_id_episode_number");

/** Saves everything as SCHEDULED in one transaction. The public app only serves PUBLISHED rows. */
export async function saveUpload(record: UploadRecord): Promise<UploadResult> {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const result = await insertRows(connection, record);
    await ("errors" in result ? connection.rollback() : connection.commit());
    return result;
  } catch (error) {
    await connection.rollback();
    if (isDuplicateEpisode(error)) return { errors: { episodeNumber: "이미 있는 회차 번호예요." } };
    throw error;
  } finally {
    connection.release();
  }
}

async function insertRows(connection: PoolConnection, record: UploadRecord): Promise<UploadResult> {
  let project: { id: number; uuid: string; title: string };
  if (record.newProject) {
    const { title, companyUuid, genreId, description } = record.newProject;
    const [companies] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM production_companies WHERE uuid = ? AND status = 'ACTIVE'",
      [companyUuid],
    );
    const [genres] = await connection.query<RowDataPacket[]>("SELECT id FROM genres WHERE id = ?", [genreId]);
    const errors: UploadErrors = {};
    if (!companies[0]) errors.company = "선택한 제작사를 쓸 수 없어요. 다시 선택해 주세요.";
    if (!genres[0]) errors.genre = "선택한 장르를 찾지 못했어요. 다시 선택해 주세요.";
    if (!companies[0] || !genres[0]) return { errors };

    const uuid = randomUUID();
    const [drama] = await connection.query<ResultSetHeader>(
      `INSERT INTO dramas (uuid, production_company_id, public_slug, title, short_description, synopsis, status, published_at)
       VALUES (?, ?, ?, ?, ?, ?, 'SCHEDULED', ?)`,
      [uuid, companies[0].id, uuid, title, [...description].slice(0, 300).join(""), description, record.releaseAt],
    );
    await connection.query("INSERT INTO drama_genres (drama_id, genre_id) VALUES (?, ?)", [drama.insertId, genres[0].id]);
    project = { id: drama.insertId, uuid, title };
  } else {
    // The lock keeps concurrent uploads to the same project in line.
    const [rows] = await connection.query<RowDataPacket[]>("SELECT id, title FROM dramas WHERE uuid = ? FOR UPDATE", [
      record.projectUuid,
    ]);
    if (!rows[0]) return { errors: { project: "선택한 프로젝트를 찾지 못했어요. 다시 선택해 주세요." } };
    project = { id: rows[0].id, uuid: record.projectUuid, title: rows[0].title };
  }

  await connection.query(
    `INSERT INTO episodes (uuid, drama_id, episode_number, title, synopsis, duration_ms, price_points, status, published_at)
     VALUES (?, ?, ?, ?, NULL, ?, ?, 'SCHEDULED', ?)`,
    [
      randomUUID(),
      project.id,
      record.episodeNumber,
      record.campaignTitle,
      record.durationMs,
      record.pricePoints,
      record.releaseAt,
    ],
  );
  return { project: { uuid: project.uuid, title: project.title } };
}
