import { Column, Entity, PrimaryColumn, Unique } from 'typeorm';

@Entity({ name: 'genres' })
@Unique('uq_genres_code', ['code'])
@Unique('uq_genres_name', ['name'])
export class Genre {
  @PrimaryColumn({ type: 'smallint' })
  id!: number;

  @Column({ type: 'varchar', length: 30 })
  code!: string;

  @Column({ type: 'varchar', length: 30 })
  name!: string;

  @Column({ name: 'display_order', type: 'smallint' })
  displayOrder!: number;
}
