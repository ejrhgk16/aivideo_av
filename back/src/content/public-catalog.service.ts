import { NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Drama } from './entities/drama.entity.js';
import { DramaGenre } from './entities/dramaGenre.entity.js';
import { ContentImage } from './entities/contentImage.entity.js';
import { ContentVideo } from './entities/contentVideo.entity.js';
import { Episode } from './entities/episode.entity.js';
import { Genre } from './entities/genre.entity.js';
import { ProductionCompany } from './entities/productionCompany.entity.js';
import { createDramaImageUrls } from './media-url.js';

const PUBLIC_STATUS = 'PUBLISHED';

export type DramaSummary = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  productionCompany: string | null;
  genres: Array<{ id: number; code: string; name: string }>;
  images: {
    poster: string | null;
    posterLandscape: string | null;
    homeHero: string | null;
    detailCover: string | null;
    campaigns: string[];
  };
  imageUrls: ReturnType<typeof createDramaImageUrls>;
  previewVideos: Array<{ storageKey: string; durationMs: number }>;
  episodeCount: number;
  freeEpisodeCount: number;
};

export type GenreSummary = Pick<Genre, 'id' | 'code' | 'name'> & { tileImage: string | null };

export type DramaDetail = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  synopsis: string;
  productionCompany: string | null;
  genres: Array<{ id: number; code: string; name: string }>;
  images: {
    poster: string | null;
    posterLandscape: string | null;
    homeHero: string | null;
    detailCover: string | null;
    campaigns: string[];
  };
  imageUrls: ReturnType<typeof createDramaImageUrls>;
  previewVideos: Array<{ storageKey: string; durationMs: number }>;
  episodes: Array<{
    id: string;
    episodeNumber: number;
    title: string | null;
    synopsis: string | null;
    durationMs: number;
    pricePoints: number;
    image: string | null;
  }>;
};

function mapImages(images: ContentImage[]) {
  const sorted = [...images].sort((left, right) => left.displayOrder - right.displayOrder);
  const firstOfKind = (kind: string) => sorted.find((image) => image.kind === kind)?.storageKey ?? null;

  const imageKeys = {
    poster: firstOfKind('POSTER'),
    posterLandscape: firstOfKind('POSTER_LANDSCAPE'),
    homeHero: firstOfKind('HOME_HERO'),
    detailCover: firstOfKind('DETAIL_COVER'),
    campaigns: sorted.filter((image) => image.kind === 'CAMPAIGN').map((image) => image.storageKey),
  };
  return imageKeys;
}

function mapPreviewVideos(videos: ContentVideo[]) {
  return [...videos]
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .map(({ storageKey, durationMs }) => ({ storageKey, durationMs }));
}

export class PublicCatalogService {
  constructor(
    @InjectRepository(Drama)
    private readonly dramaRepository: Repository<Drama>,
    @InjectRepository(ProductionCompany)
    private readonly productionCompanyRepository: Repository<ProductionCompany>,
    @InjectRepository(DramaGenre)
    private readonly dramaGenreRepository: Repository<DramaGenre>,
    @InjectRepository(Genre)
    private readonly genreRepository: Repository<Genre>,
    @InjectRepository(ContentImage)
    private readonly contentImageRepository: Repository<ContentImage>,
    @InjectRepository(ContentVideo)
    private readonly contentVideoRepository: Repository<ContentVideo>,
    @InjectRepository(Episode)
    private readonly episodeRepository: Repository<Episode>,
  ) {}

  async listDramas(sort: 'latest' = 'latest', now = new Date()): Promise<DramaSummary[]> {
    if (sort !== 'latest') {
      return [];
    }

    const dramas = await this.dramaRepository
      .createQueryBuilder('drama')
      .where('drama.status = :status', { status: PUBLIC_STATUS })
      .andWhere('drama.publishedAt <= :now', { now })
      .orderBy('drama.publishedAt', 'DESC')
      .getMany();

    if (dramas.length === 0) {
      return [];
    }

    const dramaIds = dramas.map((drama) => drama.id);
    const [companies, dramaGenres, genres, images, videos, episodes] = await Promise.all([
      this.productionCompanyRepository.findBy({ id: In(dramas.map((drama) => drama.productionCompanyId)) }),
      this.dramaGenreRepository.findBy({ dramaId: In(dramaIds) }),
      this.genreRepository.find({ order: { displayOrder: 'ASC' } }),
      this.contentImageRepository.findBy({ contentType: 'DRAMA', contentId: In(dramaIds) }),
      this.contentVideoRepository.findBy({ contentType: 'DRAMA', contentId: In(dramaIds), kind: 'PREVIEW' }),
      this.episodeRepository.findBy({ dramaId: In(dramaIds) }),
    ]);

    const companiesById = new Map(companies.map((company) => [company.id, company.name]));
    const genresById = new Map(genres.map((genre) => [genre.id, genre]));
    const genreLinksByDrama = new Map<string, DramaGenre[]>();
    for (const link of dramaGenres) {
      const links = genreLinksByDrama.get(link.dramaId) ?? [];
      links.push(link);
      genreLinksByDrama.set(link.dramaId, links);
    }
    const imagesByDrama = new Map<string, ContentImage[]>();
    for (const image of images) {
      const dramaImages = imagesByDrama.get(image.contentId) ?? [];
      dramaImages.push(image);
      imagesByDrama.set(image.contentId, dramaImages);
    }
    const videosByDrama = new Map<string, ContentVideo[]>();
    for (const video of videos) {
      const dramaVideos = videosByDrama.get(video.contentId) ?? [];
      dramaVideos.push(video);
      videosByDrama.set(video.contentId, dramaVideos);
    }
    const episodesByDrama = new Map<string, Episode[]>();
    for (const episode of episodes) {
      if (episode.status !== PUBLIC_STATUS || episode.publishedAt === null || episode.publishedAt > now) {
        continue;
      }
      const dramaEpisodes = episodesByDrama.get(episode.dramaId) ?? [];
      dramaEpisodes.push(episode);
      episodesByDrama.set(episode.dramaId, dramaEpisodes);
    }

    return dramas.map((drama) => {
      const dramaImages = imagesByDrama.get(drama.id) ?? [];
      const dramaVideos = videosByDrama.get(drama.id) ?? [];
      const dramaEpisodes = episodesByDrama.get(drama.id) ?? [];
      const dramaGenresForDrama = genreLinksByDrama.get(drama.id) ?? [];
      const dramaImagesForResponse = mapImages(dramaImages);

      return {
        id: drama.id,
        slug: drama.publicSlug,
        title: drama.title,
        shortDescription: drama.shortDescription,
        productionCompany: companiesById.get(drama.productionCompanyId) ?? null,
        genres: dramaGenresForDrama
          .map((link) => genresById.get(link.genreId))
          .filter((genre): genre is Genre => genre !== undefined)
          .map(({ id, code, name }) => ({ id, code, name })),
        images: dramaImagesForResponse,
        imageUrls: createDramaImageUrls(dramaImagesForResponse),
        previewVideos: mapPreviewVideos(dramaVideos),
        episodeCount: dramaEpisodes.length,
        freeEpisodeCount: dramaEpisodes.filter((episode) => episode.pricePoints === 0).length,
      };
    });
  }

  async getDrama(dramaId: string, now = new Date()): Promise<DramaDetail> {
    const drama = await this.dramaRepository.findOne({
      where: { id: dramaId, status: PUBLIC_STATUS },
    });

    if (
      !drama ||
      drama.status !== PUBLIC_STATUS ||
      drama.publishedAt === null ||
      drama.publishedAt > now
    ) {
      throw new NotFoundException(`Drama '${dramaId}' was not found`);
    }

    const [company, dramaGenres, genres, images, videos, episodes] = await Promise.all([
      this.productionCompanyRepository.findOne({ where: { id: drama.productionCompanyId } }),
      this.dramaGenreRepository.findBy({ dramaId: drama.id }),
      this.genreRepository.find({ order: { displayOrder: 'ASC' } }),
      this.contentImageRepository.findBy({ contentType: 'DRAMA', contentId: drama.id }),
      this.contentVideoRepository.findBy({ contentType: 'DRAMA', contentId: drama.id, kind: 'PREVIEW' }),
      this.episodeRepository.findBy({ dramaId: drama.id }),
    ]);

    const genresById = new Map(genres.map((genre) => [genre.id, genre]));
    const publicEpisodes = episodes
      .filter(
        (episode) =>
          episode.status === PUBLIC_STATUS &&
          episode.publishedAt !== null &&
          episode.publishedAt <= now,
      )
      .sort((left, right) => left.episodeNumber - right.episodeNumber);
    const episodeImages = publicEpisodes.length === 0
      ? []
      : await this.contentImageRepository.findBy({
        contentType: 'EPISODE',
        contentId: In(publicEpisodes.map((episode) => episode.id)),
        kind: 'EPISODE_COVER',
      });
    const episodeImagesById = new Map(episodeImages.map((image) => [image.contentId, image.storageKey]));

    const dramaImages = mapImages(images);
    return {
      id: drama.id,
      slug: drama.publicSlug,
      title: drama.title,
      shortDescription: drama.shortDescription,
      synopsis: drama.synopsis,
      productionCompany: company?.name ?? null,
      genres: dramaGenres
        .map((link) => genresById.get(link.genreId))
        .filter((genre): genre is Genre => genre !== undefined)
        .map(({ id, code, name }) => ({ id, code, name })),
      images: dramaImages,
      imageUrls: createDramaImageUrls(dramaImages),
      previewVideos: mapPreviewVideos(videos),
      episodes: publicEpisodes.map(
        ({ id, episodeNumber, title, synopsis, durationMs, pricePoints }) => ({
          id,
          episodeNumber,
          title,
          synopsis,
          durationMs,
          pricePoints,
          image: episodeImagesById.get(id) ?? null,
        }),
      ),
    };
  }

  async listGenres(): Promise<GenreSummary[]> {
    const genres = await this.genreRepository.find({ order: { displayOrder: 'ASC' } });
    const tileImages = await this.contentImageRepository.findBy({
      contentType: 'GENRE',
      kind: 'GENRE_TILE',
    });
    const tileImagesByGenre = new Map(tileImages.map((image) => [image.contentId, image.storageKey]));
    return genres.map(({ id, code, name }) => ({
      id,
      code,
      name,
      tileImage: tileImagesByGenre.get(String(id)) ?? null,
    }));
  }
}
