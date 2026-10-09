import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Drama } from './entities/drama.entity.js';
import { DramaGenre } from './entities/dramaGenre.entity.js';
import { DramaImage } from './entities/dramaImage.entity.js';
import { Episode } from './entities/episode.entity.js';
import { Genre } from './entities/genre.entity.js';
import { ProductionCompany } from './entities/productionCompany.entity.js';

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
    hero: string | null;
    thumbnail: string | null;
  };
  episodeCount: number;
  freeEpisodeCount: number;
};

export type GenreSummary = Pick<Genre, 'id' | 'code' | 'name'>;

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
    @InjectRepository(DramaImage)
    private readonly dramaImageRepository: Repository<DramaImage>,
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
    const [companies, dramaGenres, genres, images, episodes] = await Promise.all([
      this.productionCompanyRepository.findBy({ id: In(dramas.map((drama) => drama.productionCompanyId)) }),
      this.dramaGenreRepository.findBy({ dramaId: In(dramaIds) }),
      this.genreRepository.find({ order: { displayOrder: 'ASC' } }),
      this.dramaImageRepository.findBy({ dramaId: In(dramaIds) }),
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
    const imagesByDrama = new Map<string, DramaImage[]>();
    for (const image of images) {
      const dramaImages = imagesByDrama.get(image.dramaId) ?? [];
      dramaImages.push(image);
      imagesByDrama.set(image.dramaId, dramaImages);
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
      const imageByKind = new Map(dramaImages.map((image) => [image.kind, image.storageKey]));
      const dramaEpisodes = episodesByDrama.get(drama.id) ?? [];
      const dramaGenresForDrama = genreLinksByDrama.get(drama.id) ?? [];

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
        images: {
          poster: imageByKind.get('POSTER') ?? null,
          hero: imageByKind.get('HERO') ?? null,
          thumbnail: imageByKind.get('THUMBNAIL') ?? null,
        },
        episodeCount: dramaEpisodes.length,
        freeEpisodeCount: dramaEpisodes.filter((episode) => episode.pricePoints === 0).length,
      };
    });
  }

  async listGenres(): Promise<GenreSummary[]> {
    const genres = await this.genreRepository.find({ order: { displayOrder: 'ASC' } });
    return genres.map(({ id, code, name }) => ({ id, code, name }));
  }
}
