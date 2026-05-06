import { config } from '../config.js';
import * as researchRepo from '../repositories/research.repository.js';
import * as buildingRepo from '../repositories/building.repository.js';
import { withTransaction } from '../repositories/transaction.repository.js';
import { hasEnoughResources, deductResources } from './buildings.service.js';
import { createServiceError } from './service-error.js';

const TICK_MS = config.gameloop.tickIntervalMs;

function getResearchLabLevel(buildings) {
    for (let level = 3; level >= 1; level -= 1) {
        const name = `Forschungslabor Level ${level}`;
        const found = buildings.find((entry) => entry.name === name);
        if (Number(found?.anzahl ?? 0) > 0) return level;
    }
    return 0;
}

function buildProjectStatus(project, userResearches, activeResearch, researchLabLevel) {
    const myResearch = userResearches.find((entry) => Number(entry.project_id) === Number(project.id));
    const isCompleted = myResearch?.status === 'completed';
    const isInProgress = myResearch?.status === 'in_progress';

    if (isCompleted) {
        return {
            status: 'completed',
            canStart: false,
            lockReason: null,
            startedAt: myResearch.started_at,
            endsAt: myResearch.ends_at,
            completedAt: myResearch.completed_at,
        };
    }

    if (isInProgress) {
        return {
            status: 'in_progress',
            canStart: false,
            lockReason: null,
            startedAt: myResearch.started_at,
            endsAt: myResearch.ends_at,
            completedAt: myResearch.completed_at,
        };
    }

    if (researchLabLevel < Number(project.required_research_lab_level)) {
        return {
            status: 'locked',
            canStart: false,
            lockReason: `Forschungslabor Level ${project.required_research_lab_level} erforderlich`,
            startedAt: null,
            endsAt: null,
            completedAt: null,
        };
    }

    if (project.required_project_id) {
        const prerequisite = userResearches.find(
            (entry) => Number(entry.project_id) === Number(project.required_project_id)
        );
        if (prerequisite?.status !== 'completed') {
            return {
                status: 'locked',
                canStart: false,
                lockReason: 'Vorherige Forschung noch nicht abgeschlossen',
                startedAt: null,
                endsAt: null,
                completedAt: null,
            };
        }
    }

    if (activeResearch) {
        return {
            status: 'locked',
            canStart: false,
            lockReason: 'Es laeuft bereits eine Forschung',
            startedAt: null,
            endsAt: null,
            completedAt: null,
        };
    }

    return {
        status: 'available',
        canStart: true,
        lockReason: null,
        startedAt: null,
        endsAt: null,
        completedAt: null,
    };
}

export async function getDefenseResearchLevel(userId, client) {
    if (client) {
        await researchRepo.markDueResearchCompleted(userId, client);
        return researchRepo.findDefenseResearchLevel(userId, client);
    }

    return withTransaction(async (trx) => {
        await researchRepo.markDueResearchCompleted(userId, trx);
        return researchRepo.findDefenseResearchLevel(userId, trx);
    });
}

export async function getOverview(userId) {
    return withTransaction(async (client) => {
        await researchRepo.markDueResearchCompleted(userId, client);

        const [projects, userResearches, activeResearch, buildings, defenseResearchLevel] = await Promise.all([
            researchRepo.findAllProjects(client),
            researchRepo.findUserResearches(userId, client),
            researchRepo.findActiveResearch(userId, client),
            buildingRepo.findBuildingsByUser(userId, client),
            researchRepo.findDefenseResearchLevel(userId, client),
        ]);

        const researchLabLevel = getResearchLabLevel(buildings);

        const projectViews = projects.map((project) => {
            const statusMeta = buildProjectStatus(project, userResearches, activeResearch, researchLabLevel);

            return {
                id: project.id,
                code: project.code,
                name: project.name,
                description: project.description,
                requiredResearchLabLevel: Number(project.required_research_lab_level),
                requiredProjectId: project.required_project_id,
                costs: {
                    money: Number(project.money_cost),
                    steel: Number(project.steel_cost),
                    fuel: Number(project.fuel_cost),
                },
                durationTicks: Number(project.duration_ticks),
                unlockCategory: project.unlock_category,
                unlockLevel: Number(project.unlock_level),
                ...statusMeta,
            };
        });

        return {
            researchLabLevel,
            defenseResearchLevel,
            activeResearch: activeResearch
                ? {
                    projectId: activeResearch.project_id,
                    name: activeResearch.name,
                    startedAt: activeResearch.started_at,
                    endsAt: activeResearch.ends_at,
                }
                : null,
            projects: projectViews,
        };
    });
}

export async function startResearch(userId, projectId) {
    return withTransaction(async (client) => {
        await researchRepo.markDueResearchCompleted(userId, client);

        const project = await researchRepo.findProjectById(projectId, client);
        if (!project) {
            throw createServiceError('Forschungsprojekt nicht gefunden', 404, 'RESEARCH_PROJECT_NOT_FOUND');
        }

        const existing = await researchRepo.findUserResearchByProject(userId, projectId, client);
        if (existing?.status === 'completed') {
            throw createServiceError('Forschung bereits abgeschlossen', 400, 'RESEARCH_ALREADY_COMPLETED');
        }
        if (existing?.status === 'in_progress') {
            throw createServiceError('Forschung laeuft bereits', 400, 'RESEARCH_ALREADY_IN_PROGRESS');
        }

        const activeResearch = await researchRepo.findActiveResearch(userId, client);
        if (activeResearch) {
            throw createServiceError('Es laeuft bereits eine andere Forschung', 400, 'RESEARCH_QUEUE_BUSY');
        }

        if (project.required_project_id) {
            const prerequisite = await researchRepo.findUserResearchByProject(
                userId,
                project.required_project_id,
                client
            );
            if (prerequisite?.status !== 'completed') {
                throw createServiceError('Vorherige Forschung noch nicht abgeschlossen', 400, 'RESEARCH_PREREQUISITE_MISSING');
            }
        }

        const buildings = await buildingRepo.findBuildingsByUser(userId, client);
        const researchLabLevel = getResearchLabLevel(buildings);
        if (researchLabLevel < Number(project.required_research_lab_level)) {
            throw createServiceError(
                `Forschungslabor Level ${project.required_research_lab_level} erforderlich`,
                400,
                'RESEARCH_LAB_REQUIRED'
            );
        }

        const costs = {
            money: Number(project.money_cost),
            stone: 0,
            steel: Number(project.steel_cost),
            fuel: Number(project.fuel_cost),
        };

        const hasResources = await hasEnoughResources(userId, costs, client);
        if (!hasResources) {
            throw createServiceError('Nicht genug Ressourcen fuer die Forschung', 400, 'INSUFFICIENT_RESOURCES');
        }

        await deductResources(userId, costs, client);

        const durationMs = Math.max(0, Math.round(Number(project.duration_ticks) * TICK_MS));
        const endsAt = new Date(Date.now() + durationMs);

        const created = await researchRepo.createUserResearch(userId, project.id, endsAt, client);

        return {
            success: true,
            project: {
                id: project.id,
                code: project.code,
                name: project.name,
            },
            research: created,
        };
    });
}
