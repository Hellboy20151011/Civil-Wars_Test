import pool from '../database/db.js';

export async function findAllProjects(client = pool) {
    const result = await client.query(
        `SELECT id,
                code,
                name,
                description,
                required_research_lab_level,
                required_project_id,
                money_cost,
                steel_cost,
                fuel_cost,
                duration_ticks,
                unlock_category,
                unlock_level
         FROM research_projects
         ORDER BY unlock_category, unlock_level, id`
    );

    return result.rows;
}

export async function findProjectById(projectId, client = pool) {
    const result = await client.query(
        `SELECT id,
                code,
                name,
                description,
                required_research_lab_level,
                required_project_id,
                money_cost,
                steel_cost,
                fuel_cost,
                duration_ticks,
                unlock_category,
                unlock_level
         FROM research_projects
         WHERE id = $1`,
        [projectId]
    );

    return result.rows[0] ?? null;
}

export async function findUserResearches(userId, client = pool) {
    const result = await client.query(
        `SELECT ur.id,
                ur.user_id,
                ur.project_id,
                ur.status,
                ur.started_at,
                ur.ends_at,
                ur.completed_at,
                rp.code,
                rp.name,
                rp.unlock_category,
                rp.unlock_level
         FROM user_researches ur
         JOIN research_projects rp ON rp.id = ur.project_id
         WHERE ur.user_id = $1
         ORDER BY ur.started_at DESC`,
        [userId]
    );

    return result.rows;
}

export async function findUserResearchByProject(userId, projectId, client = pool) {
    const result = await client.query(
        `SELECT id,
                user_id,
                project_id,
                status,
                started_at,
                ends_at,
                completed_at
         FROM user_researches
         WHERE user_id = $1 AND project_id = $2`,
        [userId, projectId]
    );

    return result.rows[0] ?? null;
}

export async function findActiveResearch(userId, client = pool) {
    const result = await client.query(
        `SELECT ur.id,
                ur.user_id,
                ur.project_id,
                ur.status,
                ur.started_at,
                ur.ends_at,
                rp.name
         FROM user_researches ur
         JOIN research_projects rp ON rp.id = ur.project_id
         WHERE ur.user_id = $1 AND ur.status = 'in_progress'
         ORDER BY ur.started_at ASC
         LIMIT 1`,
        [userId]
    );

    return result.rows[0] ?? null;
}

export async function createUserResearch(userId, projectId, endsAt, client = pool) {
    const result = await client.query(
        `INSERT INTO user_researches (user_id, project_id, status, started_at, ends_at, updated_at)
         VALUES ($1, $2, 'in_progress', NOW(), $3, NOW())
         RETURNING id, user_id, project_id, status, started_at, ends_at, completed_at`,
        [userId, projectId, endsAt]
    );

    return result.rows[0] ?? null;
}

export async function markDueResearchCompleted(userId, client = pool) {
    const result = await client.query(
        `UPDATE user_researches
         SET status = 'completed',
             completed_at = NOW(),
             updated_at = NOW()
         WHERE user_id = $1
           AND status = 'in_progress'
           AND ends_at <= NOW()
         RETURNING id`,
        [userId]
    );

    return result.rows.length;
}

export async function findDefenseResearchLevel(userId, client = pool) {
    const result = await client.query(
        `SELECT COALESCE(MAX(rp.unlock_level), 0) AS level
         FROM user_researches ur
         JOIN research_projects rp ON rp.id = ur.project_id
         WHERE ur.user_id = $1
           AND ur.status = 'completed'
           AND rp.unlock_category = 'defense'`,
        [userId]
    );

    return Number(result.rows[0]?.level ?? 0);
}
