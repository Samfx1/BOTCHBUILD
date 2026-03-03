const { z } = require("zod");
const {
  createProjectSchema,
  createProjectUpdateSchema,
  listProjectsQuerySchema,
  projectIdParamSchema,
} = require("./projects.validation");

const listUpdatesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

function createProjectsController({ projectsService }) {
  async function listProjects(req, res) {
    const query = listProjectsQuerySchema.parse(req.query);
    const projects = await projectsService.listProjects(query);
    return res.status(200).json({ projects });
  }

  async function getProjectById(req, res) {
    const params = projectIdParamSchema.parse(req.params);
    const project = await projectsService.getProjectById(params.projectId);
    return res.status(200).json(project);
  }

  async function createProject(req, res) {
    const input = createProjectSchema.parse(req.body);
    const project = await projectsService.createProject({
      actor: {
        id: req.auth.sub,
        role: req.auth.role,
      },
      input,
    });
    return res.status(201).json(project);
  }

  async function listProjectUpdates(req, res) {
    const params = projectIdParamSchema.parse(req.params);
    const query = listUpdatesQuerySchema.parse(req.query);
    const updates = await projectsService.listProjectUpdates(params.projectId, query);
    return res.status(200).json({ updates });
  }

  async function createProjectUpdate(req, res) {
    const params = projectIdParamSchema.parse(req.params);
    const input = createProjectUpdateSchema.parse(req.body);
    const update = await projectsService.createProjectUpdate({
      actor: {
        id: req.auth.sub,
        role: req.auth.role,
      },
      projectId: params.projectId,
      input,
    });
    return res.status(201).json(update);
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
  createProjectsController,
};
