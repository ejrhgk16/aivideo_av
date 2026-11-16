import { randomUUID } from 'node:crypto';

const PAST = 'DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 DAY)';
const FUTURE = 'DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 1 DAY)';

export function createSubtitleFixtures({ db, runId }) {
  const owned = { dramas: [], episodes: [], videos: [], subtitles: [], episodeIds: [] };
  let cleaned = false;

  async function addDrama(companyId, name, status, publishedAt) {
    const uuid = randomUUID();
    owned.dramas.push(uuid);
    const [result] = await db.execute(
      `INSERT INTO dramas (uuid, production_company_id, public_slug, title, short_description, synopsis,
        status, published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'Subtitle API fixture', 'Subtitle API fixture', ?, ${publishedAt}, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [uuid, companyId, `api-subtitles-${runId}-${uuid}`, `API subtitles ${name} ${runId}`, status],
    );
    if (result.affectedRows !== 1 || !result.insertId) throw new Error('Could not create an owned subtitle-fixture drama.');
    return { id: result.insertId, uuid };
  }

  async function addEpisode(drama, name, { status = 'PUBLISHED', publishedAt = PAST, pricePoints = 0 } = {}) {
    const uuid = randomUUID();
    owned.episodes.push(uuid);
    const [result] = await db.execute(
      `INSERT INTO episodes (uuid, drama_id, episode_number, title, synopsis, duration_ms, price_points,
        status, published_at, created_at, updated_at)
       VALUES (?, ?, 1, ?, 'Subtitle API fixture', 60000, ?, ?, ${publishedAt}, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [uuid, drama.id, `API subtitles ${name}`, pricePoints, status],
    );
    if (result.affectedRows !== 1 || !result.insertId) throw new Error('Could not create an owned subtitle-fixture episode.');
    owned.episodeIds.push(result.insertId);
    const videoUuid = randomUUID();
    owned.videos.push(videoUuid);
    const [videoResult] = await db.execute(
      `INSERT INTO content_videos (uuid, content_type, content_id, kind, storage_key, duration_ms,
        display_order, created_at, updated_at)
       VALUES (?, 'EPISODE', ?, 'FULL', ?, 60000, 1, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [videoUuid, result.insertId, `api-subtitles/${runId}/${videoUuid}.m3u8`],
    );
    if (videoResult.affectedRows !== 1) throw new Error('Could not create an owned subtitle-fixture video.');
    return { id: result.insertId, uuid };
  }

  async function addSubtitle(episode, languageCode, format) {
    const uuid = randomUUID();
    owned.subtitles.push(uuid);
    const [result] = await db.execute(
      `INSERT INTO episode_subtitles (uuid, episode_id, language_code, format, storage_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [uuid, episode.id, languageCode, format, `api-subtitles/${runId}/${episode.uuid}/${languageCode}.${format.toLowerCase()}`],
    );
    if (result.affectedRows !== 1) throw new Error('Could not create an owned subtitle fixture.');
  }

  async function addEpisodeFixture(companyId, name, episodeOptions, languages = [['en', 'SRT'], ['ko', 'VTT']]) {
    const drama = await addDrama(companyId, name, episodeOptions.dramaStatus ?? 'PUBLISHED', episodeOptions.dramaPublishedAt ?? PAST);
    const episode = await addEpisode(drama, name, episodeOptions);
    for (const [languageCode, format] of languages) await addSubtitle(episode, languageCode, format);
    return episode.uuid;
  }

  return {
    async prepare({ fixtureContext, entitled, unentitled }) {
      if (entitled.id === unentitled.id) throw new Error('Subtitle API fixture users must be distinct.');
      const [companyRows] = await db.execute(
        `SELECT production_company_id FROM dramas
         WHERE status = 'PUBLISHED' AND published_at IS NOT NULL AND published_at <= UTC_TIMESTAMP(3)
         ORDER BY id LIMIT 1`,
      );
      if (!companyRows[0]) throw new Error('A published drama is required as the subtitle-fixture company template.');
      const companyId = companyRows[0].production_company_id;
      const values = {
        subtitleFreeEpisodeUuid: await addEpisodeFixture(companyId, 'free', {}),
        subtitlePaidEpisodeUuid: await addEpisodeFixture(companyId, 'paid', { pricePoints: 100 }),
        subtitleEmptyEpisodeUuid: await addEpisodeFixture(companyId, 'empty', {}, []),
        subtitleEnglishOnlyEpisodeUuid: await addEpisodeFixture(companyId, 'english-only', {}, [['en', 'SRT']]),
        subtitleHiddenEpisodeUuid: await addEpisodeFixture(companyId, 'hidden-episode', { status: 'HIDDEN' }),
        subtitleFutureEpisodeUuid: await addEpisodeFixture(companyId, 'future-episode', { publishedAt: FUTURE }),
        subtitleHiddenDramaEpisodeUuid: await addEpisodeFixture(companyId, 'hidden-drama', { dramaStatus: 'HIDDEN' }),
        subtitleFutureDramaEpisodeUuid: await addEpisodeFixture(companyId, 'future-drama', { dramaPublishedAt: FUTURE }),
      };
      const [paidRows] = await db.execute('SELECT id FROM episodes WHERE uuid = ?', [values.subtitlePaidEpisodeUuid]);
      if (!paidRows[0]) throw new Error('Could not resolve the owned paid subtitle-fixture episode.');
      await fixtureContext.grantEpisode(entitled.id, paidRows[0].id);
      return values;
    },
    async cleanup() {
      if (cleaned) return;
      const errors = [];
      const attempt = async action => {
        try { await action(); } catch (error) { errors.push(error); }
      };
      if (owned.episodeIds.length) {
        await attempt(() => db.execute(
          `DELETE FROM episode_entitlements WHERE episode_id IN (${owned.episodeIds.map(() => '?').join(',')})`,
          owned.episodeIds,
        ));
      }
      for (const uuid of [...owned.subtitles].reverse()) {
        await attempt(() => db.execute('DELETE FROM episode_subtitles WHERE uuid = ?', [uuid]));
      }
      for (const uuid of [...owned.videos].reverse()) {
        await attempt(() => db.execute('DELETE FROM content_videos WHERE uuid = ?', [uuid]));
      }
      for (const uuid of [...owned.episodes].reverse()) {
        await attempt(() => db.execute('DELETE FROM episodes WHERE uuid = ?', [uuid]));
      }
      for (const uuid of [...owned.dramas].reverse()) {
        await attempt(() => db.execute('DELETE FROM dramas WHERE uuid = ?', [uuid]));
      }
      for (const [table, uuids] of [
        ['episode_subtitles', owned.subtitles], ['content_videos', owned.videos],
        ['episodes', owned.episodes], ['dramas', owned.dramas],
      ]) {
        if (!uuids.length) continue;
        await attempt(async () => {
          const [rows] = await db.execute(
            `SELECT uuid FROM ${table} WHERE uuid IN (${uuids.map(() => '?').join(',')})`, uuids,
          );
          if (rows.length) throw new Error(`Run-owned ${table} fixture remains after cleanup.`);
        });
      }
      if (owned.episodeIds.length) {
        await attempt(async () => {
          const [rows] = await db.execute(
            `SELECT episode_id FROM episode_entitlements WHERE episode_id IN (${owned.episodeIds.map(() => '?').join(',')})`,
            owned.episodeIds,
          );
          if (rows.length) throw new Error('Run-owned subtitle-fixture entitlements remain after cleanup.');
        });
      }
      if (errors.length) throw new AggregateError(errors, 'Could not clean every owned subtitle fixture.');
      cleaned = true;
    },
  };
}
