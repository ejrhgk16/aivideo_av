import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'user_saved_dramas' })
@Index('IDX_user_saved_dramas_user_id_saved_at', ['userId', 'savedAt'])
export class UserSavedDrama {
  @PrimaryColumn({ name: 'user_id', type: 'int', unsigned: true })
  userId!: number;

  @PrimaryColumn({ name: 'drama_id', type: 'int', unsigned: true })
  dramaId!: number;

  @Column({
    name: 'saved_at',
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  savedAt!: Date;
}
