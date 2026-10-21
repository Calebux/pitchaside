import { Controller, Get, UseGuards } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { schemaDrift } from '../database/schema-drift';

/**
 * For organisers to open when something won't load: what the code expects that the database
 * lacks (table and column names only, no data). Empty lists mean the database matches.
 */
@UseGuards(JwtAuthGuard)
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get('schema')
  async schema() {
    const drift = await schemaDrift(this.dataSource);
    const ok = !drift.missingTables.length && !drift.missingColumns.length && !drift.missingEnumValues.length;
    return { ok, ...drift };
  }
}

/** When this server started, so "which version is live?" has an answer. */
const STARTED_AT = new Date().toISOString();

/**
 * Which version of the API is live: the commit it was built from (Railway sets
 * RAILWAY_GIT_COMMIT_SHA on GitHub deploys) and when it started. Public, nothing private.
 */
@Controller('version')
export class VersionController {
  @Get()
  version() {
    const commit = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT || null;
    return { commit: commit ? commit.slice(0, 7) : null, branch: process.env.RAILWAY_GIT_BRANCH || null, startedAt: STARTED_AT };
  }
}
