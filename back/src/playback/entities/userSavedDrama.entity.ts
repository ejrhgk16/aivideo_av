import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'user_saved_dramas' })
@Index('IDX_user_saved_dramas_user_id_saved_at', ['userId', 'savedAt'])
export class UserSavedDrama {
  @PrimaryColumn({ name: 'user_id', type: 'char', length: 36 })
  userId!: string;

  @PrimaryColumn({ name: 'drama_id', type: 'char', length: 36 })
  dramaId!: string;

  @Column({
    name: 'saved_at',
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  savedAt!: Date;
}
