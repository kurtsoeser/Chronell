/** Coverage-Schwellen fuer DB-Repos — docs/plans/phase-3-5-deepening.md */

export const P0_TARGETS = [
  { file: 'src/main/db/rules-repo.ts', minStatements: 60 },
  { file: 'src/main/db/messages-repo-list.ts', minStatements: 50 },
  { file: 'src/main/db/meta-folders-repo.ts', minStatements: 50 }
]

export const P1_TARGETS = [
  { file: 'src/main/db/folders-repo.ts', minStatements: 40 },
  { file: 'src/main/db/calendar-events-repo.ts', minStatements: 45 }
]

export const REPO_COVERAGE_TIERS = {
  p0: P0_TARGETS,
  p1: P1_TARGETS,
  all: [...P0_TARGETS, ...P1_TARGETS]
}
