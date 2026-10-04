import { Check, Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'user_preview_feed_states' })
@Check('CHK_user_preview_feed_states_position_ms', 'position_ms >= 0')
export class UserPreviewFeedState {
  @PrimaryColumn({ name: 'user_id', type: 'char', length: 36 })
  userId!: string;

  @PrimaryColumn({ name: 'collection_id', type: 'char', length: 36 })
  collectionId!: string;

  // collection_id and drama_id consistency is validated by the service contract.
  @Column({ name: 'drama_id', type: 'char', length: 36 })
  dramaId!: string;

  @Column({ name: 'position_ms', type: 'int', default: 0 })
  positionMs!: number;

  @Column({
    name: 'updated_at',
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  updatedAt!: Date;
}
