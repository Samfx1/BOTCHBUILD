const { HttpError } = require("../../utils/httpError");

function toProject(project) {
  return {
    id: project.id,
    ownerUserId: project.owner_user_id,
    ownerName: project.owner_name,
    title: project.title,
    description: project.description,
    location: project.location,
    totalBudget: Number(project.total_budget),
    fundedAmount: Number(project.funded_amount ?? 0),
    targetCompletionDate: project.target_completion_date,
    status: project.status,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
  };
}

function toProjectUpdate(update) {
  return {
    id: update.id,
    projectId: update.project_id,
    uploadedBy: update.uploaded_by,
    uploadedByName: update.uploaded_by_name,
    mediaType: update.media_type,
    mediaUrl: update.media_url,
    caption: update.caption,
    capturedAt: update.captured_at,
    createdAt: update.created_at,
  };
}

function createProjectsService({
  projectsRepository,
  investmentsRepository,
  notificationsService,
}) {
  async function listProjects(query) {
    const projects = await projectsRepository.listProjects(query);
    return projects.map(toProject);
  }

  async function getProjectById(projectId) {
    const project = await projectsRepository.findProjectById(projectId);
    if (!project) {
      throw new HttpError(404, "Project not found.");
    }

    return toProject(project);
  }

  async function createProject({ actor, input }) {
    if (!["developer", "admin"].includes(actor.role)) {
      throw new HttpError(403, "Only developers or admins can create projects.");
    }

    const created = await projectsRepository.createProject({
      ownerUserId: actor.id,
      ...input,
    });

    return toProject({
      ...created,
      owner_name: actor.fullName ?? null,
      funded_amount: 0,
    });
  }

  async function listProjectUpdates(projectId, { limit }) {
    const project = await projectsRepository.findProjectById(projectId);
    if (!project) {
      throw new HttpError(404, "Project not found.");
    }

    const updates = await projectsRepository.listProjectUpdates(projectId, {
      limit,
    });

    return updates.map(toProjectUpdate);
  }

  async function createProjectUpdate({ actor, projectId, input }) {
    const project = await projectsRepository.findProjectById(projectId);
    if (!project) {
      throw new HttpError(404, "Project not found.");
    }

    const isAdmin = actor.role === "admin";
    const isOwner = actor.id === project.owner_user_id;
    if (!isAdmin && !isOwner) {
      throw new HttpError(
        403,
        "Only the project owner or an admin can publish media updates.",
      );
    }

    const created = await projectsRepository.createProjectUpdate({
      projectId,
      uploadedBy: actor.id,
      ...input,
    });

    // Notify project investors that a new media update exists.
    if (investmentsRepository?.listInvestorIdsByProject && notificationsService) {
      const investorIds = await investmentsRepository.listInvestorIdsByProject(projectId);
      await Promise.all(
        investorIds.map((investorId) =>
          notificationsService.createSystemNotification({
            recipientUserId: investorId,
            channel: "email",
            title: `Project update: ${project.title}`,
            body: `A new ${input.mediaType} update was posted for "${project.title}".`,
            metadata: {
              projectId,
              updateType: input.mediaType,
            },
          }),
        ),
      );
    }

    return toProjectUpdate({
      ...created,
      uploaded_by_name: actor.fullName ?? null,
    });
  }

  return {
    listProjects,
    getProjectById,
    createProject,
    listProjectUpdates,
    createProjectUpdate,
  };
}

module.exports = {
  createProjectsService,
};
