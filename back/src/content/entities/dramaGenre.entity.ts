import { Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'drama_genres' })
@Index('idx_drama_genres_drama_id', ['dramaId'])
@Index('idx_drama_genres_genre_id', ['genreId'])
export class DramaGenre {
  @PrimaryColumn({ name: 'drama_id', type: 'int', unsigned: true })
  dramaId!: number;

  @PrimaryColumn({ name: 'genre_id', type: 'smallint' })
  genreId!: number;
}
