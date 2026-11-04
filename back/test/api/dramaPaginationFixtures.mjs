import { randomUUID } from 'node:crypto';

const STATUS_PUBLISHED = 'PUBLISHED';

export function createDramaPaginationFixtures({ db, runId }) {
  const owned = { dramas: [], dramaIds: [], genres: [], videos: [] };
  let cleaned = false;

  async function addDrama({ companyId, title, status, publishedAt, genreIds = [] }) {
    const uuid = randomUUID();
    owned.dramas.push(uuid);
    const [insert] = await db.execute(
      `INSERT INTO dramas (uuid, production_company_id, public_slug, title, short_description, synopsis,
        status, published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'Temporary catalog fixture', 'Temporary catalog fixture', ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [uuid, companyId, `api-catalog-${runId}-${uuid}`, title, status, publishedAt],
    );
    if (insert.affectedRows !== 1) throw new Error('Could not create an owned catalog drama.');
    const [rows] = await db.execute('SELECT id FROM dramas WHERE uuid = ?', [uuid]);
    const id = rows[0]?.id;
    if (!id) throw new Error('Could not resolve an owned catalog drama.');
    owned.dramaIds.push(id);
    for (const genreId of genreIds) await db.execute('INSERT INTO drama_genres (drama_id, genre_id) VALUES (?, ?)', [id, genreId]);
    return { id, uuid, title };
  }

  return {
    async prepare() {
      const [companyRows] = await db.execute(
        "SELECT production_company_id FROM dramas WHERE status = 'PUBLISHED' AND published_at IS NOT NULL AND published_at <= UTC_TIMESTAMP(3) ORDER BY id LIMIT 1",
      );
      if (!companyRows[0]) throw new Error('A drama is required as the catalog fixture company template.');
      const companyId = companyRows[0].production_company_id;
      const [genreRows] = await db.execute('SELECT id FROM genres ORDER BY id');
      const usedIds = new Set(genreRows.map(row => Number(row.id)));
      let nextGenreId = 1;
      const genreIds = [];
      for (let index = 0; index < 2; index += 1) {
        while (usedIds.has(nextGenreId) && nextGenreId <= 32767) nextGenreId += 1;
        if (nextGenreId > 32767) throw new Error('No unused smallint genre ID is available.');
        const id = nextGenreId;
        usedIds.add(id);
        genreIds.push(id);
        owned.genres.push(id);
        await db.execute('INSERT INTO genres (id, code, name, display_order) VALUES (?, ?, ?, ?)',
          [id, `CATALOG${index}${runId.slice(0, 8)}`.slice(0, 30), `Catalog ${index} ${runId.slice(0, 10)}`.slice(0, 30), 30000 + index]);
        nextGenreId += 1;
      }
      const now = new Date();
      const publishedAt = new Date(now.getTime() - 60_000);
      const allQuery = `API-CATALOG-${runId}-`;
      const publicDramas = [];
      for (let index = 0; index < 31; index += 1) {
        const title = `${allQuery}${index < 30 ? 'thirty-' : ''}${String(index).padStart(2, '0')}${index === 30 ? ' literal%_!' : ''}`;
        publicDramas.push(await addDrama({ companyId, title, status: STATUS_PUBLISHED, publishedAt,
          genreIds: index < 4 ? genreIds : [genreIds[0]] }));
      }
      const hidden = await addDrama({ companyId, title: `${allQuery}hidden`, status: 'HIDDEN', publishedAt, genreIds: [genreIds[0]] });
      const future = await addDrama({ companyId, title: `${allQuery}future`, status: STATUS_PUBLISHED,
        publishedAt: new Date(now.getTime() + 86400_000), genreIds: [genreIds[0]] });
      const undated = await addDrama({ companyId, title: `${allQuery}undated`, status: STATUS_PUBLISHED, publishedAt: null,
        genreIds: [genreIds[0]] });
      const previewUuid = randomUUID();
      owned.videos.push(previewUuid);
      const [previewDrama] = await db.execute('SELECT id FROM dramas WHERE uuid = ?', [publicDramas[30].uuid]);
      await db.execute(`INSERT INTO content_videos
        (uuid, content_type, content_id, kind, storage_key, duration_ms, display_order, created_at, updated_at)
        VALUES (?, 'DRAMA', ?, 'PREVIEW', ?, 60000, 1, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [previewUuid, previewDrama[0].id, `api-catalog/${runId}/preview.mp4`]);
      const publicUuids = publicDramas.map(drama => drama.uuid);
      const [orderedRows] = await db.execute(
        `SELECT uuid FROM dramas WHERE uuid IN (${publicUuids.map(() => '?').join(',')}) ORDER BY published_at DESC, id DESC`,
        publicUuids,
      );
      const expectedUuids = orderedRows.map(row => row.uuid);
      return {
        catalogAllQuery: allQuery,
        catalogThirtyQuery: `${allQuery}thirty-`,
        catalogEmptyQuery: `${allQuery}no-match`,
        catalogTailQuery: publicDramas[0].title,
        catalogLiteralQuery: `${allQuery}30 literal%_!`,
        catalogGenreCodeA: `CATALOG0${runId.slice(0, 8)}`.slice(0, 30),
        catalogGenreCodeB: `CATALOG1${runId.slice(0, 8)}`.slice(0, 30),
        catalogGenreName: `Catalog 0 ${runId.slice(0, 10)}`.slice(0, 30),
        catalogExpectedUuids: JSON.stringify(expectedUuids),
        catalogThirtyExpectedUuids: JSON.stringify(expectedUuids.slice(1)),
        catalogGenreExpectedUuids: JSON.stringify(expectedUuids.slice(-4)),
        catalogLiteralExpectedUuids: JSON.stringify([publicDramas[30].uuid]),
        catalogExcludedUuids: JSON.stringify([hidden.uuid, future.uuid, undated.uuid]),
        catalogPreviewVideoUuid: previewUuid,
        catalogPreviewDramaUuid: publicDramas[30].uuid,
      };
    },
    async cleanup() {
      if (cleaned) return;
      const errors = [];
      for (const uuid of [...owned.videos].reverse()) {
        try { await db.execute('DELETE FROM content_videos WHERE uuid = ?', [uuid]); } catch (error) { errors.push(error); }
      }
      for (const uuid of [...owned.dramas].reverse()) {
        try {
          const [rows] = await db.execute('SELECT id FROM dramas WHERE uuid = ?', [uuid]);
          if (rows[0]) await db.execute('DELETE FROM drama_genres WHERE drama_id = ?', [rows[0].id]);
          await db.execute('DELETE FROM dramas WHERE uuid = ?', [uuid]);
        } catch (error) { errors.push(error); }
      }
      for (const id of [...owned.genres].reverse()) {
        try { await db.execute('DELETE FROM genres WHERE id = ?', [id]); } catch (error) { errors.push(error); }
      }
      for (const [table, column, values] of [
        ['content_videos', 'uuid', owned.videos], ['dramas', 'uuid', owned.dramas], ['genres', 'id', owned.genres],
      ]) {
        if (!values.length) continue;
        try {
          const placeholders = values.map(() => '?').join(',');
          const [rows] = await db.execute(`SELECT ${column} FROM ${table} WHERE ${column} IN (${placeholders})`, values);
          if (rows.length) throw new Error(`Run-owned ${table} fixture remains after cleanup.`);
        } catch (error) { errors.push(error); }
      }
      if (owned.dramaIds.length) {
        try {
          const placeholders = owned.dramaIds.map(() => '?').join(',');
          const [rows] = await db.execute(`SELECT drama_id FROM drama_genres WHERE drama_id IN (${placeholders})`, owned.dramaIds);
          if (rows.length) throw new Error('Run-owned drama_genres fixture remains after cleanup.');
        } catch (error) { errors.push(error); }
      }
      if (errors.length) throw new AggregateError(errors, 'Could not clean every owned drama-pagination fixture.');
      cleaned = true;
    },
  };
}
