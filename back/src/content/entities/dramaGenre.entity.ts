import { Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'drama_genres' })
@Index('idx_drama_genres_drama_id', ['dramaId'])
@Index('idx_drama_genres_genre_id', ['genreId'])
export class DramaGenre {
  @PrimaryColumn({ name: 'drama_id', type: 'char', length: 36 })
  dramaId!: string;

  @PrimaryColumn({ name: 'genre_id', type: 'smallint' })
  genreId!: number;
}
