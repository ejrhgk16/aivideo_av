import { Check, Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'user_saved_videos' })
@Index('IDX_user_saved_videos_user_id_saved_at', ['userId', 'savedAt'])
@Check('CHK_user_saved_videos_content_type', "content_type IN ('EPISODE','PREVIEW')")
export class UserSavedVideo {
  @PrimaryColumn({ name: 'user_id', type: 'int', unsigned: true })
  userId!: number;

  @PrimaryColumn({ name: 'video_id', type: 'int', unsigned: true })
  videoId!: number;

  @Column({ name: 'content_type', type: 'varchar', length: 16 })
  contentType!: 'EPISODE' | 'PREVIEW';

  @Column({ name: 'saved_at', type: 'datetime', precision: 3, default: () => 'CURRENT_TIMESTAMP(3)' })
  savedAt!: Date;
}
