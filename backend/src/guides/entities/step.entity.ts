import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Guide } from './guide.entity';

@Entity('steps')
export class Step {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  guideId: string;

  @ManyToOne(() => Guide, (guide) => guide.steps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'guideId' })
  guide: Guide;

  @Column()
  stepIndex: number;

  @Column({ type: 'text' })
  description: string;

  @Column({ nullable: true })
  screenshotUri: string;

  @Column({ type: 'jsonb' })
  domEvent: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  redactionMetadata: {
    blurredRegions: Array<{ x: number; y: number; width: number; height: number }>;
    detectedPII: Array<{ type: string; value: string; confidence: number }>;
  };

  @Column({ type: 'bigint' })
  timestamp: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}




