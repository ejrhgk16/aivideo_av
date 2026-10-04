import { Check, Column, Entity, PrimaryColumn, Unique } from 'typeorm';

import { AuditedEntity } from '../../shared/entities/auditedEntity.entity.js';

@Entity({ name: 'collection_dramas' })
@Unique('UQ_collection_dramas_collection_id_display_order', [
  'collectionId',
  'displayOrder',
])
@Check('CHK_collection_dramas_display_order', 'display_order > 0')
export class CollectionDrama extends AuditedEntity {
  @PrimaryColumn({ name: 'collection_id', type: 'char', length: 36 })
  collectionId!: string;

  @PrimaryColumn({ name: 'drama_id', type: 'char', length: 36 })
  dramaId!: string;

  @Column({ name: 'display_order', type: 'smallint' })
  displayOrder!: number;

  @Column({ name: 'starts_at', type: 'datetime', precision: 3, nullable: true })
  startsAt!: Date | null;

  // ends_at > starts_at is validated by the service contract.
  @Column({ name: 'ends_at', type: 'datetime', precision: 3, nullable: true })
  endsAt!: Date | null;
}
