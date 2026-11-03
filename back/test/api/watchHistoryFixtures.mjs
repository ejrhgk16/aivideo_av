import { randomUUID } from 'node:crypto';

export async function cleanupWatchHistoryFixtures(db, owned) {
  const errors = [];
  for (const uuid of owned.videos) {
    try { await db.execute('DELETE FROM content_videos WHERE uuid = ?', [uuid]); } catch (error) { errors.push(error); }
  }
  for (const uuid of [...owned.episodes].reverse()) {
    try { await db.execute('DELETE FROM episodes WHERE uuid = ?', [uuid]); } catch (error) { errors.push(error); }
  }
  for (const uuid of owned.images) {
    try { await db.execute('DELETE FROM content_images WHERE uuid = ?', [uuid]); } catch (error) { errors.push(error); }
  }
  for (const uuid of [...owned.dramas].reverse()) {
    try {
      const [rows] = await db.execute('SELECT id FROM dramas WHERE uuid = ?', [uuid]);
      if (rows[0]) await db.execute('DELETE FROM drama_genres WHERE drama_id = ?', [rows[0].id]);
    } catch (error) { errors.push(error); }
    try { await db.execute('DELETE FROM dramas WHERE uuid = ?', [uuid]); } catch (error) { errors.push(error); }
  }
  if (errors.length) throw new AggregateError(errors, 'Could not clean every owned watch-history fixture.');
}

export async function createWatchHistoryFixtures({ db, sourceDramaId }) {
  const owned = { dramas: [], episodes: [], videos: [], images: [] };
  let cleaned = false;

  const addDrama = async ({ title, status = 'PUBLISHED', publishedAt = new Date(), imageKinds = ['POSTER_LANDSCAPE', 'POSTER'] }) => {
    const uuid = randomUUID();
    owned.dramas.push(uuid);
    const [result] = await db.execute(
      `INSERT INTO dramas
        (uuid, production_company_id, public_slug, title, short_description, synopsis, status, published_at, created_at, updated_at)
       SELECT ?, production_company_id, ?, ?, 'Temporary API fixture', 'Temporary API fixture', ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)
       FROM dramas WHERE id = ?`,
      [uuid, `api-test-${uuid}`, title, status, publishedAt, sourceDramaId],
    );
    if (result.affectedRows !== 1) throw new Error('Could not create an owned watch-history drama.');
    const [rows] = await db.execute('SELECT id FROM dramas WHERE uuid = ?', [uuid]);
    const id = rows[0]?.id;
    if (!id) throw new Error('Could not resolve an owned watch-history drama.');
    for (const kind of imageKinds) {
      const imageUuid = randomUUID();
      owned.images.push(imageUuid);
      await db.execute(
        `INSERT INTO content_images
          (uuid, content_type, content_id, kind, storage_key, alt_text, display_order, created_at, updated_at)
         VALUES (?, 'DRAMA', ?, ?, ?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
        [imageUuid, id, kind, `api-test/${imageUuid}.jpg`, null, 1],
      );
    }
    return { uuid, id };
  };

  const addEpisode = async (dramaId, { number = 1, status = 'PUBLISHED', publishedAt = new Date(), price = 0 } = {}) => {
    const uuid = randomUUID();
    owned.episodes.push(uuid);
    await db.execute(
      `INSERT INTO episodes
        (uuid, drama_id, episode_number, title, synopsis, duration_ms, price_points, status, published_at, created_at, updated_at)
       VALUES (?, ?, ?, 'API watch-history fixture', 'Temporary API fixture', 60000, ?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [uuid, dramaId, number, price, status, publishedAt],
    );
    const [rows] = await db.execute('SELECT id FROM episodes WHERE uuid = ?', [uuid]);
    const id = rows[0]?.id;
    if (!id) throw new Error('Could not resolve an owned watch-history episode.');
    return { uuid, id };
  };

  const addVideo = async (contentType, contentId, kind, displayOrder, durationMs = 60000) => {
    const uuid = randomUUID();
    owned.videos.push(uuid);
    await db.execute(
      `INSERT INTO content_videos
        (uuid, content_type, content_id, kind, storage_key, duration_ms, display_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [uuid, contentType, contentId, kind, `api-test/${uuid}.mp4`, durationMs, displayOrder],
    );
    const [rows] = await db.execute('SELECT id FROM content_videos WHERE uuid = ?', [uuid]);
    const id = rows[0]?.id;
    if (!id) throw new Error('Could not resolve an owned watch-history video.');
    return { uuid, id, durationMs };
  };

  try {
    const drama = await addDrama({ title: 'API watch-history fixture' });
    const episode = await addEpisode(drama.id);
    const [orders] = await db.execute(
      "SELECT COALESCE(MAX(display_order), 0) AS max_order FROM content_videos WHERE content_type = 'EPISODE' AND content_id = ? AND kind = 'FULL'",
      [episode.id],
    );
    const maxOrder = Number(orders[0].max_order);
    if (maxOrder + 31 > 32767) throw new Error('Watch-history episode media fixture display-order capacity is unavailable.');
    const pageVideos = [];
    for (let index = 1; index <= 31; index += 1) {
      pageVideos.push(await addVideo('EPISODE', episode.id, 'FULL', maxOrder + index, 60000 + index));
    }
    const previewOrders = await db.execute(
      "SELECT COALESCE(MAX(display_order), 0) AS max_order FROM content_videos WHERE content_type = 'DRAMA' AND content_id = ? AND kind = 'PREVIEW'",
      [drama.id],
    );
    const preview = await addVideo('DRAMA', drama.id, 'PREVIEW', Number(previewOrders[0][0].max_order) + 1, 30000);
    const alternate = await addVideo('EPISODE', episode.id, 'FULL', maxOrder + 32, 90000);
    const paidEpisode = await addEpisode(drama.id, { number: 3, price: 10 });
    const paidVideo = await addVideo('EPISODE', paidEpisode.id, 'FULL', 1, 120000);

    const hiddenDrama = await addDrama({ title: 'API hidden watch-history fixture', status: 'HIDDEN', publishedAt: new Date() });
    const hiddenPreview = await addVideo('DRAMA', hiddenDrama.id, 'PREVIEW', 1);
    const futureDrama = await addDrama({ title: 'API future watch-history fixture', publishedAt: new Date(Date.now() + 86400000) });
    const futurePreview = await addVideo('DRAMA', futureDrama.id, 'PREVIEW', 1);
    const hiddenEpisode = await addEpisode(drama.id, { number: 2, status: 'HIDDEN' });
    const hiddenFull = await addVideo('EPISODE', hiddenEpisode.id, 'FULL', 1);
    const wrongKind = await addVideo('DRAMA', drama.id, 'FULL', 1);
    const noImageDrama = await addDrama({ title: 'API no-image watch-history fixture', imageKinds: [] });
    const noImagePreview = await addVideo('DRAMA', noImageDrama.id, 'PREVIEW', 1);
    const posterDrama = await addDrama({ title: 'API poster-only watch-history fixture', imageKinds: ['POSTER'] });
    const posterPreview = await addVideo('DRAMA', posterDrama.id, 'PREVIEW', 1);

    return {
      drama,
      episode,
      pageVideos,
      preview,
      alternate,
      paidEpisode,
      paidVideo,
      hiddenPreview,
      futurePreview,
      hiddenFull,
      wrongKind,
      noImagePreview,
      posterPreview,
      owned,
      async cleanup() {
        if (cleaned) return;
        await cleanupWatchHistoryFixtures(db, owned);
        cleaned = true;
      },
    };
  } catch (error) {
    try { await cleanupWatchHistoryFixtures(db, owned); }
    catch (cleanupError) { throw new AggregateError([error, cleanupError], 'Watch-history fixture setup and cleanup failed.'); }
    throw error;
  }
}
