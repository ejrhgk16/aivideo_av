import "server-only";

import type { RowDataPacket } from "mysql2";

import { db } from "@/lib/db";
import type { ContentStatus } from "@/lib/metrics";

/** Admin screens call a drama a project and an episode a campaign. */

export type Campaign = {
  uuid: string;
  episodeNumber: number;
  title: string | null;
  durationMs: number;
  pricePoints: number;
  status: ContentStatus;
  publishedAt: Date | null;
};

export type Project = {
  uuid: string;
  title: string;
  shortDescription: string;
  synopsis: string;
  status: ContentStatus;
  publishedAt: Date | null;
  companyName: string;
  genres: string[];
  campaigns: Campaign[];
};

export type CampaignDetail = Campaign & { project: { uuid: string; title: string } };

const PROJECT_COLUMNS = `
  d.id, d.uuid, d.title, d.short_description AS shortDescription, d.synopsis, d.status, d.published_at AS publishedAt,
  pc.name AS companyName,
  (SELECT GROUP_CONCAT(g.name ORDER BY g.display_order SEPARATOR ',')
     FROM drama_genres dg JOIN genres g ON g.id = dg.genre_id
    WHERE dg.drama_id = d.id) AS genres
  FROM dramas d
  JOIN production_companies pc ON pc.id = d.production_company_id`;

const CAMPAIGN_COLUMNS = `
  e.drama_id AS dramaId, e.uuid, e.episode_number AS episodeNumber, e.title, e.duration_ms AS durationMs,
  e.price_points AS pricePoints, e.status, e.published_at AS publishedAt`;

function toCampaign(row: RowDataPacket): Campaign {
  return {
    uuid: row.uuid,
    episodeNumber: row.episodeNumber,
    title: row.title,
    durationMs: row.durationMs,
    pricePoints: row.pricePoints,
    status: row.status,
    publishedAt: row.publishedAt,
  };
}

function toProject(row: RowDataPacket, campaigns: RowDataPacket[]): Project {
  return {
    uuid: row.uuid,
    title: row.title,
    shortDescription: row.shortDescription,
    synopsis: row.synopsis,
    status: row.status,
    publishedAt: row.publishedAt,
    companyName: row.companyName,
    genres: row.genres ? String(row.genres).split(",") : [],
    campaigns: campaigns.filter((campaign) => campaign.dramaId === row.id).map(toCampaign),
  };
}

/** Every project with its campaigns, newest project first. */
export async function listProjects(): Promise<Project[]> {
  const [projects] = await db.query<RowDataPacket[]>(`SELECT ${PROJECT_COLUMNS} ORDER BY d.id DESC`);
  const [campaigns] = await db.query<RowDataPacket[]>(
    `SELECT ${CAMPAIGN_COLUMNS} FROM episodes e ORDER BY e.episode_number`,
  );
  return projects.map((row) => toProject(row, campaigns));
}

export async function getProject(uuid: string): Promise<Project | null> {
  const [projects] = await db.query<RowDataPacket[]>(`SELECT ${PROJECT_COLUMNS} WHERE d.uuid = ?`, [uuid]);
  if (!projects[0]) return null;
  const [campaigns] = await db.query<RowDataPacket[]>(
    `SELECT ${CAMPAIGN_COLUMNS} FROM episodes e WHERE e.drama_id = ? ORDER BY e.episode_number`,
    [projects[0].id],
  );
  return toProject(projects[0], campaigns);
}

export async function getCampaign(uuid: string): Promise<CampaignDetail | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${CAMPAIGN_COLUMNS}, d.uuid AS projectUuid, d.title AS projectTitle
       FROM episodes e JOIN dramas d ON d.id = e.drama_id
      WHERE e.uuid = ?`,
    [uuid],
  );
  const row = rows[0];
  if (!row) return null;
  return { ...toCampaign(row), project: { uuid: row.projectUuid, title: row.projectTitle } };
}
