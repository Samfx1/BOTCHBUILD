const { HttpError } = require("../../utils/httpError");

function toInvestment(investment) {
  return {
    id: investment.id,
    projectId: investment.project_id,
    investorUserId: investment.investor_user_id,
    amount: Number(investment.amount),
    currency: investment.currency,
    status: investment.status,
    projectTitle: investment.project_title,
    projectStatus: investment.project_status,
    createdAt: investment.created_at,
    updatedAt: investment.updated_at,
  };
}

function createInvestmentsService({
  investmentsRepository,
  projectsRepository,
  notificationsService,
  cacheManager,
}) {
  function invalidateProjectCaches(projectId) {
    cacheManager?.invalidateByPrefix("projects:list:");
    if (projectId) {
      cacheManager?.delete(`projects:detail:${projectId}`);
      cacheManager?.invalidateByPrefix(`projects:updates:${projectId}:`);
    }
  }

  async function createInvestment({ actor, input }) {
    if (!["investor", "admin"].includes(actor.role)) {
      throw new HttpError(403, "Only investors or admins can create investments.");
    }

    const project = await projectsRepository.findProjectById(input.projectId);
    if (!project) {
      throw new HttpError(404, "Project not found.");
    }

    if (project.status === "completed" || project.status === "paused") {
      throw new HttpError(
        400,
        "This project is not currently accepting new investments.",
      );
    }

    const created = await investmentsRepository.createInvestment({
      projectId: input.projectId,
      investorUserId: actor.id,
      amount: input.amount,
      currency: input.currency,
    });

    invalidateProjectCaches(input.projectId);

    if (notificationsService) {
      if (notificationsService.createBulkSystemNotifications) {
        await notificationsService.createBulkSystemNotifications({
          recipientUserIds: [actor.id, project.owner_user_id],
          channel: "email",
          title: "Investment update",
          body: `A new investment commitment was recorded for "${project.title}".`,
          metadata: {
            projectId: project.id,
            investmentId: created.id,
          },
        });
      } else {
        await Promise.all([
          notificationsService.createSystemNotification({
            recipientUserId: actor.id,
            channel: "email",
            title: "Investment created",
            body: `Your investment in "${project.title}" is pending payment.`,
            metadata: {
              projectId: project.id,
              investmentId: created.id,
            },
          }),
          notificationsService.createSystemNotification({
            recipientUserId: project.owner_user_id,
            channel: "email",
            title: "New investor commitment",
            body: `A new investment commitment was submitted for "${project.title}".`,
            metadata: {
              projectId: project.id,
              investmentId: created.id,
            },
          }),
        ]);
      }
    }

    return toInvestment({
      ...created,
      project_title: project.title,
      project_status: project.status,
    });
  }

  async function listMyInvestments({ actor, query }) {
    const rows = await investmentsRepository.listInvestmentsForUser(actor.id, query);
    return rows.map(toInvestment);
  }

  async function getInvestmentByIdForActor({ actor, investmentId }) {
    const investment = await investmentsRepository.findInvestmentById(investmentId);
    if (!investment) {
      throw new HttpError(404, "Investment not found.");
    }

    const isOwner = investment.investor_user_id === actor.id;
    const isAdmin = actor.role === "admin";
    if (!isOwner && !isAdmin) {
      throw new HttpError(403, "You do not have access to this investment.");
    }

    return toInvestment(investment);
  }

  return {
    createInvestment,
    listMyInvestments,
    getInvestmentByIdForActor,
  };
}

module.exports = {
  createInvestmentsService,
};
